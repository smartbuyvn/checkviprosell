/**
 * Viprosell — Script Service
 * Triggers script generation and reads results.
 * Uses shared edge function caller.
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';
import { callEdgeFunction } from '@/services/edge.client';
import { packageTypeToDb } from '@/lib/enumMapper';

export interface ScriptGenerateResponse {
  script: any | null;
  jobId?: string;
  status?: string;
  trace_id?: string;
  error: string | null;
  details?: string[];
}

export const ScriptService = {
  /** Trigger script generation via fastify backend */
  async generate(projectId: string, packageType: string = 'quickads'): Promise<ScriptGenerateResponse> {
    const traceId = crypto.randomUUID();
    
    const session = await getSessionSafe(supabase);
    if (!session) return { script: null, error: 'Chưa đăng nhập' };
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1');
      const resp = await fetch(`${API_BASE}/ai/script-composer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ project_id: projectId, trace_id: traceId, package_type: packageType })
      });
      
      const data = await resp.json();
      
      if (!resp.ok) {
         return {
           script: null,
           error: data.error || 'Lỗi từ AI Script Engine',
           trace_id: data.trace_id || traceId,
         };
      }
      
      return {
        script: null,
        jobId: data.jobId,
        status: 'queued',
        trace_id: data.trace_id || traceId,
        error: null,
      };
    } catch (err: any) {
      return {
         script: null,
         error: 'Không thể kết nối đến AI backend',
         trace_id: traceId,
      };
    }
  },

  /** Poll BullMQ job status from backend */
  async pollJobStatus(jobId: string): Promise<{ status: string; error: string | null }> {
    const session = await getSessionSafe(supabase);
    if (!session) return { status: 'error', error: 'Chưa đăng nhập' };
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1');
      const resp = await fetch(`${API_BASE}/ai/job/${jobId}/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await resp.json();
      if (!resp.ok) return { status: 'error', error: data.error };
      return { status: data.status, error: data.error || null };
    } catch {
      return { status: 'error', error: 'Không thể kết nối đến backend' };
    }
  },

  /** Read script for a project */
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return { script: data, error: error?.message ?? null };
  },

  /** Read visual pack for a project */
  async getVisualPack(projectId: string) {
    const { data, error } = await supabase
      .from('visual_packs')
      .select('*')
      .eq('project_id', projectId)
      .single();
    return { visualPack: data, error: error?.message ?? null };
  },

  /** Read captions for a project */
  async getCaptions(projectId: string) {
    const { data, error } = await supabase
      .from('caption_exports')
      .select('*')
      .eq('project_id', projectId)
      .single();
    return { captions: data, error: error?.message ?? null };
  },
};
