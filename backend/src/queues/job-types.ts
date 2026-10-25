/**
 * Viprosell — Shared Job Payload Types and Status Enums
 * Used by queue producers (routes/services) and consumers (worker).
 */

// ─── Status Enums ────────────────────────────────────────────────────────────

export const AI_JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const RENDER_JOB_STATUS = {
  QUEUED: 'queued',
  PREPARING: 'preparing',
  COMPOSING: 'composing',
  RENDERING: 'rendering',
  PREVIEW_READY: 'preview_ready',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYABLE_FAILED: 'retryable_failed',
  EXPORTED: 'exported',
} as const;

export type AiJobStatus = typeof AI_JOB_STATUS[keyof typeof AI_JOB_STATUS];
export type RenderJobStatus = typeof RENDER_JOB_STATUS[keyof typeof RENDER_JOB_STATUS];

// ─── AI Job Payloads ─────────────────────────────────────────────────────────

export interface AiJobPayload {
  type: 'product_intel' | 'concept_angles' | 'script_compose';
  projectId: string;
  userId: string;
  traceId: string;
  accessToken: string;
  packageType?: 'quickads' | 'reviewvideo' | 'conversionvideo';
  conceptId?: string;
}

// ─── Render Job Payloads ──────────────────────────────────────────────────────

export interface RenderJobPayload {
  renderId: string;      // ID of the `renders` DB row
  projectId?: string;
  renderMode: 'draftlocal' | 'draftlocaltts' | 'premiumcloud' | 'quickads';
  aspectRatio: string;
  traceId: string;
  callbackUrl?: string;
  quickAdsGraph?: any;   // SceneGraph for Quick Ads
}
