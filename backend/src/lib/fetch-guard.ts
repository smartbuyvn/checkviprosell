import dns from 'node:dns/promises';
import { isIP } from 'node:net';

/** Thrown when a URL is refused before any network request is made. */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * True for addresses that must never be reachable from a user-supplied URL:
 * loopback, private ranges, link-local (incl. the cloud metadata service), CGNAT and friends.
 */
export function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return true; // không phải IP hợp lệ → coi như nguy hiểm

  if (family === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0) return true;                       // 0.0.0.0/8
    if (a === 10) return true;                      // 10/8
    if (a === 127) return true;                     // loopback
    if (a === 169 && b === 254) return true;        // link-local: 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;        // 192.168/16
    if (a === 192 && b === 0) return true;          // 192.0.0/24, 192.0.2/24
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a >= 224) return true;                      // multicast + reserved
    return false;
  }

  const lower = ip.toLowerCase().split('%')[0];
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80')) return true;        // link-local
  if (/^f[cd]/.test(lower)) return true;            // fc00::/7 unique local
  // IPv4-mapped (::ffff:a.b.c.d) phải được xét theo luật IPv4
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

/** Hosts an asset URL may point at: the Supabase project, plus anything in ALLOWED_ASSET_HOSTS. */
export function allowedAssetHosts(): string[] {
  const hosts = new Set<string>();
  for (const raw of (process.env.ALLOWED_ASSET_HOSTS || '').split(',')) {
    const host = raw.trim().toLowerCase();
    if (host) hosts.add(host);
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname.toLowerCase());
    } catch {
      // SUPABASE_URL hỏng thì bỏ qua — allowlist vẫn còn ALLOWED_ASSET_HOSTS
    }
  }
  return [...hosts];
}

/** URL.hostname giữ nguyên ngoặc vuông của IPv6 ("[::1]") — bỏ đi để mọi bước so cùng một giá trị. */
export function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

/** True when the host equals an allowlisted host or is a subdomain of one. */
export function hostAllowed(hostname: string, allowHosts: string[]): boolean {
  const host = normalizeHost(hostname);
  return allowHosts.some((raw) => {
    const allowed = normalizeHost(raw);
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

/**
 * Validate a user-supplied asset URL: https only, host on the allowlist, and every address
 * it resolves to is public. Returns the parsed URL; throws BlockedUrlError otherwise.
 */
export async function assertAllowedUrl(raw: string, allowHosts = allowedAssetHosts()): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(`URL không hợp lệ: ${raw}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BlockedUrlError(`Giao thức bị chặn: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new BlockedUrlError('URL chứa thông tin đăng nhập');
  }
  if (allowHosts.length === 0) {
    // Fail-closed: chưa cấu hình allowlist thì không tải gì từ bên ngoài
    throw new BlockedUrlError('Chưa cấu hình ALLOWED_ASSET_HOSTS — từ chối mọi URL ngoài');
  }
  const host = normalizeHost(url.hostname);

  // Xét IP trước allowlist: một IP nội bộ phải bị chặn kể cả khi ai đó lỡ cho nó vào allowlist
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new BlockedUrlError(`IP nội bộ bị chặn: ${host}`);
    if (!hostAllowed(host, allowHosts)) {
      throw new BlockedUrlError(`Host không nằm trong allowlist: ${host}`);
    }
    return url;
  }

  if (!hostAllowed(host, allowHosts)) {
    throw new BlockedUrlError(`Host không nằm trong allowlist: ${host}`);
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(url.hostname, { all: true });
  } catch (err: any) {
    throw new BlockedUrlError(`Không phân giải được ${url.hostname}: ${err?.message}`);
  }
  if (addresses.length === 0) {
    throw new BlockedUrlError(`${url.hostname} không có địa chỉ nào`);
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new BlockedUrlError(`${url.hostname} trỏ vào IP nội bộ ${address}`);
    }
  }
  return url;
}

export interface SafeDownloadOptions {
  maxBytes?: number;
  timeoutMs?: number;
  allowHosts?: string[];
}

/**
 * Fetch a validated asset URL with no redirects, a timeout and a hard size cap.
 * Returns the body; throws BlockedUrlError for a refused URL, Error for a transport failure.
 */
export async function safeDownload(raw: string, options: SafeDownloadOptions = {}): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = await assertAllowedUrl(raw, options.allowHosts ?? allowedAssetHosts());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // redirect:'manual' — một redirect có thể trỏ sang IP nội bộ sau khi đã qua kiểm tra
    const res = await fetch(url, { redirect: 'manual', signal: controller.signal });
    if (res.status >= 300 && res.status < 400) {
      throw new BlockedUrlError(`Redirect bị chặn (${res.status}) từ ${url.hostname}`);
    }
    if (!res.ok) {
      throw new Error(`Tải ảnh thất bại ${res.status} từ ${url.hostname}`);
    }

    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > maxBytes) {
      throw new BlockedUrlError(`File quá lớn: ${declared} byte (tối đa ${maxBytes})`);
    }

    const body = Buffer.from(await res.arrayBuffer());
    if (body.byteLength > maxBytes) {
      // Content-Length có thể nói dối hoặc vắng mặt → kiểm lại theo dữ liệu thật
      throw new BlockedUrlError(`File quá lớn: ${body.byteLength} byte (tối đa ${maxBytes})`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}
