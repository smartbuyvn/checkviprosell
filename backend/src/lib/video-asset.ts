/**
 * Viprosell — Video người bán tự quay
 *
 * Ảnh tĩnh và video quay tay là hai chất liệu khác hẳn nhau, không phải hai định dạng
 * của cùng một thứ:
 *
 *   - Ảnh KHÔNG có chuyển động, nên phải tạo ra chuyển động: `zoompan` (Ken Burns).
 *   - Video ĐÃ có chuyển động thật. Zoom thêm lên nó là chồng hai chuyển động lên nhau,
 *     ra cảm giác chóng mặt và lộ ngay là máy làm. Spec V3 §3 nói thẳng: video quay thật
 *     dùng `trim` + `scale` + `crop`, **không zoom thêm**.
 *
 * Giá trị của luồng này chính là chỗ đó: cái tự nhiên mà ảnh tĩnh không bao giờ có —
 * tay người cầm sản phẩm, ánh sáng thật, vật chuyển động thật.
 *
 * Worker hiện chỉ biết ảnh: `sniffImageType` loại mọi thứ không phải JPEG/PNG/WebP.
 * Module này là phần còn thiếu để video đi được hết đường.
 */
import { spawn } from 'child_process';
import { ABS_MIN_TOTAL_MS } from './video-edit';

/* ─────────────── Ngưỡng theo spec V3 §2.4 ─────────────── */

/**
 * 30 giây và 100MB — một CẶP khớp nhau, không phải hai con số chọn rời.
 *
 * Trần dung lượng và trần thời lượng phải suy ra từ nhau, nếu không sẽ tự mâu thuẫn:
 * spec cũ ghi 60 giây + 200MB, nhưng 60 giây quay 1080p/30 đã là 128MB, nên một clip
 * hợp lệ về thời lượng vẫn bị chặn vì dung lượng. Cùng dạng lỗi với trần 80MB + "15–40
 * giây" trong bản đề xuất ngày 28/10: 4K chạm 80MB ở giây thứ 13.
 *
 * Chọn theo chế độ quay NGỐN NHẤT còn hợp lý — 1080p/60 ở ~26 Mbps — thì 100MB cho
 * đúng 31 giây. Lấy 30 giây làm trần là mọi chế độ 1080p đều lọt.
 *
 * Vì sao 100MB chứ không phải 200MB: KHÔNG phải để tiết kiệm dung lượng. Với hạn giữ
 * 24 giờ thì 100MB và 200MB chênh nhau 3.800đ/tháng ở mức 1.000 dự án — nhiễu so với
 * chi phí cố định 2,59 triệu. Lý do là THỜI GIAN TẢI LÊN: mạng di động Việt Nam khoảng
 * 10 Mbps, 200MB mất 160 giây nhìn thanh tiến trình trước khi có bất cứ điều gì xảy ra.
 * 100MB còn 80 giây.
 *
 * 30 giây là thừa đủ: thành phẩm 15–26 giây, mỗi đoạn dùng 4–8 giây, và cho phép 3 clip.
 */
export const MAX_CLIP_SEC = 30;
export const MAX_CLIP_BYTES = 100 * 1024 * 1024;

/** Dưới 720p thì phóng lên khung 1080 sẽ vỡ hạt, nhìn rẻ tiền hơn cả ảnh tĩnh. */
export const MIN_HEIGHT = 720;

/** Codec giải được bằng ffmpeg dựng sẵn, không cần cài thêm. */
export const ACCEPTED_CODECS = ['h264', 'hevc', 'vp9', 'av1'] as const;

/** Độ sáng trung bình dưới mức này là quay trong tối, chữ đè lên sẽ không đọc được. */
export const MIN_BRIGHTNESS = 0.18;

export interface VideoMeta {
  width: number;
  height: number;
  durationSec: number;
  codec: string;
  fps: number;
  hasAudio: boolean;
  sizeBytes: number;
}

export interface Problem {
  /** Mã để ghi log và đếm; không hiện cho người dùng. */
  code: string;
  /** Câu nói cho người bán, kèm việc họ cần làm. */
  message: string;
  /** `reject` thì không nhận; `warn` thì vẫn dùng được nhưng nên báo. */
  severity: 'reject' | 'warn';
}

/**
 * Soát một clip trước khi nhận. Thuần, không I/O.
 *
 * Spec §2.4: "Kiểm tra trước khi nhận: độ phân giải dưới 720p, quá tối, rung quá mức —
 * báo lại cho người bán quay lại thay vì cho ra video xấu."
 *
 * Chặn ở đây rẻ hơn nhiều so với chặn ở cuối: người bán biết ngay lúc tải lên, trong khi
 * họ vẫn đang cầm sản phẩm và quay lại được. Để lọt tới lúc render xong mới báo thì họ
 * đã mất credit, mất thời gian chờ, và phải dựng lại từ đầu.
 */
export function validateVideo(meta: Partial<VideoMeta> | null | undefined): Problem[] {
  const v: Problem[] = [];
  const m = meta ?? {};

  const h = Number(m.height);
  if (!Number.isFinite(h) || h <= 0) {
    v.push({ code: 'NO_VIDEO_STREAM', message: 'File này không có hình — có thể là file âm thanh hoặc file hỏng.', severity: 'reject' });
    return v;
  }

  if (h < MIN_HEIGHT) {
    v.push({
      code: 'LOW_RES',
      message: `Video chỉ ${h}p. Cần tối thiểu ${MIN_HEIGHT}p, nếu không khi phóng lên khung dọc sẽ bị vỡ hạt. Quay lại ở chế độ chất lượng cao nhất của điện thoại.`,
      severity: 'reject',
    });
  }

  const d = Number(m.durationSec);
  if (Number.isFinite(d) && d > MAX_CLIP_SEC) {
    v.push({
      code: 'TOO_LONG',
      message: `Clip dài ${Math.round(d)} giây, vượt mức ${MAX_CLIP_SEC} giây. Cắt bớt rồi tải lại — video thành phẩm chỉ 15–26 giây và mỗi cảnh dùng 4–8 giây, nên ${MAX_CLIP_SEC} giây là đã thừa.`,
      severity: 'reject',
    });
  }

  // Dưới 6 giây thì không còn là video bán hàng, chỉ là một đoạn cắt: không đủ chỗ cho
  // hook + cảnh sản phẩm + CTA, mỗi phần 2 giây. Thiếu vai nào thì cũng không bán được.
  if (Number.isFinite(d) && d > 0 && d < ABS_MIN_TOTAL_MS / 1000) {
    v.push({
      code: 'TOO_SHORT',
      message: `Clip chỉ ${d.toFixed(1)} giây. Cần tối thiểu ${ABS_MIN_TOTAL_MS / 1000} giây để đủ chỗ cho câu mở đầu, cảnh sản phẩm và lời kêu gọi. Quay thêm vài giây nữa.`,
      severity: 'reject',
    });
  }

  const b = Number(m.sizeBytes);
  if (Number.isFinite(b) && b > MAX_CLIP_BYTES) {
    // Nguyên nhân gần như luôn là máy đang quay 4K. Và 4K VÔ ÍCH ở đây: đầu ra là
    // 1080×1920, nên 4K chỉ gấp ba số byte để đổi lấy đúng 0 chất lượng sau khi hạ
    // khung. Nói cho người bán cách sửa thì họ sửa được trong 10 giây; chỉ báo "vượt
    // dung lượng" thì họ bỏ cuộc.
    const laBonK = Number.isFinite(h) && h >= 2000;
    v.push({
      code: 'TOO_LARGE',
      message: laBonK
        ? `Máy đang quay ở 4K nên file nặng ${(b / 1024 / 1024).toFixed(0)}MB. Vào Cài đặt > Camera > Quay video, đổi sang 1080p rồi quay lại — video thành phẩm trông y hệt vì khung xuất ra là 1080p.`
        : `File nặng ${(b / 1024 / 1024).toFixed(0)}MB, vượt mức ${MAX_CLIP_BYTES / 1024 / 1024}MB. Quay ngắn lại dưới ${MAX_CLIP_SEC} giây, hoặc hạ chất lượng quay xuống 1080p.`,
      severity: 'reject',
    });
  }

  const codec = String(m.codec ?? '').toLowerCase();
  if (codec && !ACCEPTED_CODECS.includes(codec as any)) {
    v.push({
      code: 'BAD_CODEC',
      message: `Định dạng nén "${codec}" không đọc được. Xuất lại dạng MP4 (H.264).`,
      severity: 'reject',
    });
  }

  // Khung ngang không bị loại — chỉ cảnh báo. Cắt dọc từ khung ngang thì mất hai bên,
  // nhưng nếu sản phẩm nằm giữa khung thì vẫn dùng tốt, và loại thẳng sẽ chặn oan.
  const w = Number(m.width);
  if (Number.isFinite(w) && w > h) {
    v.push({
      code: 'LANDSCAPE',
      message: 'Clip quay ngang. Video dọc lên TikTok/Reels đẹp hơn nhiều — lần sau cầm điện thoại dọc. Lần này hệ thống sẽ cắt phần giữa khung.',
      severity: 'warn',
    });
  }

  return v;
}

/** Có vấn đề nào đủ nặng để từ chối không. */
export function shouldReject(problems: Problem[]): boolean {
  return problems.some((p) => p.severity === 'reject');
}

/**
 * Dựng chuỗi filter cho một cảnh lấy từ video quay tay.
 *
 * Khác hẳn nhánh ảnh: KHÔNG `zoompan`. Video đã có chuyển động của chính nó; thêm một
 * lớp chuyển động nữa là hai thứ đánh nhau trên cùng một khung hình.
 *
 * `scale` + `crop` với `force_original_aspect_ratio=increase` phủ kín khung rồi cắt phần
 * thừa ở giữa — giữ nguyên tỉ lệ, không bóp méo người và sản phẩm.
 */
export function buildVideoSceneFilter(opts: {
  inputIndex: number;
  /** Mốc bắt đầu trong clip gốc, giây. */
  startSec: number;
  /** Độ dài cảnh cần lấy, giây. */
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  outLabel: string;
}): string {
  const { inputIndex, startSec, durationSec, width, height, fps, outLabel } = opts;
  const bd = Math.max(0, startSec);
  const dai = Math.max(0.1, durationSec);

  return (
    `[${inputIndex}:v]` +
    `trim=start=${bd.toFixed(3)}:duration=${dai.toFixed(3)},` +
    `setpts=PTS-STARTPTS,` +
    `fps=${fps},` +
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${width}:${height},` +
    `setsar=1,format=yuv420p` +
    `[${outLabel}]`
  );
}

/**
 * Chọn đoạn nào trong clip để lấy cho một cảnh.
 *
 * Bỏ qua nửa giây đầu: đó gần như luôn là lúc tay còn chạm máy, khung còn rung.
 * Clip ngắn hơn cảnh cần thì lấy từ đầu và để worker tự lặp hoặc rút ngắn cảnh.
 */
export function pickSegment(clipDurationSec: number, needSec: number): { startSec: number; durationSec: number } {
  const BO_DAU = 0.5;
  const kha = Math.max(0, clipDurationSec - BO_DAU);

  if (kha <= needSec) {
    // Không đủ dài để bỏ đoạn đầu: lấy tất cả những gì có.
    return { startSec: 0, durationSec: Math.min(clipDurationSec, needSec) };
  }

  // Lấy từ giữa clip: người quay thường ổn định nhất ở quãng giữa, còn đoạn cuối hay
  // có động tác với tay tắt máy.
  const giua = BO_DAU + (kha - needSec) / 2;
  return { startSec: Math.round(giua * 1000) / 1000, durationSec: needSec };
}

/**
 * Đọc thông số thật của file bằng ffprobe.
 *
 * Không tin phần mở rộng tên file và cũng không tin `mimetype` trình duyệt gửi lên:
 * cả hai đều do người dùng đặt. Cùng một bài học đã khiến `sniffImageType` ra đời —
 * một file JSON lỗi đặt tên .jpg từng lọt vào và cho ra video rỗng không dấu vết.
 */
export function probeVideo(filePath: string, sizeBytes = 0): Promise<VideoMeta | null> {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ]);

    let out = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('error', () => resolve(null));
    p.on('close', (code) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(parseProbe(out, sizeBytes));
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * Tách kết quả ffprobe. Để riêng khỏi `probeVideo` để test được mà không cần file thật.
 */
export function parseProbe(json: string, sizeBytes = 0): VideoMeta | null {
  const data = JSON.parse(json);
  const streams: any[] = Array.isArray(data?.streams) ? data.streams : [];

  const v = streams.find((s) => s?.codec_type === 'video');
  if (!v) return null;

  // "30000/1001" → 29.97. Giá trị này là phân số, không phải số thập phân.
  let fps = 30;
  const r = String(v.r_frame_rate ?? '');
  const m = /^(\d+)\/(\d+)$/.exec(r);
  if (m && Number(m[2]) !== 0) fps = Number(m[1]) / Number(m[2]);

  const dur = Number(data?.format?.duration ?? v.duration ?? 0);

  return {
    width: Number(v.width) || 0,
    height: Number(v.height) || 0,
    durationSec: Number.isFinite(dur) ? dur : 0,
    codec: String(v.codec_name ?? '').toLowerCase(),
    fps: Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : 30,
    hasAudio: streams.some((s) => s?.codec_type === 'audio'),
    sizeBytes: Number(data?.format?.size) || sizeBytes,
  };
}

/** File này là video hay ảnh, đọc từ mimetype đã được xác minh hoặc đuôi file. */
export function isVideoAsset(urlOrType: string | null | undefined): boolean {
  const s = String(urlOrType ?? '').toLowerCase();
  if (s.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(s);
}
