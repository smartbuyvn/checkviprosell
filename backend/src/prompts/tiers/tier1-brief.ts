/**
 * Viprosell — Tier 1: Product Brief (Local AI Video Ads Pipeline)
 * System prompt + user template + zod schema.
 * Converts raw user input into a clean, factual, production-ready JSON brief.
 */
import { z } from 'zod';

export const TIER1_SYSTEM_PROMPT = `You are a product-ad brief normalizer for a local-first short video generation pipeline.
Your job is to transform raw user input into a clean, factual, production-ready JSON brief.

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
- image_count: {{image_count}}
- image_notes: {{image_notes}}

Return the normalized product brief JSON.`;

export const Tier1BriefSchema = z.object({
  product_title: z.string().min(1),
  category: z.string().nullable().optional(),
  core_offer: z.string().nullable().optional(),
  target_audience: z.array(z.string()).default([]),
  primary_use_case: z.string().nullable().optional(),
  key_benefits: z.array(z.string()).max(5).default([]),
  proof_points: z.array(z.string()).max(5).default([]),
  price_positioning: z.enum(['budget', 'midrange', 'premium', 'unknown']).catch('unknown'),
  tone: z.string().default(''),
  target_platform: z.string().default('tiktok'),
  desired_duration_sec: z.number().int().min(10).max(45).catch(20),
  visual_inputs: z.object({
    image_count: z.number().int().default(0),
    has_real_product_images: z.boolean().default(false),
    notes: z.array(z.string()).default([]),
  }).default({ image_count: 0, has_real_product_images: false, notes: [] }),
  constraints: z.array(z.string()).default([]),
  missing_info: z.array(z.string()).default([]),
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
    .replace('{{image_count}}', String(input.image_count ?? 0))
    .replace('{{image_notes}}', String(input.image_notes ?? 'N/A'));
}