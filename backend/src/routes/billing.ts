import { FastifyInstance } from 'fastify';
import { BillingService } from '../services/billing.service';
import { getVerifiedUserId } from '../lib/auth';

export async function billingRoutes(fastify: FastifyInstance) {
  /**
   * GET /plans — Public plan catalog
   * Reads from Supabase `plans` table. Falls back to hardcoded if DB is empty.
   * No authentication required.
   */
  fastify.get('/plans', async (_request, reply) => {
    try {
      const { data: dbPlans, error } = await BillingService.getPlans();

      if (!error && dbPlans && dbPlans.length > 0) {
        // Map DB schema → frontend PlanPackage shape
        const plans = dbPlans.map((p: any) => ({
          id: p.code,
          name: p.name,
          price: p.price === 0
            ? 'Miễn phí'
            : new Intl.NumberFormat('vi-VN').format(p.price) + '₫',
          credits: p.credits,
          features: typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || []),
          popular: p.code === 'business', // highlight the middle-high tier
        }));
        return reply.send(plans);
      }
    } catch (err: any) {
      fastify.log.warn(`[Billing] DB plans fetch failed, using fallback: ${err.message}`);
    }

    // Fallback: hardcoded plans (if DB is empty or errored)
    const fallbackPlans = [
      {
        id: 'free',
        name: 'Free',
        price: 'Miễn phí',
        credits: 5,
        features: ['5 credits miễn phí', 'Draft local render', '3 loại video', 'Overlay cơ bản'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: '130,000₫',
        credits: 50,
        features: ['50 credits/tháng', 'Draft + Voice render', 'Ưu tiên AI xử lý', 'Tất cả loại video', 'Xuất caption'],
      },
      {
        id: 'business',
        name: 'Business',
        price: '250,000₫',
        credits: 110,
        features: ['110 credits/tháng', 'Premium cloud render', 'Hỗ trợ ưu tiên', 'Tất cả tính năng', 'API access'],
        popular: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        price: '520,000₫',
        credits: 240,
        features: ['240 credits/tháng', 'Premium cloud render', 'Dự án không giới hạn', 'Không watermark', 'Custom branding'],
      },
    ];
    return reply.send(fallbackPlans);
  });

  // =================== SEPAY CHECKOUT (VIETNAM) ===================
  fastify.post('/checkout/sepay', async (request, reply) => {
    try {
      const { plan_code } = request.body as any;
      const userId = await getVerifiedUserId(request.headers.authorization);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      fastify.log.info(`[Billing] Creating SePay session for user: ${userId}, plan: ${plan_code}`);

      // Map plans to VND
      const PLANS: Record<string, { credits: number, priceVnd: number }> = {
         starter: { credits: 250, priceVnd: 50000 },
         pro:     { credits: 50, priceVnd: 130000 },
         business: { credits: 110, priceVnd: 250000 },
         premium: { credits: 240, priceVnd: 520000 },
      };

      const plan = PLANS[plan_code] || PLANS['pro']; // default fallback
      const amount = plan.priceVnd;

      // Bank Configuration (Can be overridden by .env)
      const bankAcc = process.env.SEPAY_BANK_ACC || '123456789';
      const bankName = process.env.SEPAY_BANK_NAME || 'MBBank';
      const accName = process.env.SEPAY_ACCOUNT_NAME || 'NGUYEN VAN A';
      
      // Unique transfer content. Example: VIPRO A1B2C3
      const shortId = userId.split('-')[0].toUpperCase();
      const content = `VIPRO ${shortId}`;
      
      // VietQR standard URL structure via SePay
      const qr_url = `https://qr.sepay.vn/img?acc=${bankAcc}&bank=${bankName}&amount=${amount}&des=${encodeURIComponent(content)}`;

      // Return immediately without creating pending DB record to avoid DB spam on modal open
      // The webhook will handle creating the 'paid' record when money arrives.
      // But if we want to track 'pending' to show in UI history:
      try {
         const { createClient } = require('@supabase/supabase-js');
         const supabase = createClient(
            process.env.SUPABASE_URL || 'http://localhost:54321',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
         );
         await supabase.from('payments').insert({
            user_id: userId,
            provider: 'sepay',
            provider_txn_id: `pending_${Date.now()}_${shortId}`,
            order_type: 'plan_subscription',
            plan_code: plan_code,
            amount: amount,
            currency: 'VND',
            status: 'pending',
            meta: { expected_content: content }
         });
      } catch (e: any) {
         fastify.log.warn(`[Billing] Could not insert pending payment: ${e.message}`);
      }

      return reply.send({
         qr_url,
         content,
         amount,
         account_no: bankAcc,
         account_name: accName,
         bank_id: bankName
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Cổng quốc tế (Lemon Squeezy) đã bỏ: v1 chỉ thu qua VietQR/SePay.
  // Lý do: phí 5% + 0,5 USD ≈ 18% trên đơn 99k, và khách Việt ít có thẻ quốc tế.

  fastify.get('/summary', async (request, reply) => {
    try {
      const userId = await getVerifiedUserId(request.headers.authorization);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      let history: any[] = [];
      try {
        history = await BillingService.getHistory(userId);
      } catch (err: any) {
        // New user with no payments — this is expected, not an error
        fastify.log.info(`[Billing] No payment history for user ${userId}: ${err.message}`);
      }
      
      interface PaymentRow {
        id: string; created_at: string; order_type: string; plan_code: string | null; 
        credit_pack_code: string | null; status: string; amount: number; currency: string;
        payment_method: string | null; provider_txn_id: string | null; 
        receipt_url: string | null; invoice_url: string | null; meta?: any;
      }

      let currentPlan = null;
      const latestSub = history.find((p: PaymentRow) => p.order_type === 'plan_subscription' && p.status === 'paid' && p.plan_code);
      if (latestSub) {
        const PLAN_NAMES: Record<string, string> = { starter: 'Gói Starter', pro: 'Gói Pro', premium: 'Gói Premium' };
        currentPlan = {
          planCode: latestSub.plan_code,
          name: PLAN_NAMES[latestSub.plan_code || ''] || latestSub.plan_code?.toUpperCase(),
          expiresAt: null
        };
      }

      const _payments = history.map((p: PaymentRow) => ({
        id: p.id,
        created_at: p.created_at,
        plan_code: p.plan_code || p.credit_pack_code || null,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        payment_method: p.payment_method || null,
        provider_txn_id: p.provider_txn_id || null,
        receipt_url: p.receipt_url || null,
        invoice_url: p.invoice_url || null
      }));

      const invoices = history
        .filter((p: PaymentRow) => p.status === 'paid' && (p.receipt_url || p.invoice_url))
        .map((p: PaymentRow) => ({
           id: p.id,
           paymentId: p.id,
           label: p.plan_code ? `Hóa đơn gói ${p.plan_code.toUpperCase()}` : `Hóa đơn nạp Credit`,
           url: p.invoice_url || p.receipt_url || '',
           issuedAt: p.created_at
        }));

      // Expanded contract for BillingSummary
      return reply.send({ 
        currentPlan,
        payments: _payments,
        invoices
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });
}
