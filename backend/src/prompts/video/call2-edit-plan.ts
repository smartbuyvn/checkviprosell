/**
 * Viprosell — Call 2: kế hoạch dựng lại clip
 *
 * Model nhận kết quả đọc clip (Call 1) và chọn: lấy đoạn nào, theo vai trò nào, chữ gì.
 * Nó KHÔNG nhận file video — chỉ nhận mô tả. Gửi nguyên file cho LLM vừa đắt vừa vô ích:
 * thứ cần quyết là mốc thời gian, và mốc thời gian đã nằm trong kết quả Call 1.
 *
 * Mọi `in_ms`/`out_ms` phải nằm trong clip gốc. Đây là ràng buộc then chốt của cả luồng:
 * ở nhánh ảnh model được sáng tác tự do vì không có sự thật nào để trái; ở đây có một
 * đoạn phim thật, và mọi thứ model nói phải quy chiếu về được một mốc trong đó.
 */
import { z } from 'zod';
import { MIN_SPEED, MAX_SPEED, MAX_OVERLAY_WORDS, minTotalFor, maxTotalFor } from '../../lib/video-edit';

export const CALL2_SYSTEM_PROMPT = `You are an editor re-cutting ONE clip a seller filmed themselves into a vertical short.
Keep the feeling that a real person filmed this. You are not building a studio ad.

HARD CONSTRAINTS — these outrank every creative instruction:
- Every in_ms/out_ms must fall inside the source clip. You may only cut what exists.
  Never invent a shot, a moment, or a line that is not in the footage.
- Exactly one benefit. Prefer the sentence the seller already said. Add no claim of
  your own — no price, no guarantee, no ranking, no result promise.
- Keep the seller's voice. You may cut filler ("ờ", "ừm"), silence longer than 400ms,
  and repeated sentences. Do not write replacement narration unless no_speech is true.
- New "camera angles" are crops on the same frame, nothing more:
    hold       — full frame, no movement
    punch_in   — eases closer, centred on the product
    punch_out  — starts closer and eases back
  Never orbit, never change the axis, never slow below 0.85x or speed past 1.15x.
- The hook is the strongest line or image the footage ALREADY has, moved to the front
  even if it sits in the middle of the clip. Hard cut in — never fade into a hook.
- Overlay text: at most ${MAX_OVERLAY_WORDS} words, no "%" character, and it must not
  repeat word-for-word the sentence being spoken underneath it. The voice carries the
  argument; the overlay carries what the eye can grab in half a second.
  An empty overlay is a valid choice. Filler like "chất lượng cao" is not.

PACING
1. Hook — 1.2 to 2.2 seconds, cut
2. Product or hands — 4 to 8 seconds
3. One proof the seller stated or demonstrated — 4 to 8 seconds
4. CTA — 2 to 2.5 seconds

THEME (given to you; do not change it)
- tu_nhien: fewest cuts, nothing that looks processed
- sach: cut on the rhythm of speech
- cao_cap: fewer cuts, slower punch_in, sparse text
- demo_tay: favour the moments hands are working; drop long introductions

The finished length you must hit is given in the user message — it depends on how much
footage this clip actually has. Never pad by repeating a moment twice.

Output valid JSON only. No markdown.`;

export function buildCall2Prompt(
  readResult: unknown,
  clipDurationMs: number,
  theme: string,
  productName: string
): string {
  // Khoang do dai tinh theo CLIP NAY, khong phai hang so cung. Mot clip 8 giay khong
  // the cho ra thanh pham 15 giay neu khong lap lai hinh — va lap lai hinh thi lo ngay.
  const duoi = minTotalFor(clipDurationMs);
  const tren = maxTotalFor(clipDurationMs);

  return `CLIP LENGTH: ${clipDurationMs} ms — every in_ms/out_ms must be between 0 and ${clipDurationMs}.
FINISHED LENGTH: between ${duoi} and ${tren} ms. This range comes from how much footage
this clip has, so do not aim past it.
THEME: ${theme}
PRODUCT NAME (for the CTA only, may be ""): ${productName || '(unknown)'}

WHAT THE FOOTAGE CONTAINS (from reading the clip):
${JSON.stringify(readResult)}

Return JSON with this EXACT shape. The root MUST be an object, never a bare array:

{
  "theme": "${theme}",
  "total_ms": 20000,
  "keep_voice": true,
  "music_bed": "none",
  "grade": "none",
  "stabilize": "light",
  "segments": [
    {
      "id": "a1",
      "role": "hook",
      "in_ms": 4200,
      "out_ms": 6000,
      "crop": "hold",
      "speed": 1.0,
      "transition_out": "cut",
      "overlay": "short line"
    }
  ],
  "dropped": [
    { "in_ms": 0, "out_ms": 1200, "reason": "silence" }
  ]
}

Field rules, follow them exactly:
- Provide between 3 and 6 segments, in the order they will play.
- in_ms and out_ms are NUMBERS in milliseconds, measured in the SOURCE clip, with
  out_ms greater than in_ms. Segments may be taken out of order from the source —
  that is how the hook gets moved to the front.
- total_ms must equal the sum of (out_ms - in_ms) / speed across all segments, and
  must land between ${duoi} and ${tren}.
- role: exactly one of hook, product, proof, cta. Use hook once, first; cta once, last.
- crop: exactly one of hold, punch_in, punch_out.
- speed: a NUMBER between ${MIN_SPEED} and ${MAX_SPEED}. Use 1.0 unless trimming dead air.
- transition_out: exactly one of cut, xfade_160. The hook's transition into the clip is
  always a cut.
- music_bed: one of none, soft, pulse. grade: one of none, clean, premium.
  stabilize: one of off, light, medium.
- keep_voice: BOOLEAN.
- overlay: a STRING of at most ${MAX_OVERLAY_WORDS} words, or "".
- dropped: segments of the source you deliberately left out, with reason one of
  silence, repeat, unusable, off_claim. May be empty.`;
}

function wrapBareSegments(value: unknown): unknown {
  if (Array.isArray(value)) {
    console.warn('[Call2] model tra mang o goc, boc lai thanh { segments: [...] }');
    return { segments: value };
  }
  return value;
}

const Call2Shape = z.object({
  theme: z.string().catch('tu_nhien'),
  total_ms: z.coerce.number().min(0).catch(0),
  keep_voice: z.coerce.boolean().catch(true),
  music_bed: z.enum(['none', 'soft', 'pulse']).catch('none'),
  grade: z.enum(['none', 'clean', 'premium']).catch('none'),
  stabilize: z.enum(['off', 'light', 'medium']).catch('light'),
  segments: z.array(
    z.object({
      id: z.string().min(1).catch('a'),
      role: z.enum(['hook', 'product', 'proof', 'cta']).catch('product'),
      in_ms: z.coerce.number().min(0),
      out_ms: z.coerce.number().min(0),
      crop: z.enum(['hold', 'punch_in', 'punch_out']).catch('hold'),
      // KHONG .catch(1.0) cho speed ngoai khoang: cong kiem phai THAY duoc gia tri sai
      // de bao loi, chu khong de schema am tham sua thanh 1.0 roi khong ai biet model
      // dang de xuat tua 2x.
      speed: z.coerce.number().catch(1),
      transition_out: z.enum(['cut', 'xfade_160']).catch('cut'),
      overlay: z.string().catch(''),
    })
  ).min(1).max(8),
  dropped: z.array(
    z.object({
      in_ms: z.coerce.number().min(0).catch(0),
      out_ms: z.coerce.number().min(0).catch(0),
      reason: z.enum(['silence', 'repeat', 'unusable', 'off_claim']).catch('unusable'),
    })
  ).catch([]),
});

export const Call2EditPlanSchema = z.preprocess(wrapBareSegments, Call2Shape);
export type Call2EditPlan = z.infer<typeof Call2Shape>;
