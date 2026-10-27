/**
 * Viprosell — Composition Service (v2, unified local render path)
 * Uses `renders` table exclusively (aligned to db/01-schema.sql + 13-render-pipeline.sql).
 * Unified path: /render/start → insert status='pending' → Local Render Worker (Supabase Realtime)
 * → FFmpeg NVENC → status='completed' (credits deducted via render callback).
 * No BullMQ renderQueue — no consumer exists; Realtime worker is the only render consumer.
 */
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { toDbRenderMode } from '../lib/render-mode';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);


export const CompositionService = {
  /**
   * Create a render row (status=pending) for the Realtime worker.
   * Returns immediately with { renderId, status: 'pending' }.
   */
  async startComposition(
    projectId: string,
    sceneGraph: any,
    aspectRatio: string,
    renderMode: string
  ) {
    const renderId = randomUUID();
    const traceId = randomUUID();

    // So sanh sau khi chuan hoa: truoc day chi bat 'premiumcloud', nen ai gui
    // dung dang DB 'premium_cloud' se lach qua khoa admin nay.
    const dbRenderMode = toDbRenderMode(renderMode);
    if (dbRenderMode === 'premium_cloud' && process.env.PREMIUM_RENDER_ENABLED !== 'true') {
      throw new Error('CLOUD_RENDER_DISABLED: Premium cloud render is deactivated by admin.');
    }

    const { error: insertErr } = await supabase.from('renders').insert({
      id: renderId,
      project_id: projectId,
      render_mode: dbRenderMode,
      aspect_ratio: aspectRatio,
      status: 'pending',
      scene_graph_json: sceneGraph || null,
    });
    if (insertErr) throw new Error(`RENDER_INSERT_FAILED: ${insertErr.message}`);

    console.log(`[Render] Job ${renderId} created (status=pending) for project ${projectId} (mode: ${dbRenderMode}). Waiting for Local Render Worker.`);
    return { id: renderId, status: 'pending', mode: dbRenderMode, traceId };
  },

  /** Get current status of a render by reading `renders` table */
  async getJobStatus(renderId: string) {
    const { data, error } = await supabase.from('renders').select('*').eq('id', renderId).single();
    if (error || !data) return { status: 'not_found' };
    return data;
  },

  /** Retry a failed render by resetting status to pending */
  async retryRender(renderId: string) {
    const { data: render } = await supabase.from('renders').select('*').eq('id', renderId).single();
    if (!render) throw new Error('RENDER_NOT_FOUND');

    const { error } = await supabase
      .from('renders')
      .update({ status: 'pending', error_code: null, error_message: null, last_fail_reason: null, progress: 0 })
      .eq('id', renderId);
    if (error) throw new Error(`RENDER_RETRY_FAILED: ${error.message}`);

    console.log(`[Render] Retried render ${renderId} → status=pending`);
    return { id: renderId, status: 'pending', traceId: randomUUID() };
  },
};