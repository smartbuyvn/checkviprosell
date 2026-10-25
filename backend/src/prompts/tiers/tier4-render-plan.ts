/**
 * Viprosell — Tier 4: Render Plan (Local AI Video Ads Pipeline)
 * System prompt + user template + zod schema.
 * Converts a validated scene graph into a deterministic FFmpeg NVENC render plan.
 */
import { z } from 'zod';

export const TIER4_SYSTEM_PROMPT = `You are a render-planning engine for an FFmpeg NVENC short-video renderer.
You receive a validated scene graph and must convert it into a deterministic render plan JSON.

Rules:
- Output valid JSON only.
- No markdown.
- Use instructions that are realistically executable by an FFmpeg-based composition pipeline.
- Assume image-based scenes, text overlays, subtitle burn-in, background music, voiceover, and simple transitions.
- Keep transitions minimal and production-safe.
- Do not introduce unsupported features.
- Prefer consistent naming, timing and coordinates.
- Supported camera motions: static, zoom_in, zoom_out, pan_left, pan_right, push_in.
- Supported transitions: cut, fade.
- Supported crop modes: simple_crop, smart_pan.`;

export const TIER4_USER_TEMPLATE = `SCENE GRAPH JSON:
{{scene_graph_json}}

Return the render plan JSON.`;

export const Tier4RenderPlanSchema = z.object({
  render_meta: z.object({
    renderer: z.string().default('ffmpeg_nvenc'),
    gpu_index: z.number().int().min(0).max(1).default(0),
    aspect_ratio: z.string().default('9:16'),
    fps: z.number().int().min(24).max(30).default(30),
  }).default({ renderer: 'ffmpeg_nvenc', gpu_index: 0, aspect_ratio: '9:16', fps: 30 }),
  assets: z.array(
    z.object({
      asset_id: z.string().min(1),
      type: z.enum(['image', 'voiceover', 'music']).catch('image'),
      source: z.string().min(1),
    })
  ).min(1),
  timeline: z.array(
    z.object({
      scene_id: z.string().min(1),
      start_sec: z.number().min(0),
      end_sec: z.number().min(0),
      asset_id: z.string().min(1),
      crop_mode: z.enum(['simple_crop', 'smart_pan']).catch('simple_crop'),
      motion: z.object({
        type: z.string().default('zoom_in'),
        zoom_start: z.number().min(1).max(2).default(1),
        zoom_end: z.number().min(1).max(2).default(1.08),
      }).default({ type: 'zoom_in', zoom_start: 1, zoom_end: 1.08 }),
      overlay: z.object({
        text: z.string().max(40).default(''),
        position_y: z.number().min(0).max(1).default(0.18),
        font_style: z.string().default('headline_bold'),
        animate_in: z.string().default('none'),
      }).default({ text: '', position_y: 0.18, font_style: 'headline_bold', animate_in: 'none' }),
      transition_in: z.string().default('cut'),
      transition_out: z.string().default('cut'),
    })
  ).min(4).max(10),
  audio_plan: z.object({
    voiceover_asset_id: z.string().nullable().default(null),
    music_asset_id: z.string().nullable().default(null),
    music_volume: z.number().min(0).max(1).default(0.18),
    ducking: z.boolean().default(false),
  }).default({ voiceover_asset_id: null, music_asset_id: null, music_volume: 0.18, ducking: false }),
  subtitle_plan: z.object({
    burn_in: z.boolean().default(true),
    style: z.string().default('clean_white_shadow'),
    position_y: z.number().min(0).max(1).default(0.82),
  }).default({ burn_in: true, style: 'clean_white_shadow', position_y: 0.82 }),
  export: z.object({
    format: z.string().default('mp4'),
    codec: z.enum(['h264_nvenc', 'libx264']).catch('h264_nvenc'),
    resolution: z.string().default('1080x1920'),
    audio_codec: z.string().default('aac'),
  }).default({ format: 'mp4', codec: 'h264_nvenc', resolution: '1080x1920', audio_codec: 'aac' }),
});

export type Tier4RenderPlan = z.infer<typeof Tier4RenderPlanSchema>;

export function buildTier4Prompt(sceneGraphJson: unknown): string {
  return TIER4_USER_TEMPLATE.replace('{{scene_graph_json}}', JSON.stringify(sceneGraphJson));
}