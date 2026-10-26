/**
 * Viprosell — Error Utilities
 * Graceful error handling helpers for Supabase auth lock errors, AbortErrors, etc.
 */

/** Check if an error is an AbortError / lock-related error that should be silently retried */
export function isAbortOrLockError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('AbortError') ||
    msg.includes('Lock broken') ||
    msg.includes('steal') ||
    msg.includes('The user aborted a request') ||
    msg.includes('signal is aborted')
  );
}

/** Get a user-friendly Vietnamese error message from an error */
export function getUserErrorMessage(err: unknown, fallback = 'Đã xảy ra lỗi không xác định'): string {
  if (!err) return fallback;
  
  if (isAbortOrLockError(err)) {
    return 'Phiên đăng nhập đang được đồng bộ. Vui lòng thử lại.';
  }
  
  const msg = err instanceof Error ? err.message : String(err);
  
  // Network errors
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_NETWORK')) {
    return 'Không thể kết nối đến server. Vui lòng kiểm tra mạng và thử lại.';
  }
  
  // Auth errors
  if (msg.includes('JWT expired') || msg.includes('token is expired')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  
  if (msg.includes('Invalid login credentials')) {
    return 'Email hoặc mật khẩu không đúng.';
  }

  return msg || fallback;
}

/**
 * Lock-safe wrapper around supabase.auth.getSession().
 * Catches AbortError / "Lock broken" errors and returns null session
 * instead of crashing the calling component.
 * 
 * Usage: Replace `supabase.auth.getSession()` with `getSessionSafe(supabase)`
 */
export async function getSessionSafe(supabase: any): Promise<{ access_token: string } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (err) {
    if (isAbortOrLockError(err)) {
      console.debug('[Auth] getSession Lock/Abort — returning null session');
    } else {
      console.warn('[Auth] getSession failed:', err);
    }
    return null;
  }
}
