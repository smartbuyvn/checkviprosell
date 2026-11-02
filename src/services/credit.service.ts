/**
 * Viprosell — Credit Ledger Service (Real Supabase)
 *
 * Append-only ledger for tracking credit balance changes.
 * Every public method is wrapped in try/catch and ALWAYS returns
 * a valid fallback shape so the UI never hangs on an unresolved promise.
 *
 * Table: credit_ledger
 * Columns consumed: balance_after, created_at, project_id, *
 */

import { supabase } from '@/integrations/supabase/client';
import { currentUserId } from '@/lib/currentUser';

/* ──────────────────────── Types ──────────────────────── */

export interface CreditBalanceResult {
  balance: number;
  error: string | null;
}

export interface CreditLedgerResult {
  entries: any[];
  error: string | null;
}

/* ══════════════════════════════════════════════════════════════
   CreditService — Public API
   ══════════════════════════════════════════════════════════════ */

export const CreditService = {
  /**
   * getBalance()
   *
   * Returns the user's current credit balance by reading the most
   * recent `balance_after` value from the ledger.
   *
   * SECURITY NOTE (PGRST116):
   * When a user has zero transactions, `.single()` throws a
   * Supabase PostgREST error (code PGRST116 — "JSON object requested,
   * multiple (or no) rows returned"). We MUST catch this gracefully
   * and return `{ balance: 0 }` so the UI does not crash or spin.
   */
  async getBalance(): Promise<CreditBalanceResult> {
    try {
      // Phải lọc theo user_id, không trông vào RLS: tài khoản admin có chính sách
      // đọc được toàn bộ credit_ledger, nên truy vấn thiếu điều kiện này sẽ lấy
      // dòng mới nhất của MỘT KHÁCH BẤT KỲ và hiện ra như số dư của admin.
      const uid = await currentUserId();
      if (!uid) return { balance: 0, error: null };

      const { data, error } = await supabase
        .from('credit_ledger')
        .select('balance_after')
        .eq('user_id', uid as never)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('[CreditService] getBalance() — Supabase error:', error.message);
        return { balance: 0, error: null };
      }

      const row = data?.[0];
      return { balance: row?.balance_after ?? 0, error: null };
    } catch (err: any) {
      console.error('[CreditService] getBalance() — unexpected error:', err);
      return { balance: 0, error: null };
    }
  },

  /**
   * getLedger(limit)
   *
   * Returns the most recent `limit` entries from the credit ledger,
   * ordered newest-first. Falls back to an empty array on any error.
   */
  async getLedger(limit: number = 50): Promise<CreditLedgerResult> {
    try {
      const uid = await currentUserId();
      if (!uid) return { entries: [], error: null };

      const { data, error } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', uid as never)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[CreditService] getLedger() — Supabase error:', error.message);
        return { entries: [], error: error.message };
      }

      return { entries: data ?? [], error: null };
    } catch (err: any) {
      console.error('[CreditService] getLedger() — unexpected error:', err);
      return { entries: [], error: err.message || 'Unknown error' };
    }
  },

  /**
   * getLedgerByProject(projectId)
   *
   * Returns all credit ledger entries linked to a specific project,
   * ordered newest-first. Falls back to an empty array on any error.
   */
  async getLedgerByProject(projectId: string): Promise<CreditLedgerResult> {
    try {
      const { data, error } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[CreditService] getLedgerByProject() — Supabase error:', error.message);
        return { entries: [], error: error.message };
      }

      return { entries: data ?? [], error: null };
    } catch (err: any) {
      console.error('[CreditService] getLedgerByProject() — unexpected error:', err);
      return { entries: [], error: err.message || 'Unknown error' };
    }
  },
};
