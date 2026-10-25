/**
 * Viprosell — Tier 2: Ad Strategy (Local AI Video Ads Pipeline)
 * System prompt + user template + zod schema.
 * Receives a normalized product brief, produces a compact strategy for 9:16 short-form.
 * Batch mode: returns exactly 3 strategy variants (painfirst / reviewtrust / offerconversion)
 * to feed the existing 3-concept selection UI.
 */
import { z } from 'zod';

export const TIER2_SYSTEM_PROMPT = `You are a direct-response short video ad strategist for local rendering pipelines.
You receive a normalized product brief and must produce compact ad strategies in valid JSON.

Rules:
- Output valid JSON only.
- No markdown.
- Create practical strategies for 9:16 short-form video.
- Prioritize mobile attention in the first 2 seconds.
- Use only claims supported by the brief.
- Avoid hype language and generic slogans.
- Strategies must be renderable from limited assets such as 1-3 product images.
- Every recommendation must be usable by a scene planner and an FFmpeg-based renderer.
- Keep overlays concise and voice lines believable.
- Provide exactly 3 strategies, one for each angle_type: painfirst, reviewtrust, offerconversion.`;

export const TIER2_USER_TEMPLATE = `BRIEF JSON:
{{brief_json}}

Return the ad strategies JSON. Structure: { "strategies": [ {angle_type, creative_angle, primary_hook, secondary_hooks, emotional_frame, audience_focus, cta, pacing, visual_style, music_direction, narration_style, scene_count_target, safety_notes} ] } with exactly 3 items in the order painfirst, reviewtrust, offerconversion.`;

export const Tier2StrategySchema = z.object({
  angle_type: z.enum(['painfirst', 'reviewtrust', 'offerconversion']).catch('painfirst'),
  creative_angle: z.string().min(1),
  primary_hook: z.string().min(1).max(120),
  secondary_hooks: z.array(z.string()).max(3).default([]),
  emotional_frame: z.string().default(''),
  audience_focus: z.string().default(''),
  cta: z.string().min(1),
  pacing: z.enum(['fast', 'fast_medium', 'medium']).catch('fast_medium'),
  visual_style: z.object({
    look: z.string().default(''),
    camera_language: z.string().default(''),
    text_style: z.string().default(''),
  }).default({ look: '', camera_language: '', text_style: '' }),
  music_direction: z.string().default(''),
  narration_style: z.string().default(''),
  scene_count_target: z.number().int().min(4).max(10).catch(6),
  safety_notes: z.array(z.string()).default([]),
});

export const Tier2BatchSchema = z.object({
  strategies: z.array(Tier2StrategySchema).min(1).max(4),
});

export type Tier2Strategy = z.infer<typeof Tier2StrategySchema>;

export function buildTier2Prompt(briefJson: unknown): string {
  return TIER2_USER_TEMPLATE.replace('{{brief_json}}', JSON.stringify(briefJson));
}