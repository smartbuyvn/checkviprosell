/**
 * Viprosell — Admin Service (Fastify Backbone)
 * Admin-only operations: settings with contradiction validation, health checks, etc.
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetchUtils';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1') + '/admin';

export const AdminService = {
  /** Update settings enforcing backend validation via Fastify */
  async updateSettingsSecure(updates: Record<string, any>) {
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        timeout: 5000,
      });
      const data = await resp.json();
      if (!resp.ok) return { data: null, error: data.message || data.error || 'Lỗi lưu settings' };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },

  /** Run health check on a service via Fastify */
  async healthCheck(serviceName: string, serviceUrl: string) {
    // In a real local MVP we might hit a dedicated check endpoint, but Fastify '/health' handles DB + Local LLM
    try {
       const resp = await fetchWithTimeout(`${API_BASE}/health`, { timeout: 5000 });
       const data = await resp.json();
       // For mock compatibility with UI
       const specificStatus = data.services[serviceName] === 'up' ? 'healthy' : 'degraded';
       return { data: { status: specificStatus, response_time_ms: 120 }, error: null };
    } catch (e: any) {
       return { data: null, error: e.message };
    }
  },

  /** Get failed render jobs via Fastify */
  async getFailedJobs(limit = 50) {
    try {
       const resp = await fetchWithTimeout(`${API_BASE}/failed-jobs`, { timeout: 5000 });
       const data = await resp.json();
       return { data: { jobs: data.failed_projects }, error: null };
    } catch (e: any) {
       return { data: null, error: e.message };
    }
  },

  /** Get usage statistics (reading directly from Supabase for local viewer) */
  async getUsageStats() {
    return { data: { stats: {}, render_summary: {} }, error: null }; // Minimized for MVP
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

  /** Get all prompts via Fastify */
  async getPrompts() {
    try {
       const resp = await fetchWithTimeout(`${API_BASE}/prompts`, { timeout: 5000 });
       const data = await resp.json();
       return { prompts: data.prompts || [], error: null };
    } catch (e: any) {
       return { prompts: [], error: e.message };
    }
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
