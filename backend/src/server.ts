import Fastify from 'fastify';
import cors from '@fastify/cors';
import { aiRoutes } from './routes/ai';
import { renderRoutes } from './routes/render';
import { faceReplaceRoutes } from './routes/face-replace';
import { webhookRoutes } from './routes/webhooks';
import { MockSentry } from './services/sentry.service';

MockSentry.init();

const server = Fastify({
  logger: true
});

server.register(cors, {
  origin: '*' // Allow frontend to call during dev
});

server.register(aiRoutes, { prefix: '/api/v1/ai' });
server.register(renderRoutes, { prefix: '/api/v1/render' });
server.register(faceReplaceRoutes, { prefix: '/api/v1/face-replace' });
server.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

server.get('/health', async () => {
  return { status: 'ok', service: 'viprosell-backend-v1.2' };
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Viprosell Backend listening on http://localhost:3001');
  } catch (err) {
    MockSentry.captureException(err, { service: 'fastify-bootstrap' });
    server.log.error(err);
    process.exit(1);
  }
};

start();
