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

  /**
   * Gửi yêu cầu rút hoa hồng.
   * Mọi kiểm tra (số dư, ngưỡng tối thiểu, yêu cầu đang mở) nằm ở service chứ không
   * ở giao diện: client có thể gửi bất cứ số nào.
   */
  fastify.post<{ Body: { amountVnd: number; bank: string; accountNo: string; accountName: string } }>(
    '/withdrawals',
    async (request, reply) => {
      try {
        const userId = await getVerifiedUserId(request.headers.authorization);
        if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

        const result = await AffiliateService.requestWithdrawal(userId, request.body || ({} as any));
        return reply.send(result);
      } catch (error: any) {
        fastify.log.warn(`[Affiliate POST /withdrawals] ${error.message}`);
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  /** Lịch sử yêu cầu rút của chính người gọi. */
  fastify.get('/withdrawals', async (request, reply) => {
    try {
      const userId = await getVerifiedUserId(request.headers.authorization);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      const rows = await AffiliateService.getWithdrawals(userId);
      return reply.send(rows);
    } catch (error: any) {
      fastify.log.error(`[Affiliate GET /withdrawals] ${error.message}`);
      return reply.code(500).send({ error: error.message });
    }
  });
}
