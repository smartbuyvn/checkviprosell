/**
 * Viprosell — Project Service (Real Supabase)
 *
 * All enum values are converted through enumMapper before being sent
 * to Supabase, and converted back when read from Supabase.
 * This resolves the mismatch between Frontend enums (quickads)
 * and Supabase Cloud enums (quick_ads).
 */

import { supabase } from '@/integrations/supabase/client';
import { currentUserId } from '@/lib/currentUser';
import { fetchWithTimeout } from '@/lib/fetchUtils';
import {
  packageTypeToDb,
  packageTypeFromDb,
  projectStatusToDb,
  projectStatusFromDb,
} from '@/lib/enumMapper';

export interface CreateProjectInput {
  title: string;
  package_type: 'quickads' | 'reviewvideo' | 'conversionvideo';
  category: 'beauty' | 'fashion' | 'home' | 'other';
  source_url?: string;
  manual_notes?: string;
  language?: string;
}

export const ProjectService = {
  async create(input: CreateProjectInput) {
    // `currentUserId()` doc phien san co tai may; `auth.getUser()` goi mang va gianh
    // khoa phien moi lan. Day la await DAU TIEN cua nut "Luu & Tai len", nen no treo
    // la ca luong tao du an treo theo, khong mot dong nao duoc ghi.
    const uid = await currentUserId();
    if (!uid) return { project: null, error: 'Chưa đăng nhập' };

    const { data, error } = await supabase
      .from('projects')
      .insert({
        title: input.title,
        package_type: packageTypeToDb(input.package_type) as any,
        category: input.category,
        source_url: input.source_url ?? null,
        manual_notes: input.manual_notes ?? null,
        language: input.language ?? 'vi',
        user_id: uid,
        status: 'draft',
      })
      .select()
      .single();

    // Convert DB values back to Frontend format for the returned object
    const project = data ? {
      ...data,
      package_type: packageTypeFromDb(data.package_type) as any,
      status: projectStatusFromDb(data.status) as any,
    } : null;

    return { project, error: error?.message ?? null };
  },

  async update(projectId: string, updates: Partial<CreateProjectInput>) {
    // Convert enums before sending to DB
    const dbUpdates: Record<string, any> = { ...updates };
    if (updates.package_type) {
      dbUpdates.package_type = packageTypeToDb(updates.package_type);
    }

    const { error } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', projectId);
    return { error: error?.message ?? null };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    // Convert DB values back to Frontend format
    const project = data ? {
      ...data,
      package_type: packageTypeFromDb(data.package_type) as any,
      status: projectStatusFromDb(data.status) as any,
    } : null;

    return { project, error: error?.message ?? null };
  },

  async listByUser() {
    const uid = await currentUserId();
    if (!uid) return { projects: [], error: 'Chưa đăng nhập' };

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', uid as never)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Convert DB values back to Frontend format for all projects
    const projects = (data ?? []).map((p: any) => ({
      ...p,
      package_type: packageTypeFromDb(p.package_type),
      status: projectStatusFromDb(p.status),
    }));

    return { projects, error: error?.message ?? null };
  },

  /**
   * Danh sách dự án kèm video đã dựng xong, cho lưới thẻ ở Dashboard.
   *
   * Lấy kèm renders và scripts trong MỘT truy vấn thay vì gọi lần lượt từng dự án:
   * 20 dự án mà gọi riêng là 41 lượt mạng.
   *
   * Lưu ý về độ dài: dùng scripts.duration_sec, KHÔNG dùng renders.duration_ms —
   * cột đó là thời gian máy dựng video (render.worker.ts ghi renderTimeMs vào đấy),
   * không phải độ dài video. Lấy nhầm sẽ hiện "14 giây" cho một video 25 giây.
   */
  async listWithVideos(limit = 24, offset = 0) {
    const uid = await currentUserId();
    if (!uid) return { projects: [], error: 'Chưa đăng nhập' };

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        renders ( id, status, output_url, thumbnail_url, created_at ),
        scripts ( duration_sec )
      `)
      .eq('user_id', uid as never)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      // Phải giới hạn. Bản trước lấy TẤT CẢ dự án kèm toàn bộ renders và scripts của
      // từng cái: khách có 200 video thì một lần mở trang là 200 dòng cộng mọi bản
      // dựng, rồi 200 ảnh đại diện tải cùng lúc. 24 vừa đủ kín màn hình rộng nhất
      // (6 cột × 4 hàng) mà vẫn nhẹ.
      .range(offset, offset + limit - 1);

    const projects = (data ?? []).map((p: any) => {
      const renders = Array.isArray(p.renders) ? p.renders : [];
      // Bản dựng xong mới nhất; chưa có thì lấy bản mới nhất bất kể trạng thái
      // để còn hiện được "đang xử lý" hay "hỏng".
      const done = renders
        .filter((r: any) => r.status === 'completed' && r.output_url)
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
      const latest = renders
        .slice()
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

      const script = Array.isArray(p.scripts) ? p.scripts[0] : p.scripts;

      return {
        ...p,
        package_type: packageTypeFromDb(p.package_type),
        status: projectStatusFromDb(p.status),
        video: done[0] ?? null,
        latestRender: latest[0] ?? null,
        durationSec: script?.duration_sec ?? null,
      };
    });

    return { projects, error: error?.message ?? null };
  },

  async updateStatus(projectId: string, status: 'draft' | 'analyzing' | 'conceptready' | 'scriptready' | 'renderqueued' | 'rendering' | 'completed' | 'failed') {
    const { error } = await supabase
      .from('projects')
      .update({ status: projectStatusToDb(status) as any })
      .eq('id', projectId);
    return { error: error?.message ?? null };
  },

  async deleteProject(projectId: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    return { error: error?.message ?? null };
  },

  async trashProject(projectId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Chưa đăng nhập' };

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
      // Xoá mà treo thì người dùng bấm lại nhiều lần, mỗi lần một yêu cầu nữa.
      const response = await fetchWithTimeout(`${baseUrl}/projects/${projectId}/trash`, {
        timeout: 15000,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        return { error: data.error || 'Lỗi khi xóa dự án' };
      }
      return { error: null, cancel_requested: data.cancel_requested };
    } catch (err: any) {
      return { error: err.message };
    }
  },
};
