import 'dotenv/config'; // Load .env before anything else
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { aiRoutes } from './routes/ai';
import { renderRoutes } from './routes/render';
import { faceReplaceRoutes } from './routes/face-replace';
import { webhookRoutes } from './routes/webhooks';
import { billingRoutes } from './routes/billing';
import { affiliateRoutes } from './routes/affiliate';
import { adminRoutes } from './routes/admin';
import { projectRoutes } from './routes/projects';
import { quickAdsRoutes } from './routes/quick-ads';
import { MockSentry } from './services/sentry.service';

// ─── Startup Env Validation ─────────────────────────────────
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.warn(
    `[Startup] WARNING: Missing env vars: ${missing.join(', ')}. ` +
    `Copy backend/.env.example to backend/.env and fill in the values.`
  );
}

// Secret cho xác thực/webhook: thiếu ở production thì không khởi động (fail-closed)
const REQUIRED_SECRETS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEPAY_WEBHOOK_SECRET',
  'INTERNAL_CALLBACK_SECRET',
];
const missingSecrets = REQUIRED_SECRETS.filter(
  (k) => !process.env[k] || process.env[k] === 'CHANGE_ME_IN_PRODUCTION'
);
if (missingSecrets.length > 0) {
  const message = `[Startup] Missing required secrets: ${missingSecrets.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    console.error(`${message} — refusing to start in production.`);
    process.exit(1);
  }
  console.warn(`${message} — webhook/callback routes will reject requests (503).`);
}

MockSentry.init();

const server = Fastify({ logger: true });

// Register multipart to support file uploads with strict 50MB limit
server.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1 // Max 1 file per request
  }
});

// Ensure renders_output directory exists
const RENDER_OUTPUT_DIR = path.resolve(process.env.RENDER_OUTPUT_DIR || 'D:/vidiosell/renders_output');
if (!fs.existsSync(RENDER_OUTPUT_DIR)) {
  fs.mkdirSync(RENDER_OUTPUT_DIR, { recursive: true });
  console.log(`[Static] Created renders_output dir: ${RENDER_OUTPUT_DIR}`);
}

// Serve rendered videos at /local-renders/<filename>
server.register(staticPlugin, {
  root: RENDER_OUTPUT_DIR,
  prefix: '/local-renders/',
  decorateReply: false,
});

// ─── Security Headers ──────────────────────────────────────────────────────
server.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Remove server fingerprinting
  reply.removeHeader('x-powered-by');
});

// ─── CORS — Whitelist chỉ cho phép origins cụ thể ───────────────────────────
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:8080,http://localhost:5173,https://v.ninhle.com,https://api.ninhle.com'
).split(',').map(o => o.trim());

server.register(cors, {
  origin: (origin, cb) => {
    // Allow non-browser requests (worker-to-worker, curl, health checks)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    server.log.warn(`[CORS] Blocked origin: ${origin}`);
    cb(new Error(`CORS: Origin "${origin}" is not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Callback-Secret', 'X-Timestamp', 'X-Idempotency-Key', 'X-Internal-Token'],
});

server.register(aiRoutes,          { prefix: '/api/v1/ai' });
server.register(renderRoutes,       { prefix: '/api/v1/render' });
server.register(faceReplaceRoutes,  { prefix: '/api/v1/face-replace' });
server.register(webhookRoutes,      { prefix: '/api/v1/webhooks' });
server.register(billingRoutes,      { prefix: '/api/v1/billing' });
server.register(affiliateRoutes,    { prefix: '/api/v1/affiliate' });
server.register(adminRoutes,        { prefix: '/api/v1/admin' });
server.register(projectRoutes,      { prefix: '/api/v1/projects' });
server.register(quickAdsRoutes,     { prefix: '/api/v1/quick-ads' });

server.get('/health', async (_, reply) => {
  return reply.status(200).send({
    status: 'ok',
    service: 'viprosell-backend-v1.2',
  });
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`ViproSell Backend listening on http://localhost:${port}`);
  } catch (err) {
    MockSentry.captureException(err, { service: 'fastify-bootstrap' });
    server.log.error(err);
    process.exit(1);
  }
};

start();
