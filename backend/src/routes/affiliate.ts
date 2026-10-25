import { FastifyInstance } from 'fastify';
import { AffiliateService } from '../services/affiliate.service';
import { getVerifiedUserId } from '../lib/auth';

export async function affiliateRoutes(fastify: FastifyInstance) {
  fastify.get('/me', async (request, reply) => {
    try {
      const userId = await getVerifiedUserId(request.headers.authorization);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      const dashData = await AffiliateService.getDashboard(userId);
      return reply.send(dashData);
    } catch (error: any) {
      fastify.log.error(`[Affiliate GET /me] Error: ${error.message}`);
      return reply.code(500).send({ error: error.message });
    }
  });

  fastify.post<{ Body: { code: string } }>('/refer', async (request, reply) => {
    try {
      const userId = await getVerifiedUserId(request.headers.authorization);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      const { code } = request.body;
      if (!code) {
        return reply.code(400).send({ error: 'Thiếu mã giới thiệu' });
      }

      const result = await AffiliateService.refer(userId, code);
      return reply.send(result);
    } catch (error: any) {
      fastify.log.error(`[Affiliate POST /refer] Error: ${error.message}`);
      return reply.code(400).send({ error: error.message });
    }
  });
}
