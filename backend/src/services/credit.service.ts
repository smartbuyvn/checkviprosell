/**
 * Viprosell — Credit Service (v2)
 * Uses `credit_ledger` table exclusively.
 * NEVER mutates `users.credits` directly — that column does not exist in schema.
 * Credits deducted ONLY after confirmed successful render export.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const CreditService = {
  /** Get current balance by summing credit_ledger deltas for a user */
  async getBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('credit_ledger')
      .select('delta')
      .eq('user_id', userId);
    if (error) throw new Error(`BALANCE_READ_FAILED: ${error.message}`);
    return (data || []).reduce((sum, row) => sum + (row.delta || 0), 0);
  },

  /**
   * Deduct credits via credit_ledger insert.
   * MUST only be called after confirmed successful render export.
   * Idempotency enforced by caller (render callback checks status before calling).
   */
  async deductToLedger(
    userId: string,
    projectId: string,
    renderId: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; balance_after?: number; error?: string }> {
    console.log(`[Billing] Deducting ${amount} credits for user ${userId}, project ${projectId}`);

    const currentBalance = await CreditService.getBalance(userId);

    if (currentBalance < amount) {
      console.error(`[Billing] INSUFFICIENT_CREDITS: balance=${currentBalance}, needed=${amount}`);
      return { success: false, error: 'INSUFFICIENT_CREDITS' };
    }

    const balanceAfter = currentBalance - amount;

    const { error } = await supabase.from('credit_ledger').insert({
      user_id: userId,
      project_id: projectId,
      delta: -amount,
      reason,
      balance_after: balanceAfter,
    });

    if (error) {
      console.error('[Billing] Ledger insert failed', error);
      return { success: false, error: error.message };
    }

    // Log usage
    await supabase.from('usage_logs').insert({
      user_id: userId,
      project_id: projectId,
      step_name: 'render_credit_deduction',
      credits_used: amount,
      meta: { render_id: renderId, reason },
    });

    console.log(`[Billing] Deducted ${amount}. New balance: ${balanceAfter}`);
    return { success: true, balance_after: balanceAfter };
  },

  /**
   * Grant credits via credit_ledger (used by webhook on payment success).
   */
  async grantToLedger(
    userId: string,
    amount: number,
    reason: string,
    paymentId?: string
  ): Promise<{ success: boolean; balance_after?: number; error?: string }> {
    const currentBalance = await CreditService.getBalance(userId);
    const balanceAfter = currentBalance + amount;

    const { error } = await supabase.from('credit_ledger').insert({
      user_id: userId,
      payment_id: paymentId || null,
      delta: amount,
      reason,
      balance_after: balanceAfter,
    });

    if (error) return { success: false, error: error.message };
    console.log(`[Billing] Granted ${amount} credits to ${userId}. Balance: ${balanceAfter}`);
    return { success: true, balance_after: balanceAfter };
  },
};
