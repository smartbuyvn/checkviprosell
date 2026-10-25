import { FastifyInstance } from 'fastify';
import { AIService } from '../services/ai.service';
import { requireProjectOwner } from '../lib/auth';
import { aiEnabled, checkDailyBudget, checkRate } from '../lib/rate-limit';

// Trần mỗi user mỗi giờ cho các lần gọi LLM
const AI_CALLS_PER_HOUR = Number(process.env.AI_CALLS_PER_HOUR || '60');

/** Guard an AI route: kill switch, daily credit cap, then per-user rate limit. */
async function aiGuard(userId: string, reply: any): Promise<boolean> {
  if (!(await aiEnabled())) {
    reply.status(503).send({ error: 'AI_PAUSED', detail: 'Hệ thống đang tạm dừng tạo nội dung.' });
    return false;
  }
  const budget = await checkDailyBudget();
  if (!budget.withinBudget) {
    reply.status(503).send({ error: 'DAILY_BUDGET_REACHED' });
    return false;
  }
  const decision = checkRate(`ai:${userId}`, AI_CALLS_PER_HOUR, 3_600_000);
  if (!decision.allowed) {
    reply.header('retry-after', Math.ceil(decision.retryAfterMs / 1000));
    reply.status(429).send({ error: 'RATE_LIMITED', retry_after_ms: decision.retryAfterMs });
    return false;
  }
  return true;
}

export async function aiRoutes(fastify: FastifyInstance) {

  // POST /api/v1/ai/product-intel
  // Enqueues a product intelligence job — returns immediately with jobId
  fastify.post('/product-intel', async (request, reply) => {
    const { project_id, trace_id } = request.body as any;
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send({ error: 'Missing Auth Token' });
    if (!project_id) return reply.status(400).send({ error: 'Missing project_id' });

    const userId = await requireProjectOwner(request, reply, project_id);
    if (!userId) return reply;
    if (!(await aiGuard(userId, reply))) return reply;
    const traceId = trace_id || crypto.randomUUID();

    try {
      await AIService.runProductIntel(project_id, userId, traceId, authHeader.replace('Bearer ', ''));
      fastify.log.info(`[AI] Completed product-intel job for project ${project_id}`);
      return reply.send({ jobId: 'sync-' + traceId, status: 'queued', traceId });
    } catch (e: any) {
      fastify.log.error(e);
      return reply.status(500).send({ error: e.message });
    }
  });

  // POST /api/v1/ai/concepts
  // Enqueues a commerce concepts job
  fastify.post('/concepts', async (request, reply) => {
    const { project_id, trace_id } = request.body as any;
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send({ error: 'Missing Auth Token' });
    if (!project_id) return reply.status(400).send({ error: 'Missing project_id' });

    const userId = await requireProjectOwner(request, reply, project_id);
    if (!userId) return reply;
    if (!(await aiGuard(userId, reply))) return reply;
    const traceId = trace_id || crypto.randomUUID();

    try {
      await AIService.runCommerceConcepts(project_id, userId, traceId, authHeader.replace('Bearer ', ''));
      fastify.log.info(`[AI] Completed concepts job for project ${project_id}`);
      return reply.send({ jobId: 'sync-' + traceId, status: 'queued', traceId });
    } catch (e: any) {
      fastify.log.error(e);
      return reply.status(500).send({ error: e.message });
    }
  });

  // POST /api/v1/ai/script-composer
  // Enqueues a script composition job (quickads | reviewvideo | conversionvideo)
  fastify.post('/script-composer', async (request, reply) => {
    const { project_id, trace_id, package_type } = request.body as any;
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send({ error: 'Missing Auth Token' });
    if (!project_id) return reply.status(400).send({ error: 'Missing project_id' });

    const allowed = ['quickads', 'reviewvideo', 'conversionvideo'];
    const pkg = (package_type || 'quickads').replace('_', '');
    if (!allowed.includes(pkg)) {
      return reply.status(400).send({ error: `Invalid package_type: ${pkg}. Must be one of: ${allowed.join(', ')}` });
    }

    const userId = await requireProjectOwner(request, reply, project_id);
    if (!userId) return reply;
    if (!(await aiGuard(userId, reply))) return reply;
    const traceId = trace_id || crypto.randomUUID();

    try {
      await AIService.runScriptComposer(project_id, userId, traceId, authHeader.replace('Bearer ', ''), pkg);
      fastify.log.info(`[AI] Completed script-composer (${pkg}) job for project ${project_id}`);
      return reply.send({ jobId: 'sync-' + traceId, status: 'queued', traceId, packageType: pkg });
    } catch (e: any) {
      fastify.log.error(e);
      return reply.status(500).send({ error: e.message });
    }
  });

  // GET /api/v1/ai/job/:jobId/status
  // Poll BullMQ job status — used by frontend polling or long-poll proxy
  fastify.get('/job/:jobId/status', async (request, reply) => {
    const { jobId } = request.params as any;
    try {
      if (jobId.startsWith('sync-')) {
        return reply.send({
          jobId,
          status: 'completed',
          data: {},
          result: null,
          error: null,
          attemptsMade: 1,
        });
      }
      return reply.status(404).send({ error: 'Job not found' });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/v1/ai/generate — legacy stub kept for API compatibility
  // Frontend should use the individual endpoints above
  fastify.post('/generate', async (request, reply) => {
    return reply.status(410).send({
      error: 'DEPRECATED: Use /api/v1/ai/product-intel, /concepts, and /script-composer instead.',
      retryable: false,
    });
  });
}
