import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAllowedUrl,
  BlockedUrlError,
  hostAllowed,
  isPrivateIp,
  safeDownload,
} from '../src/lib/fetch-guard';

const ALLOW = ['supabase.co', 'r2.example.com'];

async function refusal(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err: any) {
    assert.ok(err instanceof BlockedUrlError, `mong đợi BlockedUrlError, nhận ${err?.name}: ${err?.message}`);
    return err.message;
  }
  throw new assert.AssertionError({ message: 'URL lẽ ra phải bị từ chối nhưng lại được chấp nhận' });
}

test('isPrivateIp blocks loopback, private, link-local and metadata addresses', () => {
  for (const ip of [
    '127.0.0.1', '127.1.2.3', '10.0.0.1', '10.255.255.255',
    '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1',
    'not-an-ip', '',
  ]) {
    assert.equal(isPrivateIp(ip), true, `${ip} lẽ ra phải bị chặn`);
  }
});

test('isPrivateIp allows ordinary public addresses', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '93.184.216.34', '2606:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, `${ip} lẽ ra phải được cho qua`);
  }
});

test('assertAllowedUrl refuses hosts outside the allowlist', async () => {
  const msg = await refusal(() => assertAllowedUrl('https://evil.example.net/a.jpg', ALLOW));
  assert.match(msg, /allowlist/i);
});

test('assertAllowedUrl refuses non-http protocols and embedded credentials', async () => {
  assert.match(await refusal(() => assertAllowedUrl('file:///etc/passwd', ALLOW)), /Giao thức/);
  assert.match(await refusal(() => assertAllowedUrl('gopher://supabase.co/x', ALLOW)), /Giao thức/);
  assert.match(await refusal(() => assertAllowedUrl('https://u:p@supabase.co/a.jpg', ALLOW)), /đăng nhập/);
  assert.match(await refusal(() => assertAllowedUrl('khong-phai-url', ALLOW)), /không hợp lệ/);
});

test('assertAllowedUrl refuses internal IPs even when the host is allowlisted', async () => {
  // Chính là kịch bản metadata của cloud: 169.254.169.254
  for (const target of [
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:3001/api/v1/admin/health',
    'http://10.0.0.5/x.jpg',
    'http://[::1]:3001/x.jpg',
  ]) {
    const host = new URL(target).hostname.replace(/^\[|\]$/g, '');
    const msg = await refusal(() => assertAllowedUrl(target, [host]));
    assert.match(msg, /nội bộ/);
  }
});

test('assertAllowedUrl is fail-closed when no allowlist is configured', async () => {
  const msg = await refusal(() => assertAllowedUrl('https://supabase.co/a.jpg', []));
  assert.match(msg, /ALLOWED_ASSET_HOSTS/);
});

test('hostAllowed matches a host and its subdomains, not a lookalike', () => {
  assert.equal(hostAllowed('supabase.co', ALLOW), true);
  assert.equal(hostAllowed('abcdef.supabase.co', ALLOW), true);
  assert.equal(hostAllowed('ABCDEF.Supabase.CO', ALLOW), true);
  assert.equal(hostAllowed('notsupabase.co', ALLOW), false);
  assert.equal(hostAllowed('supabase.co.evil.net', ALLOW), false);
  assert.equal(hostAllowed('[::1]', ['::1']), true, 'ngoặc vuông IPv6 phải được chuẩn hoá');
});

test('a host that does not resolve is refused, not allowed through', async () => {
  const msg = await refusal(() =>
    assertAllowedUrl('https://khong-ton-tai-abc123.supabase.co/x.jpg', ALLOW)
  );
  assert.match(msg, /phân giải/);
});

test('safeDownload refuses before opening any connection', async () => {
  await refusal(() => safeDownload('http://169.254.169.254/latest/meta-data/', {
    allowHosts: ['169.254.169.254'],
    timeoutMs: 2000,
  }));
});
