/**
 * Viprosell â€” Usage Log Service (Real Supabase)
 * Tracks credit usage and step execution for auditing.
 */

import { supabase } from '@/integrations/supabase/client';

export const UsageService = {
  async getByUser(limit = 50) {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { logs: data ?? [], error: error?.message ?? null };
  },

  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    return { logs: data ?? [], error: error?.message ?? null };
  },

  /** Admin-only: get all usage logs */
  async getAll(limit = 100) {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { logs: data ?? [], error: error?.message ?? null };
  },
};
