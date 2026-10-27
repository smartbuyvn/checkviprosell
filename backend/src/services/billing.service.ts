import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

export const BillingService = {
  /** Fetch active plans from DB, ordered by sort_order */
  /**
   * Lay mot goi dang hoat dong theo ma. Dung luc tao don de gia va so credit
   * chi co MOT nguon duy nhat la bang plans, thay vi viet cung o moi noi.
   */
  async getPlanByCode(code: string) {
    return supabase
      .from('plans')
      .select('code, name, price, credits')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
  },

  async getPlans() {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    return { data: data || [], error };
  },

  async getHistory(userId: string) {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn(`[BillingService] getHistory error for ${userId}: ${error.message}`);
      return [];
    }
    return payments || [];
  }
};
