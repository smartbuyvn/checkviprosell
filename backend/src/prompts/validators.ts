/**
 * Viprosell — Cross-tier validator rules for the 4-tier Local AI pipeline.
 * Enforced between tiers so the render worker only receives validated render plans.
 */
import type { Tier1Brief } from './tiers/tier1-brief';
import type { Tier2Strategy } from './tiers/tier2-strategy';
import type { Tier3SceneGraph } from './tiers/tier3-scene-graph';
import type { Tier4RenderPlan } from './tiers/tier4-render-plan';

const SUPPORTED_CODECS = new Set(['h264_nvenc', 'libx264']);
const MAX_OVERLAY_CHARS = 40;
const MAX_HOOK_WORDS = 12;

export interface TierValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBriefTier(brief: Tier1Brief): TierValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!brief.product_title || brief.product_title.trim().length === 0) {
    errors.push('brief.product_title must not be empty');
  }
  if (brief.needs_human_review && (!brief.missing_info || brief.missing_info.length === 0)) {
    warnings.push('brief.needs_human_review=true but missing_info is empty');
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validateStrategyTier(strategy: Tier2Strategy): TierValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hookWords = (strategy.primary_hook || '').trim().split(/\s+/).filter(Boolean).length;
  if (hookWords > MAX_HOOK_WORDS) {
    warnings.push(`strategy.primary_hook has ${hookWords} words (max ${MAX_HOOK_WORDS}). Rendering may feel long.`);
  }
  const scenes = strategy.scene_count_target || 6;
  if (scenes < 4 || scenes > 10) {
    errors.push(`strategy.scene_count_target must be 4-10, got ${scenes}`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validateSceneGraphTier(sceneGraph: Tier3SceneGraph): TierValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const scenes = sceneGraph.scenes || [];
  const metaDuration = sceneGraph.video_meta?.duration_sec || 20;

  let computedDuration = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (typeof s.start_sec !== 'number' || typeof s.end_sec !== 'number' || s.start_sec >= s.end_sec) {
      errors.push(`scene[${s.scene_id}].start_sec must be < end_sec`);
    }
    if (s.overlay_text && s.overlay_text.length > MAX_OVERLAY_CHARS) {
      errors.push(`scene[${s.scene_id}].overlay_text exceeds ${MAX_OVERLAY_CHARS} chars`);
    }
    computedDuration += (s.end_sec || 0) - (s.start_sec || 0);
  }

  if (Math.abs(computedDuration - metaDuration) > 3) {
    warnings.push(`scene_graph.video_meta.duration_sec (${metaDuration}s) differs from sum of scenes (${computedDuration.toFixed(1)}s)`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validateRenderPlanTier(plan: Tier4RenderPlan): TierValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!SUPPORTED_CODECS.has(plan.export?.codec || '')) {
    errors.push(`render_plan.export.codec "${plan.export?.codec}" is not supported. Supported: ${[...SUPPORTED_CODECS].join(', ')}`);
  }

  const assetIds = new Set<string>((plan.assets || []).map((a) => a.asset_id));
  const timeline = plan.timeline || [];
  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i];
    if (!assetIds.has(t.asset_id)) {
      errors.push(`render_plan.timeline[${i}].asset_id "${t.asset_id}" does not exist in assets`);
    }
    if (t.start_sec >= t.end_sec) {
      errors.push(`render_plan.timeline[${i}] start_sec must be < end_sec`);
    }
    if (t.overlay?.text && t.overlay.text.length > MAX_OVERLAY_CHARS) {
      errors.push(`render_plan.timeline[${i}].overlay.text exceeds ${MAX_OVERLAY_CHARS} chars`);
    }
  }

  const supportedMotions = new Set(['static', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'push_in']);
  for (let i = 0; i < timeline.length; i++) {
    if (!supportedMotions.has(timeline[i].motion?.type || '')) {
      errors.push(`render_plan.timeline[${i}].motion.type "${timeline[i].motion?.type}" is not supported`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateFullPipeline(
  brief: Tier1Brief,
  strategy: Tier2Strategy,
  sceneGraph: Tier3SceneGraph,
  renderPlan: Tier4RenderPlan
): TierValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const r of [validateBriefTier(brief), validateStrategyTier(strategy), validateSceneGraphTier(sceneGraph), validateRenderPlanTier(renderPlan)]) {
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function clampSceneCount(strategy: Tier2Strategy): number {
  const raw = strategy.scene_count_target || 6;
  return Math.min(10, Math.max(4, Math.round(raw)));
}