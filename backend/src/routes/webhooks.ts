import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { MockSentry } from '../services/sentry.service';
import { CreditService } from '../services/credit.service';
import { isSecretConfigured, parseTransferCode, safeEqual } from '../lib/security';

export async function webhookRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
  );
  

  // =================== SEPAY WEBHOOK ===================
  fastify.post('/sepay', async (request, reply) => {
    try {
      const body = request.body as any;
      fastify.log.info(`[SePay Webhook] Received: ${JSON.stringify(body)}`);

      // 1. Verify SePay API Key (Security)
      const authHeader = request.headers.authorization;
      const expectedToken = process.env.SEPAY_WEBHOOK_SECRET;
      // Fail-closed: thiếu secret thì từ chối (503 → SePay tự gửi lại khi đã cấu hình)
      if (!isSecretConfigured(expectedToken)) {
         fastify.log.error('[SePay Webhook] SEPAY_WEBHOOK_SECRET not set — rejecting webhook');
         return reply.status(503).send({ error: 'SEPAY_WEBHOOK_NOT_CONFIGURED' });
      }
      if (!safeEqual(authHeader || '', `Apikey ${expectedToken}`)) {
         fastify.log.warn('[SePay Webhook] Unauthorized access attempt');
         return reply.status(401).send({ error: 'Unauthorized' });
      }

      // 2. Extract Data
      const { transferAmount, content, referenceCode, id: sepayId, transferType } = body;
      
      // Only process incoming transfers
      if (transferType !== 'in' || !content) {
         return reply.send({ received: true, note: 'ignored_not_in_or_no_content' });
      }

      // 3. Find User by Content
      // Example content: "NGUYEN VAN A CK VIPRO A1B2C3D4" — mã = 8 ký tự hex đầu của user id (billing.ts)
      const shortId = parseTransferCode(content);
      if (!shortId) {
         fastify.log.warn(`[SePay Webhook] No full 8-char VIPRO code in content: ${content}`);
         return reply.send({ received: true, note: 'no_vipro_syntax' });
      }

      const minUuid = `${shortId}-0000-0000-0000-000000000000`;
      const maxUuid = `${shortId}-ffff-ffff-ffff-ffffffffffff`;

      // Lấy tối đa 2 để phát hiện trùng tiền tố: chỉ cộng credit khi khớp đúng 1 user
      const { data: users, error: userErr } = await supabase
        .from('profiles')
        .select('id, referred_by')
        .gte('id', minUuid)
        .lte('id', maxUuid)
        .limit(2);

      if (userErr) {
         fastify.log.error(`[SePay Webhook] User lookup failed for shortId ${shortId}: ${userErr.message}`);
         return reply.status(500).send({ error: 'USER_LOOKUP_FAILED' });
      }
      if (!users || users.length === 0) {
         fastify.log.warn(`[SePay Webhook] User not found for shortId: ${shortId}`);
         return reply.send({ received: true, note: 'user_not_found' });
      }
      if (users.length > 1) {
         fastify.log.error(`[SePay Webhook] Ambiguous shortId ${shortId} matches multiple users — manual reconciliation needed (ref ${referenceCode})`);
         return reply.send({ received: true, note: 'ambiguous_user_code' });
      }

      const user = users[0];
      const userId = user.id;

      // 4. Idempotency Check
      const idempotencyKey = `sepay_${sepayId}_${referenceCode}`;
      const { error: idemError } = await supabase.from('idempotency_keys').insert({
        idempotency_key: idempotencyKey,
        action: 'sepay_payment',
      });

      if (idemError) {
        if (idemError.code === 'PGRST205') {
           // Fail-closed: không có chống trùng thì không cộng credit; 500 để SePay gửi lại sau
           fastify.log.error(`[SePay Webhook] idempotency_keys table missing — refusing to process ${idempotencyKey}`);
           return reply.status(500).send({ error: 'IDEMPOTENCY_UNAVAILABLE' });
        } else {
           fastify.log.warn(`[SePay Webhook] Idempotency block — already processed: ${idempotencyKey}`);
           return reply.send({ received: true, idempotent_stop: true });
        }
      }

      // 5. Determine Plan based on amount (rough heuristic, or lookup pending payment)
      let planCode = 'pack';
      let creditsToGrant = 0;
      
      if (transferAmount >= 520000) { planCode = 'premium'; creditsToGrant = 240; }
      else if (transferAmount >= 250000) { planCode = 'business'; creditsToGrant = 110; }
      else if (transferAmount >= 130000) { planCode = 'pro'; creditsToGrant = 50; }
      else {
         // Fallback custom credit
         creditsToGrant = Math.floor(transferAmount / 3000); // Ex: 3000d = 1 credit
      }

      // 6. Record Payment
      const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
        user_id: userId,
        provider: 'sepay',
        provider_txn_id: referenceCode,
        order_type: planCode !== 'pack' ? 'plan_subscription' : 'credit_pack',
        plan_code: planCode !== 'pack' ? planCode : null,
        amount: transferAmount,
        currency: 'VND',
        status: 'paid',
        idempotency_key: idempotencyKey,
      }).select('id').single();

      if (payErr) {
        await supabase.from('idempotency_keys').delete().eq('idempotency_key', idempotencyKey);
        return reply.status(500).send({ error: 'Payment insert failed' });
      }

      // Các ý định thanh toán cũ còn treo 'pending' của user này coi như không thành:
      // họ đã trả bằng mã khác. Enum payment_status chỉ có pending|paid|failed|refunded,
      // nên dùng 'failed' — 'obsolete' không tồn tại và Postgres sẽ từ chối cả câu lệnh.
      const { error: staleErr } = await supabase.from('payments')
         .update({ status: 'failed' })
         .eq('user_id', userId)
         .eq('status', 'pending')
         .neq('id', paymentRow.id);
      if (staleErr) {
        fastify.log.warn(`[SePay Webhook] Không dọn được payment treo của ${userId}: ${staleErr.message}`);
      }

      // Buyer +10% bonus
      let finalCreditsToGrant = creditsToGrant;
      if (user.referred_by) {
        finalCreditsToGrant = Math.floor(creditsToGrant * 1.1);
        fastify.log.info(`[SePay Webhook] User ${userId} has referrer, granting +10% bonus credits: ${finalCreditsToGrant}`);
      }

      // 7. Grant Credits
      const creditResult = await CreditService.grantToLedger(
        userId,
        finalCreditsToGrant,
        `sepay_${planCode}`,
        paymentRow?.id
      );

      // 8. Affiliate Logic (Recurring & Tiered)
      if (user.referred_by) {
        const { data: referrer } = await supabase.from('profiles').select('id').eq('affiliate_code', user.referred_by).single();
        if (referrer && referrer.id !== userId) {
           const { data: pastEvents } = await supabase.from('affiliate_events')
             .select('commission_amount')
             .eq('referrer_id', referrer.id)
             .neq('status', 'rejected');
             
           const totalAccVnd = (pastEvents || []).reduce((acc, ev) => acc + Number(ev.commission_amount), 0);
           const commissionRate = totalAccVnd >= 2500000 ? 0.15 : 0.10;
           const commissionVnd = Math.round(transferAmount * commissionRate);
           
           await supabase.from('affiliate_events').insert({
             referrer_id: referrer.id,
             referred_id: userId,
             payment_id: paymentRow?.id,
             status: 'pending',
             commission_amount: commissionVnd,
             meta: {
               eventType: 'recurring_conversion',
               grossAmountVnd: transferAmount,
               commissionRate: commissionRate,
               tierApplied: commissionRate === 0.15 ? 'gold' : 'silver',
               holdUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
               reason: 'Hoa hồng từ giao dịch thanh toán qua SePay.',
               providerTxnId: referenceCode,
             }
           });
        }
      }

      return reply.send({ received: true, success: true, credits_granted: finalCreditsToGrant });
    } catch (err: any) {
      fastify.log.error(`[SePay Webhook] Error: ${err.message}`);
      return reply.status(500).send({ error: err.message });
    }
  });

}
