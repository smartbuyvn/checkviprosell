import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { MockSentry } from '../services/sentry.service';
import { baoThanhToanXong } from '../services/email.notify';
import { CreditService } from '../services/credit.service';
import { isSecretConfigured, parseTransferCode, safeEqual, parseOrderRef } from '../lib/security';

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

      // 3. CHONG TRUNG — dat TRUOC moi viec khac.
      //
      // Ban cu dat buoc nay SAU khi tra don hang, va do that ngay 29/10 cho thay no
      // khong bao gio chay cho lan gui lai: tra don loc `status = 'pending'`, don da
      // tra thi khong con pending, nen tra hut, roi roi xuong duong tuong thich cu va
      // tra ve `no_vipro_syntax`. Tien van dung — khong cong hai lan — nhung dung do
      // MAY, va log thi noi doi: "noi dung khong chua ma nhan dien duoc" trong khi
      // noi dung hoan toan hop le, chi la don da tra roi.
      //
      // Dat cong re nhat va dut khoat nhat len dau: no khong can doc gi tu CSDL ngoai
      // mot lan chen, va no dung duoc cho MOI truong hop gui lai.
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
           fastify.log.warn(`[SePay Webhook] Da xu ly roi, bo qua: ${idempotencyKey}`);
           return reply.send({ received: true, idempotent_stop: true });
        }
      }

      /**
       * Nha khoa chong trung de SePay gui lai lan nua.
       *
       * Chi goi o cac duong hong CO THE THU LAI (loi mang, loi doc CSDL). Duong
       * "khong tim thay don" hay "tra thieu tien" thi KHONG nha: gui lai cung ra ket
       * qua y het, va giu khoa lai thi lan sau khong phai chay lai ca luong.
       */
      const nhaKhoa = async () => {
        await supabase.from('idempotency_keys').delete().eq('idempotency_key', idempotencyKey);
      };

      // 4. Xac dinh DON HANG truoc, roi moi ra nguoi mua.
      //
      // Noi dung chuyen khoan co hai dang:
      //   - Moi: "VIPRO P7K3M9QX" - ma gan voi TUNG DON HANG, tra ra dung goi khach da chon.
      //   - Cu:  "VIPRO a1b2c3d4" - 8 ky tu hex dau cua user id, gan voi NGUOI chu khong phai
      //          don hang. Van ho tro vi khach co the da sao chep ma cu tu truoc.
      // Hai dang khong the lan nhau vi "P" khong phai ky tu hex.
      let userId: string | null = null;
      let pending: { id: string; plan_code: string | null; amount: number } | null = null;

      const orderRef = parseOrderRef(content);
      if (orderRef) {
        const { data: pr, error: prErr } = await supabase
          .from('payments')
          .select('id, user_id, plan_code, amount')
          .eq('meta->>ref_code', orderRef)
          .eq('status', 'pending')
          .maybeSingle();
        if (prErr) {
          fastify.log.error(`[SePay Webhook] Loi tra don ${orderRef}: ${prErr.message}`);
          await nhaKhoa();
          return reply.status(500).send({ error: 'ORDER_LOOKUP_FAILED' });
        }
        if (pr) {
          userId = pr.user_id;
          pending = { id: pr.id, plan_code: pr.plan_code, amount: Number(pr.amount) };
        } else {
          fastify.log.warn(`[SePay Webhook] Ma don ${orderRef} khong con don treo nao`);
        }
      }

      if (!userId) {
        // Duong tuong thich nguoc: suy ra nguoi dung tu ma cu.
        const shortId = parseTransferCode(content);
        if (!shortId) {
          // Toi day nghia la: khong doc duoc ma don MOI, va cung khong phai ma CU.
          // Neu noi dung co dang "VIPRO Pxxxxxxx" thi ly do that la don khong con
          // treo nua — noi ro de nguoi doc log khong di tim nham huong.
          fastify.log.warn(
            orderRef
              ? `[SePay Webhook] Ma don ${orderRef} hop le nhung khong con don treo nao — co the da tra roi`
              : `[SePay Webhook] Noi dung khong chua ma nhan dien duoc: ${content}`
          );
          return reply.send({ received: true, note: 'no_vipro_syntax' });
        }

        const minUuid = `${shortId}-0000-0000-0000-000000000000`;
        const maxUuid = `${shortId}-ffff-ffff-ffff-ffffffffffff`;

        // Lay toi da 2 de phat hien trung tien to: chi xu ly khi khop dung mot nguoi.
        const { data: users, error: userErr } = await supabase
          .from('profiles')
          .select('id')
          .gte('id', minUuid)
          .lte('id', maxUuid)
          .limit(2);

        if (userErr) {
          fastify.log.error(`[SePay Webhook] Tra nguoi dung that bai (${shortId}): ${userErr.message}`);
          return reply.status(500).send({ error: 'USER_LOOKUP_FAILED' });
        }
        if (!users || users.length === 0) {
          fastify.log.warn(`[SePay Webhook] Khong thay nguoi dung cho ma: ${shortId}`);
          return reply.send({ received: true, note: 'user_not_found' });
        }
        if (users.length > 1) {
          fastify.log.error(`[SePay Webhook] Ma ${shortId} trung nhieu nguoi - can xu ly tay`);
          return reply.send({ received: true, note: 'ambiguous_user_code' });
        }
        userId = users[0].id;

        // Khong co ma don thi lay y dinh mua gan nhat con treo cua chinh nguoi do.
        const { data: pr } = await supabase
          .from('payments')
          .select('id, plan_code, amount')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pr) pending = { id: pr.id, plan_code: pr.plan_code, amount: Number(pr.amount) };
      }

      // Toi day userId chac chan co gia tri (moi nhanh khong ra duoc deu da return),
      // nhung TypeScript khong thu hep duoc qua khoi gan lai o tren. Guard nay lam
      // bat bien do tuong minh thay vi ep kieu.
      if (!userId) {
        fastify.log.error(`[SePay Webhook] Khong xac dinh duoc nguoi mua tu: ${content}`);
        return reply.status(500).send({ error: 'USER_RESOLUTION_FAILED' });
      }

      const { data: user } = await supabase
        .from('profiles')
        .select('id, referred_by')
        .eq('id', userId)
        .maybeSingle();
      if (!user) {
        fastify.log.error(`[SePay Webhook] Khong doc duoc ho so ${userId}`);
        return reply.status(500).send({ error: 'PROFILE_NOT_FOUND' });
      }


      // 5. So credit lay tu DON HANG khach da chon, khong doan theo so tien.
      //
      // Ban cu doan bang nguong: >=520000 thi 240 credit, >=250000 thi 110, con lai
      // chia 3000. Hau qua: khach chuyen 1.000.000d van chi nhan 240 credit, con chuyen
      // 519.000d thi tut han mot bac. Y dinh mua da duoc ghi vao bang payments ngay luc
      // tao don - truoc day khong ai tra toi no.
      if (!pending || !pending.plan_code) {
        fastify.log.error(
          `[SePay Webhook] Khong tim duoc don treo cho ${userId} (ref=${orderRef ?? 'khong co'}, ` +
          `so tien=${transferAmount}). KHONG tu cong credit - chuyen xu ly tay.`
        );
        return reply.send({ received: true, note: 'no_pending_order_manual_review' });
      }

      const { data: planRow, error: planErr } = await supabase
        .from('plans')
        .select('code, name, credits, price')
        .eq('code', pending.plan_code)
        .maybeSingle();

      if (planErr || !planRow) {
        fastify.log.error(`[SePay Webhook] Khong doc duoc goi ${pending.plan_code}`);
        // Doc bang `plans` hong la loi tam thoi; khong nha khoa thi lan gui lai bi
        // chan vinh vien va khach da tra tien se khong bao gio nhan duoc credit.
        await nhaKhoa();
        return reply.status(500).send({ error: 'PLAN_LOOKUP_FAILED' });
      }

      const planCode = planRow.code;
      let creditsToGrant = Number(planRow.credits);
      const expectedAmount = Math.round(Number(planRow.price));

      // Thieu qua 2% thi khong cong: co the khach go nham so tien.
      if (transferAmount < expectedAmount * 0.98) {
        fastify.log.warn(
          `[SePay Webhook] Thieu tien cho don ${pending.id}: nhan ${transferAmount}/${expectedAmount}. ` +
          `Giu nguyen pending, cho xu ly tay.`
        );
        return reply.send({ received: true, note: 'underpaid_manual_review' });
      }

      // Thua tien thi quy phan du ra credit theo dung don gia cua goi do,
      // thay vi im lang nuot phan thua nhu ban cu.
      if (transferAmount > expectedAmount && expectedAmount > 0 && Number(planRow.credits) > 0) {
        const unitPrice = expectedAmount / Number(planRow.credits);
        const extra = Math.floor((transferAmount - expectedAmount) / unitPrice);
        if (extra > 0) {
          creditsToGrant += extra;
          fastify.log.info(
            `[SePay Webhook] Thua ${transferAmount - expectedAmount}d -> cong them ${extra} credit`
          );
        }
      }

      // 6. Danh dau chinh DON HANG do la da tra.
      //
      // Ban cu chen mot ban ghi 'paid' MOI roi danh dau moi don treo cua nguoi nay thanh
      // 'failed' - ke ca chinh don vua duoc tra. Ket qua la lich su hien mot don that bai
      // va mot don thanh cong cho cung mot lan mua, con ref_code trong meta thi mat lien ket.
      const { data: paymentRow, error: payErr } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          provider_txn_id: referenceCode,
          amount: transferAmount,
          idempotency_key: idempotencyKey,
        })
        .eq('id', pending.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (payErr || !paymentRow) {
        // Tra lai khoa chong trung de SePay gui lai, neu khong lan sau se bi chan nham.
        await nhaKhoa();
        fastify.log.error(
          `[SePay Webhook] Khong cap nhat duoc don ${pending.id}: ${payErr?.message ?? 'khong con pending'}`
        );
        return reply.status(500).send({ error: 'PAYMENT_UPDATE_FAILED' });
      }

      // Cac y dinh mua cu con treo cua nguoi nay coi nhu khong thanh: ho da tra bang don khac.
      // Enum payment_status chi co pending|paid|failed|refunded nen dung 'failed'.
      const { error: staleErr } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .neq('id', paymentRow.id);
      if (staleErr) {
        fastify.log.warn(`[SePay Webhook] Khong don duoc don treo cu cua ${userId}: ${staleErr.message}`);
      }

      // Buyer +10% bonus
      let finalCreditsToGrant = creditsToGrant;
      if (user.referred_by) {
        finalCreditsToGrant = Math.floor(creditsToGrant * 1.1);
        fastify.log.info(`[SePay Webhook] User ${userId} has referrer, granting +10% bonus credits: ${finalCreditsToGrant}`);
      }

      // 7. Cong credit — va PHAI kiem tra ket qua.
      //
      // Ban cu gan `creditResult` roi khong doc. Ledger ghi hong thi don van 'paid',
      // webhook van tra `success: true, credits_granted: N`, va khach mat tien ma
      // khong co credit nao — khong mot loi nao bao. Day la lo thung tien ton tai
      // im lang: khong ai di soat mot don da ghi la da tra.
      const creditResult = await CreditService.grantToLedger(
        userId,
        finalCreditsToGrant,
        `sepay_${planCode}`,
        paymentRow?.id
      );

      if (!creditResult.success) {
        // Tra don ve 'pending' va nha khoa chong trung, de lan SePay gui lai chay lai
        // tron ven ca luong nay va cong duoc credit. Tu lanh qua duong san co, khong
        // can duong sua rieng.
        //
        // Neu khong co lan gui lai nao: don nam o 'pending' van dung hon 'paid' —
        // "da nhan tien, chua giao hang" thi con nguoi nhin thay, con 'paid' khong
        // credit thi trong nhu da xong va khong ai mo ra xem.
        await supabase.from('payments').update({ status: 'pending' }).eq('id', paymentRow.id);
        await nhaKhoa();

        const loi =
          `[SePay Webhook] NGHIEM TRONG: da nhan ${transferAmount}d cua ${userId} ` +
          `nhung KHONG cong duoc ${finalCreditsToGrant} credit (don ${paymentRow.id}, ` +
          `goi ${planCode}, ref ${referenceCode}): ${creditResult.error}`;
        fastify.log.error(loi);
        MockSentry.captureException(new Error(loi), { userId, paymentId: paymentRow.id });

        return reply.status(500).send({ error: 'CREDIT_GRANT_FAILED' });
      }

      // Bao cho khach bang email. KHONG `await`: thu la viec phu, webhook phai tra
      // loi SePay nhanh. `baoThanhToanXong` tu nuot moi loi nen khong can bat o day.
      void baoThanhToanXong({
        userId,
        // Ten HIEN THI cua goi, khong phai ma noi bo: khach doc "Starter" chu
        // khong doc "starter". Day la cung loai ro ri da gap o hook "budget".
        tenGoi: String((planRow as any).name || planCode),
        soTien: transferAmount,
        creditNhan: creditsToGrant,
        creditThuong: finalCreditsToGrant - creditsToGrant,
      });

      // 8. Hoa hong tra bang TIEN (VND).
      //
      // Tren nen kinh te V3 thi tra tien van du bien: gia von mot video khoang 70d
      // (giong doc va render deu chay tren may ca nhan, khong ton phi bien doi), nen
      // goi Seller 99.000d con lai ~80% sau khi tru 66 credit va hoa hong 15%.
      // Con so "lo" trong ban V2 ung voi stack phai mua TTS va thue render (1.400d/video),
      // khong con dung voi V3.
      //
      // CANH BAO khi doi huong: neu sau nay chuyen sang TTS tra phi hoac render tren cloud,
      // gia von moi video tang len hang nghin dong va hoa hong tien mat tren goi re nhat
      // se an het bien. Phai tinh lai truoc khi doi.
      if (user.referred_by) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id')
          .eq('affiliate_code', user.referred_by)
          .maybeSingle();

        if (referrer && referrer.id !== userId) {
          const { data: pastEvents } = await supabase
            .from('affiliate_events')
            .select('commission_amount')
            .eq('referrer_id', referrer.id)
            .neq('status', 'rejected');

          const totalAccVnd = (pastEvents || []).reduce(
            (acc, ev) => acc + Number(ev.commission_amount || 0),
            0
          );
          const commissionRate = totalAccVnd >= 2500000 ? 0.15 : 0.10;

          // Tinh tren GIA NIEM YET cua goi, khong tren so tien thuc nhan: khach go nham
          // them mot so 0 thi hoa hong khong duoc phong theo.
          const commissionVnd = Math.round(expectedAmount * commissionRate);

          if (commissionVnd > 0) {
            await supabase.from('affiliate_events').insert({
              referrer_id: referrer.id,
              referred_id: userId,
              payment_id: paymentRow?.id,
              status: 'pending',
              commission_amount: commissionVnd,
              meta: {
                unit: 'vnd',
                eventType: 'recurring_conversion',
                planCode,
                grossAmountVnd: expectedAmount,
                receivedAmountVnd: transferAmount,
                commissionRate,
                tierApplied: commissionRate === 0.15 ? 'gold' : 'silver',
                holdUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                reason: 'Hoa hong tien mat tu giao dich SePay.',
                providerTxnId: referenceCode,
              },
            });
          }
        }
      }

      return reply.send({ received: true, success: true, credits_granted: finalCreditsToGrant });
    } catch (err: any) {
      fastify.log.error(`[SePay Webhook] Error: ${err.message}`);
      return reply.status(500).send({ error: err.message });
    }
  });

}
