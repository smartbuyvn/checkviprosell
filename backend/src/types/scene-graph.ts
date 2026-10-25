/**
 * Viprosell — SceneGraph Type Contract
 * Phase 1: Stable schema for AI → Composition communication
 *
 * RULES:
 * - All enums are CLOSED (no free-form strings allowed in composition layer)
 * - Text fields have max-length contracts (enforced at validation layer)
 * - Schema is aspect-agnostic: same JSON renders both 9:16 and 1:1
 * - No runtime hallucination: every animation name must exist in AnimationType enum
 */

// ─── Enums (CLOSED — no free-form strings allowed) ────────────────────────────

export enum AnimationType {
  /** Image pans left while scaled up — Ken Burns classic */
  PAN_LEFT = 'pan_left',
  /** Image pans right while scaled up */
  PAN_RIGHT = 'pan_right',
  /** Slow zoom in from center */
  ZOOM_IN = 'zoom_in',
  /** Slow zoom out from center */
  ZOOM_OUT = 'zoom_out',
  /** Static — no motion, just cut */
  STATIC = 'static',
  /** Gentle fade in from black */
  FADE_IN = 'fade_in',
  /** Wipe reveal from left edge */
  WIPE_LEFT = 'wipe_left',
}

export enum LayoutType {
  /** Full-bleed image, text overlays on top */
  IMAGE_FULL = 'image_full',
  /** Image top half, text bottom half */
  IMAGE_TOP_TEXT_BOTTOM = 'image_top_text_bottom',
  /** Text-only scene, solid background color */
  TEXT_ONLY = 'text_only',
  /** CTA finale: product image + price + CTA button */
  CTA_CARD = 'cta_card',
  /** Side-by-side: small image left + text right (1:1 optimized) */
  SPLIT_IMAGE_TEXT = 'split_image_text',
}

export enum TextStyle {
  /** Large bold headline — hooks, USPs */
  HEADLINE = 'headline',
  /** Medium body text — supporting copy */
  BODY = 'body',
  /** Accent badge — price, promo, discount */
  BADGE = 'badge',
  /** CTA button label */
  CTA = 'cta',
  /** Small watermark / brand name */
  CAPTION = 'caption',
}

export enum VoiceoverMode {
  /** Generate TTS from voiceover_text (requires TTS API in Phase 2) */
  TTS = 'tts',
  /** No voiceover — silent or music-only */
  NONE = 'none',
  /** Placeholder: include text in output but skip audio in Phase 1 */
  PLACEHOLDER = 'placeholder',
}

export enum AssetFitMode {
  /** Scale to cover full frame, may crop edges */
  COVER = 'cover',
  /** Scale to fit within frame, may show letterbox */
  CONTAIN = 'contain',
  /** Scale to exactly fill, may distort (avoid unless intended) */
  FILL = 'fill',
}

export enum AspectRatioTarget {
  VERTICAL_9_16 = '9:16',
  SQUARE_1_1 = '1:1',
  HORIZONTAL_16_9 = '16:9',
}

export enum VideoPackageType {
  QUICK_ADS = 'quick_ads',
  REVIEW_VIDEO = 'review_video',
  CONVERSION_VIDEO = 'conversion_video',
}

// ─── Text Overlay ──────────────────────────────────────────────────────────────

/** Max char limits enforced by validator */
export const TEXT_LIMITS = {
  headline: 40,
  body: 80,
  badge: 20,
  cta: 25,
  caption: 30,
} as const;

export interface TextOverlay {
  /** Display text — must respect char limit for its style */
  text: string;
  style: TextStyle;
  /**
   * Vertical position as fraction of frame height (0 = top, 1 = bottom)
   * Default safe zones: top text at 0.08, bottom text at 0.78
   */
  position_y: number;
  /**
   * Horizontal alignment
   * @default 'center'
   */
  align?: 'left' | 'center' | 'right';
  /**
   * Animation: slide_up | fade_in | none
   * Kept as literal union (not enum) to keep overlay config lightweight
   */
  entrance?: 'slide_up' | 'fade_in' | 'none';
  /** Delay in frames before overlay appears (relative to scene start) */
  delay_frames?: number;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export interface SceneAsset {
  /**
   * Source URL or local asset reference.
   * Can be: https://... | supabase://bucket/path | asset_id:{uuid}
   */
  src: string;
  fit: AssetFitMode;
  /** Optional: override focal point for pan animations (0–1 range) */
  focal_x?: number;
  focal_y?: number;
}

export interface Scene {
  /** Unique scene identifier within this SceneGraph */
  id: string;
  /**
   * Start frame (at 30fps).
   * Scene 0 starts at frame 0.
   * Each subsequent scene starts where previous ended.
   */
  start_frame: number;
  /** Duration in frames (at 30fps). Min: 30 (1s), Max: 150 (5s) */
  duration_frames: number;
  layout: LayoutType;
  animation: AnimationType;
  /** Primary visual asset. Required for all layouts except TEXT_ONLY */
  asset?: SceneAsset;
  /** Text overlays rendered on this scene */
  overlays: TextOverlay[];
  /** Voiceover text for TTS. Ignored if voiceover_mode = none */
  voiceover_text?: string;
  /** Background color hex — used for TEXT_ONLY and letterbox fill */
  bg_color?: string;
}

// ─── Global Metadata ──────────────────────────────────────────────────────────

export interface SceneGraphMeta {
  /** Human-readable title for this video variant */
  title: string;
  /** Which ad package this graph was generated for */
  package_type: VideoPackageType;
  /** Target aspect ratio — composition layer adapts safe areas accordingly */
  aspect_ratio: AspectRatioTarget;
  /** Total duration in frames (sum of all scene duration_frames) */
  total_frames: number;
  /** Frames per second — always 30 in Phase 1 */
  fps: 30;
  /** Brand/product name — used in CTA and watermark */
  brand_name: string;
  /** Primary brand color hex for badges and CTA button */
  brand_color?: string;
  /** Voiceover mode for all scenes */
  voiceover_mode: VoiceoverMode;
  /** Background music track ID (Phase 2). Null in Phase 1 */
  bg_music_id?: string | null;
  /** ISO timestamp when this SceneGraph was generated */
  generated_at: string;
  /** Gemini model that generated this graph */
  generated_by_model?: string;
}

// ─── SceneGraph (Root) ────────────────────────────────────────────────────────

export interface SceneGraph {
  /** Schema version — must be '1.0' in Phase 1 */
  schema_version: '1.0';
  meta: SceneGraphMeta;
  /**
   * Ordered array of scenes.
   * Min: 3 scenes, Max: 8 scenes (enforced by validator)
   * Last scene SHOULD be layout: cta_card
   */
  scenes: Scene[];
}

// ─── Input Contract (for AI Service) ─────────────────────────────────────────

export interface SceneGraphInput {
  product_title: string;
  product_summary: string;
  product_price?: string;
  promo_text?: string;
  target_audience: string;
  aspect_ratio: AspectRatioTarget;
  /** Target duration in seconds. AI will compute frames. Min: 10, Max: 30 */
  duration_seconds: number;
  package_type: VideoPackageType;
  /** Array of public image URLs for product */
  image_urls: string[];
}

// ─── Validation Result ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Normalized SceneGraph (with safe defaults applied) if valid */
  data?: SceneGraph;
}
