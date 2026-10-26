/**
 * Viprosell — Shared Edge Function Caller
 * Centralizes auth + fetch + error handling for all edge function calls.
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';

export interface EdgeResponse<T = any> {
  data: T | null;
  error: string | null;
}

/**
 * Call a Supabase edge function with standard auth and error handling.
 * Eliminates duplicated fetch+auth+error patterns across services.
 */
export async function callEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<EdgeResponse<T>> {
  const session = await getSessionSafe(supabase);
  if (!session) return { data: null, error: 'Chưa đăng nhập' };

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    },
  );

  const data = await resp.json();

  if (!resp.ok) {
    if (resp.status === 429) return { data: null, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' };
    if (resp.status === 402) return { data: null, error: data.message || 'Hết credit, vui lòng nạp thêm.' };
    if (resp.status === 403) return { data: null, error: data.message || 'Tính năng bị chặn bởi cấu hình hệ thống.' };
    if (resp.status === 422 && data.retryable) {
      return { data: { ...data, _retryable: true } as T, error: data.error || 'AI trả kết quả không hợp lệ. Vui lòng thử lại.' };
    }
    return { data: null, error: data.error || data.message || `${functionName} thất bại` };
  }

  return { data: data as T, error: null };
}
