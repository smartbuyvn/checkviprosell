import { FastifyInstance } from 'fastify';
import { BillingService } from '../services/billing.service';
import { getVerifiedUserId } from '../lib/auth';
import { generateOrderRef } from '../lib/security';

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
    // Chi liet ke tinh nang CO THAT. Da go (19/10 -> 27/10/2026):
    //   'Draft + Voice render'  - chua co TTS nao trong backend
    //   'Premium cloud render'  - bi khoa boi PREMIUM_RENDER_ENABLED
    //   'Khong watermark'       - khong he co watermark nen go cung khong co gi de go
    //   'API access'            - chua mo API cho khach
    //   'Du an khong gioi han'  - khong co gioi han o goi nao de ma bo
    //   'credits/thang'         - khong co gia han tu dong, day la goi nap mot lan
    // Danh sach nay chi dung khi doc bang plans that bai; sua o DB phai dong bo.
    const fallbackPlans = [
      {
        id: 'free', name: 'Free', price: 'Mien phi', credits: 3,
        features: ['3 credits dung thu', 'Video co watermark', 'Do phan giai 720p', 'Render ban nhap'],
        popular: false,
      },
      {
        id: 'starter', name: 'Starter', price: '129.000d', credits: 30,
        features: ['30 credits', 'Tat ca loai video', 'Xuat caption', 'Ho tro qua email'],
        popular: false,
      },
      {
        id: 'pro', name: 'Pro', price: '249.000d', credits: 80,
        features: ['80 credits', 'Tat ca loai video', 'Xuat caption', 'Ho tro uu tien'],
        popular: true,
      },
      {
        id: 'business', name: 'Business', price: '499.000d', credits: 180,
        features: ['180 credits', 'Tat ca loai video', 'Xuat caption', 'Ho tro uu tien'],
        popular: false,
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

      // Doc gia tu bang plans thay vi viet cung o day.
      // Ban hardcode cu con chua goi "starter" 250 credit / 50.000d (200d moi credit)
      // khong ton tai o bat ky noi nao khac va ban duoi gia von.
      const { data: planRow, error: planErr } = await BillingService.getPlanByCode(plan_code);

      if (planErr || !planRow) {
        fastify.log.warn(`[Billing] Goi khong hop le hoac khong hoat dong: ${plan_code}`);
        return reply.code(400).send({ error: 'INVALID_PLAN', plan_code });
      }
      const amount = Math.round(Number(planRow.price));
      if (!(amount > 0)) {
        return reply.code(400).send({ error: 'PLAN_NOT_PURCHASABLE', plan_code });
      }

      /**
       * Tai khoan nhan tien. KHONG co duong lui.
       *
       * ── Vi sao bo gia tri du phong ──
       *
       * Ban cu viet `process.env.SEPAY_BANK_ACC || '123456789'`. Ba gia tri du phong
       * do la cho dien — `123456789` / `MBBank` / `NGUYEN VAN A` — va chung di
       * THANG vao ma QR ma khach quet de chuyen tien.
       *
       * Nghia la: chi can quen dat bien tren may chu, moi khach tra tien deu chuyen
       * vao mot so tai khoan khong phai cua minh, va he thong khong he keu mot tieng.
       * Khach thay QR binh thuong, chuyen tien binh thuong, roi khong duoc cong credit
       * — vi webhook khong bao gio nhan duoc giao dich nao.
       *
       * Do that ngay 30/10: 6 don da tao, 0 don nhan duoc tien.
       *
       * Tu choi dung ma QR con hon dung mot ma QR sai. Khach thay loi thi bao ngay;
       * khach chuyen nham tien thi khong lay lai duoc.
       */
      const bankAcc = String(process.env.SEPAY_BANK_ACC || '').trim();
      const bankName = String(process.env.SEPAY_BANK_NAME || '').trim();
      const accName = String(process.env.SEPAY_ACCOUNT_NAME || '').trim();

      if (!bankAcc || !bankName || !accName) {
        const thieu = [
          !bankAcc && 'SEPAY_BANK_ACC',
          !bankName && 'SEPAY_BANK_NAME',
          !accName && 'SEPAY_ACCOUNT_NAME',
        ].filter(Boolean).join(', ');
        fastify.log.error(`[Billing] Chua dat tai khoan nhan tien (${thieu}) — tu choi dung ma QR.`);
        return reply.code(503).send({
          error: 'PAYMENT_ACCOUNT_NOT_CONFIGURED',
          message: 'Hệ thống thanh toán đang tạm ngưng. Vui lòng liên hệ hỗ trợ.',
        });
      }
      
      // Ma gan voi TUNG DON HANG, khong phai tung nguoi.
      // Truoc day noi dung la `VIPRO <8 hex dau cua user id>`, nen moi don cua cung mot
      // khach deu giong het nhau va webhook khong biet ho mua goi nao -> phai doan theo
      // so tien, dan toi cong sai credit.
      const refCode = generateOrderRef();
      const content = `VIPRO ${refCode}`;
      
      // VietQR standard URL structure via SePay
      const qr_url = `https://qr.sepay.vn/img?acc=${bankAcc}&bank=${bankName}&amount=${amount}&des=${encodeURIComponent(content)}`;

      // Ghi y dinh mua ngay luc nay: webhook se tra lai ban ghi nay theo ref_code
      try {
         const { createClient } = require('@supabase/supabase-js');
         const supabase = createClient(
            process.env.SUPABASE_URL || 'http://localhost:54321',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
         );
         await supabase.from('payments').insert({
              idempotency_key: `checkout_${refCode}`,
            user_id: userId,
            provider: 'sepay',
            provider_txn_id: `pending_${refCode}`,
            order_type: 'plan_subscription',
            plan_code: plan_code,
            amount: amount,
            currency: 'VND',
            status: 'pending',
            meta: { expected_content: content, ref_code: refCode }
         });
      } catch (e: any) {
         fastify.log.warn(`[Billing] Could not insert pending payment: ${e.message}`);
      }

      return reply.send({
         qr_url,
         ref_code: refCode,
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
