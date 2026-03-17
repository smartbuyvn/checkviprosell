/**
 * Viprosell â€” Script Service
 * Triggers script generation and reads results.
 * Uses shared edge function caller.
 */

import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/services/edge.client';

export interface ScriptGenerateResponse {
  script: any | null;
  trace_id?: string;
  error: string | null;
  details?: string[];
}

export const ScriptService = {
  /** Trigger script generation via edge function */
  async generate(projectId: string): Promise<ScriptGenerateResponse> {
    const traceId = crypto.randomUUID();
    const { data, error } = await callEdgeFunction<any>('script-composer', {
      project_id: projectId,
      trace_id: traceId,
    });

    if (error) {
      return {
        script: null,
        error,
        details: data?.details,
        trace_id: data?.trace_id,
      };
    }

    return {
      script: data.script,
      trace_id: data.trace_id,
      error: null,
    };
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
