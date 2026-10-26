/**
 * Viprosell — Enum Mapping Layer
 *
 * The Supabase Cloud database uses snake_case enums (e.g. 'quick_ads')
 * while the Frontend uses concatenated lowercase (e.g. 'quickads').
 *
 * This module provides bidirectional mapping so that:
 *   - Data SENT to Supabase is converted from Frontend → DB format
 *   - Data READ from Supabase is converted from DB → Frontend format
 *
 * ROOT CAUSE: The original migration (Supabase Cloud) defined enums with
 * underscores, but the local db/01-schema.sql and frontend types were
 * written without underscores. Both are valid, but they must match.
 */

// ─── Package Type ──────────────────────────────────────────────
// Frontend: 'quickads' | 'reviewvideo' | 'conversionvideo'
// Database: 'quick_ads' | 'review_video' | 'conversion_video'

const PACKAGE_TYPE_TO_DB: Record<string, string> = {
  quickads: 'quick_ads',
  reviewvideo: 'review_video',
  conversionvideo: 'conversion_video',
};

const PACKAGE_TYPE_FROM_DB: Record<string, string> = {
  quick_ads: 'quickads',
  review_video: 'reviewvideo',
  conversion_video: 'conversionvideo',
};

// ─── Project Status ────────────────────────────────────────────
// Frontend: 'conceptready' | 'scriptready' | 'renderqueued'
// Database: 'concept_ready' | 'script_ready' | 'render_queued'

const PROJECT_STATUS_TO_DB: Record<string, string> = {
  draft: 'draft',
  analyzing: 'analyzing',
  conceptready: 'concept_ready',
  scriptready: 'script_ready',
  renderqueued: 'render_queued',
  rendering: 'rendering',
  completed: 'completed',
  failed: 'failed',
};

const PROJECT_STATUS_FROM_DB: Record<string, string> = {
  draft: 'draft',
  analyzing: 'analyzing',
  concept_ready: 'conceptready',
  script_ready: 'scriptready',
  render_queued: 'renderqueued',
  rendering: 'rendering',
  completed: 'completed',
  failed: 'failed',
};

// ─── Render Mode ───────────────────────────────────────────────
// Frontend: 'draft_local' | 'draftlocaltts' | 'premiumcloud'
// Database: 'draft_local' | 'draft_local_tts' | 'premium_cloud'

const RENDER_MODE_TO_DB: Record<string, string> = {
  draft_local: 'draft_local',
  draftlocaltts: 'draft_local_tts',
  premiumcloud: 'premium_cloud',
};

const RENDER_MODE_FROM_DB: Record<string, string> = {
  draft_local: 'draft_local',
  draft_local_tts: 'draftlocaltts',
  premium_cloud: 'premiumcloud',
};

// ─── Angle Type ────────────────────────────────────────────────
// Frontend: 'painfirst' | 'reviewtrust' | 'offerconversion'
// Database: 'pain_first' | 'review_trust' | 'offer_conversion'

const ANGLE_TYPE_TO_DB: Record<string, string> = {
  painfirst: 'pain_first',
  reviewtrust: 'review_trust',
  offerconversion: 'offer_conversion',
};

const ANGLE_TYPE_FROM_DB: Record<string, string> = {
  pain_first: 'painfirst',
  review_trust: 'reviewtrust',
  offer_conversion: 'offerconversion',
};

// ═══════════════════════════════════════════════════════════════
//  Public Mapping Functions
// ═══════════════════════════════════════════════════════════════

/** Convert a Frontend value → Database value. Returns original if no mapping exists. */
function mapTo(dict: Record<string, string>, value: string): string {
  return dict[value] ?? value;
}

/** Convert a Database value → Frontend value. Returns original if no mapping exists. */
function mapFrom(dict: Record<string, string>, value: string): string {
  return dict[value] ?? value;
}

// ─── Package Type ──────────────────────────────────────────────

export function packageTypeToDb(value: string): string {
  return mapTo(PACKAGE_TYPE_TO_DB, value);
}

export function packageTypeFromDb(value: string): string {
  return mapFrom(PACKAGE_TYPE_FROM_DB, value);
}

// ─── Project Status ────────────────────────────────────────────

export function projectStatusToDb(value: string): string {
  return mapTo(PROJECT_STATUS_TO_DB, value);
}

export function projectStatusFromDb(value: string): string {
  return mapFrom(PROJECT_STATUS_FROM_DB, value);
}

// ─── Render Mode ───────────────────────────────────────────────

export function renderModeToDb(value: string): string {
  return mapTo(RENDER_MODE_TO_DB, value);
}

export function renderModeFromDb(value: string): string {
  return mapFrom(RENDER_MODE_FROM_DB, value);
}

// ─── Angle Type ────────────────────────────────────────────────

export function angleTypeToDb(value: string): string {
  return mapTo(ANGLE_TYPE_TO_DB, value);
}

export function angleTypeFromDb(value: string): string {
  return mapFrom(ANGLE_TYPE_FROM_DB, value);
}
