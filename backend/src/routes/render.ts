import { FastifyInstance } from 'fastify';
import { CompositionService } from '../services/composition.service';
import { CreditService } from '../services/credit.service';
import { isSecretConfigured, safeEqual } from '../lib/security';
import { requireProjectOwner } from '../lib/auth';
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
      const { projectId, sceneGraph, aspect = '9:16', mode = 'draft_local' } = request.body as any;
      if (!projectId) return reply.status(400).send({ error: 'Missing projectId' });

      const userId = await requireProjectOwner(request, reply, projectId);
      if (!userId) return reply;

      const result = await CompositionService.startComposition(projectId, sceneGraph, aspect, mode);
      return reply.send({ success: true, renderId: result.id, status: result.status, traceId: result.traceId });
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
      const { data: project } = await supabase.from('projects').select('user_id, deleted_at, cancel_requested_at').eq('id', render.project_id).single();
      
      if (project && (project.deleted_at || project.cancel_requested_at)) {
        fastify.log.warn(`[Render Callback] Project ${render.project_id} was trashed/cancelled. Ignoring export and marking as orphaned.`);
        await supabase.from('renders').update({
          status: 'deleted_pending_cleanup',
          output_url: output_url ?? render.output_url,
          updated_at: new Date().toISOString(),
        }).eq('id', renderId);
        return reply.send({ success: true, message: 'Render marked as orphaned due to project cancellation.' });
      }

      // Credit deduction — only on 'completed'/'exported', only once per render
      const finalStatuses = ['completed', 'exported'];
      if (finalStatuses.includes(status) && !finalStatuses.includes(render.status)) {
        if (project) {
          const deduction = await CreditService.deductToLedger(
            project.user_id,
            render.project_id,
            renderId,
            20,
            'render_export'
          );
          if (!deduction.success) {
            await supabase.from('renders').update({
              status: 'failed',
              error_message: 'Không đủ xu để xuất bản.',
            }).eq('id', renderId);
            return reply.send({ success: false, error: 'INSUFFICIENT_CREDITS' });
          }
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
      const { data: render } = await supabase.from('renders').select('status').eq('id', renderId).single();
      if (!render || !['failed', 'retryable_failed'].includes(render.status)) {
        return reply.status(400).send({ error: 'Render cannot be retried in current state.' });
      }
      const result = await CompositionService.retryRender(renderId);
      return reply.send({ success: true, status: result.status, traceId: result.traceId });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /render/export — request full export after preview_ready
  fastify.post('/export', async (request, reply) => {
    try {
      const { renderId } = request.body as any;
      const { data: render } = await supabase.from('renders').select('*').eq('id', renderId).single();
      if (!render || render.status !== 'preview_ready') {
        return reply.status(400).send({ error: 'Chỉ export khi Preview đã hoàn thành.' });
      }

      // Notify Local Worker via Supabase Realtime by setting status to pending
      await supabase.from('renders').update({ status: 'pending' }).eq('id', renderId);

      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
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
      const result = await CompositionService.getJobStatus(renderId);
      if (result.status === 'not_found') return reply.status(404).send({ error: 'Render not found' });
      return reply.send({ success: true, render: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
