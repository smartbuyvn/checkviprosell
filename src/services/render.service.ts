/**
 * Viprosell â€” Render Service
 * Job management + local render orchestration.
 * Uses shared edge function caller.
 */

import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/services/edge.client';
import { renderLocalDraft, type LocalRenderConfig, type LegacyRenderConfig, type RenderResult } from '@/engine/renderEngine';

export type RenderMode = 'draft_local' | 'draft_local_tts' | 'premium_cloud';

export interface RenderJob {
  id: string;
  project_id: string;
  render_mode: string;
  status: string;
  output_url: string | null;
  error_code: string | null;
  error_message: string | null;
  last_fail_reason: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export const RenderService = {
  /** Create a render job via edge function */
  async createJob(projectId: string, renderMode: RenderMode = 'draft_local') {
    return callEdgeFunction('render-worker', {
      action: 'create',
      project_id: projectId,
      render_mode: renderMode,
      trace_id: crypto.randomUUID(),
    });
  },

  /** Update render job status via edge function */
  async updateStatus(renderId: string, projectId: string, status: string, extra?: {
    output_url?: string;
    duration_ms?: number;
    error_code?: string;
    error_message?: string;
    last_fail_reason?: string;
  }) {
    return callEdgeFunction('render-worker', {
      action: 'update_status',
      project_id: projectId,
      render_id: renderId,
      status,
      ...extra,
      trace_id: crypto.randomUUID(),
    });
  },

  /** Get all renders for a project */
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('renders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    return { renders: (data ?? []) as RenderJob[], error: error?.message ?? null };
  },

  /** Get latest render for a project */
  async getLatest(projectId: string) {
    const { data, error } = await supabase
      .from('renders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return { render: data as RenderJob | null, error: error?.message ?? null };
  },

  /** Get count of completed renders across all user projects + latest date */
  async getCompletedCount(): Promise<{ count: number; latestDate: string | null }> {
    const { data, error } = await supabase
      .from('renders')
      .select('id, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    if (error || !data) return { count: 0, latestDate: null };
    return {
      count: data.length,
      latestDate: data.length > 0 ? data[0].created_at : null,
    };
  },

  /**
   * Execute local draft render end-to-end:
   * 1. Create job (queued)
   * 2. Update to processing
   * 3. Run Canvas render engine
   * 4. Upload result to storage
   * 5. Update to completed/failed
   */
  async executeLocalRender(
    projectId: string,
    renderMode: RenderMode,
    config: Omit<LocalRenderConfig, 'onProgress'> | Omit<LegacyRenderConfig, 'onProgress'>,
    onProgress?: (pct: number) => void,
  ): Promise<{ success: boolean; outputUrl?: string; error?: string }> {
    // Step 1: Create job
    const { data: createData, error: createError } = await this.createJob(projectId, renderMode);
    if (createError || !createData?.render) {
      return { success: false, error: createError || 'KhÃ´ng táº¡o Ä‘Æ°á»£c render job' };
    }
    const renderId = createData.render.id;

    // Step 2: Mark processing
    await this.updateStatus(renderId, projectId, 'processing');
    onProgress?.(5);

    // Step 3: Run render engine
    let result: RenderResult;
    try {
      result = await renderLocalDraft({
        ...config,
        onProgress: (pct) => onProgress?.(5 + Math.round(pct * 0.8)),
      } as any);
    } catch (err: any) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'RENDER_ENGINE_ERROR',
        error_message: err.message || 'Render engine crashed',
        last_fail_reason: err.message,
      });
      return { success: false, error: err.message || 'Render engine tháº¥t báº¡i' };
    }

    if (result.error || !result.blob.size) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'EMPTY_OUTPUT',
        error_message: result.error || 'Video output rá»—ng',
        last_fail_reason: result.error,
      });
      return { success: false, error: result.error || 'Video output rá»—ng' };
    }

    onProgress?.(88);

    // Step 4: Upload to storage
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'AUTH_LOST',
        error_message: 'PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t',
      });
      return { success: false, error: 'PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t' };
    }

    const fileName = `${user.id}/${projectId}/render_${renderId}.webm`;
    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(fileName, result.blob, { contentType: 'video/webm', upsert: true });

    if (uploadError) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'UPLOAD_FAILED',
        error_message: uploadError.message,
        last_fail_reason: uploadError.message,
      });
      return { success: false, error: `Upload tháº¥t báº¡i: ${uploadError.message}` };
    }

    // Private bucket â€” use signed URL (1 hour expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('project-assets')
      .createSignedUrl(fileName, 3600);

    const outputUrl = signedData?.signedUrl;
    if (signedError || !outputUrl) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'SIGNED_URL_FAILED',
        error_message: signedError?.message || 'KhÃ´ng táº¡o Ä‘Æ°á»£c link táº£i video',
      });
      return { success: false, error: 'KhÃ´ng táº¡o Ä‘Æ°á»£c link táº£i video' };
    }

    onProgress?.(95);

    // Step 5: Mark completed
    await this.updateStatus(renderId, projectId, 'completed', {
      output_url: outputUrl,
      duration_ms: result.durationMs,
    });

    onProgress?.(100);

    return { success: true, outputUrl };
  },
};
