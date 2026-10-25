/**
 * Viprosell — SceneGraph Runtime Validator
 * Phase 1
 *
 * PHILOSOPHY:
 * - Hard errors: missing required fields, invalid enums → REJECT (never guess)
 * - Soft errors: missing optional fields with safe defaults → NORMALIZE + warn
 * - Text too long: REJECT (not silently trim — Remotion should receive clean data)
 *
 * Import in both backend (validator gate before queue) and frontend (preview guard)
 */

import type { SceneGraph, ValidationResult, TextOverlay } from './scene-graph';
import {
  AnimationType,
  LayoutType,
  TextStyle,
  VoiceoverMode,
  AssetFitMode,
  AspectRatioTarget,
  VideoPackageType,
  TEXT_LIMITS,
} from './scene-graph';
import { TEXT_MAX_LENGTHS } from './scene-graph.schema';

// ─── Enum sets for fast lookup ─────────────────────────────────────────────────

const VALID_ANIMATIONS = new Set<string>(Object.values(AnimationType));
const VALID_LAYOUTS = new Set<string>(Object.values(LayoutType));
const VALID_TEXT_STYLES = new Set<string>(Object.values(TextStyle));
const VALID_VOICEOVER_MODES = new Set<string>(Object.values(VoiceoverMode));
const VALID_ASSET_FITS = new Set<string>(Object.values(AssetFitMode));
const VALID_ASPECT_RATIOS = new Set<string>(Object.values(AspectRatioTarget));
const VALID_PACKAGE_TYPES = new Set<string>(Object.values(VideoPackageType));

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function validateOverlay(
  overlay: any,
  sceneId: string,
  idx: number,
  errors: string[],
  warnings: string[]
): TextOverlay | null {
  const prefix = `Scene[${sceneId}].overlays[${idx}]`;

  if (typeof overlay !== 'object' || overlay === null) {
    errors.push(`${prefix}: must be an object`);
    return null;
  }

  if (typeof overlay.text !== 'string' || overlay.text.trim().length === 0) {
    errors.push(`${prefix}.text: required, must be non-empty string`);
    return null;
  }

  if (!VALID_TEXT_STYLES.has(overlay.style)) {
    errors.push(`${prefix}.style: "${overlay.style}" is not a valid TextStyle. Valid: ${[...VALID_TEXT_STYLES].join(', ')}`);
    return null;
  }

  const maxLen = TEXT_MAX_LENGTHS[overlay.style] ?? 80;
  if (overlay.text.length > maxLen) {
    errors.push(`${prefix}.text: exceeds max length for style="${overlay.style}" (${overlay.text.length} > ${maxLen} chars). Shorten the text.`);
    return null;
  }

  if (typeof overlay.position_y !== 'number' || overlay.position_y < 0 || overlay.position_y > 1) {
    errors.push(`${prefix}.position_y: must be a number between 0 and 1`);
    return null;
  }

  // Normalize optionals with safe defaults
  const normalized: TextOverlay = {
    text: overlay.text.trim(),
    style: overlay.style as TextStyle,
    position_y: overlay.position_y,
    align: ['left', 'center', 'right'].includes(overlay.align) ? overlay.align : 'center',
    entrance: ['slide_up', 'fade_in', 'none'].includes(overlay.entrance) ? overlay.entrance : 'fade_in',
    delay_frames: typeof overlay.delay_frames === 'number' ? Math.min(Math.max(0, overlay.delay_frames), 30) : 0,
  };

  return normalized;
}

// ─── Main Validator ────────────────────────────────────────────────────────────

export function validateSceneGraph(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Root must be a JSON object'], warnings };
  }

  const obj = raw as any;

  // ── schema_version ──
  if (obj.schema_version !== '1.0') {
    errors.push(`schema_version: must be "1.0", got "${obj.schema_version}"`);
  }

  // ── meta ──
  if (typeof obj.meta !== 'object' || obj.meta === null) {
    errors.push('meta: required object is missing');
    return { valid: false, errors, warnings }; // Can't continue without meta
  }

  const meta = obj.meta;

  if (typeof meta.title !== 'string' || meta.title.trim().length === 0) {
    errors.push('meta.title: required non-empty string');
  }
  if (meta.title?.length > 80) {
    errors.push(`meta.title: too long (${meta.title.length} > 80 chars)`);
  }

  if (!VALID_PACKAGE_TYPES.has(meta.package_type)) {
    errors.push(`meta.package_type: "${meta.package_type}" invalid. Valid: ${[...VALID_PACKAGE_TYPES].join(', ')}`);
  }

  if (!VALID_ASPECT_RATIOS.has(meta.aspect_ratio)) {
    errors.push(`meta.aspect_ratio: "${meta.aspect_ratio}" invalid. Valid: ${[...VALID_ASPECT_RATIOS].join(', ')}`);
  }

  if (typeof meta.total_frames !== 'number' || meta.total_frames < 300 || meta.total_frames > 900) {
    errors.push(`meta.total_frames: must be 300–900 (10s–30s at 30fps), got ${meta.total_frames}`);
  }

  if (meta.fps !== 30) {
    errors.push(`meta.fps: must be 30, got ${meta.fps}`);
  }

  if (typeof meta.brand_name !== 'string' || meta.brand_name.trim().length === 0) {
    errors.push('meta.brand_name: required non-empty string');
  }

  if (!VALID_VOICEOVER_MODES.has(meta.voiceover_mode)) {
    errors.push(`meta.voiceover_mode: "${meta.voiceover_mode}" invalid. Valid: ${[...VALID_VOICEOVER_MODES].join(', ')}`);
  }

  if (meta.brand_color !== undefined && !HEX_REGEX.test(meta.brand_color)) {
    warnings.push(`meta.brand_color: "${meta.brand_color}" is not a valid hex color. Will use default.`);
    meta.brand_color = '#FF4C61';
  }

  if (typeof meta.generated_at !== 'string') {
    warnings.push('meta.generated_at: missing, will be set to now');
    meta.generated_at = new Date().toISOString();
  }

  // ── scenes ──
  if (!Array.isArray(obj.scenes)) {
    errors.push('scenes: must be an array');
    return { valid: false, errors, warnings };
  }

  if (obj.scenes.length < 3 || obj.scenes.length > 8) {
    errors.push(`scenes: must have 3–8 scenes, got ${obj.scenes.length}`);
  }

  const normalizedScenes: SceneGraph['scenes'] = [];
  let computedTotalFrames = 0;

  for (let i = 0; i < obj.scenes.length; i++) {
    const scene = obj.scenes[i];
    const sceneId = scene?.id ?? `scene_${i}`;
    const prefix = `Scene[${sceneId}]`;

    if (typeof scene !== 'object' || scene === null) {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    if (typeof scene.id !== 'string' || scene.id.trim().length === 0) {
      errors.push(`${prefix}.id: required non-empty string`);
    }

    if (typeof scene.start_frame !== 'number' || scene.start_frame < 0) {
      errors.push(`${prefix}.start_frame: must be a non-negative integer`);
    }

    if (typeof scene.duration_frames !== 'number' || scene.duration_frames < 30 || scene.duration_frames > 150) {
      errors.push(`${prefix}.duration_frames: must be 30–150 (1s–5s at 30fps), got ${scene.duration_frames}`);
    } else {
      computedTotalFrames += scene.duration_frames;
    }

    if (!VALID_LAYOUTS.has(scene.layout)) {
      errors.push(`${prefix}.layout: "${scene.layout}" is not a valid LayoutType. Valid: ${[...VALID_LAYOUTS].join(', ')}`);
    }

    if (!VALID_ANIMATIONS.has(scene.animation)) {
      errors.push(`${prefix}.animation: "${scene.animation}" is not a valid AnimationType. Valid: ${[...VALID_ANIMATIONS].join(', ')}`);
    }

    // Asset validation (required for non-TEXT_ONLY layouts)
    const requiresAsset = scene.layout !== LayoutType.TEXT_ONLY;
    if (requiresAsset) {
      if (!scene.asset) {
        errors.push(`${prefix}.asset: required for layout="${scene.layout}"`);
      } else {
        if (typeof scene.asset.src !== 'string' || scene.asset.src.trim().length === 0) {
          errors.push(`${prefix}.asset.src: required non-empty string`);
        }
        if (!VALID_ASSET_FITS.has(scene.asset.fit)) {
          errors.push(`${prefix}.asset.fit: "${scene.asset.fit}" invalid. Valid: ${[...VALID_ASSET_FITS].join(', ')}`);
        }
      }
    }

    // Overlays
    if (!Array.isArray(scene.overlays)) {
      errors.push(`${prefix}.overlays: must be an array (can be empty [])`);
      continue;
    }

    if (scene.overlays.length > 3) {
      errors.push(`${prefix}.overlays: max 3 overlays per scene, got ${scene.overlays.length}`);
    }

    const normalizedOverlays: TextOverlay[] = [];
    for (let j = 0; j < scene.overlays.length; j++) {
      const overlay = validateOverlay(scene.overlays[j], sceneId, j, errors, warnings);
      if (overlay) normalizedOverlays.push(overlay);
    }

    // Voiceover text length
    if (scene.voiceover_text && scene.voiceover_text.length > 200) {
      errors.push(`${prefix}.voiceover_text: exceeds 200 chars (${scene.voiceover_text.length}). Shorten for TTS.`);
    }

    // bg_color
    if (scene.bg_color !== undefined && !HEX_REGEX.test(scene.bg_color)) {
      warnings.push(`${prefix}.bg_color: "${scene.bg_color}" is not valid hex. Will use #000000.`);
      scene.bg_color = '#000000';
    }

    normalizedScenes.push({
      id: String(scene.id).trim(),
      start_frame: scene.start_frame,
      duration_frames: scene.duration_frames,
      layout: scene.layout as LayoutType,
      animation: scene.animation as AnimationType,
      asset: scene.asset ? {
        src: scene.asset.src.trim(),
        fit: scene.asset.fit as AssetFitMode,
        focal_x: scene.asset.focal_x,
        focal_y: scene.asset.focal_y,
      } : undefined,
      overlays: normalizedOverlays,
      voiceover_text: scene.voiceover_text,
      bg_color: scene.bg_color,
    });
  }

  // Cross-check total_frames
  if (errors.length === 0 && Math.abs(computedTotalFrames - meta.total_frames) > 30) {
    warnings.push(
      `meta.total_frames (${meta.total_frames}) doesn't match sum of scene durations (${computedTotalFrames}). Correcting.`
    );
    meta.total_frames = computedTotalFrames;
  }

  // Last scene should be CTA
  const lastScene = normalizedScenes[normalizedScenes.length - 1];
  if (lastScene && lastScene.layout !== LayoutType.CTA_CARD) {
    warnings.push(`Last scene layout is "${lastScene.layout}", expected "cta_card". Consider adding a CTA scene.`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const normalized: SceneGraph = {
    schema_version: '1.0',
    meta: {
      title: meta.title.trim(),
      package_type: meta.package_type as VideoPackageType,
      aspect_ratio: meta.aspect_ratio as AspectRatioTarget,
      total_frames: meta.total_frames,
      fps: 30,
      brand_name: meta.brand_name.trim(),
      brand_color: meta.brand_color,
      voiceover_mode: meta.voiceover_mode as VoiceoverMode,
      bg_music_id: meta.bg_music_id ?? null,
      generated_at: meta.generated_at,
      generated_by_model: meta.generated_by_model,
    },
    scenes: normalizedScenes,
  };

  return { valid: true, errors: [], warnings, data: normalized };
}
