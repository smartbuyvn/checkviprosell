import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { MockSentry } from '../services/sentry.service';
import { CreditService } from '../services/credit.service';
import { isSecretConfigured, parseTransferCode, safeEqual } from '../lib/security';

export async function webhookRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
  );
  
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

  // Isolate raw body parser to this plugin scope for Stripe HMAC
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body: string, done) => {
    try {
      const json = JSON.parse(body);
      (req as any).rawBody = body;
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  fastify.post('/stripe', {
    config: { rawBody: true },
  }, async (request, reply) => {
    try {
      let event: Stripe.Event;
      
      // ─── Real Stripe Signature Verification via SDK ───────────────────────
      if (stripeWebhookSecret) {
        const sig = request.headers['stripe-signature'] as string;
        if (!sig) {
          fastify.log.warn('[Webhook] Missing Stripe-Signature header');
          return reply.status(400).send({ error: 'Missing Stripe-Signature header' });
        }

        const rawBody = (request as any).rawBody as string | undefined;
        if (!rawBody) {
          fastify.log.error('[Webhook] rawBody not available — ensure rawBody plugin is configured');
          return reply.status(500).send({ error: 'Internal config error: rawBody not captured' });
        }

        try {
          event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
        } catch (err: any) {
          fastify.log.warn(`[Webhook] Signature verification FAILED via SDK: ${err.message}`);
          return reply.status(400).send({ error: `Webhook signature invalid: ${err.message}` });
        }
        fastify.log.info('[Webhook] Stripe signature verified via SDK ✅');
      } else {
        // Fail-closed: không có secret thì không xác thực được sự kiện → từ chối, không tin body
        fastify.log.error('[Webhook] STRIPE_WEBHOOK_SECRET not set — rejecting unverifiable Stripe event');
        return reply.status(503).send({ error: 'STRIPE_WEBHOOK_NOT_CONFIGURED' });
      }

      fastify.log.info(`[Webhook] Received event: ${event.type}`);

      // ─── checkout.session.completed ───────────────────────────────
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const creditsToGrant = parseInt(session.metadata?.credits || '0', 10);
        const idempotencyKey = session.id;
        const amountTotal = session.amount_total || 0;
        const paymentStatus = session.payment_status || 'unpaid';
        const planCode = session.metadata?.plan_code;
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

        if (!userId) {
          return reply.status(400).send({ error: 'Missing client_reference_id in session metadata' });
        }
        if (creditsToGrant <= 0) {
          return reply.send({ received: true, note: 'no credits' });
        }
        if (paymentStatus !== 'paid') {
          return reply.send({ received: true, note: `ignored: payment_status=${paymentStatus}` });
        }

        // Idempotency check 
        const { error: idemError } = await supabase.from('idempotency_keys').insert({
          idempotency_key: idempotencyKey,
          action: 'checkout_session',
        });

        if (idemError) {
          fastify.log.warn(`[Webhook] Idempotency block — already processed session: ${idempotencyKey}`);
          return reply.send({ received: true, idempotent_stop: true });
        }

        // Record Payment table truthfully — using paymentIntentId to ensure refund binds correctly
        const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
          user_id: userId,
          provider: 'stripe',
          provider_txn_id: paymentIntentId || idempotencyKey,
          order_type: planCode ? 'plan_subscription' : 'credit_pack',
          plan_code: planCode || null,
          amount: amountTotal / 100,
          currency: session.currency?.toUpperCase() || 'USD',
          status: 'paid',
          idempotency_key: idempotencyKey,
        }).select('id').single();

        if (payErr) {
          await supabase.from('idempotency_keys').delete().eq('idempotency_key', idempotencyKey);
          return reply.status(500).send({ error: 'Payment history insert failed' });
        }

        // Check for referral before granting credits
        const { data: profile } = await supabase.from('profiles').select('referred_by').eq('id', userId).single();
        let finalCreditsToGrant = creditsToGrant;
        if (profile?.referred_by) {
          finalCreditsToGrant = Math.floor(creditsToGrant * 1.1); // +10% bonus
          fastify.log.info(`[Webhook] User ${userId} has referrer, granting +10% bonus credits: ${finalCreditsToGrant}`);
        }

        // Grant Ledger Credits
        const creditResult = await CreditService.grantToLedger(
          userId,
          finalCreditsToGrant,
          `checkout_${planCode || 'pack'}`,
          paymentRow?.id
        );

        if (!creditResult.success) {
          return reply.status(500).send({ error: 'Credit grant failed' });
        }

        // Affiliate logic updated for Recurring and Tiered
        if (paymentStatus === 'paid' && profile?.referred_by) {
          const { data: referrer } = await supabase.from('profiles').select('id').eq('affiliate_code', profile.referred_by).single();
          // Anti-abuse: Strict Anti-Self-Referral guard
          if (referrer && referrer.id !== userId) {
            
            // Calculate total accumulated valid commission to determine Tier
            const { data: pastEvents } = await supabase.from('affiliate_events')
              .select('commission_amount')
              .eq('referrer_id', referrer.id)
              .neq('status', 'rejected');
              
            const totalAccVnd = (pastEvents || []).reduce((acc, ev) => acc + Number(ev.commission_amount), 0);
            
            // Gold Tier threshold: 2,500,000 VND
            const commissionRate = totalAccVnd >= 2500000 ? 0.15 : 0.10;
            const commissionVnd = Math.round(amountTotal * commissionRate);
            
            await supabase.from('affiliate_events').insert({
              referrer_id: referrer.id,
              referred_id: userId,
              payment_id: paymentRow?.id,
              status: 'pending',
              commission_amount: commissionVnd,
              meta: {
                eventType: 'recurring_conversion',
                grossAmountVnd: amountTotal,
                commissionRate: commissionRate,
                tierApplied: commissionRate === 0.15 ? 'gold' : 'silver',
                holdUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                reason: 'Hoa hồng từ giao dịch mua Credit của khách hàng giới thiệu.',
                providerTxnId: paymentIntentId || idempotencyKey,
              }
            });
            fastify.log.info(`[Webhook-Affiliate] Recurring commission (${commissionRate*100}%) granted to referrer ${referrer.id} for user: ${userId}`);
          } else if (referrer && referrer.id === userId) {
              fastify.log.warn(`[Webhook-Affiliate] Blocked self-referral for user: ${userId}`);
          }
        }
        return reply.send({ received: true, credits_granted: finalCreditsToGrant });
      }

      // ─── checkout.session.async_payment_failed ─────────────────────
      if (event.type === 'checkout.session.async_payment_failed') {
         const session = event.data.object as Stripe.Checkout.Session;
         const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
         await supabase.from('payments').update({ status: 'failed' }).eq('provider_txn_id', paymentIntentId || session.id);
         return reply.send({ received: true, action: 'payment_failed' });
      }

      // ─── charge.succeeded ───────────────────────────────────────
      if (event.type === 'charge.succeeded') {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        const receiptUrl = charge.receipt_url;
        const paymentMethod = charge.payment_method_details?.type || null;

        if (paymentIntentId && receiptUrl) {
          await supabase.from('payments').update({
            receipt_url: receiptUrl,
            payment_method: paymentMethod,
            updated_at: new Date().toISOString()
          }).eq('provider_txn_id', paymentIntentId);
        }
        return reply.send({ received: true, action: 'receipt_updated' });
      }

      // ─── charge.refunded ───────────────────────────────────────
      if (event.type === 'charge.refunded') {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntent = charge.payment_intent as string;
        try {
          const { data: payDocs } = await supabase.from('payments').select('id').eq('provider_txn_id', paymentIntent).limit(1);
          if (payDocs && payDocs.length > 0) {
             const payId = payDocs[0].id;
             await supabase.from('payments').update({ status: 'refunded' }).eq('id', payId);
             
             await supabase.from('affiliate_events')
               .update({ status: 'rejected', meta: { reason: 'payment_refunded_reversal' } })
               .eq('payment_id', payId)
               .neq('status', 'paid');
          }
        } catch (e: any) { fastify.log.error(`[Refund Error] ${e.message}`); }
        return reply.send({ received: true, action: 'refund_processed' });
      }

      return reply.send({ received: true });
    } catch (err: any) {
      MockSentry.captureException(err, { context: 'stripe-webhook' });
      fastify.log.error(`[Webhook] Unhandled error: ${err.message}`);
      return reply.status(400).send({ error: `Webhook error: ${err.message}` });
    }
  });

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

      // Mark any pending sepay records as paid/obsolete
      await supabase.from('payments')
         .update({ status: 'obsolete' })
         .eq('user_id', userId)
         .eq('status', 'pending');

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

  fastify.post('/paypal', async (_request, reply) => {
    return reply.send({ received: true, provider: 'paypal', message: 'Not implemented in Beta' });
  });
}
