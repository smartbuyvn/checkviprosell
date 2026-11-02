/**
 * Viprosell — Usage Log Service (Real Supabase)
 * Tracks credit usage and step execution for auditing.
 */

import { supabase } from '@/integrations/supabase/client';
import { currentUserId } from '@/lib/currentUser';

export const UsageService = {
  /**
   * Nhật ký dùng credit của CHÍNH người đang đăng nhập.
   *
   * Điều kiện user_id là thứ duy nhất phân biệt hàm này với `getAll` bên dưới.
   * Thiếu nó thì tài khoản admin — vốn có chính sách đọc toàn bộ usage_logs — sẽ
   * thấy nhật ký của mọi khách trong trang cá nhân của mình.
   */
  async getByUser(limit = 50) {
    const uid = await currentUserId();
    if (!uid) return { logs: [], error: null };

    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', uid as never)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { logs: data ?? [], error: error?.message ?? null };
  },

  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    return { logs: data ?? [], error: error?.message ?? null };
  },

  /** Admin-only: get all usage logs */
  async getAll(limit = 100) {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { logs: data ?? [], error: error?.message ?? null };
  },
};
