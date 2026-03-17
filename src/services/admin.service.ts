/**
 * Viprosell â€” Admin Service (Real Supabase)
 * Admin-only operations: audit logs, service health, system management.
 * Uses shared edge client for consistent auth/error handling.
 */

import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/services/edge.client';

export const AdminService = {
  /** Update settings with backend validation + audit logging */
  async updateSettingsSecure(updates: Record<string, any>) {
    return callEdgeFunction('admin-settings', { action: 'update_settings', updates });
  },

  /** Run health check on a service */
  async healthCheck(serviceName: string, serviceUrl: string) {
    return callEdgeFunction('admin-settings', { action: 'health_check', service_name: serviceName, service_url: serviceUrl });
  },

  /** Get failed render jobs */
  async getFailedJobs(limit = 50) {
    return callEdgeFunction('admin-settings', { action: 'get_failed_jobs', limit });
  },

  /** Get usage statistics (with failures + latency) */
  async getUsageStats() {
    return callEdgeFunction('admin-settings', { action: 'get_usage_stats' });
  },

  /** Read audit logs (admin only via RLS) */
  async getAuditLogs(limit = 100) {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { logs: data ?? [], error: error?.message ?? null };
  },

  /** Read service health logs (admin only) */
  async getServiceHealthLogs(limit = 50) {
    const { data, error } = await supabase
      .from('service_health_logs')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit);
    return { logs: data ?? [], error: error?.message ?? null };
  },

  /** Get all prompts (admin only via RLS) */
  async getPrompts() {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('category')
      .order('version', { ascending: false });
    return { prompts: data ?? [], error: error?.message ?? null };
  },

  /** Create/update prompt */
  async upsertPrompt(prompt: {
    category: string;
    name: string;
    content: string;
    package_type?: string | null;
    version?: number;
  }) {
    const { data, error } = await supabase
      .from('prompts')
      .insert(prompt as any)
      .select()
      .single();
    return { prompt: data, error: error?.message ?? null };
  },

  /** Toggle prompt active status */
  async togglePrompt(promptId: string, isActive: boolean) {
    const { error } = await supabase
      .from('prompts')
      .update({ is_active: isActive })
      .eq('id', promptId);
    return { error: error?.message ?? null };
  },
};
