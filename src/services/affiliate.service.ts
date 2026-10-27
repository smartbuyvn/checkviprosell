import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';
import { fetchWithTimeout } from '@/lib/fetchUtils';

const API_ROOT = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

export const AffiliateService = {
  getReferralStats: async () => {
    // 100% Backend fetched for data integrity and exact single-source-of-truth logic
    const session = await getSessionSafe(supabase);
    if (!session) return null;

    try {
      const response = await fetchWithTimeout(`${API_ROOT}/affiliate/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        timeout: 8000,
      });
      if (!response.ok) throw new Error('Failed to fetch affiliate metrics');
      return await response.json();
    } catch (e) {
      console.error('[AffiliateService] fetch error:', e);
      return null;
    }
  },
  /** Gửi yêu cầu rút hoa hồng. Backend tự kiểm số dư và ngưỡng tối thiểu. */
  requestWithdrawal: async (input: {
    amountVnd: number;
    bank: string;
    accountNo: string;
    accountName: string;
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetchWithTimeout(`${API_ROOT}/affiliate/withdrawals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || 'Không gửi được yêu cầu rút');
    return body;
  },

  
  setReferredBy: async (affiliateCode: string) => {
    const session = await getSessionSafe(supabase);
    if (!session) return { error: 'Chưa đăng nhập' };

    try {
      const response = await fetchWithTimeout(`${API_ROOT}/affiliate/refer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ code: affiliateCode }),
        timeout: 8000,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to apply referral code');
      }
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Unknown error' };
    }
  }
};
