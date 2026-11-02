/**
 * Viprosell — Render Service
 * Job management + local render orchestration.
 * Routes through Fastify backend (not Supabase edge functions).
 */

import { supabase } from '@/integrations/supabase/client';
import { currentUserId } from '@/lib/currentUser';
import { getSessionSafe } from '@/lib/errorUtils';
import { renderLocalDraft, type LocalRenderConfig, type LegacyRenderConfig, type RenderResult } from '@/engine/renderEngine';
import { fetchWithTimeout } from '@/lib/fetchUtils';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1');

async function getAuthHeader(): Promise<string | null> {
  const session = await getSessionSafe(supabase);
  return session ? `Bearer ${session.access_token}` : null;
}

export type RenderMode = 'draft_local' | 'draftlocaltts' | 'premiumcloud';

export interface RenderJob {
  id: string;
  project_id: string;
  render_mode: string;
  status: string;
  output_url: string | null;
  /** Anh dai dien do render.worker.ts trich ra sau khi dung xong. Null neu chua co. */
  thumbnail_url: string | null;
  error_code: string | null;
  error_message: string | null;
  last_fail_reason: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

/** Mot phuong an tiep can khach co the chon truoc khi dung video. */
export interface PhuongAn {
  gocTiepCan: 'painfirst' | 'reviewtrust' | 'offerconversion';
  hook: string;
  gocNhin: string;
  cta: string;
  /** Nguyen van phuong an. Gui lai luc dung de hook khong bi sinh lai khac di. */
  nguyenVan: unknown;
}

export interface KetQuaPhuongAn {
  hieuDuoc: {
    ten: string;
    moTa: string | null;
    loiIch: string[];
    soAnhDocDuoc: number;
    soAnhTaiLen: number;
  };
  phuongAn: PhuongAn[];
  /** Nhung thu KHACH sua duoc, khong phai thuat ngu noi bo. */
  canSua: string[];
}

/** Một dấu bản quyền tìm được, kèm ảnh nhỏ để khách nhìn mà quyết định. */
export interface DauUngVien {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chữ đọc được — chỉ để khách nhận ra, có thể sai chính tả. */
  text: string;
  /** Số ảnh thấy dấu này. Càng nhiều càng chắc là dấu. */
  soAnh: number;
  anh: number[];
  anhNho: string | null;
}

export interface KetQuaTimDau {
  batDuoc: boolean;
  dau: DauUngVien[];
  soAnhDaQuet: number;
  /** Phần diện tích ảnh còn lại nếu khách chọn hết, 0..1. */
  giuLaiNeuChonHet: number;
  nhan: string;
}

export const RenderService = {
  /**
   * Lay cac phuong an tiep can de khach CHON truoc khi dung video.
   *
   * Khong tru credit: day la xem truoc, chua dung gi. Chay tang 1 + 2 nen mat vai
   * giay — timeout phai rong hon han cac route khac.
   */
  /**
   * Tìm dấu bản quyền trên ảnh của dự án.
   *
   * Trả về ỨNG VIÊN để khách tích, không phải quyết định. Đo ngày 31/10 trên 10 dự
   * án thật: bộ dò tìm đúng dấu trên 2, loại sạch chữ sản phẩm trên 6, nhưng vẫn cho
   * dương tính giả trên 2 — chữ in trên vỏ hộp và rác OCR.
   *
   * Hỏng thì trả danh sách rỗng chứ không ném lỗi: không dò được dấu là mất một tiện
   * ích, không phải mất cả video.
   */
  async timDau(projectId: string): Promise<KetQuaTimDau> {
    const rong: KetQuaTimDau = { batDuoc: false, dau: [], soAnhDaQuet: 0, giuLaiNeuChonHet: 1, nhan: '' };
    const auth = await getAuthHeader();
    if (!auth) return rong;
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/render/tim-dau`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ projectId }),
        // Mỗi ảnh tốn ~3 giây, tối đa 6 ảnh.
        timeout: 60000,
      });
      const data = await resp.json();
      if (!resp.ok) return rong;
      return {
        batDuoc: Boolean(data?.batDuoc),
        dau: Array.isArray(data?.dau) ? data.dau : [],
        soAnhDaQuet: Number(data?.soAnhDaQuet) || 0,
        giuLaiNeuChonHet: Number(data?.giuLaiNeuChonHet) || 1,
        nhan: String(data?.nhan ?? ''),
      };
    } catch {
      return rong;
    }
  },

  async layPhuongAn(
    projectId: string,
    rawInput: any
  ): Promise<{ data: KetQuaPhuongAn | null; error: string | null }> {
    const auth = await getAuthHeader();
    if (!auth) return { data: null, error: 'Chưa đăng nhập' };
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/render/phuong-an`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ projectId, rawInput }),
        timeout: 90000,
      });
      const data = await resp.json();
      if (!resp.ok) return { data: null, error: data?.error || 'Không lấy được phương án' };
      return { data: data as KetQuaPhuongAn, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /** Create a render job via Fastify backend (enqueues BullMQ job) */
  /**
   * Tạo job render.
   *
   * @param rawInput Dữ liệu sản phẩm để chạy CẢ 4 TẦNG AI. Trước đây nó bị truyền
   *                 vào tham số sceneGraph, nên worker tưởng đã có đồ thị cảnh sẵn
   *                 và bỏ qua tầng 1-2-3: video ra không có lời đọc, chữ overlay là
   *                 tên gói, các cảnh giống hệt nhau.
   * @param aspect   Tỉ lệ khách chọn. Trước đây viết cứng '9:16' nên lựa chọn của
   *                 khách bị vứt đi.
   */
async createJob(
    projectId: string,
    renderMode: RenderMode = 'draft_local',
    rawInput: any = null,
    aspect: string = '9:16',
    sceneGraph: any = null
  ) {
    const auth = await getAuthHeader();
    if (!auth) return { data: null, error: 'Chưa đăng nhập' };
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/render/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({
          projectId,
          mode: renderMode,   // backend doc 'mode', khong phai 'render_mode'
          aspect,             // backend doc 'aspect', khong phai 'aspect_ratio'
          rawInput,           // duong chay ca 4 tang
          sceneGraph,         // chi co khi da sinh kich ban truoc
        }),
        timeout: 15000,
      });
      const data = await resp.json();
      if (!resp.ok) return { data: null, error: data.error || 'Không tạo được render job' };
      // Backend returns: { success: true, renderId, status, traceId }
      return { data, error: null };
    } catch {
      return { data: null, error: 'Không thể kết nối đến backend. Backend đã chạy chưa?' };
    }
  },

  /** Poll render job status from Supabase (worker updates DB directly) */
  async pollRenderStatus(renderId: string): Promise<{ status: string; output_url: string | null; error_message: string | null }> {
    const { data, error } = await supabase
      .from('renders')
      .select('status, output_url, error_code, error_message')
      .eq('id', renderId)
      .single();
    if (error) return { status: 'error', output_url: null, error_message: error.message };
    return { status: data?.status || 'unknown', output_url: data?.output_url || null, error_message: data?.error_message || null };
  },

  /** Update render job status (direct DB — for client-side render path only) */
  async updateStatus(renderId: string, _projectId: string, status: string, extra?: {
    output_url?: string;
    duration_ms?: number;
    error_code?: string;
    error_message?: string;
    last_fail_reason?: string;
  }) {
    const updateData: Record<string, any> = { status, updated_at: new Date().toISOString(), ...extra };
    const { error } = await supabase.from('renders').update(updateData).eq('id', renderId);
    return { error: error?.message ?? null };
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

  /**
   * Số video đã dựng xong của CHÍNH người đang đăng nhập, kèm ngày gần nhất.
   *
   * `renders` không có cột user_id nên phải lọc bắc cầu qua projects. Dùng
   * `projects!inner` để hàng nào không khớp chủ sở hữu thì bị loại hẳn khỏi kết quả,
   * chứ không trả về với projects = null.
   */
  async getCompletedCount(): Promise<{ count: number; latestDate: string | null }> {
    const uid = await currentUserId();
    if (!uid) return { count: 0, latestDate: null };

    const { data, error } = await supabase
      .from('renders')
      .select('id, created_at, projects!inner(user_id)')
      .eq('projects.user_id', uid as never)
      .eq('status', 'completed')
      .is('deleted_at', null)
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
    if (createError || !createData?.renderId) {
      return { success: false, error: createError || 'Không tạo được render job' };
    }
    const renderId = createData.renderId; // backend returns { renderId, status, traceId }

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
      return { success: false, error: err.message || 'Render engine thất bại' };
    }

    if (result.error || !result.blob.size) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'EMPTY_OUTPUT',
        error_message: result.error || 'Video output rỗng',
        last_fail_reason: result.error,
      });
      return { success: false, error: result.error || 'Video output rỗng' };
    }

    onProgress?.(88);

    // Step 4: Upload to storage
    const uid = await currentUserId();
    if (!uid) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'AUTH_LOST',
        error_message: 'Phiên đăng nhập đã hết',
      });
      return { success: false, error: 'Phiên đăng nhập đã hết' };
    }

    const fileName = `${uid}/${projectId}/render_${renderId}.webm`;
    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(fileName, result.blob, { contentType: 'video/webm', upsert: true });

    if (uploadError) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'UPLOAD_FAILED',
        error_message: uploadError.message,
        last_fail_reason: uploadError.message,
      });
      return { success: false, error: `Upload thất bại: ${uploadError.message}` };
    }

    // Private bucket — use signed URL (1 hour expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('project-assets')
      .createSignedUrl(fileName, 3600);

    const outputUrl = signedData?.signedUrl;
    if (signedError || !outputUrl) {
      await this.updateStatus(renderId, projectId, 'failed', {
        error_code: 'SIGNED_URL_FAILED',
        error_message: signedError?.message || 'Không tạo được link tải video',
      });
      return { success: false, error: 'Không tạo được link tải video' };
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
