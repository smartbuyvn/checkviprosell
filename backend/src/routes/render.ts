import { FastifyInstance } from 'fastify';
import { CompositionService } from '../services/composition.service';
import { EncodeService } from '../services/encode.service';

export async function renderRoutes(fastify: FastifyInstance) {
  fastify.post('/start', async (request, reply) => {
    try {
      const { projectId, sceneGraph, aspect = '9:16', mode = 'auto' } = request.body as any;
      if (!projectId || !sceneGraph) {
        return reply.status(400).send({ error: 'Missing projectId or sceneGraph' });
      }

      // 1. Dispatch to composition service (Remotion React Tree builder)
      const compJob = await CompositionService.startComposition(projectId, sceneGraph, aspect, mode);

      reply.send({
        success: true,
        jobId: compJob.id,
        status: compJob.status
      });

      // 2. Simulate async processing (will trigger encode when done)
      CompositionService.processComposition(compJob.id, aspect).catch(err => {
        fastify.log.error(`Composition Job ${compJob.id} failed:`, err);
      });

    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/status/:jobId', async (request, reply) => {
    try {
      const { jobId } = request.params as any;
      const compStatus = await CompositionService.getJobStatus(jobId);
      
      if (compStatus.status === 'not_found') {
         return reply.status(404).send({ error: 'Job not found' });
      }

      let encodeStatus = null;
      if (compStatus.encodeJobId) {
         encodeStatus = await EncodeService.getJobStatus(compStatus.encodeJobId);
      }
      
      return reply.send({ success: true, composition: compStatus, encode: encodeStatus });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
