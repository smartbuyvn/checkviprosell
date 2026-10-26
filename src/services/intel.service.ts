/**
 * Viprosell — Intel Service
 * Triggers AI product analysis (async job) and reads results.
 * Backend returns {jobId, status: "queued"} — caller must poll.
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1');

export interface IntelResult {
  product_name: string;
  category: string;
  target_buyer: string;
  price_band: string;
  usp_list: string[];
  pain_points: string[];
  objections: string[];
  trust_signals: string[];
  use_context: string[];
  recommended_package_fit: string[];
  confidence_score: number;
}

export interface IntelResponse {
  intel: IntelResult | null;
  jobId?: string;
  traceId?: string;
  status?: string; // 'queued' | 'active' | 'completed' | 'failed'
  error: string | null;
}

async function getAuthHeader(): Promise<string | null> {
  const session = await getSessionSafe(supabase);
  if (!session) return null;
  return `Bearer ${session.access_token}`;
}

export const IntelService = {
  /** Read persisted intel for a project (Supabase direct — read-only, safe) */
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('product_intelligence')
      .select('*')
      .eq('project_id', projectId)
      .single();
    return { intel: data, error: error?.message ?? null };
  },

  /**
   * Trigger AI analysis via Fastify backend.
   * Returns immediately with {jobId, status: "queued"}.
   * Poll using pollJobStatus() until status = "completed" / "failed".
   */
  async analyze(projectId: string): Promise<IntelResponse> {
    const traceId = crypto.randomUUID();
    const auth = await getAuthHeader();
    if (!auth) return { intel: null, error: 'Chưa đăng nhập' };

    try {
      const resp = await fetch(`${API_BASE}/ai/product-intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ project_id: projectId, trace_id: traceId }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return { intel: null, error: data.error || 'Lỗi AI Server', traceId };
      }

      // Async: returns jobId, not intel directly
      return { intel: null, jobId: data.jobId, status: 'queued', traceId, error: null };
    } catch {
      return { intel: null, error: 'Không thể kết nối đến backend. Backend đã chạy chưa?', traceId };
    }
  },

  /**
   * Poll BullMQ job status from backend.
   * Call repeatedly until status = "completed" or "failed".
   */
  async pollJobStatus(jobId: string): Promise<{ status: string; error: string | null }> {
    const auth = await getAuthHeader();
    if (!auth) return { status: 'error', error: 'Chưa đăng nhập' };

    try {
      const resp = await fetch(`${API_BASE}/ai/job/${jobId}/status`, {
        headers: { Authorization: auth },
      });
      const data = await resp.json();
      if (!resp.ok) return { status: 'error', error: data.error };
      return { status: data.status, error: data.error || null };
    } catch {
      return { status: 'error', error: 'Không thể kết nối đến backend' };
    }
  },

  /** Update persisted intel fields (user edits) */
  async updateIntel(projectId: string, updates: Partial<IntelResult>) {
    const { error } = await supabase
      .from('product_intelligence')
      .update(updates as any)
      .eq('project_id', projectId);
    return { error: error?.message ?? null };
  },
};
