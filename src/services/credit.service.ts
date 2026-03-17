/**
 * Viprosell â€” Credit Ledger Service (Real Supabase)
 * Append-only ledger for tracking credit balance changes.
 */

import { supabase } from '@/integrations/supabase/client';

export const CreditService = {
  async getBalance() {
    const { data, error } = await supabase
      .from('credit_ledger')
      .select('balance_after')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return { balance: 0, error: null };
    return { balance: data?.balance_after ?? 0, error: null };
  },

  async getLedger(limit = 50) {
    const { data, error } = await supabase
      .from('credit_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { entries: data ?? [], error: error?.message ?? null };
  },

  async getLedgerByProject(projectId: string) {
    const { data, error } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    return { entries: data ?? [], error: error?.message ?? null };
  },
};
