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

HARD CONSTRAINTS — these outrank every creative instruction below:
- Build the angle ONLY on facts the brief states. If the brief has no price, the
  offer angle cannot mention one; use urgency of use, not urgency of discount.
- Banned outright, no matter how well they would perform: ranking claims ("so 1",
  "tot nhat", "duy nhat"), promised results ("giam 5kg", "het mun sau 7 ngay"),
  invented social proof ("10.000 nguoi da mua"), fake scarcity ("chi con 3 suat"),
  and medical or safety claims of any kind.
- When the brief sets needs_human_review=true, keep every line conservative: say
  what the product IS, not what it achieves.
This sells to real buyers with real money. A fabricated claim is a legal exposure,
not a creative risk.

THE HOOK MUST BE ABOUT THIS PRODUCT — this is a hard constraint, not a style note:
- primary_hook must contain at least one concrete noun taken from the brief: the
  product name, its category, a material, a visible feature, or a number the brief
  states. Not an abstract noun like "vấn đề", "nhu cầu", "giải pháp".
- Apply this test before you answer: could this exact hook be pasted onto an ad for
  a completely different product? If yes, it is REJECTED. Write a new one.
- These are real hooks this system produced, and every one of them fails that test.
  Do not write anything resembling them:
    "Gặp vấn đề này mỗi ngày à?"
    "Đang tìm một thứ giải quyết việc này?"
    "Khó chịu lặp lại mỗi ngày?"
    "Vấn đề quen thuộc mỗi ngày"
    "Đang chọn đồng hồ hay laptop?"
  They name no product, state no fact, and would fit any listing on any marketplace.
  A viewer scrolling past learns nothing and keeps scrolling.
- Being conservative means claiming LESS, not saying less. "Laptop ASUS 15 inch,
  card rời" is conservative AND specific. "Gặp vấn đề này mỗi ngày à?" is neither —
  it claims nothing because it says nothing.
- When the brief truly has no product facts, build the hook from what the PHOTOS
  show, which the brief records in visual_inputs.notes. A visible colour, shape or
  piece of packaging is a concrete fact and beats any abstract question.

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

Return JSON with this EXACT shape and these EXACT types. The root MUST be an object
with a "strategies" key, never a bare array:

{
  "strategies": [
    {
      "angle_type": "painfirst",
      "creative_angle": "one sentence",
      "primary_hook": "one line of on-screen text",
      "secondary_hooks": ["one line", "one line"],
      "emotional_frame": "one phrase",
      "audience_focus": "one phrase",
      "cta": "one short line",
      "pacing": "fast_medium",
      "visual_style": {
        "look": "one phrase",
        "camera_language": "one phrase",
        "text_style": "one phrase"
      },
      "music_direction": "one phrase",
      "narration_style": "one phrase",
      "scene_count_target": 6,
      "safety_notes": ["one short note"]
    }
  ]
}

Type rules, follow them exactly:
- primary_hook, cta, creative_angle, emotional_frame, audience_focus, music_direction,
  narration_style: plain STRINGS. Never objects. Do not wrap them as {"text": ...}.
- secondary_hooks: ARRAY OF PLAIN STRINGS, at most 3. Never an array of objects.
- safety_notes: ARRAY OF STRINGS, even when there is only one note. Never a single string.
- visual_style: an OBJECT with exactly the three string fields look, camera_language,
  text_style. Never a plain string.
- scene_count_target: an INTEGER between 4 and 10. Not a string.
- angle_type: exactly one of painfirst, reviewtrust, offerconversion.
- pacing: exactly one of fast, fast_medium, medium.

Return exactly 3 items, in this order: painfirst, reviewtrust, offerconversion.`;

/**
 * Keo ve chuoi tu nhung dang model hay tra nham.
 *
 * Prompt da noi ro kieu, nhung model van lech thinh thoang. Sua duoc o day thi hon la
 * bo ca lan sinh noi dung: noi dung van dung, chi la boc sai lop vo.
 * Co ghi log de con biet model lech cho nao, chu khong chua lap im lang.
 */
function coerceString(value: unknown, field: string): unknown {
  if (typeof value === 'string') return value;

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of ['text', 'value', 'hook', 'content', 'label', 'line']) {
      if (typeof obj[key] === 'string') {
        console.warn(`[Tier2] ${field}: model tra object, lay truong "${key}" lam chuoi`);
        return obj[key];
      }
    }
  }

  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    console.warn(`[Tier2] ${field}: model tra mang, noi lai thanh mot chuoi`);
    return value.join(' ');
  }

  return value;
}

/** Keo ve mang chuoi: model hay tra mot chuoi don, hoac mang object. */
function coerceStringArray(value: unknown, field: string): unknown {
  if (typeof value === 'string') {
    console.warn(`[Tier2] ${field}: model tra mot chuoi, boc thanh mang mot phan tu`);
    return value.trim() ? [value] : [];
  }
  if (Array.isArray(value)) return value.map((v) => coerceString(v, `${field}[]`));
  return value;
}

/** visual_style phai la object; model doi khi mo ta bang mot cau. */
function coerceVisualStyle(value: unknown): unknown {
  if (typeof value === 'string') {
    console.warn('[Tier2] visual_style: model tra chuoi, dat vao truong look');
    return { look: value, camera_language: '', text_style: '' };
  }
  return value;
}

export const Tier2StrategySchema = z.object({
  angle_type: z.enum(['painfirst', 'reviewtrust', 'offerconversion']).catch('painfirst'),
  creative_angle: z.preprocess((v) => coerceString(v, 'creative_angle'), z.string().min(1)),
  primary_hook: z.preprocess((v) => coerceString(v, 'primary_hook'), z.string().min(1).max(120)),
  secondary_hooks: z
    .preprocess((v) => coerceStringArray(v, 'secondary_hooks'), z.array(z.string()).max(3))
    .default([]),
  emotional_frame: z.preprocess((v) => coerceString(v, 'emotional_frame'), z.string()).default(''),
  audience_focus: z.preprocess((v) => coerceString(v, 'audience_focus'), z.string()).default(''),
  cta: z.preprocess((v) => coerceString(v, 'cta'), z.string().min(1)),
  pacing: z.enum(['fast', 'fast_medium', 'medium']).catch('fast_medium'),
  visual_style: z
    .preprocess(
      coerceVisualStyle,
      z.object({
        look: z.string().default(''),
        camera_language: z.string().default(''),
        text_style: z.string().default(''),
      })
    )
    .default({ look: '', camera_language: '', text_style: '' }),
  music_direction: z.preprocess((v) => coerceString(v, 'music_direction'), z.string()).default(''),
  narration_style: z.preprocess((v) => coerceString(v, 'narration_style'), z.string()).default(''),
  scene_count_target: z.coerce.number().int().min(4).max(10).catch(6),
  safety_notes: z
    .preprocess((v) => coerceStringArray(v, 'safety_notes'), z.array(z.string()))
    .default([]),
});

/**
 * Model doi khi bo qua lop vo va tra thang mot mang o goc, gay loi
 * "root: Invalid input: expected object, received array". Boc lai thay vi bo ca lan goi.
 */
function wrapBareArray(value: unknown): unknown {
  if (Array.isArray(value)) {
    console.warn('[Tier2] model tra mang o goc, boc lai thanh { strategies: [...] }');
    return { strategies: value };
  }
  return value;
}

export const Tier2BatchSchema = z.preprocess(
  wrapBareArray,
  z.object({
    strategies: z.array(Tier2StrategySchema).min(1).max(4),
  })
);

export type Tier2Strategy = z.infer<typeof Tier2StrategySchema>;

export function buildTier2Prompt(briefJson: unknown): string {
  return TIER2_USER_TEMPLATE.replace('{{brief_json}}', JSON.stringify(briefJson));
}