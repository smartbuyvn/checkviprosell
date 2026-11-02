/**
 * Viprosell — Xử lý một job "dựng lại clip khách tự quay"
 *
 * Tách khỏi `render.worker.ts` vì đây là một luồng khác hẳn, không phải một biến thể
 * của luồng ảnh. Chung nhau đúng một thứ: bước tải file lên ở cuối, và bước đó nằm
 * lại trong worker.
 *
 * Hàm này dựng ra file tại `outputPath`. Mọi việc sau đó (tải lên, ảnh đại diện, báo
 * trạng thái) là của worker.
 */
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { safeDownload } from './lib/fetch-guard';
import { probeVideo, validateVideo, shouldReject, MAX_CLIP_BYTES, isVideoAsset } from './lib/video-asset';
import { detectMusicBed } from './lib/music-detect';
import { runWhisper, parseSrt, type TimedCue } from './lib/subtitle-align';
import { VideoEditService } from './services/video-edit.service';
import { buildEditCommand, buildStabilizePassCommands, segmentOutSec } from './lib/video-compose';
import { buildAssFile, type AssCue } from './lib/ass-subtitle';
import { boCucChu, FONT_CHU } from './lib/bo-cuc-chu';
import { THEMES } from './lib/video-edit';

const ASPECT: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

/** Chạy ffmpeg, trả về mã thoát. Không ném lỗi — người gọi quyết định. */
function chayFfmpeg(args: string[], cwd?: string): Promise<number> {
  return new Promise((resolve) => {
    // `cwd` la cach DUY NHAT dua duoc duong dan .trf cho vidstab tren Windows: dung
    // duong dan day du thi ffmpeg tra -22 vi ':' trong 'D:' la dau phan cach tham so
    // cua filter, va thoat dau cung khong cuu duoc.
    const p = spawn('ffmpeg', args, cwd ? { cwd } : undefined);
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString().slice(-2000); });
    p.on('error', () => resolve(-1));
    p.on('close', (code) => {
      if (code !== 0) console.error('[VideoEditJob] ffmpeg loi:', err.slice(-800));
      resolve(code ?? -1);
    });
  });
}

/** Tách tiếng ra WAV 16kHz mono — định dạng Whisper cần. */
async function trichTieng(videoPath: string, outPath: string): Promise<boolean> {
  const code = await chayFfmpeg([
    '-hide_banner', '-loglevel', 'error',
    '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000',
    '-y', outPath,
  ]);
  return code === 0 && fs.existsSync(outPath);
}

export interface VideoEditJobInput {
  payload: any;
  renderId: string;
  jobTmpDir: string;
  outputPath: string;
  assPath: string;
  onProgress?: (percent: number) => void | Promise<void>;
}

export async function runVideoEditJob(input: VideoEditJobInput): Promise<void> {
  const { payload, jobTmpDir, outputPath, assPath, onProgress } = input;
  const raw = payload.raw_input ?? {};
  const bao = async (p: number) => { try { await onProgress?.(p); } catch { /* báo tiến độ hỏng không được làm hỏng render */ } };

  /* ── 1. Lấy clip ── */
  const nguon: string[] = Array.isArray(raw.image_urls) ? raw.image_urls.filter(isVideoAsset) : [];
  if (nguon.length === 0) {
    throw new Error('NO_SOURCE_CLIP: che do dung clip nhung khong co video nao duoc tai len');
  }

  const clipPath = path.join(jobTmpDir, 'source.mp4');
  const bytes = await safeDownload(nguon[0], { maxBytes: MAX_CLIP_BYTES, timeoutMs: 180_000 });
  fs.writeFileSync(clipPath, bytes);
  await bao(15);

  /* ── 2. Đo và soát clip ── */
  const meta = await probeVideo(clipPath, bytes.length);
  if (!meta) throw new Error('VIDEO_UNREADABLE: khong doc duoc thong so clip');

  const vanDe = validateVideo(meta);
  if (shouldReject(vanDe)) {
    // Thông báo của `validateVideo` viết cho người bán và nói rõ cách sửa, nên đưa
    // thẳng ra chứ không gói lại bằng một câu kỹ thuật.
    throw new Error(`CLIP_REJECTED: ${vanDe.filter((v) => v.severity === 'reject').map((v) => v.message).join(' ')}`);
  }
  for (const v of vanDe) console.warn(`[VideoEditJob] ${v.code}: ${v.message}`);

  /* ── 3. Transcript ── */
  let transcript = '';
  let cues: TimedCue[] = [];
  const whisperModel = process.env.WHISPER_MODEL_PATH || '';

  if (meta.hasAudio && whisperModel && fs.existsSync(whisperModel)) {
    const wav = path.join(jobTmpDir, 'source.wav');
    if (await trichTieng(clipPath, wav)) {
      const srt = await runWhisper(wav, whisperModel, 'vi');
      if (srt) {
        cues = parseSrt(srt);
        transcript = cues.map((c) => c.text).join(' ').trim();
      }
    }
  }
  console.log(`[VideoEditJob] Transcript ${transcript.length} ky tu, ${cues.length} mau.`);
  await bao(25);

  /* ── 4. Có nhạc nền không — ĐO, không hỏi model ── */
  //
  // Model nghe mô tả khung hình chứ không nghe tiếng, nên `problems: ["music_bed"]`
  // của Call 1 chỉ là phỏng đoán. Cờ này đổi hẳn cách được phép dựng nên phải đo.
  const nhac = await detectMusicBed({
    filePath: clipPath,
    hasAudio: meta.hasAudio,
    userDeclared: Boolean(raw.has_background_music),
    cues,
    clipDurationSec: meta.durationSec,
  });
  console.log(
    `[VideoEditJob] music_bed_likely=${nhac.likely} (${nhac.reason}` +
    (nhac.speechDb !== undefined ? `, noi ${nhac.speechDb}dB vs im ${nhac.silenceDb}dB` : '') + ')'
  );
  await bao(30);

  /* ── 5. Hai lần gọi LLM + cổng kiểm ── */
  const { plan, read, theme } = await VideoEditService.buildEditPlan({
    videoPath: clipPath,
    transcript,
    theme: raw.theme,
    productName: raw.product_title ?? '',
    tmpDir: jobTmpDir,
    musicBedLikely: nhac.likely,
  });
  await bao(55);

  /* ── 6. Chống rung: hai lượt, TRƯỚC khi cắt ── */
  const cauHinh = THEMES[theme];
  const khung = ASPECT[String(payload.aspect_ratio || '9:16')] ?? ASPECT['9:16'];
  const fps = Math.min(30, Math.round(meta.fps) || 30);

  // Clip dùng để cắt. Có chống rung thì đổi sang bản đã nắn.
  let clipDung = clipPath;

  const lenhNan = buildStabilizePassCommands({
    clipPath,
    level: cauHinh.stabilize,
    width: khung.width,
    height: khung.height,
  });

  if (lenhNan) {
    // Đo thật 28/10 trên clip 8 giây 4K: hạ khung trước rồi nắn mất 4,5 giây, so với
    // 26,1 giây nếu phân tích thẳng trên 4K — nhanh 5,8 lần và còn đúng hơn, vì vector
    // trong .trf tính theo pixel của độ phân giải lúc phân tích.
    //
    // Phải chạy trên TOÀN clip trước khi cắt: vidstabtransform đọc .trf tuần tự theo
    // số khung, cắt trước thì số khung không còn khớp với file đo.
    const t0 = Date.now();
    const okDo = await chayFfmpeg(lenhNan.detect, jobTmpDir);
    const okNan = okDo === 0 ? await chayFfmpeg(lenhNan.transform, jobTmpDir) : -1;
    const banNan = path.join(jobTmpDir, lenhNan.outName);

    if (okNan === 0 && fs.existsSync(banNan)) {
      clipDung = banNan;
      console.log(`[VideoEditJob] Chong rung xong trong ${Date.now() - t0}ms.`);
    } else {
      // Chống rung hỏng KHÔNG được làm hỏng cả video: thà hơi rung còn hơn không có.
      console.warn('[VideoEditJob] Chong rung that bai — dung clip goc.');
    }
  }
  await bao(65);

  /* ── 7. Chữ trên màn hình ── */

  /**
    * Tuy chon "Khong chen chu len video" cua khach.
    *
    * Luong anh da doc no tu ngay dau; luong clip thi KHONG — no dung phu de roi dot
    * len video du khach da tick bo. Nguoi ban tick xong van thay chu, va khong co
    * cach nao biet vi sao.
    *
    * Chan o cho DAY cue, khong chan o cho rap filter: duoi kia da biet bo buoc dot
    * khi khong co cue nao, nen chuoi filter khong phai doi mot chu.
    */
   const khongChenChu = Boolean(raw.no_text_overlay);
   if (khongChenChu) console.log('[VideoEditJob] Khach chon bo chu — khong dot phu de.');

  let moc = 0;
  const assCues: AssCue[] = [];
  for (const s of (khongChenChu ? [] : plan.segments)) {
    const dai = segmentOutSec(s as any);
    if (s.overlay?.trim()) {
      assCues.push({
        startSec: moc + 0.15,
        endSec: moc + Math.max(1, dai - 0.15),
        text: s.overlay.trim(),
        style: 'Overlay',
        fontSize: Math.max(24, Math.round(0.046 * khung.height)),
      });
    }
    moc += dai;
  }

  let duongAss: string | null = null;
  if (assCues.length > 0) {
    // Bo cuc chung voi luong anh. Ban cu tu tinh o day: Arial thay vi Montserrat, co
    // chu theo CHIEU CAO thay vi be ngang, va overlayMarginV 0,17h ngay sat
    // subMarginV 0,18h — tu khi Overlay doi sang neo mep duoi thi hai cum chong len
    // nhau. Moi lan chinh bo cuc truoc day chi sua duoc mot nua he thong.
    fs.writeFileSync(assPath, buildAssFile(assCues, {
      width: khung.width,
      height: khung.height,
      fontName: FONT_CHU,
      ...boCucChu(khung.width, khung.height),
    }), 'utf-8');
    duongAss = assPath;
  }

  /* ── 8. Dựng ── */
  const nhacThuVien = !nhac.likely && cauHinh.music !== 'none'
    ? path.join(process.cwd(), 'audio-assets', cauHinh.music === 'pulse' ? 'upbeat_01.mp3' : 'chill_01.mp3')
    : null;

  const { args, durationSec } = buildEditCommand({
    clipPath: clipDung,
    segments: plan.segments as any,
    width: khung.width,
    height: khung.height,
    fps,
    grade: cauHinh.grade,
    // Da nan o buoc tren roi; chuoi filter chinh khong chay vidstab nua.
    stabilize: 'off',
    outputPath,
    assPath: duongAss,
    musicPath: nhacThuVien && fs.existsSync(nhacThuVien) ? nhacThuVien : null,
    hasOriginalAudio: meta.hasAudio,
    keepOriginalAudio: true,
    musicBedLikely: nhac.likely,
  });

  console.log(
    `[VideoEditJob] Dung ${plan.segments.length} doan, ${durationSec.toFixed(1)}s, theme=${theme}` +
    `, ${read.spoken_claims.length} y khach noi, van de: ${read.problems.join('/') || 'khong'}.`
  );
  const code = await chayFfmpeg(args);
  if (code !== 0) throw new Error(`FFMPEG_FAILED: ffmpeg tra ma ${code} khi dung clip`);
  if (!fs.existsSync(outputPath)) throw new Error('FFMPEG_NO_OUTPUT: ffmpeg chay xong nhung khong co file');

  await bao(90);
}
