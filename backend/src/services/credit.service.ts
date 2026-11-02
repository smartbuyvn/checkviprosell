/**
 * Viprosell — Credit Service (v2)
 * Uses `credit_ledger` table exclusively.
 * NEVER mutates `users.credits` directly — that column does not exist in schema.
 * Credits deducted ONLY after confirmed successful render export.
 */
import { createClient } from '@supabase/supabase-js';
import { thieuHamRpc } from '../lib/loi-rpc';

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

    const { data, error } = await supabase.rpc('tru_credit_render', {
      p_user: userId,
      p_project: projectId,
      p_render: renderId,
      p_so_credit: amount,
      p_ly_do: reason,
    });

    if (!error) {
      const dong = (Array.isArray(data) ? data[0] : data) as
        | { dat?: boolean; ma?: string; so_du_sau?: number }
        | null
        | undefined;

      if (!dong) {
        console.error('[Billing] tru_credit_render tra ve rong — khong tru duoc.');
        return { success: false, error: 'LEDGER_RPC_EMPTY' };
      }

      if (dong.dat) {
        if (dong.ma === 'DA_TRU_TRUOC_DO') {
          // Goi lai cho cung mot render. Tra THANH CONG la dung: tien da tru that roi,
          // nen noi goi phai di tiep va danh dau render hoan thanh. Tra that bai o day
          // se bien mot lan giao hang trung lap thanh mot video bi doi la that bai.
          console.warn(`[Billing] Render ${renderId} da duoc tru credit truoc do — khong tru lan hai.`);
        }
        return { success: true, balance_after: dong.so_du_sau };
      }

      console.error(`[Billing] Khong tru duoc credit cho render ${renderId}: ${dong.ma}`);
      return { success: false, error: dong.ma ?? 'LEDGER_RPC_FAILED' };
    }

    if (!thieuHamRpc(error, 'tru_credit_render')) {
      // Loi that su: khong lui ve duong cu, vi duong cu khong sua duoc loi nay.
      console.error(`[Billing] tru_credit_render loi: ${error.message}`);
      return { success: false, error: error.message };
    }

    /**
     * Hàm chưa tồn tại trong cơ sở dữ liệu → lùi về đường cũ.
     *
     * Chọn lùi chứ không chọn chặn, vì hai hướng sai không bằng nhau:
     *
     *   - Chặn: migration chưa chạy thì MỌI render hoàn thành đều không trừ được tiền,
     *     và route callback sẽ đánh dấu chúng 'failed' với "Không đủ xu" — khách mất
     *     video đáng được nhận. Tệ hơn hiện trạng.
     *   - Lùi: giữ đúng hành vi hôm nay, kèm hai lỗ đã biết. Không tệ hơn hiện trạng.
     *
     * Log ở mức error và nói rõ phải làm gì, vì đây là đường TIỀN đang chạy kém an toàn
     * và không được phép trôi qua im lặng.
     */
    console.error(
      '[Billing] ======================================================================\n' +
      '[Billing] tru_credit_render KHONG TON TAI trong CSDL. Dang dung duong CU, co hai lo:\n' +
      '[Billing]   1. Hai lan tru dong thoi cung doc mot so du -> vuot chot "khong du".\n' +
      '[Billing]   2. Khong rang buoc nao chan tru hai lan cho cung mot render.\n' +
      '[Billing] Chay migration 20261102000001_tru_credit_nguyen_tu.sql de bit.\n' +
      '[Billing] ======================================================================'
    );
    return CreditService.truDuongCu(userId, projectId, renderId, amount, reason);
  },

  /**
   * Đường trừ credit CŨ — chỉ còn là đường lùi khi `tru_credit_render()` chưa tồn tại.
   *
   * Giữ lại nguyên văn chứ không sửa: nó có hai lỗ đã biết (đọc-rồi-ghi không khoá, và
   * không có ràng buộc một-lần), và cả hai chỉ sửa được ở mức cơ sở dữ liệu. Sửa vá ở
   * đây sẽ tạo ảo giác an toàn mà không giải quyết gì.
   */
  async truDuongCu(
    userId: string,
    projectId: string,
    renderId: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; balance_after?: number; error?: string }> {
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
