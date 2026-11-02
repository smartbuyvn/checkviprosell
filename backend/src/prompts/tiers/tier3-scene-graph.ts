/**
 * Viprosell — Tier 3: Scene Graph (Local AI Video Ads Pipeline)
 * System prompt + user template + zod schema.
 * Converts brief + strategy into a scene-by-scene plan renderable by FFmpeg.
 */
import { z } from 'zod';

export const TIER3_SYSTEM_PROMPT = `You are a short-form ad director creating a scene graph for FFmpeg-compatible product video rendering.
You receive a product brief and ad strategy, then output a scene-by-scene JSON plan.

HARD CONSTRAINTS — these outrank every creative instruction below:
- Use ONLY facts present in the brief. Never invent a specification, a material, a
  certification, a warranty, a discount, a shipping time or a quantity sold.
- If a fact you want is not in the brief, write the line WITHOUT it. Do not write a
  placeholder, do not guess, do not round a number up.
- Never write a superlative that implies a verified ranking: "số 1", "tốt nhất thị
  trường", "duy nhất", "được chứng nhận". These are legal claims, not copy.
- Never promise a result: "giảm 5kg", "hết mụn sau 7 ngày", "bền 10 năm".
- Price appears on screen only if the brief gives a price. No "chỉ từ", no "giá sốc".
This is a live commercial product selling to real buyers. A fabricated claim is a
liability, not a creative choice.

Rules:
- Output valid JSON only.
- No markdown.
- Keep each scene focused on one message.
- Total duration must match strategy and brief constraints.
- Visual instructions must be realistic for image-based rendering with zoom, pan, crop, text overlay, subtitles, music and voiceover.
- Do not invent impossible camera moves.
- Voice lines should sound natural in Vietnamese.

PACING — this is what separates an ad from a slideshow:
- Scene 1 is the hook and must be 1.5-2.5 seconds. A viewer decides to stay or
  scroll in that window; a slow opening loses them before the product appears.
- Scenes 2-4 carry the argument at 2.5-4 seconds each. Long enough to read the
  overlay, short enough that nothing feels static.
- The final CTA scene gets 2.5-3.5 seconds. Shorter and the offer does not land.
- Never give two neighbouring scenes the same duration and the same camera_motion.
  Identical cuts in a row read as a slideshow, not a film.
- Alternate motion direction between scenes: a zoom_in followed by another zoom_in
  feels like a stutter. Follow zoom_in with static, pan, or zoom_out.

TEXT ON SCREEN — every line must have a job. Say which one in overlay_role:
- hook — the line that stops the scroll. A question, a number, or a problem.
- benefit — one thing the buyer gets. Concrete, from the brief.
- price — the price or the offer, only if the brief states it.
- proof — a number that backs the claim, only if the brief states it.
- cta — what to do next. Last scene.
- none — this scene carries NO text. Use it deliberately: a scene where the image
  and the voice do the work is stronger than one with a line of filler on it.
Set overlay_role to 'none' and overlay_text to "" rather than writing something
vague. An empty overlay is a choice; "chất lượng cao" is a failure.
- overlay_text is a headline, not a sentence: 3-6 words, no trailing period.
- overlay_text must NOT repeat voice_line word for word. The voice carries the
  argument; the overlay carries the claim the eye can grab in half a second.
- Put the number, the price, or the benefit in the overlay. Abstract words
  ("chất lượng cao", "uy tín") take up the line and say nothing.
- text_only and cta_card scenes are the only ones where the overlay may be longer,
  and even then keep it under 10 words.

VOICE LINES — every scene must have one:
- voice_line is REQUIRED on every scene. Never leave it empty. An empty voice_line
  means the scene plays silent, and a silent gap in the middle of an ad reads as
  a broken video.
- Write it as a person would say it out loud, not as written copy. Short clauses,
  no bullet-point phrasing, no brand name repeated every sentence.
- Match the length to the scene by COUNTING CHARACTERS, not syllables. Measured
  Vietnamese TTS rate: seconds = characters / 28.3 + 0.93, plus 0.25s of silence
  before the next scene. Budget per scene, including spaces and punctuation:

      2.0s scene -> 23 characters      3.5s scene -> 65 characters
      2.5s scene -> 37 characters      4.0s scene -> 79 characters
      3.0s scene -> 51 characters      4.5s scene -> 94 characters

  These are HARD CEILINGS, not targets. Measured on a real render dated 31/10:
  eight of ten lines came back 20-40% over budget, so every scene had to be
  stretched and a 30-second video shipped at 35.1 seconds.
- Count the characters of each voice_line before you emit it. If a line is over
  budget, cut words until it fits — do not hand back a line you know is too long.
- The voice carries the argument; the overlay carries the claim. Saying the same
  words twice wastes both.
- Open with a question, a number, or a problem — never with "Sản phẩm này là..."

CAMERA — choose by what the shot has to DO, not by variety for its own sake:
- hero_push — the product fills the frame and the camera eases in. The hook shot.
- detail_macro — already close, drifting closer on one feature: a seam, a texture,
  a control. Use when the voice line names something specific.
- reveal_up — starts low and rises. Use once, where the product first appears whole.
- lifestyle_hold — nearly still, barely breathing. Use when a line of text or a
  price needs reading; motion competes with reading.
- endcard_lock — locked off, no movement. The CTA scene only.
Rules:
- Use at least THREE different values across the video. All-hero_push is the single
  most common way these videos look amateur.
- Never repeat the same value on two neighbouring scenes.
- endcard_lock belongs on the last scene and nowhere else.
- camera_motion.speed: 'slow' by default; 'medium' only on the hook.
- The renderer owns the zoom amounts. Do not try to specify them.

VISUAL ORDER:
- Open on product_closeup or detail_crop. A text_only opening wastes the hook.
- Do not use the same visual_type for more than two scenes in a row.
- Reserve cta_card for the last scene.
- music_intensity rises toward the CTA: start low or medium, end high.

Use safe layout assumptions for 9:16 mobile view.`;

/**
 * Ban mau phai liet ke DU ten truong va kieu.
 *
 * Ban cu chi co dung mot cau "Return the scene graph JSON." - khong mot ten truong nao.
 * Model phai tu bia ra toan bo, nen no dat `start`/`duration` thay vi `start_sec`/`end_sec`
 * va schema bao "expected number, received undefined" cho tung canh mot.
 * Thu lai cung vo ich vi lan thu lai doc dung cau mo ho do.
 */
export const TIER3_USER_TEMPLATE = `BRIEF JSON:
{{brief_json}}

STRATEGY JSON:
{{strategy_json}}

Return JSON with this EXACT shape. Field names and types are mandatory. The root MUST be
an object with "video_meta" and "scenes" keys, never a bare array:

{
  "video_meta": {
    "aspect_ratio": "9:16",
    "duration_sec": 20,
    "style": "one phrase",
    "target_platform": "tiktok"
  },
  "scenes": [
    {
      "scene_id": "s1",
      "start_sec": 0,
      "end_sec": 3.5,
      "purpose": "hook",
      "asset_ref": "image_1",
      "visual_type": "product_closeup",
      "camera_motion": { "type": "hero_push", "direction": "center", "speed": "slow" },
      "overlay_text": "short line",
      "overlay_role": "hook",
      "voice_line": "natural Vietnamese sentence",
      "subtitle": "natural Vietnamese sentence",
      "music_intensity": "medium",
      "safe_region": { "title_y": 0.18, "subtitle_y": 0.82, "cta_y": 0.9 }
    }
  ]
}

Field rules, follow them exactly:
- Every scene MUST have start_sec and end_sec as NUMBERS in seconds, counted from the
  start of the video. Do not use "start", "end", "duration" or "time" instead.
- start_sec of the first scene is 0. Each scene's start_sec equals the previous
  scene's end_sec, with no gaps and no overlaps.
- The last scene's end_sec must equal video_meta.duration_sec.
- scene_id: a unique non-empty STRING such as "s1", "s2".
- Provide between {{canh_it_nhat}} and {{canh_nhieu_nhat}} scenes.
- duration_sec: a NUMBER between 10 and 45.
- visual_type: exactly one of product_closeup, detail_crop, text_only,
  lifestyle_simulated, cta_card.
- camera_motion.type: exactly one of hero_push, detail_macro, reveal_up,
  lifestyle_hold, endcard_lock. camera_motion.speed: exactly one of slow, medium.
- overlay_role: exactly one of hook, benefit, price, proof, cta, none.
  When overlay_role is "none", overlay_text must be "".
- The renderer positions and sizes the text from overlay_role. safe_region is a hint
  only; do not try to lay out the frame through it.
- music_intensity: exactly one of low, medium, high.
- overlay_text: a STRING of at most 40 characters, or "" when overlay_role is "none".
- voice_line and subtitle: STRINGS of at most 200 characters.
- safe_region values: NUMBERS between 0 and 1.`;

/**
 * Model doi khi bo qua lop vo va tra thang mang canh o goc, gay loi
 * "root: Invalid input: expected object, received array". Boc lai thay vi bo ca lan goi:
 * noi dung van dung, chi thieu lop vo ben ngoai.
 */
function wrapBareScenes(value: unknown): unknown {
  if (Array.isArray(value)) {
    console.warn('[Tier3] model tra mang o goc, boc lai thanh { scenes: [...] }');
    return { scenes: value };
  }
  return value;
}

const Tier3Shape = z.object({
  video_meta: z.object({
    aspect_ratio: z.string().default('9:16'),
    duration_sec: z.number().min(10).max(45).catch(20),
    style: z.string().default(''),
    target_platform: z.string().default('tiktok'),
  }).default({ aspect_ratio: '9:16', duration_sec: 20, style: '', target_platform: 'tiktok' }),
  scenes: z.array(
    z.object({
      scene_id: z.string().min(1),
      start_sec: z.coerce.number().min(0),
      end_sec: z.coerce.number().min(0),
      purpose: z.string().default(''),
      asset_ref: z.string().default('image_1'),
      visual_type: z.enum(['product_closeup', 'detail_crop', 'text_only', 'lifestyle_simulated', 'cta_card']).catch('product_closeup'),
      camera_motion: z.object({
        // Nhan CA hai bo ten: bo moi co nghia (hero_push...) va bo cu (zoom_in...).
        // normalizeCamera trong lib/camera-moves.ts dich bo cu sang bo moi, nen ban
        // ghi tu lan chay truoc va prompt tuy bien cua admin van chay duoc.
        type: z.enum([
          'hero_push', 'detail_macro', 'reveal_up', 'lifestyle_hold', 'endcard_lock',
          'static', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'push_in',
        ]).catch('hero_push'),
        direction: z.string().default('center'),
        speed: z.enum(['slow', 'medium']).catch('slow'),
      }).default({ type: 'hero_push', direction: 'center', speed: 'slow' }),
      overlay_text: z.string().max(40).default(''),
      // Vai tro cau chu quyet dinh co chu va cho dung (OVERLAY_STYLES trong
      // lib/render-plan.ts). Mac dinh 'benefit' chu khong phai 'none': thieu truong
      // nay thi van co chu, con de 'none' thi model bo qua la ca video mat chu.
      overlay_role: z.enum(['hook', 'benefit', 'price', 'proof', 'cta', 'none']).catch('benefit'),
      // KHONG dat .default(''): de mac dinh thi model bo qua la schema tu dien chuoi
      // rong, canh do im lang ma khong ai biet. Yeu cau toi thieu 1 ky tu de loi lo ra
      // ngay o tang nay, con sua duoc, thay vi lo ra o video cuoi.
      voice_line: z.string().min(1).max(200).catch('...'),
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

export const Tier3SceneGraphSchema = z.preprocess(wrapBareScenes, Tier3Shape);

export type Tier3SceneGraph = z.infer<typeof Tier3Shape>;

/**
 * So canh suy TU THOI LUONG, khong viet cung.
 *
 * Ban cu ghi thang "between 4 and 10 scenes" cho moi thoi luong. Hai cho hong:
 *
 *   - Video 15 giay: 10 canh la moi canh 1,5 giay — ngan hon ca canh hook, va nguoc
 *     han nhip chinh prompt nay quy dinh (canh lap luan 2,5-4 giay).
 *   - Video 45 giay: tran 10 canh ep moi canh dai 4,5 giay, cung vuot nhip do.
 *
 * Nhip o tren la nguon su that: hook 1,5-2,5 giay, lap luan 2,5-4 giay, CTA 2,5-3,5.
 * Nguoc lai ra so canh: it nhat `giay / 4`, nhieu nhat `giay / 2,5`.
 *
 * San 4 canh: duoi muc do khong con du cho hook, lap luan va CTA.
 */
export function soCanhTheoThoiLuong(giay: number): { itNhat: number; nhieuNhat: number } {
  const g = Number.isFinite(giay) && giay > 0 ? giay : 20;
  const itNhat = Math.max(4, Math.round(g / 4));
  const nhieuNhat = Math.max(itNhat + 1, Math.round(g / 2.5));
  return { itNhat, nhieuNhat };
}

export function buildTier3Prompt(
  briefJson: unknown,
  strategyJson: unknown,
  thoiLuongGiay?: number
): string {
  // Lay thoi luong tu brief neu nguoi goi khong truyen — brief la noi `desired_duration_sec`
  // di qua, nen khong phai sua moi cho goi ham nay.
  const tuBrief = Number((briefJson as any)?.desired_duration_sec);
  const giay = Number.isFinite(Number(thoiLuongGiay)) && Number(thoiLuongGiay) > 0
    ? Number(thoiLuongGiay)
    : (Number.isFinite(tuBrief) && tuBrief > 0 ? tuBrief : 20);
  const { itNhat, nhieuNhat } = soCanhTheoThoiLuong(giay);

  return TIER3_USER_TEMPLATE
    .replace('{{brief_json}}', JSON.stringify(briefJson))
    .replace('{{strategy_json}}', JSON.stringify(strategyJson))
    .replace('{{canh_it_nhat}}', String(itNhat))
    .replace('{{canh_nhieu_nhat}}', String(nhieuNhat));
}
