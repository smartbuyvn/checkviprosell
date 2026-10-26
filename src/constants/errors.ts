/**
 * Viprosell — Error Taxonomy
 * Canonical error codes from Architecture Addendum §7.3
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
  [ERROR_CODES.AI_SCHEMA_INVALID]: 'Kết quả AI không hợp lệ. Vui lòng thử lại.',
  [ERROR_CODES.AI_OUTPUT_UNUSABLE]: 'AI không thể tạo nội dung phù hợp. Vui lòng thử lại.',
  [ERROR_CODES.AI_TIMEOUT]: 'AI xử lý quá lâu. Vui lòng thử lại sau.',
  [ERROR_CODES.LOCAL_LLM_UNREACHABLE]: 'Không thể kết nối đến AI local. Kiểm tra cấu hình.',
  [ERROR_CODES.RENDER_WORKER_UNREACHABLE]: 'Render worker không khả dụng. Kiểm tra cấu hình.',
  [ERROR_CODES.RENDER_ASSET_MISSING]: 'Thiếu ảnh/video sản phẩm để render.',
  [ERROR_CODES.RENDER_TIMEOUT]: 'Render quá lâu. Vui lòng thử lại.',
  [ERROR_CODES.INSUFFICIENT_CREDITS]: 'Không đủ credits. Vui lòng nạp thêm.',
  [ERROR_CODES.CLOUD_CALL_BLOCKED_BY_POLICY]: 'Tính năng cloud bị tắt bởi admin.',
  [ERROR_CODES.PREMIUM_FEATURE_DISABLED]: 'Tính năng premium chưa được bật.',
  [ERROR_CODES.PAYMENT_WEBHOOK_DUPLICATE]: 'Giao dịch đã được xử lý.',
};
