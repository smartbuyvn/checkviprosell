/**
 * Viprosell — Supabase Client (Bulletproof Production)
 *
 * Quy tắc bảo mật:
 * - Frontend CHỈ dùng VITE_SUPABASE_ANON_KEY (public, RLS-protected)
 * - KHÔNG BAO GIỜ import SERVICE_ROLE_KEY vào frontend
 * - Thiếu env var → throw ngay, không silent fail
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/* ──────────────────────── Environment Validation ──────────────────────── */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── PRODUCTION: Fail-fast — throw ngay nếu thiếu biến ───
if (import.meta.env.PROD) {
  if (!SUPABASE_URL) {
    console.error(
      '%c🔴 [CRITICAL] VITE_SUPABASE_URL is MISSING! App cannot connect to Supabase.',
      'color: #ff0000; font-size: 18px; font-weight: bold; background: #1a1a1a; padding: 4px 8px;'
    );
    throw new Error('CRITICAL: VITE_SUPABASE_URL is missing. Check .env file.');
  }
  if (!SUPABASE_ANON_KEY) {
    console.error(
      '%c🔴 [CRITICAL] VITE_SUPABASE_ANON_KEY is MISSING! Auth + API will fail.',
      'color: #ff0000; font-size: 18px; font-weight: bold; background: #1a1a1a; padding: 4px 8px;'
    );
    throw new Error('CRITICAL: VITE_SUPABASE_ANON_KEY is missing. Check .env file.');
  }
}

// ─── DEVELOPMENT: Warn visibly but don't crash ───
if (!import.meta.env.PROD) {
  if (!SUPABASE_URL) {
    console.warn(
      '%c⚠️ [AUTH] VITE_SUPABASE_URL chưa set — dùng localhost fallback.',
      'color: #ff6b35; font-size: 14px; font-weight: bold;'
    );
  }
  if (!SUPABASE_ANON_KEY) {
    console.warn(
      '%c⚠️ [AUTH] VITE_SUPABASE_ANON_KEY chưa set — Supabase API sẽ fail.',
      'color: #ff6b35; font-size: 14px; font-weight: bold;'
    );
  }
}

/* ──────────────────────── Client Initialization ──────────────────────── */

const resolvedUrl = SUPABASE_URL || 'http://localhost:54321';
const resolvedKey = SUPABASE_ANON_KEY || 'missing_anon_key_check_env';

/**
 * Khoá tuần tự cho GoTrue, thay cho `navigator.locks`.
 *
 * ── Vì sao không dùng navigator.locks ──
 *
 * Nó gây treo khi F5 trên Chromium, và khoá do nó cấp còn dùng chung giữa các tab.
 *
 * ── Vì sao bản tự viết trước đó hỏng ──
 *
 * Bản cũ giữ một cờ `isLocking` và một mảng `lockQueue`. Khi một tác vụ xong, phần
 * `finally` đặt `isLocking = false` RỒI mới lấy mục kế ra chạy — nên mục đó chạy
 * trong lúc cờ đang là `false`. Lời gọi tiếp theo thấy khoá rảnh và chạy song song;
 * hai nhánh cùng `shift()` một hàng đợi, và **mục bị bỏ rơi thì promise của nó không
 * bao giờ resolve**.
 *
 * Hậu quả đo được trên production ngày 29/10/2026: mọi lệnh `supabase.from(...)` đều
 * treo vô hạn, vì supabase-js lấy token qua chính khoá này cho MỌI truy vấn. Nút
 * "Lưu & Tải lên…" quay mãi, không lỗi, không một dòng nào xuống CSDL suốt sáu
 * tiếng. `try/catch` không bắt được vì promise treo không ném lỗi.
 *
 * ── Cách làm hiện tại ──
 *
 * Nối chuỗi promise. Không có cờ để lệch, không có hàng đợi để rơi: mỗi lời gọi chạy
 * sau khi lời gọi trước kết thúc, và đó là toàn bộ điều GoTrue cần.
 *
 * Lỗi KHÔNG được làm đứt chuỗi — một lần làm mới token hỏng mà khoá kẹt theo thì
 * mọi truy vấn sau đều chết. Nên nhánh nối tiếp nuốt lỗi, còn lỗi thật vẫn trả về
 * đúng người gọi.
 *
 * Tính tái nhập do supabase-js tự lo: `_acquireLock` kiểm `lockAcquired` trước khi
 * gọi khoá, nên nó không bao giờ xin khoá hai lần lồng nhau.
 */
/**
 * Chờ tối đa bao lâu cho tác vụ ĐANG giữ khoá.
 *
 * Đây là phần quan trọng nhất. Chuỗi tuần tự không thôi vẫn kẹt vĩnh viễn nếu một
 * tác vụ không bao giờ kết thúc — và trên production ngày 29/10/2026 đúng là có:
 * console in `[Auth] getSession() timed out after 3s`, rồi mọi lệnh
 * `supabase.from(...)` treo theo, vì supabase-js lấy token qua khoá này cho MỌI
 * truy vấn. Nút "Lưu & Tải lên…" quay sáu tiếng, không lỗi, không ghi được gì.
 *
 * 5 giây: dài hơn mọi lần làm mới token bình thường, ngắn hơn mức người dùng chịu
 * được. Hết giờ thì đi tiếp chứ không chờ nữa — mất tính loại trừ trong chốc lát
 * còn hơn treo cả ứng dụng.
 */
const HET_GIO_KHOA_MS = 5000;

let chuoiKhoa: Promise<unknown> = Promise.resolve();

const memoryLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const truoc = chuoiKhoa;

  const ketQua = (async () => {
    // Chờ tác vụ trước, NHƯNG không chờ mãi.
    await Promise.race([
      truoc.then(
        () => undefined,
        () => undefined
      ),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.warn('[Auth] Khoá bị giữ quá 5 giây — bỏ qua để không treo cả ứng dụng');
          resolve();
        }, HET_GIO_KHOA_MS)
      ),
    ]);
    return fn();
  })();

  // Lỗi KHÔNG được làm đứt chuỗi: một lần làm mới token hỏng mà khoá kẹt theo thì
  // mọi truy vấn sau đều chết.
  chuoiKhoa = ketQua.then(
    () => undefined,
    () => undefined
  );

  return ketQua;
};

export const supabase = createClient<Database>(resolvedUrl, resolvedKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: memoryLock,
  },
});