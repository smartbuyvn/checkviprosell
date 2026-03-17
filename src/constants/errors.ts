/**
 * Viprosell â€” Error Taxonomy
 * Canonical error codes from Architecture Addendum Â§7.3
 */

export const ERROR_CODES = {
  // AI pipeline errors
  AI_SCHEMA_INVALID: 'AI_SCHEMA_INVALID',
  AI_OUTPUT_UNUSABLE: 'AI_OUTPUT_UNUSABLE',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_GATEWAY_ERROR: 'AI_GATEWAY_ERROR',

  // Infrastructure errors
  LOCAL_LLM_UNREACHABLE: 'LOCAL_LLM_UNREACHABLE',
  RENDER_WORKER_UNREACHABLE: 'RENDER_WORKER_UNREACHABLE',
  RENDER_ASSET_MISSING: 'RENDER_ASSET_MISSING',
  RENDER_TIMEOUT: 'RENDER_TIMEOUT',

  // Business errors
  PAYMENT_WEBHOOK_DUPLICATE: 'PAYMENT_WEBHOOK_DUPLICATE',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',

  // Policy errors
  CLOUD_CALL_BLOCKED_BY_POLICY: 'CLOUD_CALL_BLOCKED_BY_POLICY',
  PREMIUM_FEATURE_DISABLED: 'PREMIUM_FEATURE_DISABLED',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation errors
  INTEL_VALIDATION_FAILED: 'INTEL_VALIDATION_FAILED',
  CONCEPT_VALIDATION_FAILED: 'CONCEPT_VALIDATION_FAILED',
  SCRIPT_VALIDATION_FAILED: 'SCRIPT_VALIDATION_FAILED',

  // Data errors
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  INTEL_NOT_FOUND: 'INTEL_NOT_FOUND',
  NO_CONCEPT_SELECTED: 'NO_CONCEPT_SELECTED',
  PERSIST_FAILED: 'PERSIST_FAILED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/** User-facing error messages (Vietnamese) */
export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.AI_SCHEMA_INVALID]: 'Káº¿t quáº£ AI khÃ´ng há»£p lá»‡. Vui lÃ²ng thá»­ láº¡i.',
  [ERROR_CODES.AI_OUTPUT_UNUSABLE]: 'AI khÃ´ng thá»ƒ táº¡o ná»™i dung phÃ¹ há»£p. Vui lÃ²ng thá»­ láº¡i.',
  [ERROR_CODES.AI_TIMEOUT]: 'AI xá»­ lÃ½ quÃ¡ lÃ¢u. Vui lÃ²ng thá»­ láº¡i sau.',
  [ERROR_CODES.LOCAL_LLM_UNREACHABLE]: 'KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n AI local. Kiá»ƒm tra cáº¥u hÃ¬nh.',
  [ERROR_CODES.RENDER_WORKER_UNREACHABLE]: 'Render worker khÃ´ng kháº£ dá»¥ng. Kiá»ƒm tra cáº¥u hÃ¬nh.',
  [ERROR_CODES.RENDER_ASSET_MISSING]: 'Thiáº¿u áº£nh/video sáº£n pháº©m Ä‘á»ƒ render.',
  [ERROR_CODES.RENDER_TIMEOUT]: 'Render quÃ¡ lÃ¢u. Vui lÃ²ng thá»­ láº¡i.',
  [ERROR_CODES.INSUFFICIENT_CREDITS]: 'KhÃ´ng Ä‘á»§ credits. Vui lÃ²ng náº¡p thÃªm.',
  [ERROR_CODES.CLOUD_CALL_BLOCKED_BY_POLICY]: 'TÃ­nh nÄƒng cloud bá»‹ táº¯t bá»Ÿi admin.',
  [ERROR_CODES.PREMIUM_FEATURE_DISABLED]: 'TÃ­nh nÄƒng premium chÆ°a Ä‘Æ°á»£c báº­t.',
  [ERROR_CODES.PAYMENT_WEBHOOK_DUPLICATE]: 'Giao dá»‹ch Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½.',
};
