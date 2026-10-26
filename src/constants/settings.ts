import { SystemSettings } from '@/types';

/**
 * Default system settings — local-first, cloud disabled.
 * These are the app defaults when no admin override is present.
 */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  // Core settings
  LOCALONLYMODE: true,
  CLOUDFALLBACKENABLED: false,
  PREMIUMRENDERENABLED: false,
  ALLOWEXTERNALAIAPIS: false,
  LOCALLLMURL: 'http://localhost:11434',
  LOCALRENDERWORKERURL: 'http://localhost:5001',
  DEFAULTTTSMODE: 'local',
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

  if (settings.LOCALONLYMODE && settings.ALLOWEXTERNALAIAPIS) {
    errors.push('LOCALONLYMODE=true không được phép bật ALLOWEXTERNALAIAPIS');
  }

  if (settings.CLOUDFALLBACKENABLED && !settings.LOCALLLMURL) {
    errors.push('CLOUDFALLBACKENABLED=true nhưng chưa cấu hình LOCALLLMURL');
  }

  if (settings.PREMIUMRENDERENABLED && settings.LOCALONLYMODE) {
    errors.push('PREMIUMRENDERENABLED=true không tương thích với LOCALONLYMODE=true');
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
