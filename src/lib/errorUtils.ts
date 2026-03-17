/**
 * Viprosell â€” Error Utilities
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
export function getUserErrorMessage(err: unknown, fallback = 'ÄÃ£ xáº£y ra lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh'): string {
  if (!err) return fallback;
  
  if (isAbortOrLockError(err)) {
    return 'PhiÃªn Ä‘Äƒng nháº­p Ä‘ang Ä‘Æ°á»£c Ä‘á»“ng bá»™. Vui lÃ²ng thá»­ láº¡i.';
  }
  
  const msg = err instanceof Error ? err.message : String(err);
  
  // Network errors
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_NETWORK')) {
    return 'KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n server. Vui lÃ²ng kiá»ƒm tra máº¡ng vÃ  thá»­ láº¡i.';
  }
  
  // Auth errors
  if (msg.includes('JWT expired') || msg.includes('token is expired')) {
    return 'PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.';
  }
  
  if (msg.includes('Invalid login credentials')) {
    return 'Email hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng.';
  }

  return msg || fallback;
}
