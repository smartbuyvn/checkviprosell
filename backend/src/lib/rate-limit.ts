import { createClient } from '@supabase/supabase-js';

// Khởi tạo trễ: tạo client ngay lúc import làm cả tiến trình chết nếu thiếu env,
// và khiến module không test được nếu chưa nạp .env.
let client: ReturnType<typeof createClient> | null = null;
function db() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'anon',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return client;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface Window {
  hits: number[];
}

// Bộ đếm nằm trong bộ nhớ tiến trình: đủ cho 1 instance API (hiện tại chỉ có 1 trên VPS).
// Chạy nhiều instance thì phải chuyển sang đếm trong Postgres, nếu không mỗi instance
// cho phép trọn hạn mức riêng.
const windows = new Map<string, Window>();

/** Sliding-window counter; call once per attempt. Returns whether the call may proceed. */
export function checkRate(key: string, limit: number, windowMs: number, now = Date.now()): RateDecision {
  const win = windows.get(key) ?? { hits: [] };
  const cutoff = now - windowMs;
  win.hits = win.hits.filter((t) => t > cutoff);

  if (win.hits.length >= limit) {
    windows.set(key, win);
    const oldest = win.hits[0];
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, oldest + windowMs - now) };
  }

  win.hits.push(now);
  windows.set(key, win);
  return { allowed: true, remaining: limit - win.hits.length, retryAfterMs: 0 };
}

/** Drop windows with no recent hits so the map cannot grow without bound. */
export function pruneRateWindows(olderThanMs = 3_600_000, now = Date.now()): number {
  let dropped = 0;
  for (const [key, win] of windows) {
    if (win.hits.length === 0 || win.hits[win.hits.length - 1] < now - olderThanMs) {
      windows.delete(key);
      dropped++;
    }
  }
  return dropped;
}

/** Test helper: forget every counter. */
export function resetRateWindows(): void {
  windows.clear();
}

let settingsCache: { at: number; values: Map<string, string> } | null = null;
const SETTINGS_TTL_MS = 30_000;

async function readSettings(): Promise<Map<string, string>> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.values;
  }
  const values = new Map<string, string>();
  const { data, error } = await db().from('system_settings').select('key, value');
  if (error) {
    // Đọc hỏng thì giữ cache cũ nếu có; không có thì trả rỗng và để caller quyết fail-open/closed
    console.warn(`[RateLimit] Không đọc được system_settings: ${error.message}`);
    return settingsCache?.values ?? values;
  }
  for (const row of (data ?? []) as any[]) {
    if (row?.key) values.set(String(row.key), String(row.value ?? ''));
  }
  settingsCache = { at: Date.now(), values };
  return values;
}

/** Test helper: drop the settings cache. */
export function resetSettingsCache(): void {
  settingsCache = null;
}

/**
 * Emergency stop for every AI/render job, flipped from system_settings.AI_KILL_SWITCH.
 * Fail-open on a read error: một lỗi đọc DB không nên làm sập cả sản phẩm.
 */
export async function aiEnabled(): Promise<boolean> {
  const settings = await readSettings();
  const raw = (settings.get('AI_KILL_SWITCH') ?? '').trim().toLowerCase();
  return !(raw === 'on' || raw === 'true' || raw === '1');
}

export interface BudgetStatus {
  withinBudget: boolean;
  usedCredits: number;
  limitCredits: number;
}

/**
 * Today's credit spend against system_settings.AI_DAILY_CREDIT_LIMIT (0 or unset = no cap).
 * Chặn kiểu đốt tiền: ai đó gọi liên tục thì trần theo ngày cắt trước khi hoá đơn tới.
 */
export async function checkDailyBudget(): Promise<BudgetStatus> {
  const settings = await readSettings();
  const limitCredits = Number(settings.get('AI_DAILY_CREDIT_LIMIT') ?? '0');
  if (!Number.isFinite(limitCredits) || limitCredits <= 0) {
    return { withinBudget: true, usedCredits: 0, limitCredits: 0 };
  }

  // Cộng ở phía JS: đủ cho vài nghìn dòng mỗi ngày. Khi lượng dùng tăng thì chuyển
  // thành RPC Postgres (sum) — kéo cả bảng về rồi cộng sẽ chậm dần.
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from('usage_logs')
    .select('credits_used')
    .gte('created_at', since.toISOString());

  if (error) {
    console.warn(`[RateLimit] Không đọc được usage_logs: ${error.message}`);
    return { withinBudget: true, usedCredits: 0, limitCredits };
  }

  const usedCredits = (data ?? []).reduce((sum, row: any) => sum + Number(row.credits_used ?? 0), 0);
  return { withinBudget: usedCredits < limitCredits, usedCredits, limitCredits };
}
