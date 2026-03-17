// ============================================================
// Viprosell â€” Core Type Definitions
// Source of truth for all typed models in the app
// ============================================================

// --- Enums ---

export type PackageType = 'quick_ads' | 'review_video' | 'conversion_video';

export type ProductCategory = 'beauty' | 'fashion' | 'home' | 'other';

export type ProjectStatus =
  | 'draft'
  | 'analyzing'
  | 'concept_ready'
  | 'script_ready'
  | 'render_queued'
  | 'rendering'
  | 'completed'
  | 'failed';

export type RenderStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type RenderMode = 'draft_local' | 'draft_local_tts' | 'premium_cloud';

export type AffiliateEventStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type UserRole = 'guest' | 'user' | 'admin';

export type PriceBand = 'low' | 'mid' | 'high';

export type AngleType = 'pain_first' | 'review_trust' | 'offer_conversion';

export type OverlayStyle = 'headline' | 'price' | 'badge' | 'cta';

export type ReviewPersona = 'bestie' | 'koc' | 'shop_owner' | 'soft_expert';

export type TTSMode = 'local' | 'cloud';

export type AspectRatio = '9:16' | '16:9' | '1:1';

// --- Core Models ---

export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  package_type: PackageType;
  category: ProductCategory;
  source_url?: string;
  status: ProjectStatus;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectAsset {
  id: string;
  project_id: string;
  asset_type: 'image' | 'video';
  file_url: string;
  file_name: string;
  file_size: number;
  sort_order: number;
  created_at: string;
}

export interface ProductIntelligence {
  project_id: string;
  product_name: string;
  category: ProductCategory;
  target_buyer: string;
  price_band: PriceBand;
  usp_list: string[];
  pain_points: string[];
  objections: string[];
  trust_signals: string[];
  use_context: string[];
  recommended_package_fit: PackageType[];
  confidence_score: number;
}

export interface CommerceAngle {
  angle_type: AngleType;
  title: string;
  big_idea: string;
  hook: string;
  cta: string;
  why_it_works: string;
  score: number;
}

export interface ConceptSet {
  project_id: string;
  angles: CommerceAngle[];
  best_angle_type: AngleType;
}

export interface SceneCard {
  scene_no: number;
  duration_sec: number;
  visual_instruction: string;
  overlay_text: string;
  voice_line: string;
}

export interface Script {
  id: string;
  project_id: string;
  package_type: PackageType;
  duration_sec: number;
  script_text: string;
  scene_cards: SceneCard[];
  cta: string;
  created_at: string;
}

export interface OverlayItem {
  start_sec: number;
  end_sec: number;
  text: string;
  style: OverlayStyle;
}

export interface AssetPlanItem {
  asset_type: 'image' | 'video';
  source_ref: string;
  scene_no: number;
}

export interface VisualPack {
  project_id: string;
  render_mode: RenderMode;
  aspect_ratio: AspectRatio;
  subtitle_text: string;
  overlay_list: OverlayItem[];
  asset_plan: AssetPlanItem[];
  music_hint: string;
}

export interface CaptionExport {
  project_id: string;
  caption_tiktok: string;
  caption_reels: string;
  hashtags: string[];
  thumbnail_text: string;
  short_description: string;
}

export interface RenderJob {
  id: string;
  project_id: string;
  render_mode: RenderMode;
  status: RenderStatus;
  output_url?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  idempotency_key: string;
  created_at: string;
}

export interface AffiliateEvent {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: AffiliateEventStatus;
  commission_amount: number;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  project_id: string;
  step_name: string;
  trace_id: string;
  credits_used: number;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  features: string[];
}

// --- System Settings ---

export interface SystemSettings {
  // Core settings (original)
  LOCAL_ONLY_MODE: boolean;
  CLOUD_FALLBACK_ENABLED: boolean;
  PREMIUM_RENDER_ENABLED: boolean;
  ALLOW_EXTERNAL_AI_APIS: boolean;
  LOCAL_LLM_URL: string;
  LOCAL_RENDER_WORKER_URL: string;
  DEFAULT_TTS_MODE: TTSMode;
  MAX_ASSETS_PER_PROJECT: number;
  DEFAULT_ASPECT_RATIO: AspectRatio;
  // Extended settings (Addendum Â§6.2)
  LOCAL_TTS_URL: string;
  AI_JSON_REPAIR_ENABLED: boolean;
  AI_MAX_RETRY_PER_STEP: number;
  AI_LOG_RAW_OUTPUT: boolean;
  MAX_RENDER_RETRY: number;
  PROMPT_VERSION_PINNING: boolean;
  FAILED_JOB_RETENTION_DAYS: number;
  TRACE_LOG_ENABLED: boolean;
  SAFE_MODE_ON_LOCAL_FAILURE: boolean;
}
