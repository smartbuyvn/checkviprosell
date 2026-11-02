/**
 * Viprosell — Điều phối luồng dựng lại clip khách tự quay
 *
 * Trình tự:
 *   1. ffprobe    — đo clip (code)
 *   2. Whisper    — transcript (code, chạy máy nhà, không tốn tiền API)
 *   3. trích khung — tối đa 6 khung (code)
 *   4. Call 1     — model đọc khung + transcript, kể lại thứ nó thấy
 *   5. Call 2     — model chọn đoạn nào, vai trò nào
 *   6. QA         — đối chiếu với clip gốc và lời khách nói (code)
 *   7. ffmpeg     — dựng (code)
 *
 * Hai lần gọi LLM, không phải bốn. Và KHÔNG gửi file video cho model: thứ cần quyết là
 * mốc thời gian, mà mốc thời gian nằm trong kết quả bước 1–3. Gửi nguyên clip vừa đắt
 * vừa không thêm thông tin nào model dùng được.
 *
 * Sáu khung chứ không phải mười hai: một clip 30 giây hiếm khi có quá 6 cảnh khác nhau,
 * và mỗi khung là khoảng 1.600 token đầu vào. Giảm một nửa số khung là giảm một nửa
 * phần đắt nhất của luồng này, đổi lấy rất ít thông tin.
 */
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { runTier } from './pipeline.service';
import { getPrompt } from './prompt-registry.service';
import {
  CALL1_SYSTEM_PROMPT, buildCall1Prompt, Call1ReadClipSchema, MAX_FRAMES,
  type Call1ReadClip,
} from '../prompts/video/call1-read-clip';
import {
  CALL2_SYSTEM_PROMPT, buildCall2Prompt, Call2EditPlanSchema,
  type Call2EditPlan,
} from '../prompts/video/call2-edit-plan';
import { qaEditPlan, formatBlocks, type QaResult } from '../lib/video-qa';
import { resolveTheme, THEMES, type Theme } from '../lib/video-edit';
import { probeVideo, type VideoMeta } from '../lib/video-asset';
import type { LlmImage } from './llm.provider';

export interface EditPlanResult {
  meta: VideoMeta;
  read: Call1ReadClip;
  plan: Call2EditPlan;
  qa: QaResult;
  theme: Theme;
}

/**
 * Chọn mốc trích khung: trải đều nhưng bỏ nửa giây đầu và cuối.
 *
 * Khung đầu clip gần như luôn là lúc tay còn chạm máy; khung cuối là lúc với tay tắt.
 * Hai khung đó không đại diện cho clip, mà lại chiếm mất hai trong sáu suất.
 */
export function framePlan(durationSec: number, soKhung = MAX_FRAMES): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [0];

  const BO = Math.min(0.5, durationSec / 10);
  const dau = BO;
  const cuoi = Math.max(dau, durationSec - BO);
  const n = Math.max(1, Math.min(soKhung, Math.floor(durationSec)));

  if (n === 1) return [Math.round(durationSec / 2 * 1000)];

  const buoc = (cuoi - dau) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round((dau + i * buoc) * 1000));
}

/** Trích một khung tại mốc cho trước. Trả về null nếu ffmpeg không ra ảnh. */
function extractFrame(videoPath: string, atMs: number, outPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-ss', (atMs / 1000).toFixed(3),
      '-i', videoPath,
      '-frames:v', '1',
      // Hạ về 768px cạnh dài: model thị giác không cần hơn, mà mỗi pixel thừa là token
      // thừa. Giữ tỉ lệ để không bóp méo sản phẩm.
      '-vf', 'scale=768:768:force_original_aspect_ratio=decrease',
      '-y', outPath,
    ]);
    p.on('error', () => resolve(null));
    p.on('close', (code) => resolve(code === 0 && fs.existsSync(outPath) ? outPath : null));
  });
}

export const VideoEditService = {
  /**
   * Chạy hai call và cổng kiểm, trả về kế hoạch dựng đã soát.
   *
   * KHÔNG gọi ffmpeg dựng ở đây — việc đó là của worker. Tách ra để chạy thử kế hoạch
   * mà không tốn một lần render, và để test được phần quyết định riêng khỏi phần I/O.
   */
  async buildEditPlan(opts: {
    videoPath: string;
    transcript: string;
    theme?: string | null;
    productName?: string;
    traceId?: string;
    tmpDir: string;
    /** Clip da co nhac lan trong tieng noi — worker DO, khong phai model doan. */
    musicBedLikely?: boolean;
  }): Promise<EditPlanResult> {
    const { videoPath, transcript, productName = '', traceId = 'video-edit', tmpDir, musicBedLikely = false } = opts;
    const theme = resolveTheme(opts.theme);

    // ── 1. Đo clip ──
    const meta = await probeVideo(videoPath);
    if (!meta) throw new Error('VIDEO_UNREADABLE: khong doc duoc thong so clip bang ffprobe');

    // ── 2–3. Trích khung ──
    const mocKhung = framePlan(meta.durationSec);
    const anh: LlmImage[] = [];
    for (let i = 0; i < mocKhung.length; i++) {
      const p = path.join(tmpDir, `frame_${i}.jpg`);
      const ok = await extractFrame(videoPath, mocKhung[i], p);
      if (ok) anh.push({ mimeType: 'image/jpeg', base64: fs.readFileSync(p).toString('base64') });
    }

    if (anh.length === 0) {
      throw new Error('VIDEO_NO_FRAMES: khong trich duoc khung hinh nao tu clip');
    }
    console.log(`[VideoEdit] Trich ${anh.length}/${mocKhung.length} khung, clip dai ${meta.durationSec.toFixed(1)}s.`);

    // ── 4. Call 1: đọc clip ──
    const { data: read } = await runTier<Call1ReadClip>(
      'brief',
      await getPrompt('video_call1_read_clip', CALL1_SYSTEM_PROMPT),
      buildCall1Prompt(transcript, meta.durationSec, mocKhung.slice(0, anh.length)),
      Call1ReadClipSchema,
      traceId,
      anh
    );

    // `demo_tay` chỉ có nghĩa khi thật sự có tay trong khung. Để model chọn theme này
    // trên clip không có tay là nó sẽ đi tìm những đoạn không tồn tại.
    const themeThat: Theme = theme === 'demo_tay' && !read.hands_visible ? 'tu_nhien' : theme;
    if (themeThat !== theme) {
      console.warn(`[VideoEdit] Clip khong co tay trong khung — doi theme demo_tay sang tu_nhien.`);
    }

    // ── 5. Call 2: kế hoạch dựng ──
    const { data: plan } = await runTier<Call2EditPlan>(
      'scene_graph',
      await getPrompt('video_call2_edit_plan', CALL2_SYSTEM_PROMPT),
      buildCall2Prompt(read, Math.round(meta.durationSec * 1000), themeThat, productName),
      Call2EditPlanSchema,
      traceId
    );

    // ── 6. Cổng kiểm ──
    const qa = qaEditPlan({
      segments: plan.segments as any,
      clipDurationMs: Math.round(meta.durationSec * 1000),
      spokenClaims: read.spoken_claims,
      productName,
      totalMs: plan.total_ms,
      musicBedLikely,
    });

    for (const dong of formatBlocks(qa.blocks)) console.warn(dong);

    if (!qa.pass) {
      throw new Error(
        'VIDEO_PLAN_REJECTED: ke hoach dung khong dung duoc. ' +
        qa.blocks.map((b) => `${b.segmentId}:${b.reason}`).join(', ')
      );
    }

    // Theme quyết định nhạc/màu/ổn định, KHÔNG phải model.
    //
    // Model vẫn trả ba trường đó vì chúng nằm trong schema, nhưng giá trị dùng để
    // render lấy từ bảng THEMES. Đây là lựa chọn của khách khi bấm vào thẻ theme —
    // để model ghi đè là khách chọn "Tự nhiên" mà nhận về video có nhạc và chỉnh màu.
    const cauHinh = THEMES[themeThat];

    // Clip da co nhac thi theme khong duoc bat nhac thu vien, du bang THEMES noi gi.
    // Hai bai hat phat cung luc te hon ca hai phuong an.
    const nhacChot = musicBedLikely ? 'none' as const : cauHinh.music;
    const planChot: Call2EditPlan = {
      ...plan,
      theme: themeThat,
      music_bed: nhacChot,
      grade: cauHinh.grade,
      stabilize: cauHinh.stabilize,
      segments: qa.segments as any,
      total_ms: Math.round(qa.segments.reduce((n, s) => n + (s.out_ms - s.in_ms) / (s.speed || 1), 0)),
    };

    return { meta, read: read, plan: planChot, qa, theme: themeThat };
  },
};
