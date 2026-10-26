import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';

// Chạy offline: Supabase trỏ vào cổng đóng nên mọi xác minh token qua Supabase Auth đều thất bại ngay
process.env.SUPABASE_URL = 'http://127.0.0.1:59999';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.SEPAY_WEBHOOK_SECRET;
delete process.env.INTERNAL_CALLBACK_SECRET;

/** Build an unsigned JWT (alg: none) — the kind the old code accepted. */
function forgedToken(sub: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub })}.x`;
}

async function buildApp(plugin: (app: FastifyInstance) => Promise<void>, prefix: string): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(plugin, { prefix });
  await app.ready();
  return app;
}

test('parseTransferCode only accepts a full 8-hex code', async () => {
  const { parseTransferCode } = await import('../src/lib/security');
  assert.equal(parseTransferCode('NGUYEN VAN A CK VIPRO A1B2C3D4'), 'a1b2c3d4');
  assert.equal(parseTransferCode('VIPROA1B2C3D4 FT26101912345'), 'a1b2c3d4');
  assert.equal(parseTransferCode('vipro a1b2c3d4'), 'a1b2c3d4');
  assert.equal(parseTransferCode('CK VIPRO A'), null);
  assert.equal(parseTransferCode('CK VIPRO A1B2C3'), null);
  assert.equal(parseTransferCode('CK VIPRO ZZZZZZZZ'), null);
});

test('safeEqual compares exactly', async () => {
  const { safeEqual } = await import('../src/lib/security');
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('Stripe and PayPal webhooks no longer exist', async () => {
  const { webhookRoutes } = await import('../src/routes/webhooks');
  const app = await buildApp(webhookRoutes, '/api/v1/webhooks');

  // Dự án không dùng Stripe (không có route tạo thanh toán, không có khóa).
  // Webhook cũ nhận sự kiện không chữ ký và cộng credit tùy ý → đã xóa hẳn.
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/stripe',
    payload: {
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: '00000000-0000-0000-0000-000000000000', metadata: { credits: '999999' } } },
    },
  });
  assert.equal(res.statusCode, 404, 'route /stripe lẽ ra đã bị xóa');

  const paypal = await app.inject({ method: 'POST', url: '/api/v1/webhooks/paypal', payload: {} });
  assert.equal(paypal.statusCode, 404, 'route /paypal lẽ ra đã bị xóa');

  await app.close();
});

test('SePay webhook still works after removing Stripe', async () => {
  const { webhookRoutes } = await import('../src/routes/webhooks');
  const app = await buildApp(webhookRoutes, '/api/v1/webhooks');

  // Luồng mua gói đi qua đây: VietQR -> chuyển khoản -> webhook này cộng credit.
  // Xóa Stripe cũng gỡ luôn content-type parser cũ, nên phải chắc JSON vẫn đọc được.
  process.env.SEPAY_WEBHOOK_SECRET = 'sepay-test-secret';
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/sepay',
    payload: { transferType: 'out', content: 'probe' },
    headers: { authorization: 'Apikey sepay-test-secret' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().note, 'ignored_not_in_or_no_content');
  delete process.env.SEPAY_WEBHOOK_SECRET;
  await app.close();
});

test('SePay webhook is fail-closed and checks the API key', async () => {
  const { webhookRoutes } = await import('../src/routes/webhooks');
  const app = await buildApp(webhookRoutes, '/api/v1/webhooks');
  const body = { transferType: 'out', content: 'probe' };

  delete process.env.SEPAY_WEBHOOK_SECRET;
  let res = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sepay', payload: body });
  assert.equal(res.statusCode, 503);

  process.env.SEPAY_WEBHOOK_SECRET = 'sepay-test-secret';
  res = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sepay', payload: body, headers: { authorization: 'Apikey wrong' } });
  assert.equal(res.statusCode, 401);

  res = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sepay', payload: body, headers: { authorization: 'Apikey sepay-test-secret' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().note, 'ignored_not_in_or_no_content');

  delete process.env.SEPAY_WEBHOOK_SECRET;
  await app.close();
});

test('Render callback is fail-closed and checks the secret before the body', async () => {
  const { renderRoutes } = await import('../src/routes/render');
  const app = await buildApp(renderRoutes, '/api/v1/render');
  const payload = { renderId: '00000000-0000-0000-0000-000000000000', status: 'completed' };

  let res = await app.inject({ method: 'POST', url: '/api/v1/render/callback', payload });
  assert.equal(res.statusCode, 503);

  process.env.INTERNAL_CALLBACK_SECRET = 'callback-test-secret';
  res = await app.inject({ method: 'POST', url: '/api/v1/render/callback', payload, headers: { 'x-callback-secret': 'wrong' } });
  assert.equal(res.statusCode, 403);

  delete process.env.INTERNAL_CALLBACK_SECRET;
  await app.close();
});

test('Admin routes reject an unsigned token', async () => {
  const { adminRoutes } = await import('../src/routes/admin');
  const app = await buildApp(adminRoutes, '/api/v1/admin');
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/health',
    headers: { authorization: `Bearer ${forgedToken('00000000-0000-0000-0000-000000000000')}` },
  });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('AI and project routes reject unsigned or missing tokens', async () => {
  const { aiRoutes } = await import('../src/routes/ai');
  const { projectRoutes } = await import('../src/routes/projects');
  const ai = await buildApp(aiRoutes, '/api/v1/ai');
  const projects = await buildApp(projectRoutes, '/api/v1/projects');
  const projectId = '00000000-0000-0000-0000-000000000001';

  let res = await ai.inject({
    method: 'POST',
    url: '/api/v1/ai/product-intel',
    payload: { project_id: projectId },
    headers: { authorization: `Bearer ${forgedToken('00000000-0000-0000-0000-000000000000')}` },
  });
  assert.equal(res.statusCode, 401);

  // Trước đây không gửi token thì bỏ qua kiểm tra chủ sở hữu
  res = await projects.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/trash` });
  assert.equal(res.statusCode, 401);
  res = await projects.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/restore` });
  assert.equal(res.statusCode, 401);

  await ai.close();
  await projects.close();
});

test('Render start, quick-ads and face-replace require a verified user', async () => {
  const { renderRoutes } = await import('../src/routes/render');
  const { quickAdsRoutes } = await import('../src/routes/quick-ads');
  const { faceReplaceRoutes } = await import('../src/routes/face-replace');
  const render = await buildApp(renderRoutes, '/api/v1/render');
  const quickAds = await buildApp(quickAdsRoutes, '/api/v1/quick-ads');
  const faceReplace = await buildApp(faceReplaceRoutes, '/api/v1/face-replace');
  const projectId = '00000000-0000-0000-0000-000000000001';

  let res = await render.inject({ method: 'POST', url: '/api/v1/render/start', payload: { projectId } });
  assert.equal(res.statusCode, 401);

  res = await quickAds.inject({ method: 'GET', url: '/api/v1/quick-ads/cost-log' });
  assert.equal(res.statusCode, 401);

  // S1-2: không còn nhánh "cho qua nếu IP là localhost" — nginx proxy làm nhánh đó vô nghĩa
  res = await quickAds.inject({
    method: 'GET',
    url: '/api/v1/quick-ads/cost-log',
    remoteAddress: '127.0.0.1',
    headers: { 'x-internal-token': 'doan-bua' },
  });
  assert.equal(res.statusCode, 401);
  res = await quickAds.inject({
    method: 'POST',
    url: '/api/v1/quick-ads/render',
    payload: { scene_graph: {}, image_urls: ['http://127.0.0.1/x.jpg'] },
    headers: { authorization: `Bearer ${forgedToken('00000000-0000-0000-0000-000000000000')}` },
  });
  assert.equal(res.statusCode, 401);

  res = await faceReplace.inject({
    method: 'POST',
    url: '/api/v1/face-replace/queue',
    payload: { projectId, sourceImageUrl: 'http://a/x.jpg', targetVideoUrl: 'http://a/y.mp4' },
  });
  assert.equal(res.statusCode, 401);

  await render.close();
  await quickAds.close();
  await faceReplace.close();
});
