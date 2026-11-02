import { FastifyInstance } from 'fastify';
import { CompositionService } from '../services/composition.service';
import { CreditService } from '../services/credit.service';
import { creditsFor, specFromRender, specFromRequest, giaiThichCredit } from '../lib/credit-cost';
import { isSecretConfigured, safeEqual } from '../lib/security';
import { requireProjectOwner, requireRenderOwner } from '../lib/auth';
import { baoVideoXong } from '../services/email.notify';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function renderRoutes(fastify: FastifyInstance) {

  // POST /render/start — enqueue a new render job
  fastify.post('/start', async (request, reply) => {
    try {
      // rawInput la duong chay CA 4 TANG. sceneGraph chi dung khi da co do thi canh
      // san (tu trang kich ban). Truoc day route khong nhan rawInput nen wizard phai
      // nhet du lieu san pham vao sceneGraph — worker tuong da co scene graph va bo
      // qua tang 1-2-3.
      const { projectId, sceneGraph, rawInput, aspect = '9:16', mode = 'draft_local' } = request.body as any;
      if (!projectId) return reply.status(400).send({ error: 'Missing projectId' });

      const userId = await requireProjectOwner(request, reply, projectId);
      if (!userId) return reply;

      const result = await CompositionService.startComposition(projectId, sceneGraph, aspect, mode, rawInput);
      return reply.send({ success: true, renderId: result.id, status: result.status, traceId: result.traceId });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /render/phuong-an — chay tang 1 + 2, tra ve cac phuong an cho khach CHON.
   *
   * Vi sao co man hinh nay: he thong van luon sinh du ba phuong an roi lay cai dau
   * tien va vut hai cai con lai. Khach khong he biet minh co lua chon, va khi brief
   * yeu thi ho nhan mot cau hook chung chung ma khong hieu vi sao.
   *
   * Khong CHAN khi brief yeu — chan la khach mat ca video. Thay vao do noi ro he
   * thong hieu duoc gi, thieu gi, roi de khach tich.
   *
   * Khong tru credit: day moi la xem truoc, chua dung video nao.
   */
  /**
   * POST /render/tim-dau — tìm dấu bản quyền trên ảnh của dự án.
   *
   * ── Vì sao trả về ỨNG VIÊN chứ không tự xoá ──
   *
   * Đo ngày 31/10 trên 10 dự án thật: bộ dò tìm đúng dấu trên 2 dự án, loại sạch chữ
   * của sản phẩm trên 6, nhưng vẫn cho dương tính giả trên 2 — "ninhle.com" in trên
   * vỏ hộp, và rác OCR đọc thành "qua"/"rad".
   *
   * Về mặt pixel, dấu của sàn và chữ in trên hộp giống hệt nhau. Xoá tự động theo kết
   * quả dò là cắt mất sản phẩm của khách. Nên route này chỉ đề xuất; khách tích cái
   * nào thì khung đó mới đi vào `raw_input.watermark_boxes`.
   *
   * KHÔNG trừ credit: đây mới là xem trước.
   */
  fastify.post('/tim-dau', async (request, reply) => {
    try {
      const { projectId } = request.body as any;
      if (!projectId) return reply.status(400).send({ error: 'Missing projectId' });

      const userId = await requireProjectOwner(request, reply, projectId);
      if (!userId) return reply;

      // Nạp muộn: cả hai lib đều gọi tiến trình ngoài, không nên nằm trong đường khởi động.
      const { timDauChoDuAn } = await import('../services/dau-anh.service');
      const ra = await timDauChoDuAn(projectId);
      return reply.send({ success: true, ...ra });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/phuong-an', async (request, reply) => {
    try {
      const { projectId, rawInput } = request.body as any;
      if (!projectId) return reply.status(400).send({ error: 'Missing projectId' });

      const userId = await requireProjectOwner(request, reply, projectId);
      if (!userId) return reply;

      // Nap tre, khong import o dau file: `pipeline.service` keo theo `llm.provider`,
      // ma file do goi `dotenv/config` ngay luc import. Nap som la moi lan dang ky
      // route deu doc `.env` — du chi dung route khac — va dieu do da lam vo test
      // "callback fail-closed", vi test do dua tren tien de secret CHUA duoc cau hinh.
      const { PipelineService } = await import('../services/pipeline.service');
      const { napAnhSanPham, tuDanhSachUrl } = await import('../lib/product-vision');

      const anh = tuDanhSachUrl(rawInput?.image_urls);
      const traceId = `phuongan-${projectId.slice(0, 8)}`;
      const anhChoModel = await napAnhSanPham(anh, traceId);

      const brief = await PipelineService.generateBrief(
        {
          title: rawInput?.product_title || rawInput?.product_summary || 'San pham',
          raw_description: rawInput?.product_summary || '',
          source_url: rawInput?.product_url || '',
          target_platform: 'tiktok',
          preferred_tone: rawInput?.preferred_tone || '',
          desired_duration_sec: rawInput?.duration_seconds || 20,
          audience_hint: rawInput?.target_audience || '',
          key_points_user: rawInput?.promo_text || '',
          do_not_say: rawInput?.do_not_say || '',
          image_count: anh.length,
          image_notes: anh.map((a) => a.url.split('/').pop()).join(', '),
        },
        traceId,
        anhChoModel
      );

      const strategies = await PipelineService.generateStrategies(brief, traceId);

      // Chi noi nhung gi KHACH sua duoc. "needs_human_review" la tu cua he thong,
      // khach khong lam gi voi no — con "chua ro ten san pham" thi ho go mot dong la xong.
      const canSua: string[] = [];
      if (brief.visual_inputs?.has_real_product_images === false && anh.length > 0) {
        canSua.push('Anh tai len trong khong giong anh san pham — thu tai anh chup chinh san pham');
      }
      if (anhChoModel.length === 0 && anh.length > 0) {
        canSua.push('Khong doc duoc anh nao, nen video se dua hoan toan vao phan mo ta');
      }
      for (const m of (brief.missing_info ?? []).slice(0, 3)) canSua.push(m);

      return reply.send({
        hieuDuoc: {
          ten: brief.product_title,
          moTa: brief.core_offer,
          loiIch: brief.key_benefits ?? [],
          soAnhDocDuoc: anhChoModel.length,
          soAnhTaiLen: anh.length,
        },
        phuongAn: strategies.map((s) => ({
          gocTiepCan: s.angle_type,
          hook: s.primary_hook,
          gocNhin: s.creative_angle,
          cta: s.cta,
          // Gui nguyen phuong an de luc dung khong phai sinh lai — hook khach nhan
          // dung bang hook khach da tich.
          nguyenVan: s,
        })),
        canSua,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /render/callback — physical worker signals status update
  fastify.post('/callback', async (request, reply) => {
    try {
      // Fail-closed: xác thực worker trước mọi xử lý; thiếu secret thì từ chối toàn bộ callback
      const secret = process.env.INTERNAL_CALLBACK_SECRET;
      if (!isSecretConfigured(secret)) {
        fastify.log.error('[Render Callback] INTERNAL_CALLBACK_SECRET not set — rejecting callback');
        return reply.status(503).send({ error: 'CALLBACK_SECRET_NOT_CONFIGURED' });
      }
      const incomingSecret = (request.headers['x-callback-secret'] as string) || '';
      if (!safeEqual(incomingSecret, secret)) {
        return reply.status(403).send({ error: 'UNAUTHORIZED_CALLBACK' });
      }

      const { renderId, status, error_code, error_message, output_url } = request.body as any;
      if (!renderId || !status) return reply.status(400).send({ error: 'Missing renderId or status' });

      const { data: render } = await supabase.from('renders').select('*').eq('id', renderId).single();
      if (!render) return reply.status(404).send({ error: 'Render not found' });

      // Check if project was trashed/cancelled
      const { data: project } = await supabase.from('projects').select('user_id, title, deleted_at, cancel_requested_at').eq('id', render.project_id).single();
      
      if (project && (project.deleted_at || project.cancel_requested_at)) {
        fastify.log.warn(`[Render Callback] Project ${render.project_id} was trashed/cancelled. Ignoring export and marking as orphaned.`);
        // 'cancelled' chu khong phai 'deleted_pending_cleanup'.
        //
        // Gia tri cu KHONG co trong enum render_status — hoi thang Postgres ngay
        // 01/11/2026: "invalid input value for enum render_status". Lenh nay vi the
        // THAT BAI moi lan chay, va vi khong ai doc `error` nen no hong trong im lang:
        // render cua du an da xoa giu nguyen trang thai cu mai mai.
        const { error: loiHuy } = await supabase.from('renders').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          output_url: output_url ?? render.output_url,
          updated_at: new Date().toISOString(),
        }).eq('id', renderId);
        if (loiHuy) {
          fastify.log.error(`[Render Callback] Khong danh dau duoc render ${renderId} la da huy: ${loiHuy.message}`);
          return reply.status(500).send({ success: false, error: 'CANCEL_MARK_FAILED' });
        }
        return reply.send({ success: true, message: 'Render marked as orphaned due to project cancellation.' });
      }

      // Chi tru credit khi job sang trang thai CUOI, va chi mot lan.
      //
      // Ban cu viet ['completed', 'exported']. 'exported' KHONG co trong enum
      // render_status ('pending'|'queued'|'processing'|'completed'|'failed'|'cancelled')
      // — no den tu src/queues/job-types.ts, mot bo trang thai tuong tuong cua thoi
      // BullMQ. Day la so sanh doc nen khong nem loi, chi la khong bao gio khop.
      // Da xoa src/queues/ ngay 01/11/2026.
      const finalStatuses = ['completed'];
      if (finalStatuses.includes(status) && !finalStatuses.includes(render.status)) {
        if (project) {
          // So credit theo THU KHACH NHAN DUOC, khong viet cung.
          //
          // Ban cu tru 20 credit moi video. Goi Free co 5 credit nen khong lam noi mot
          // video nao, va goi Pro 130.000d/50 credit chi ra 2,5 video — tuc 52.000d moi
          // video. Do la loi product-market fit, phat hien 28/10.
          // Tinh theo DON KHACH DAT, khong theo thu AI dung ra.
          //
          // Giao dien bao gia truoc khi dung bang dung cong thuc nay tren dung nhung
          // lua chon nay, nen so bao va so tru luon bang nhau. Ban cu doc thoi luong
          // tu timeline cua ke hoach dung: khach dat 20 giay ma ke hoach ra 21 giay la
          // bi tru gap doi, do may quyet, khong bao truoc duoc.
          //
          // `specFromRender` chi con la duong lui cho dong render cu khong co raw_input.
          const rawInput = (render as any)?.raw_input;
          const spec = rawInput
            ? specFromRequest(rawInput, (render as any)?.render_mode)
            : specFromRender(render as any, (render as any)?.render_plan_json);
          const soCredit = creditsFor(spec);

          // Ghi ro TAI SAO la con so do, de sau nay doi chieu duoc voi man hinh bao gia.
          const giaiThich = giaiThichCredit(spec)
            .map((d) => `${d.nhan}: ${d.credit}`)
            .join('; ');
          fastify.log.info(
            `[Render Callback] Tru ${soCredit} credit cho render ${renderId} — ${giaiThich}`
          );

          const deduction = await CreditService.deductToLedger(
            project.user_id,
            render.project_id,
            renderId,
            soCredit,
            `render_completed: ${giaiThich}`
          );
          if (!deduction.success) {
            await supabase.from('renders').update({
              status: 'failed',
              error_message: 'Không đủ xu để xuất bản.',
            }).eq('id', renderId);
            return reply.send({ success: false, error: 'INSUFFICIENT_CREDITS' });
          }

          // Bao khach video da xong. KHONG `await`: callback phai tra loi worker
          // nhanh, va `baoVideoXong` tu nuot moi loi.
          //
          // Chi gui khi credit da tru THANH CONG — thu nay neu ro so credit da dung
          // va so du con lai, noi truoc khi tru la noi mot con so chua dung.
          void baoVideoXong({
            userId: project.user_id,
            tenVideo: (project as any).title || 'Video của bạn',
            linkVideo: output_url ?? render.output_url ?? '',
            soCreditDaTru: soCredit,
          });
        }
      }

      await supabase.from('renders').update({
        status,
        error_code: error_code || null,
        error_message: error_message || null,
        output_url: output_url ?? render.output_url,
        updated_at: new Date().toISOString(),
      }).eq('id', renderId);

      return reply.send({ success: true });
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // POST /render/retry — re-enqueue a failed render
  fastify.post('/retry', async (request, reply) => {
    try {
      const { renderId } = request.body as any;

      // Kiem quyen so huu TRUOC moi thu khac.
      //
      // Truoc 02/11/2026 route nay khong kiem gi: bat ky ai biet mot renderId deu xep
      // lai duoc hang doi render cua nguoi khac — dot CPU va TRU CREDIT cua chu so huu.
      // `renders` khong co cot user_id nen phai di qua project_id -> projects.user_id.
      const chu = await requireRenderOwner(request, reply, renderId);
      if (!chu) return reply; // requireRenderOwner da gui 400/401/403/404

      const render = chu.render;
      // Chi 'failed'. 'retryable_failed' khong co trong enum render_status nen
      // khong dong nao mang gia tri do — phan tu chet trong mang JS.
      if (!['failed'].includes(render.status)) {
        return reply.status(400).send({ error: 'Render cannot be retried in current state.' });
      }
      const result = await CompositionService.retryRender(renderId);
      return reply.send({ success: true, status: result.status, traceId: result.traceId });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /render/export — ĐANG TẮT, chờ quyết định.
   *
   * Bản cũ kiểm `render.status !== 'preview_ready'`. Giá trị đó KHÔNG có trong enum
   * `render_status`, nên điều kiện LUÔN đúng và endpoint luôn trả 400 — nó chưa bao
   * giờ chạy. Hỏi thẳng Postgres ngày 01/11/2026 để xác nhận.
   *
   * KHÔNG sửa thành 'completed' để bật nó lên, vì endpoint này **không kiểm quyền sở
   * hữu**: bật lên là biến một endpoint chết thành chỗ cho bất kỳ ai xếp lại hàng đợi
   * render của người khác — đốt CPU và trừ credit của chủ sở hữu. Phải thêm
   * `requireProjectOwner` trước, và đó là thay đổi định tuyến cần duyệt.
   */
  fastify.post('/export', async (_request, reply) => {
    return reply.status(503).send({
      error: 'EXPORT_DISABLED',
      message: 'Chức năng xuất lại đang tắt. Dùng /render/retry.',
    });
  });

  // POST /render/upload - internal API to securely upload rendered videos
  fastify.post('/upload', async (request, reply) => {
    try {
      const authHeader = request.headers['authorization'];
      const timestampStr = request.headers['x-timestamp'] as string;
      const idempotencyKey = request.headers['x-idempotency-key'] as string;

      if (!authHeader || !timestampStr || !idempotencyKey) {
        return reply.status(401).send({ error: 'Missing security headers' });
      }

      // 1. Replay Protection: Check timestamp (within 5 minutes)
      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();
      if (isNaN(timestamp) || Math.abs(now - timestamp) > 5 * 60 * 1000) {
        return reply.status(401).send({ error: 'Request expired or invalid timestamp' });
      }

      // 2. HMAC Validation
      const secret = process.env.INTERNAL_CALLBACK_SECRET;
      if (!secret || secret === 'CHANGE_ME_IN_PRODUCTION') {
        return reply.status(500).send({ error: 'Server misconfiguration' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestampStr}:${idempotencyKey}`)
        .digest('hex');

      const providedSignature = authHeader.replace('HMAC ', '');
      if (!safeEqual(providedSignature, expectedSignature)) {
        return reply.status(401).send({ error: 'Invalid HMAC signature' });
      }

      // 3. Process Multipart File
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Strict MIME check
      if (data.mimetype !== 'video/mp4') {
        return reply.status(400).send({ error: 'Invalid file type. Only video/mp4 is allowed.' });
      }

      // Generate UUID filename (ignore client filename completely)
      const fileId = crypto.randomUUID();
      const filename = `${fileId}.mp4`;
      
      const outputDir = path.resolve(process.env.RENDER_OUTPUT_DIR || '../renders_output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const savePath = path.join(outputDir, filename);

      // Save file using pipeline
      await pipeline(data.file, fs.createWriteStream(savePath));

      if (data.file.truncated) {
        // Truncated because it exceeded the size limit
        if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
        return reply.status(413).send({ error: 'File size limit exceeded' });
      }

      // Determine the public URL — use backend public base URL (not frontend URL)
      // BACKEND_PUBLIC_BASE_URL = https://api.ninhle.com/api/v1 (via Cloudflare tunnel)
      // Strip /api/v1 suffix to get the root: https://api.ninhle.com
      const backendBase = (process.env.BACKEND_PUBLIC_BASE_URL || 'http://localhost:3001/api/v1')
        .replace(/\/api\/v1\/?$/, '');
      const publicUrl = `${backendBase}/local-renders/${filename}`;


      return reply.send({ success: true, fileId, url: publicUrl });

    } catch (e: any) {
      fastify.log.error(e);
      return reply.status(500).send({ error: e.message });
    }
  });

  // GET /render/status/:renderId — poll render status
  fastify.get('/status/:renderId', async (request, reply) => {
    try {
      const { renderId } = request.params as any;

      // Truoc 02/11/2026 route nay tra ve trang thai VA output_url cua bat ky render
      // nao cho bat ky ai goi. renderId la UUID nen khong do duoc bang vet can, nhung
      // mot URL lo qua log, qua referrer hay qua mot anh chup man hinh la du.
      const chu = await requireRenderOwner(request, reply, renderId);
      if (!chu) return reply;

      const result = await CompositionService.getJobStatus(renderId);
      if (result.status === 'not_found') return reply.status(404).send({ error: 'Render not found' });
      return reply.send({ success: true, render: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
