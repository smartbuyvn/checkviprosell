/**
 * Viprosell â€” Shared Edge Function Caller
 * Centralizes auth + fetch + error handling for all edge function calls.
 */

import { supabase } from '@/integrations/supabase/client';

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: 'ChÆ°a Ä‘Äƒng nháº­p' };

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
    if (resp.status === 429) return { data: null, error: 'QuÃ¡ nhiá»u yÃªu cáº§u, vui lÃ²ng thá»­ láº¡i sau.' };
    if (resp.status === 402) return { data: null, error: data.message || 'Háº¿t credit, vui lÃ²ng náº¡p thÃªm.' };
    if (resp.status === 403) return { data: null, error: data.message || 'TÃ­nh nÄƒng bá»‹ cháº·n bá»Ÿi cáº¥u hÃ¬nh há»‡ thá»‘ng.' };
    if (resp.status === 422 && data.retryable) {
      return { data: { ...data, _retryable: true } as T, error: data.error || 'AI tráº£ káº¿t quáº£ khÃ´ng há»£p lá»‡. Vui lÃ²ng thá»­ láº¡i.' };
    }
    return { data: null, error: data.error || data.message || `${functionName} tháº¥t báº¡i` };
  }

  return { data: data as T, error: null };
}
