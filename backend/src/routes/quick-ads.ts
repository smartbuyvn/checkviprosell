/**
 * Viprosell — Quick Ads Route (Phase 1.5 — Internal/Team Use)
 * Prefix: /api/v1/quick-ads
 *
 * Endpoints:
 *   POST /generate  → Generate SceneGraph for preview (no render cost)
 *   POST /render    → Start MP4 render job (async, after user approves preview)
 *   GET  /status/:jobId → Poll render job status
 *   GET  /cost-log  → View first 50 render cost logs (internal monitoring)
 */

import { FastifyInstance } from 'fastify';
import { getVerifiedUserId, isAdmin, requireProjectOwner, requireRenderOwner } from '../lib/auth';
import { isSecretConfigured, safeEqual } from '../lib/security';
import { assertAllowedUrl, BlockedUrlError } from '../lib/fetch-guard';
import { aiEnabled, checkDailyBudget, checkRate } from '../lib/rate-limit';

// Trần mỗi user mỗi giờ cho các route tốn tiền AI/render
const QUICK_ADS_PER_HOUR = Number(process.env.QUICK_ADS_PER_HOUR || '30');
import { QuickAdsRenderService } from '../services/quick-ads-render.service';
import { validateSceneGraph } from '../types/scene-graph.validator';

/**
 * Internal API key guard — fail-closed on a missing or placeholder INTERNAL_API_TOKEN.
 * Không còn nhánh "cho qua nếu IP là localhost": API chạy sau nginx proxy tới 127.0.0.1,
 * nên mọi request từ internet đều trông như localhost và nhánh đó mở toang endpoint.
 */
function isInternalRequest(request: any): boolean {
  const configuredToken = process.env.INTERNAL_API_TOKEN;
  if (!isSecretConfigured(configuredToken)) {
    console.error('[QuickAds] INTERNAL_API_TOKEN not set — rejecting internal request');
    return false;
  }
  const token = (request.headers['x-internal-token'] as string | undefined) ?? '';
  return safeEqual(token, configuredToken);
}

export async function quickAdsRoutes(fastify: FastifyInstance) {

  // Mọi route quick-ads tốn chi phí AI/render hoặc lộ log chi phí → bắt buộc user đã xác minh
  fastify.addHook('preHandler', async (request, reply) => {
    // Script giám sát dùng internal token, không có phiên người dùng
    if (isInternalRequest(request)) return;
    const userId = await getVerifiedUserId(request.headers.authorization);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    (request as any).viprosellUserId = userId;

    // Chỉ chắn các route tốn tiền; /status và /cost-log chỉ đọc
    if (request.method !== 'POST') return;

    if (!(await aiEnabled())) {
      return reply.status(503).send({ error: 'AI_PAUSED', detail: 'Hệ thống đang tạm dừng tạo video.' });
    }

    const budget = await checkDailyBudget();
    if (!budget.withinBudget) {
      fastify.log.error(
        `[QuickAds] Chạm trần credit theo ngày: ${budget.usedCredits}/${budget.limitCredits}`
      );
      return reply.status(503).send({ error: 'DAILY_BUDGET_REACHED' });
    }

    const decision = checkRate(`quick-ads:${userId}`, QUICK_ADS_PER_HOUR, 3_600_000);
    if (!decision.allowed) {
      reply.header('retry-after', Math.ceil(decision.retryAfterMs / 1000));
      return reply.status(429).send({ error: 'RATE_LIMITED', retry_after_ms: decision.retryAfterMs });
    }
  });

  // ── POST /generate ──────────────────────────────────────────────────────────
  // Generates a SceneGraph JSON from product input.
  // Returns SceneGraph + content_guard results for frontend preview.
  // Safe to call multiple times — no render cost.
  fastify.post<{
    Body: {
      product_title: string;
      product_summary: string;
      product_price?: string;
      promo_text?: string;
      target_audience?: string;
      aspect_ratio?: '9:16' | '1:1';
      duration_seconds?: number;
      image_urls: string[];
      hook_mode?: 'price' | 'solution' | 'testimonial';
      goal?: 'traffic' | 'conversion';
    };
  }>('/generate', async (request, reply) => {
    try {
      const body = request.body;

      if (!body.product_title?.trim()) {
        return reply.status(400).send({ error: 'product_title is required' });
      }
      if (!body.product_summary?.trim()) {
        return reply.status(400).send({ error: 'product_summary is required' });
      }
      if (!Array.isArray(body.image_urls) || body.image_urls.length === 0) {
        return reply.status(400).send({ error: 'image_urls must be a non-empty array' });
      }
      if (body.image_urls.length > 6) {
        return reply.status(400).send({ error: 'Maximum 6 image URLs allowed' });
      }

      const result = await QuickAdsRenderService.generatePreview(body);

      return reply.send({
        success: true,
        scene_graph: result.scene_graph,
        warnings: result.warnings,
        content_guard: {
          passed: result.content_guard.passed,
          errors: result.content_guard.errors,
          warnings: result.content_guard.warnings,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── POST /render ────────────────────────────────────────────────────────────
  // Starts an async render job. Returns job_id immediately.
  // Client must poll /status/:jobId to get result.
  // Requires scene_graph to already be validated (from /generate endpoint).
  fastify.post<{
    Body: { scene_graph: unknown; render_plan?: unknown; image_urls?: string[] };
  }>('/render', async (request, reply) => {
    try {
      const { scene_graph, render_plan, image_urls } = request.body;

      let validTitle = 'Sản phẩm';
      let validGraph = undefined;

      if (scene_graph) {
        // Validate before accepting job if scene_graph is provided
        const validation = validateSceneGraph(scene_graph);
        if (!validation.valid) {
          return reply.status(400).send({
            error: 'Invalid scene_graph',
            validation_errors: validation.errors,
          });
        }
        validTitle = validation.data?.meta?.title || 'Sản phẩm';
        validGraph = validation.data;
      }

      if (!image_urls || image_urls.length === 0) {
        // Allow passing product_url instead
        const product_url = (request.body as any).product_url;
        if (!product_url) {
          return reply.status(400).send({ error: 'image_urls or product_url is required for rendering' });
        }
      }

      // Chắn SSRF ngay tại cửa: worker cũng chắn, nhưng báo lỗi ở đây thì user biết liền
      // thay vì chờ job chạy rồi mới chết.
      for (const candidate of image_urls || []) {
        try {
          await assertAllowedUrl(candidate);
        } catch (err: any) {
          if (err instanceof BlockedUrlError) {
            return reply.status(400).send({ error: 'IMAGE_URL_REJECTED', detail: err.message });
          }
          throw err;
        }
      }

      /**
       * Render PHẢI có chủ sở hữu trước khi được tạo.
       *
       * Trước 02/11/2026 route này gọi `startRender` không kèm dự án, nên dòng `renders`
       * sinh ra với `project_id` rỗng. Bảng `renders` không có cột `user_id` — quyền sở
       * hữu đi qua `project_id → projects.user_id` — nên một dòng không dự án là một
       * dòng KHÔNG AI kiểm được quyền. `/status/:jobId` vì thế trả `output_url` của bất
       * kỳ job nào cho bất kỳ người đã đăng nhập nào.
       *
       * Ba đường vào, theo thứ tự ưu tiên:
       *   1. Thân yêu cầu có `project_id` → kiểm người gọi có sở hữu nó không.
       *   2. Có người dùng đã xác minh → tự tạo một dự án `quick_ads` của họ.
       *   3. Không cả hai (token nội bộ không có phiên người dùng) → từ chối.
       */
      const userId = (request as any).viprosellUserId as string | undefined;
      const duAnGui = (request.body as any).project_id as string | undefined;
      let projectId: string;

      if (duAnGui) {
        const chu = await requireProjectOwner(request, reply, duAnGui);
        if (!chu) return reply; // da gui 401/403/404
        projectId = duAnGui;
      } else if (userId) {
        const tao = await QuickAdsRenderService.taoDuAnQuickAds(userId, {
          product_title: (request.body as any).product_title || validTitle,
          product_url: (request.body as any).product_url,
        });
        if (!tao.projectId) {
          return reply.status(500).send({ error: 'PROJECT_CREATE_FAILED', detail: tao.error });
        }
        projectId = tao.projectId;
      } else {
        // Token noi bo di qua hook xac thuc nen khong co phien nguoi dung. No dung duoc
        // cho /cost-log (chi doc), nhung tao render thi phai co chu.
        return reply.status(400).send({
          error: 'OWNER_REQUIRED',
          detail: 'Render phai co chu so huu: dang nhap, hoac gui project_id.',
        });
      }

      const job = await QuickAdsRenderService.startRender({
        product_title: (request.body as any).product_title || validTitle,
        product_summary: (request.body as any).product_summary || validTitle,
        image_urls: image_urls || [],
        product_url: (request.body as any).product_url,
        scene_graph: validGraph,
        render_plan,
      }, projectId);

      return reply.status(202).send({
        success: true,
        job_id: job.job_id,
        status: job.status,
        message: 'Render job started. Poll /status/:jobId for result.',
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── GET /status/:jobId ───────────────────────────────────────────────────────
  fastify.get<{ Params: { jobId: string } }>('/status/:jobId', async (request, reply) => {
    /**
     * Hook `preHandler` đã bắt buộc token, nhưng đó là XÁC THỰC chứ không phải PHÂN QUYỀN.
     * Trước 02/11/2026 bất kỳ người đã đăng nhập nào cũng đọc được trạng thái và
     * `output_url` của job người khác — chỉ cần biết `jobId`.
     *
     * `jobId` chính là `renders.id`, nên `requireRenderOwner` dùng được trực tiếp. Nó
     * cũng từ chối những dòng render cũ không có `project_id`: những dòng đó không ai
     * chứng minh được quyền, nên không ai được đọc.
     */
    const chu = await requireRenderOwner(request, reply, request.params.jobId);
    if (!chu) return reply; // da gui 400/401/403/404

    const job = await QuickAdsRenderService.getJob(request.params.jobId);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    return reply.send({
      success: true,
      job_id: job.job_id,
      status: job.status,
      output_url: job.output_url,
      render_time_ms: job.render_time_ms,
      file_size_bytes: job.file_size_bytes,
      error: job.error,
      warnings: job.warnings,
      progress: job.progress,
    });
  });

  // ── GET /cost-log ─────────────────────────────────────────────────────────
  // Internal monitoring — first 50 render jobs cost log
  fastify.get('/cost-log', async (request, reply) => {
    // Log chi phí chỉ dành cho admin, hoặc script giám sát có internal token
    const userId = (request as any).viprosellUserId as string | undefined;
    const adminOk = userId ? await isAdmin(userId) : false;
    if (!adminOk && !isInternalRequest(request)) {
      return reply.status(403).send({ error: 'Forbidden. Admin role required.' });
    }
    const logs = await QuickAdsRenderService.getCostLogs();
    const summary = {
      total_jobs: logs.length,
      completed: logs.filter((l) => l.status === 'completed').length,
      failed: logs.filter((l) => l.status === 'failed').length,
      avg_render_time_ms:
        logs.filter((l) => l.render_time_ms).reduce((sum, l) => sum + (l.render_time_ms ?? 0), 0) /
        (logs.filter((l) => l.render_time_ms).length || 1),
      avg_file_size_mb:
        logs.filter((l) => l.file_size_bytes).reduce((sum, l) => sum + (l.file_size_bytes ?? 0), 0) /
        (logs.filter((l) => l.file_size_bytes).length || 1) / 1024 / 1024,
    };
    return reply.send({ success: true, summary, logs });
  });
}
