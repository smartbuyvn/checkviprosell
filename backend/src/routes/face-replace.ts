import { FastifyInstance } from 'fastify';
import { FaceReplaceService } from '../services/face-replace.service';
import { getVerifiedUserId, requireProjectOwner } from '../lib/auth';

export async function faceReplaceRoutes(fastify: FastifyInstance) {
  fastify.post('/queue', async (request, reply) => {
    try {
      const { projectId, sourceImageUrl, targetVideoUrl } = request.body as any;
      
      if (!projectId || !sourceImageUrl || !targetVideoUrl) {
         return reply.status(400).send({ error: 'Missing required parameters' });
      }

      const userId = await requireProjectOwner(request, reply, projectId);
      if (!userId) return reply;

      const job = await FaceReplaceService.queueJob(projectId, sourceImageUrl, targetVideoUrl);

      reply.send({
        success: true,
        jobId: job.id,
        status: job.status
      });

      // Simulate async worker processing
      FaceReplaceService.processJob(job.id).catch(err => {
        fastify.log.error(`FaceReplace Job ${job.id} failed:`, err);
      });

    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/status/:jobId', async (request, reply) => {
    try {
      const userId = await getVerifiedUserId(request.headers.authorization);
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { jobId } = request.params as any;
      const status = await FaceReplaceService.getJobStatus(jobId);
      
      return reply.send({ success: true, ...status });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
