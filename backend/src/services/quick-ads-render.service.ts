/**
 * Viprosell — Quick Ads Render Orchestration Service (API Gateway)
 *
 * Pipeline:
 * Input → Validate basic raw inputs → Insert into Supabase (status=pending)
 * The Local Render Worker picks this up via Supabase Realtime,
 * runs the 4-tier Local AI pipeline (brief → strategy → scene_graph → render_plan),
 * renders with FFmpeg NVENC, uploads and reports back via callback.
 */

import 'dotenv/config';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { SceneGraphService } from './scene-graph.service';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuickAdsRenderInput {
  product_title: string;
  product_summary: string;
  product_price?: string;
  promo_text?: string;
  target_audience?: string;
  aspect_ratio?: '9:16' | '1:1';
  duration_seconds?: number;
  image_urls: string[];
  product_url?: string;
  hook_mode?: 'price' | 'solution' | 'testimonial';
  goal?: 'traffic' | 'conversion';
  scene_graph?: any;
  render_plan?: any;
}

export interface RenderJobResult {
  job_id: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed' | 'queued' | 'processing';
  output_url?: string;
  render_time_ms?: number;
  file_size_bytes?: number | null;
  error?: string;
  warnings?: string[];
  progress?: number;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export const QuickAdsRenderService = {
  /**
   * Step 0: Generate SceneGraph + RenderPlan for preview (no render cost).
   */
  async generatePreview(input: QuickAdsRenderInput): Promise<{
    scene_graph: any;
    render_plan: any;
    warnings: string[];
    content_guard: { passed: boolean; errors: string[]; warnings: string[] };
  }> {
    const { productBrief, sceneGraph, renderPlan } = await SceneGraphService.generatePipeline({
      product_title: input.product_title,
      product_summary: input.product_summary,
      product_price: input.product_price,
      promo_text: input.promo_text,
      target_audience: input.target_audience,
      aspect_ratio: input.aspect_ratio,
      duration_seconds: input.duration_seconds,
      image_urls: input.image_urls,
      product_url: input.product_url,
    });

    const warnings: string[] = [];
    if (productBrief.needs_human_review) warnings.push('Dữ liệu đầu vào thiếu thông tin — cần kiểm tra lại trước khi chạy quảng cáo.');

    return {
      scene_graph: sceneGraph,
      render_plan: renderPlan,
      warnings,
      content_guard: {
        passed: !productBrief.needs_human_review,
        errors: [],
        warnings,
      },
    };
  },

  /**
   * Step 1: Create Job in Supabase (status=pending, picked up by Realtime worker).
   */
  async startRender(input: QuickAdsRenderInput, jobId?: string): Promise<RenderJobResult> {
    const id = jobId ?? crypto.randomUUID();

    // Anh/video la BAT BUOC. Link san pham mot minh khong du.
    //
    // Nhanh cu cho qua khi co `product_url` ma khong co file nao — nhung khong cho
    // nao trong he thong tai anh tu link ve, va SPEC V3 §2.3 CAM lam viec do (dieu
    // khoan san thuong mai dien tu, va anh tren san mang watermark cua nguoi ban khac).
    // Nen nhanh do dan thang toi mot ban render khong co lieu dau vao: worker chay,
    // tieu tien LLM, roi dung lai o guard NO_PRODUCT_IMAGES.
    //
    // Route /quick-ads/scene-graph von da bat buoc image_urls khong rong, nen nhanh nay
    // khong bao gio toi duoc qua duong HTTP — hai tang noi hai dieu khac nhau. Gio thi
    // thong nhat: khong co file, khong co video.
    //
    // Link van duoc giu lai va van co ich: no di xuong tang 1 lam ngu canh VAN BAN
    // (ten, gia, mo ta), dung nhu spec cho phep.
    if (!input.image_urls || input.image_urls.length < 3) {
      return {
        job_id: id,
        status: 'failed',
        error: 'Cần ít nhất 3 ảnh hoặc video sản phẩm. Link sản phẩm chỉ dùng làm ngữ cảnh văn bản, không thay được file.',
      };
    }

    const { error: insertErr } = await supabase.from('renders').insert({
      id,
      render_mode: 'draft_local',
      aspect_ratio: input.aspect_ratio || '9:16',
      status: 'pending',
      raw_input: input,
      scene_graph_json: input.scene_graph || null,
      render_plan_json: input.render_plan || null,
    });

    if (insertErr) {
      console.error('[API Gateway] Failed to insert job to Supabase:', insertErr.message);
      return {
        job_id: id,
        status: 'failed',
        error: `Database error: ${insertErr.message}`,
      };
    }

    console.log(`[API Gateway] Job ${id} created in Supabase. Waiting for Local Render Worker.`);
    return { job_id: id, status: 'pending' };
  },

  /**
   * Step 2: Get Job Status.
   */
  async getJob(jobId: string): Promise<RenderJobResult | undefined> {
    const { data, error } = await supabase.from('renders').select('*').eq('id', jobId).single();
    if (error || !data) return undefined;

    return {
      job_id: data.id,
      status: data.status as any,
      output_url: data.output_url,
      render_time_ms: data.duration_ms,
      file_size_bytes: null,
      error: data.error_message,
      warnings: [],
      progress: data.progress,
    };
  },

  /**
   * Internal monitoring — recent render jobs cost log (from `renders` table).
   */
  async getCostLogs(): Promise<any[]> {
    const { data, error } = await supabase
      .from('renders')
      .select('id, status, duration_ms, output_url, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[API Gateway] getCostLogs failed:', error.message);
      return [];
    }
    return (data || []).map((r: any) => ({
      job_id: r.id,
      status: r.status,
      render_time_ms: r.duration_ms,
      output_url: r.output_url,
      error: r.error_message,
      created_at: r.created_at,
    }));
  },
};