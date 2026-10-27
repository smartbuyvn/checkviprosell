/**
 * Viprosell — dựng phụ đề ASS (libass) thay cho drawtext.
 *
 * Vì sao đổi (spec V2, mục S3-2):
 *  - drawtext nuốt cả dòng chữ khi có '%' nếu quên expansion=none — "Giảm 50% hôm nay"
 *    biến mất khỏi video mà FFmpeg vẫn báo thành công.
 *  - drawtext không tự xuống dòng: câu dài tràn ra ngoài khung hoặc bị cắt.
 *  - escapeDrawText phải xoá dấu nháy đơn, làm hỏng câu bán hàng.
 * ASS xử lý cả ba: '%' và dấu nháy là ký tự thường, libass tự ngắt dòng theo lề.
 *
 * Toàn bộ cảnh được concat trước rồi mới áp một file .ass theo mốc thời gian tuyệt đối,
 * nên chỉ cần một lần giải mã phụ đề cho cả video.
 */

export type AssStyleName = 'Overlay' | 'Sub';

export interface AssCue {
  /** Mốc bắt đầu tính từ đầu video, đơn vị giây. */
  startSec: number;
  endSec: number;
  text: string;
  style: AssStyleName;
  /** Cỡ chữ riêng cho cue này; bỏ trống thì dùng cỡ của style. */
  fontSize?: number;
}

export interface AssOptions {
  width: number;
  height: number;
  /** Tên font theo fontconfig. VPS hiện chỉ có DejaVu Sans hỗ trợ tiếng Việt. */
  fontName: string;
  overlayFontSize: number;
  subFontSize: number;
  /** Khoảng cách từ MÉP TRÊN xuống, cho chữ overlay (px). */
  overlayMarginV: number;
  /** Khoảng cách từ MÉP DƯỚI lên, cho phụ đề (px). */
  subMarginV: number;
  /** Lề trái/phải — vùng an toàn, giữ chữ không chạm mép (px). */
  marginH: number;
}

/**
 * Thoát ký tự cho trường Text của ASS.
 * Giữ nguyên '%' và dấu nháy đơn — đó chính là thứ drawtext làm hỏng.
 */
export function escapeAssText(text: string): string {
  return String(text ?? '')
    // Dấu gạch chéo ngược mở đầu mã điều khiển ASS (\N, \h...) nên không để lọt nguyên bản.
    .replace(/\\/g, '/')
    // { } mở/đóng khối override; không thoát thì phần còn lại của dòng bị nuốt.
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    // Xuống dòng thật -> ngắt dòng cứng của ASS.
    .replace(/\r?\n/g, '\\N')
    .trim();
}

/** Đổi giây sang dạng giờ:phút:giây.cs mà ASS yêu cầu (chỉ 2 chữ số phần trăm giây). */
export function toAssTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  // Làm tròn có thể đẩy lên 100 centisecond; dồn sang giây để không sinh ".100".
  const carry = cs === 100 ? 1 : 0;
  const cs2 = cs === 100 ? 0 : cs;
  const sec2 = sec + carry;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec2 % 60).padStart(2, '0')}.${String(cs2).padStart(2, '0')}`;
}

/**
 * Sinh nội dung file .ass hoàn chỉnh.
 * Overlay neo mép trên (an=8), phụ đề neo mép dưới (an=2) — cả hai vẫn tự xuống dòng
 * trong phạm vi lề, khác hẳn drawtext vốn vẽ một dòng duy nhất.
 */
export function buildAssFile(cues: AssCue[], opts: AssOptions): string {
  const { width, height, fontName, overlayFontSize, subFontSize, overlayMarginV, subMarginV, marginH } = opts;

  // &H00BBGGRR — ASS dùng thứ tự ngược so với HTML, và 00 ở đầu là alpha (00 = đục).
  const white = '&H00FFFFFF';
  const black = '&H00000000';

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 0',            // 0 = tự ngắt dòng thông minh, cân đối các dòng
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${Math.round(width)}`,
    `PlayResY: ${Math.round(height)}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,'
      + ' Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline,'
      + ' Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Overlay,${fontName},${Math.round(overlayFontSize)},${white},${white},${black},${black},`
      + `-1,0,0,0,100,100,0,0,1,4,2,8,${Math.round(marginH)},${Math.round(marginH)},${Math.round(overlayMarginV)},1`,
    `Style: Sub,${fontName},${Math.round(subFontSize)},${white},${white},${black},${black},`
      + `0,0,0,0,100,100,0,0,1,3,1,2,${Math.round(marginH)},${Math.round(marginH)},${Math.round(subMarginV)},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events = cues
    .filter((c) => String(c.text ?? '').trim() !== '' && c.endSec > c.startSec)
    .map((c) =>
      `Dialogue: 0,${toAssTime(c.startSec)},${toAssTime(c.endSec)},${c.style},,0,0,0,,`
      + (c.fontSize ? `{\\fs${Math.round(c.fontSize)}}` : '')
      + escapeAssText(c.text)
    );

  return [...header, ...events, ''].join('\n');
}

/**
 * Thoát đường dẫn để nhét vào filter `subtitles=` của FFmpeg.
 * Filter graph tách tham số bằng ':' nên dấu hai chấm trong "C:/..." phải được thoát,
 * nếu không FFmpeg hiểu nhầm là tham số kế tiếp.
 */
export function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}
