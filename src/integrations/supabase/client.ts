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

// --------------------------------------------------------------------------------
// CUSTOM IN-MEMORY LOCK
// Bypasses the buggy navigator.locks (which causes F5 freezes in Chromium)
// while strictly maintaining the sequential execution required by Supabase GoTrue
// to prevent internal deadlocks.
// --------------------------------------------------------------------------------
let isLocking = false;
const lockQueue: Array<() => void> = [];

const memoryLock = async (name: string, ...args: any[]) => {
  const acquire = args[args.length - 1];
  if (typeof acquire !== 'function') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        const result = await acquire();
        resolve(result);
      } catch (e) {
        reject(e);
      } finally {
        isLocking = false;
        if (lockQueue.length > 0) {
          const next = lockQueue.shift();
          if (next) next();
        }
      }
    };

    if (isLocking) {
      lockQueue.push(run);
    } else {
      isLocking = true;
      run();
    }
  });
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