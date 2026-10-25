/**
 * Viprosell — Tier 3: Scene Graph (Local AI Video Ads Pipeline)
 * System prompt + user template + zod schema.
 * Converts brief + strategy into a scene-by-scene plan renderable by FFmpeg.
 */
import { z } from 'zod';

export const TIER3_SYSTEM_PROMPT = `You are a short-form ad director creating a scene graph for FFmpeg-compatible product video rendering.
You receive a product brief and ad strategy, then output a scene-by-scene JSON plan.

Rules:
- Output valid JSON only.
- No markdown.
- Keep each scene focused on one message.
- Total duration must match strategy and brief constraints.
- Visual instructions must be realistic for image-based rendering with zoom, pan, crop, text overlay, subtitles, music and voiceover.
- Do not invent impossible camera moves.
- Overlays should be short, under 8 words when possible.
- Voice lines should sound natural in Vietnamese.
- Use safe layout assumptions for 9:16 mobile view.`;

export const TIER3_USER_TEMPLATE = `BRIEF JSON:
{{brief_json}}

STRATEGY JSON:
{{strategy_json}}

Return the scene graph JSON.`;

export const Tier3SceneGraphSchema = z.object({
  video_meta: z.object({
    aspect_ratio: z.string().default('9:16'),
    duration_sec: z.number().min(10).max(45).catch(20),
    style: z.string().default(''),
    target_platform: z.string().default('tiktok'),
  }).default({ aspect_ratio: '9:16', duration_sec: 20, style: '', target_platform: 'tiktok' }),
  scenes: z.array(
    z.object({
      scene_id: z.string().min(1),
      start_sec: z.number().min(0),
      end_sec: z.number().min(0),
      purpose: z.string().default(''),
      asset_ref: z.string().default('image_1'),
      visual_type: z.enum(['product_closeup', 'detail_crop', 'text_only', 'lifestyle_simulated', 'cta_card']).catch('product_closeup'),
      camera_motion: z.object({
        type: z.enum(['static', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'push_in']).catch('zoom_in'),
        direction: z.string().default('center'),
        speed: z.enum(['slow', 'medium']).catch('slow'),
      }).default({ type: 'zoom_in', direction: 'center', speed: 'slow' }),
      overlay_text: z.string().max(40).default(''),
      voice_line: z.string().max(200).default(''),
      subtitle: z.string().max(200).default(''),
      music_intensity: z.enum(['low', 'medium', 'high']).catch('medium'),
      safe_region: z.object({
        title_y: z.number().min(0).max(1).default(0.18),
        subtitle_y: z.number().min(0).max(1).default(0.82),
        cta_y: z.number().min(0).max(1).default(0.9),
      }).default({ title_y: 0.18, subtitle_y: 0.82, cta_y: 0.9 }),
    })
  ).min(4).max(10),
});

export type Tier3SceneGraph = z.infer<typeof Tier3SceneGraphSchema>;

export function buildTier3Prompt(briefJson: unknown, strategyJson: unknown): string {
  return TIER3_USER_TEMPLATE
    .replace('{{brief_json}}', JSON.stringify(briefJson))
    .replace('{{strategy_json}}', JSON.stringify(strategyJson));
}