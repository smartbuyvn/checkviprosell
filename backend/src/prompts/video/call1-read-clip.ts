/**
 * Viprosell — Call 1: đọc clip khách tự quay
 *
 * Model nhận các khung hình trích từ clip + transcript do Whisper tạo, và kể lại thứ
 * nó THẤY. Không đề xuất, không sáng tác.
 *
 * Vì sao tách riêng khỏi Call 2: hai việc này có tiêu chuẩn đúng/sai khác hẳn nhau.
 * Call 1 sai là bịa ra thứ không có trong khung hình — kiểm được bằng cách đối chiếu
 * với transcript. Call 2 sai là chọn nhầm đoạn — chỉ kiểm được bằng mốc thời gian.
 * Gộp hai việc vào một lần gọi thì không còn chỗ nào để chặn giữa chừng.
 */
import { z } from 'zod';

/** Số khung tối đa gửi cho model. */
export const MAX_FRAMES = 6;

export const CALL1_SYSTEM_PROMPT = `You read footage a seller filmed themselves, for a video editor.
You receive frames sampled from one clip, plus a transcript of what was said.

Describe ONLY what is in the frames and the transcript. You are not a creative director
here — do not propose shots, angles or copy. Another step does that.

HARD CONSTRAINTS — these outrank everything else:
- Never invent a product property, a price, a certification, or a claim. If the seller
  did not say it and the frame does not show it, it does not exist.
- Watermarks, burned-in captions, platform UI, and other people's comments visible on
  screen are NOT the seller's content. Ignore them.
- Do not infer that a face looks better, a product is a different colour, or a room is
  somewhere it is not. Describe the frame, not an improved version of it.
- When you cannot tell, put it in "unknowns" rather than guessing.

spoken_claims: short paraphrases of what the seller actually said about the product.
Keep each one close to their words. An empty list is a correct answer when they said
nothing about the product.

one_benefit_said: the single strongest benefit the seller stated out loud. Leave it ""
when they stated none — do not promote a visual impression into a spoken claim.

problems: report only what you can see or hear.
- shake: the frame moves enough to be distracting
- dark: underexposed, detail lost in shadow
- blown: overexposed, detail lost in highlight
- horizontal: filmed in landscape
- cut_off_product: the product leaves the frame or is cropped by the edge
- music_bed: background music is audible
- no_speech: nobody speaks

Output valid JSON only. No markdown.`;

export function buildCall1Prompt(transcript: string, clipDurationSec: number, frameTimesMs: number[]): string {
  return `CLIP LENGTH: ${clipDurationSec.toFixed(1)} seconds
FRAME TIMESTAMPS (ms, in the order the images are attached): ${frameTimesMs.join(', ')}

TRANSCRIPT (may be empty):
${transcript.trim() || '(no speech detected)'}

Return JSON with this EXACT shape. The root MUST be an object, never a bare array:

{
  "product_visible": true,
  "hands_visible": true,
  "spoken_claims": ["short paraphrase, close to their words"],
  "shots": [
    { "frame_id": "f1", "at_ms": 0, "usable": true, "reject_reason": "", "subject": "product", "sharp": true }
  ],
  "problems": ["shake"],
  "one_benefit_said": "",
  "unknowns": []
}

Field rules, follow them exactly:
- One "shots" entry per attached frame, in the same order, with at_ms copied from the
  list above. Do not invent frames that were not attached.
- subject: exactly one of product, hand, face, room, other.
- usable and sharp: BOOLEANS, not strings.
- reject_reason: a short phrase when usable is false, otherwise "".
- problems: only values from the list in the system prompt. An empty array is fine.
- spoken_claims and unknowns: arrays of STRINGS, possibly empty.`;
}

/** Model đôi khi bỏ lớp vỏ và trả thẳng mảng shots. Bọc lại thay vì bỏ cả lần gọi. */
function wrapBareShots(value: unknown): unknown {
  if (Array.isArray(value)) {
    console.warn('[Call1] model tra mang o goc, boc lai thanh { shots: [...] }');
    return { shots: value };
  }
  return value;
}

const Call1Shape = z.object({
  product_visible: z.coerce.boolean().catch(true),
  hands_visible: z.coerce.boolean().catch(false),
  spoken_claims: z.array(z.string()).catch([]),
  shots: z.array(
    z.object({
      frame_id: z.string().default(''),
      at_ms: z.coerce.number().min(0).catch(0),
      usable: z.coerce.boolean().catch(true),
      reject_reason: z.string().default(''),
      subject: z.enum(['product', 'hand', 'face', 'room', 'other']).catch('other'),
      sharp: z.coerce.boolean().catch(true),
    })
  ).catch([]),
  problems: z.array(
    z.enum(['shake', 'dark', 'blown', 'horizontal', 'cut_off_product', 'music_bed', 'no_speech'])
  ).catch([]),
  // KHONG dat .default(''): de mac dinh thi model bo qua la schema tu dien chuoi rong,
  // va Call 2 tuong khach khong noi loi ich nao.
  one_benefit_said: z.string().catch(''),
  unknowns: z.array(z.string()).catch([]),
});

export const Call1ReadClipSchema = z.preprocess(wrapBareShots, Call1Shape);
export type Call1ReadClip = z.infer<typeof Call1Shape>;
