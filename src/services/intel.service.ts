/**
 * Viprosell — Intel Service
 * Triggers AI product analysis (async job) and reads results.
 * Backend returns {jobId, status: "queued"} — caller must poll.
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';
import { fetchWithTimeout } from '@/lib/fetchUtils';

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
      // `fetchWithTimeout`, KHÔNG phải `fetch` trần.
      //
      // Đây là chỗ làm trang "Phân tích sản phẩm" quay vô hạn: `fetch` không có hạn
      // chờ, nên backend treo là lời gọi này treo theo mãi mãi. Vòng lặp 60 giây ngay
      // bên dưới có đường thoát đầy đủ nhưng KHÔNG BAO GIỜ chạy tới.
      //
      // Dự án đứng lại ở trạng thái `analyzing` và người bán chỉ thấy một vòng xoay —
      // không thông báo, không nút thử lại. Có 7 dự án như vậy trong CSDL.
      //
      // 45 giây: đủ rộng cho một lần gọi LLM chậm, còn hơn thì đã là hỏng chứ không
      // phải chậm.
      const resp = await fetchWithTimeout(`${API_BASE}/ai/product-intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ project_id: projectId, trace_id: traceId }),
        timeout: 45000,
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
      // Hạn chờ ngắn hơn hẳn: đây là lệnh hỏi trạng thái, gọi lại mỗi 2 giây. Để nó
      // treo thì cả vòng lặp đứng im và hạn 60 giây của vòng lặp mất tác dụng.
      const resp = await fetchWithTimeout(`${API_BASE}/ai/job/${jobId}/status`, {
        timeout: 8000,
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
