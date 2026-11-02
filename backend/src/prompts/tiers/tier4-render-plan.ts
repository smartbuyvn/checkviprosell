/**
 * Viprosell — Tầng 4: lược đồ kế hoạch dựng
 *
 * CHỈ CÒN LƯỢC ĐỒ. Tầng 4 KHÔNG gọi LLM — kế hoạch dựng do hàm `buildRenderPlan`
 * trong `lib/render-plan.ts` sinh ra. Lược đồ ở đây là cổng kiểm cho kết quả của
 * hàm đó, và là nguồn của kiểu `Tier4RenderPlan` mà 19 chỗ trong mã đang dùng.
 *
 * `TIER4_SYSTEM_PROMPT`, `TIER4_USER_TEMPLATE` và `buildTier4Prompt` đã xoá ngày
 * 01/11/2026: không nơi nào gọi, và để lại thì người đọc tưởng tầng 4 còn tốn
 * một lượt LLM nữa.
 */
import { z } from 'zod';


/**
 * Model doi khi bo qua lop vo va tra thang mang timeline o goc, gay loi
 * "root: Invalid input: expected object, received array". Boc lai thay vi bo ca lan goi.
 */
function wrapBareTimeline(value: unknown): unknown {
  if (Array.isArray(value)) {
    console.warn('[Tier4] model tra mang o goc, boc lai thanh { timeline: [...] }');
    return { timeline: value };
  }
  return value;
}

const Tier4Shape = z.object({
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
      start_sec: z.coerce.number().min(0),
      end_sec: z.coerce.number().min(0),
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
    // Mac dinh libx264: spec quyet dinh #2 chot render bang CPU va worker chay o
    // bat ky dau. De mac dinh h264_nvenc thi may khong co NVIDIA se thu NVENC that
    // bai roi moi lui ve CPU - ton mot lan goi ffmpeg vo ich cho MOI ban render.
    codec: z.enum(['h264_nvenc', 'libx264']).catch('libx264'),
    resolution: z.string().default('1080x1920'),
    audio_codec: z.string().default('aac'),
  }).default({ format: 'mp4', codec: 'libx264', resolution: '1080x1920', audio_codec: 'aac' }),
});

export const Tier4RenderPlanSchema = z.preprocess(wrapBareTimeline, Tier4Shape);

export type Tier4RenderPlan = z.infer<typeof Tier4Shape>;
