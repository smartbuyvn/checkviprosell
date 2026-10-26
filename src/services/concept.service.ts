/**
 * Viprosell — Concept Service
 * Generate, read, and select commerce angles.
 * Backend returns {jobId, status: "queued"} — caller must poll.
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1') + '/ai';

export interface Concept {
  id: string;
  project_id: string;
  angle_type: 'painfirst' | 'reviewvideotrust' | 'offerconversionvideo';
  title: string;
  big_idea: string | null;
  hook: string | null;
  cta: string | null;
  why_it_works: string | null;
  score: number | null;
  is_selected: boolean;
  scriptready_at: string;
}

export interface GenerateResponse {
  concepts: Concept[] | null;
  jobId?: string;
  status?: string;
  traceId?: string;
  trace_id?: string; // legacy compat
  error: string | null;
  details?: string[];
}

export const ConceptService = {
  /** Read persisted concepts for a project */
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('concepts')
      .select('*')
      .eq('project_id', projectId)
      .order('score', { ascending: false });
    return { concepts: (data ?? []) as Concept[], error: error?.message ?? null };
  },

  /** Trigger AI concept generation via Fastify backend (async job) */
  async generate(projectId: string): Promise<GenerateResponse> {
    const traceId = crypto.randomUUID();
    const session = await getSessionSafe(supabase);
    if (!session) return { concepts: null, error: 'Chưa đăng nhập' };

    try {
      const resp = await fetch(`${API_BASE}/concepts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId, trace_id: traceId }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return { concepts: null, error: data.error || 'Lỗi từ AI Server (Concepts)', traceId };
      }

      // Async: returns jobId, not concepts directly
      return { concepts: null, jobId: data.jobId, status: 'queued', traceId, error: null };
    } catch {
      return { concepts: null, error: 'Không thể kết nối đến backend. Backend đã chạy chưa?', traceId };
    }
  },

  /** Poll BullMQ job status from backend */
  async pollJobStatus(jobId: string): Promise<{ status: string; error: string | null }> {
    const session = await getSessionSafe(supabase);
    if (!session) return { status: 'error', error: 'Chưa đăng nhập' };
    try {
      const resp = await fetch(`${API_BASE}/job/${jobId}/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await resp.json();
      if (!resp.ok) return { status: 'error', error: data.error };
      return { status: data.status, error: data.error || null };
    } catch {
      return { status: 'error', error: 'Không thể kết nối đến backend' };
    }
  },

  /** Select a concept (deselect others) */
  async select(projectId: string, conceptId: string) {
    // Deselect all for this project
    await supabase
      .from('concepts')
      .update({ is_selected: false })
      .eq('project_id', projectId);

    // Select the chosen one
    const { error } = await supabase
      .from('concepts')
      .update({ is_selected: true })
      .eq('id', conceptId)
      .eq('project_id', projectId);

    return { error: error?.message ?? null };
  },
};
