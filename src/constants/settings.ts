import { SystemSettings } from '@/types';

/**
 * Default system settings — local-first, cloud disabled.
 * These are the app defaults when no admin override is present.
 */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  // Core settings
  LOCAL_ONLY_MODE: true,
  CLOUD_FALLBACK_ENABLED: false,
  PREMIUM_RENDER_ENABLED: false,
  ALLOW_EXTERNAL_AI_APIS: false,
  LOCAL_LLM_URL: 'http://localhost:11434',
  LOCAL_RENDER_WORKER_URL: 'http://localhost:5001',
  DEFAULT_TTS_MODE: 'local',
  MAX_ASSETS_PER_PROJECT: 8,
  DEFAULT_ASPECT_RATIO: '9:16',
  // Extended settings (Addendum §6.2)
  LOCAL_TTS_URL: 'http://localhost:5002',
  AI_JSON_REPAIR_ENABLED: true,
  AI_MAX_RETRY_PER_STEP: 1,
  AI_LOG_RAW_OUTPUT: true,
  MAX_RENDER_RETRY: 1,
  PROMPT_VERSION_PINNING: true,
  FAILED_JOB_RETENTION_DAYS: 14,
  TRACE_LOG_ENABLED: true,
  SAFE_MODE_ON_LOCAL_FAILURE: true,
};

/**
 * Validates system settings for contradictions.
 * Returns array of error messages.
 */
export function validateSettings(settings: SystemSettings): string[] {
  const errors: string[] = [];

  if (settings.LOCAL_ONLY_MODE && settings.ALLOW_EXTERNAL_AI_APIS) {
    errors.push('LOCAL_ONLY_MODE=true không được phép bật ALLOW_EXTERNAL_AI_APIS');
  }

  if (settings.CLOUD_FALLBACK_ENABLED && !settings.LOCAL_LLM_URL) {
    errors.push('CLOUD_FALLBACK_ENABLED=true nhưng chưa cấu hình LOCAL_LLM_URL');
  }

  if (settings.PREMIUM_RENDER_ENABLED && settings.LOCAL_ONLY_MODE) {
    errors.push('PREMIUM_RENDER_ENABLED=true không tương thích với LOCAL_ONLY_MODE=true');
  }

  // Addendum §6.3 — extended contradiction rules
  if (!settings.AI_JSON_REPAIR_ENABLED) {
    errors.push('AI_JSON_REPAIR_ENABLED=false sẽ giảm độ bền pipeline AI');
  }

  if (!settings.PROMPT_VERSION_PINNING) {
    errors.push('PROMPT_VERSION_PINNING=false có thể gây prompt drift khi rollout');
  }

  return errors;
}
