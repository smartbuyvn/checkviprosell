import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

export const BillingService = {
  /** Fetch active plans from DB, ordered by sort_order */
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
