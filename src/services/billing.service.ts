/**
 * Viprosell — Billing Service (SePay / VietQR)
 *
 * Single source of truth for all billing-related API calls.
 * All authenticated requests carry the Supabase session Bearer token.
 *
 * Endpoints consumed:
 *   GET  /plans                  → Plan catalog (public)
 *   GET  /billing/summary        → Current plan + payment history + invoices
 *   POST /billing/checkout/sepay → SePay VietQR checkout (domestic bank transfer)
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';
import { fetchWithTimeout } from '@/lib/fetchUtils';

/* ──────────────────────── Environment ──────────────────────── */

const API_ROOT = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const APP_BASE = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
const API_BASE = API_ROOT; // Backend routes already mounted at /api/v1/billing

/* ──────────────────────── Types ──────────────────────── */

export type PlanCode = 'free' | 'pro' | 'business' | 'premium';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface PlanPackage {
  id: PlanCode;
  name: string;
  price: string;
  credits: number;
  features: string[];
  popular?: boolean;
}

export interface CurrentPlanSummary {
  planCode: PlanCode;
  name: string;
  expiresAt?: string | null;
}

export interface BillingInvoice {
  id: string;
  paymentId?: string | null;
  label: string;
  url: string;
  issuedAt?: string | null;
}

export interface PaymentTransaction {
  id: string;
  created_at: string;
  plan_code: string;
  amount: number;
  currency?: string;
  status: PaymentStatus;
  payment_method?: string;
}

export interface BillingSummary {
  currentPlan: CurrentPlanSummary | null;
  payments: PaymentTransaction[];
  invoices?: BillingInvoice[];
}

/** Response shape from the SePay VietQR checkout endpoint */
export interface SePayCheckoutData {
  qr_url: string;
  content: string;
  amount: number;
  account_no?: string;
  account_name?: string;
  bank_id?: string;
}

/* ══════════════════════════════════════════════════════════════
   BillingService — Static Class API
   ══════════════════════════════════════════════════════════════ */

export class BillingService {
  /**
   * Helper: Tự động lấy Token từ phiên đăng nhập Supabase
   * để đính kèm vào Header, giúp Backend biết ai đang gọi API
   */
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const session = await getSessionSafe(supabase);
    if (!session?.access_token) return { 'Content-Type': 'application/json' };

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }

  /**
   * 1. Lấy danh sách gói cước (Dùng cho trang Bảng giá)
   * Endpoint này là Public (không cần token).
   */
  static async getPlans(): Promise<{ ok: boolean; plans: PlanPackage[] }> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/billing/plans`, { timeout: 8000 });
      if (!res.ok) return { ok: false, plans: [] };
      const data = await res.json();
      // Backend returns flat array OR { plans: [...] } — handle both
      const plans = Array.isArray(data) ? data : (data.plans || []);
      return { ok: true, plans };
    } catch (error) {
      console.warn("[BillingService] Lỗi tải gói cước:", error);
      return { ok: false, plans: [] };
    }
  }

  /**
   * 2. Lấy lịch sử giao dịch và số dư (Dùng cho Dashboard)
   */
  static async getBillingSummary(): Promise<{ ok: boolean; summary: BillingSummary | null }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetchWithTimeout(`${API_BASE}/billing/summary`, { headers, timeout: 8000 });
      if (!res.ok) return { ok: false, summary: null };
      const data = await res.json();
      return { ok: true, summary: data };
    } catch (error) {
      console.warn("[BillingService] Lỗi tải lịch sử giao dịch:", error);
      return { ok: false, summary: null };
    }
  }

  /**
   * 3. Tạo mã QR thanh toán Nội địa (SePay)
   * Ném lỗi rõ ràng để Modal UI bắt được và báo đỏ cho khách.
   */
  static async checkoutSePay(planCode: PlanCode): Promise<SePayCheckoutData> {
    const headers = await this.getAuthHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/billing/checkout/sepay`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan_code: planCode }),
      timeout: 10000,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể khởi tạo mã QR thanh toán. Vui lòng thử lại.');
    }
    return res.json();
  }
}
