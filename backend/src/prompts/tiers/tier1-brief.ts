/**
 * Viprosell — Tier 1: Product Brief (Local AI Video Ads Pipeline)
 * System prompt + user template + zod schema.
 * Converts raw user input into a clean, factual, production-ready JSON brief.
 */
import { z } from 'zod';

export const TIER1_SYSTEM_PROMPT = `You are a product-ad brief normalizer for a local-first short video generation pipeline.
Your job is to transform raw user input into a clean, factual, production-ready JSON brief.

SELLER'S OWN LIMITS — the 'seller_forbids' field in the input:
- Whatever the seller lists there must not appear anywhere in the brief, and must be
  carried into 'safety_notes' so the later stages see it too.
- This outranks your judgement about what would sell well. The seller knows their
  market, their competitors and their legal exposure; you do not.
- "N/A" means they set no limit.

Rules:
- Output valid JSON only.
- Do not use markdown.
- Do not invent product facts.
- If information is missing, keep fields null or empty and set needs_human_review=true.
- Normalize language into concise commercial Vietnamese.
- Extract only what is useful for ad generation.
- Prefer concrete benefits over vague adjectives.
- Keep target audience practical and narrow.
- Infer category only when confidence is high.
- Include safety notes if claims may be unverifiable.

Product photos (attached to the user message when available):
- Look at the photos before writing anything. They are the most reliable source about the product.
- Ground visual claims in what is actually visible: colour, finish, packaging, texture, size cues, how it is held or used, what is included in the box.
- Record concrete observations in visual_inputs.notes, one short Vietnamese sentence each. Describe what is there, not what would look good.
- Set visual_inputs.has_real_product_images=true only when at least one photo shows the product itself, not a logo, a price card, a screenshot of someone else's listing, or a stock background.
- Where the text and the photos disagree, trust the photos, note the conflict in missing_info and set needs_human_review=true.
- Flag unusable photos in visual_inputs.notes: blurry, too dark, heavy watermark, visible competitor branding, or a different product.
- When no photo is attached, leave visual_inputs.notes empty and say nothing about appearance. Do not guess colour or material from the product name.`;

export const TIER1_USER_TEMPLATE = `INPUT PRODUCT DATA:
- title: {{title}}
- raw_description: {{description}}
- source_url: {{source_url}}
- price_text: {{price_text}}
- target_platform: {{target_platform}}
- preferred_tone: {{preferred_tone}}
- desired_duration_sec: {{desired_duration_sec}}
- audience_hint: {{audience_hint}}
- key_points_user: {{key_points_user}}
- seller_forbids: {{do_not_say}}
- image_count: {{image_count}}
- image_notes: {{image_notes}}

Return JSON with this EXACT shape. The root MUST be an object, never a bare array:

{
  "product_title": "tên sản phẩm, một dòng",
  "category": "mỹ phẩm",
  "core_offer": "một câu về thứ khách nhận được",
  "target_audience": ["nữ 25-35", "da dầu"],
  "primary_use_case": "một câu",
  "key_benefits": ["lợi ích 1", "lợi ích 2", "lợi ích 3"],
  "proof_points": ["bằng chứng 1", "bằng chứng 2"],
  "price_positioning": "midrange",
  "tone": "thân thiện",
  "target_platform": "tiktok",
  "desired_duration_sec": 25,
  "visual_inputs": {
    "image_count": 4,
    "has_real_product_images": true,
    "notes": ["ảnh 1 là ảnh hộp sản phẩm"]
  },
  "constraints": ["không nói quá về công dụng y tế"],
  "missing_info": ["chưa rõ dung tích"],
  "needs_human_review": false
}

Type rules, follow them exactly:
- product_title: a non-empty STRING. This field is REQUIRED — never omit it, never null.
  When the input title is missing or useless, write a short descriptive name from the
  photos instead.
- target_audience, key_benefits, proof_points, constraints, missing_info,
  visual_inputs.notes: ARRAYS OF PLAIN STRINGS. Never objects, never a single string.
- key_benefits: AT MOST 5 items. proof_points: AT MOST 5 items. Pick the strongest
  ones and drop the rest; sending more makes the whole brief invalid.
- price_positioning: exactly one of budget, midrange, premium, unknown.
- desired_duration_sec: an INTEGER between 10 and 45.
- visual_inputs: an OBJECT with image_count (INTEGER), has_real_product_images
  (BOOLEAN) and notes (ARRAY OF STRINGS).
- needs_human_review: a BOOLEAN, not a string.
- category, core_offer, primary_use_case: STRINGS, or null when genuinely unknown.`;

/**
 * Keo ve mang chuoi tu nhung dang model hay tra nham.
 *
 * Ngay 28/10 tang 1 vo vi model tra `missing_info` la OBJECT thay vi mang, va
 * `key_benefits` co hon 5 phan tu. Prompt da noi ro kieu, nhung day la duong lui:
 * noi dung van dung, chi la boc sai lop vo — sua duoc thi hon la bo ca lan goi.
 */
function veMangChuoi(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        for (const k of ['text', 'value', 'label', 'name', 'content', 'item']) {
          if (typeof o[k] === 'string') return o[k];
        }
      }
      return String(v ?? '');
    }).filter((x) => String(x).trim() !== '');
  }
  if (typeof value === 'string') {
    return value.trim() ? [value] : [];
  }
  if (value && typeof value === 'object') {
    // Model doi khi tra { "1": "...", "2": "..." } hoac { ghi_chu: "..." }
    const vals = Object.values(value as Record<string, unknown>);
    if (vals.every((v) => typeof v === 'string')) return vals.filter((v) => String(v).trim());
  }
  return value;
}

/** Cat bot phan tu thua thay vi lam hong ca brief. */
function catBot(max: number) {
  return (value: unknown): unknown => {
    const arr = veMangChuoi(value);
    if (Array.isArray(arr) && arr.length > max) {
      console.warn(`[Tier1] Danh sach co ${arr.length} muc, cat con ${max}`);
      return arr.slice(0, max);
    }
    return arr;
  };
}

export const Tier1BriefSchema = z.object({
  product_title: z.string().min(1),
  category: z.string().nullable().optional(),
  core_offer: z.string().nullable().optional(),
  target_audience: z.preprocess(veMangChuoi, z.array(z.string())).default([]),
  primary_use_case: z.string().nullable().optional(),
  key_benefits: z.preprocess(catBot(5), z.array(z.string()).max(5)).default([]),
  proof_points: z.preprocess(catBot(5), z.array(z.string()).max(5)).default([]),
  price_positioning: z.enum(['budget', 'midrange', 'premium', 'unknown']).catch('unknown'),
  tone: z.string().default(''),
  target_platform: z.string().default('tiktok'),
  desired_duration_sec: z.number().int().min(10).max(45).catch(20),
  visual_inputs: z.object({
    image_count: z.number().int().default(0),
    has_real_product_images: z.boolean().default(false),
    notes: z.preprocess(veMangChuoi, z.array(z.string())).default([]),
  }).default({ image_count: 0, has_real_product_images: false, notes: [] }),
  constraints: z.preprocess(veMangChuoi, z.array(z.string())).default([]),
  missing_info: z.preprocess(veMangChuoi, z.array(z.string())).default([]),
  needs_human_review: z.boolean().default(false),
});

export type Tier1Brief = z.infer<typeof Tier1BriefSchema>;

export function buildTier1Prompt(input: Record<string, unknown>): string {
  return TIER1_USER_TEMPLATE
    .replace('{{title}}', String(input.title ?? 'N/A'))
    .replace('{{description}}', String(input.raw_description ?? input.description ?? 'N/A'))
    .replace('{{source_url}}', String(input.source_url ?? 'N/A'))
    .replace('{{price_text}}', String(input.price_text ?? 'N/A'))
    .replace('{{target_platform}}', String(input.target_platform ?? 'tiktok'))
    .replace('{{preferred_tone}}', String(input.preferred_tone ?? 'N/A'))
    .replace('{{desired_duration_sec}}', String(input.desired_duration_sec ?? 20))
    .replace('{{audience_hint}}', String(input.audience_hint ?? 'N/A'))
    .replace('{{key_points_user}}', String(input.key_points_user ?? 'N/A'))
    .replace('{{do_not_say}}', String(input.do_not_say ?? 'N/A'))
    .replace('{{image_count}}', String(input.image_count ?? 0))
    .replace('{{image_notes}}', String(input.image_notes ?? 'N/A'));
}