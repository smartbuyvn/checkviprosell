import { FastifyInstance } from 'fastify';
import { AIService } from '../services/ai.service';

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.post('/generate', async (request, reply) => {
    try {
      const { projectId, packageType, sourceUrl, manualNotes } = request.body as any;
      
      // 1. Analyze product (Product Summary)
      const summary = await AIService.analyzeProduct(sourceUrl, manualNotes);
      
      // 2. Write script based on package type
      const script = await AIService.generateScript(summary, packageType);

      // 3. Generate aspect-agnostic scene graph
      const sceneGraph = await AIService.generateSceneGraph(script);

      return reply.send({
        success: true,
        summary,
        script,
        sceneGraph
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
