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
  /**
   * Khoảng cách từ mép dưới lên, RIÊNG cho cue này (px).
   *
   * `MarginV` trong phần `[V4+ Styles]` là một giá trị chung cho cả file. Tiêu đề thì
   * phải nằm ngay trên phụ đề đang hiện cùng lúc với nó — mà phụ đề lúc một dòng lúc
   * hai dòng. Dùng lề chung thì phải chừa chỗ cho trường hợp xấu nhất, và mọi câu phụ
   * đề một dòng để lại một khoảng trống bằng đúng một dòng.
   *
   * Đo trên khung 1080×1080 ngày 30/10: khoảng trống đó là 57px.
   *
   * Bỏ trống thì dùng lề của style, đúng như trước.
   */
  marginV?: number;
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

  /**
   * Viền tím đậm thay cho viền đen.
   *
   * ASS dùng `&HBBGGRR`, ngược thứ tự so với HTML. Tím đậm `#3D1259` thành
   * `&H0059123D`.
   *
   * Đen tuyệt đối là màu nặng nhất có thể đặt cạnh một bức ảnh — nó cắt chữ ra khỏi
   * hình như dán decal. Tím đậm vẫn đủ tối để tương phản với chữ trắng, nhưng có sắc
   * nên hoà vào bố cục thay vì chọi lại.
   */
  const timDam = '&H0059123D';

  /**
   * Bóng đổ bán trong suốt. `&HA0...` — byte đầu là alpha, A0 ≈ 63% trong.
   *
   * `B0` ≈ 69% trong. Hạ dần qua ba lần: 50% → 63% → 69%, mỗi lần khách vẫn thấy
   * nặng. Bóng càng trong thì càng giống một vầng tối mềm quanh chữ, không phải
   * một mảng đen.
   */
  const bongMo = '&HB059123D';

  /**
   * Độ dày viền và bóng, tính THEO BỀ NGANG KHUNG.
   *
   * ── Vì sao đổi ──
   *
   * Bản cũ viết cứng `Outline=4` cho tiêu đề và `Outline=3` cho phụ đề. Với
   * `ScaledBorderAndShadow: yes` và PlayResX=1080, đó là viền đen đặc dày 3–4 pixel
   * quanh MỌI nét chữ — kiểu phụ đề karaoke những năm 2000, và nó đè nặng lên hình
   * tới mức ảnh sản phẩm bị lu đi.
   *
   * Cách nhẹ hơn mà vẫn đọc được trên nền sáng: viền MỎNG cộng bóng đổ bán trong
   * suốt. Viền lo phần tương phản ở sát nét chữ, bóng lo phần tách chữ khỏi nền.
   *
   * Tính theo tỉ lệ khung để video 1:1 và 16:9 không bị viền dày gấp đôi so với 9:16.
   */
  /**
   * Lan ha thu ba, ngay 30/10: khach van thay nang, xin "thanh thoat va tinh te".
   *
   * Cach lam: VIEN mong gan het muc, va doi phan viec tach chu khoi nen sang cho
   * BONG DO. Vien la duong ke bam sat net chu — no la thu mat doc ra la "nang".
   * Bong do toa ra ngoai va mo dan, nen tang bong khong lam chu trong day hon.
   *
   * Hanh trinh ti le muc toi tren chu qua ba lan: 3,96 -> 1,72 -> 1,00 -> muc nay.
   */
  const viendTieuDe = Math.max(0.6, Math.round((width / 1080) * 0.8 * 10) / 10);
  const viendPhuDe = Math.max(0.5, Math.round((width / 1080) * 0.6 * 10) / 10);
  const bongTieuDe = Math.max(1, Math.round((width / 1080) * 3 * 10) / 10);
  const bongPhuDe = Math.max(1, Math.round((width / 1080) * 2.6 * 10) / 10);

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
    // Viền mỏng + bóng mờ, thay cho viền đen đặc 3–4px của bản cũ.
    `Style: Overlay,${fontName},${Math.round(overlayFontSize)},${white},${white},${timDam},${bongMo},`
      + `-1,0,0,0,100,100,0,0,1,${viendTieuDe},${bongTieuDe},2,${Math.round(marginH)},${Math.round(marginH)},${Math.round(overlayMarginV)},1`,
    `Style: Sub,${fontName},${Math.round(subFontSize)},${white},${white},${timDam},${bongMo},`
      + `0,0,0,0,100,100,0,0,1,${viendPhuDe},${bongPhuDe},2,${Math.round(marginH)},${Math.round(marginH)},${Math.round(subMarginV)},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events = cues
    .filter((c) => String(c.text ?? '').trim() !== '' && c.endSec > c.startSec)
    .map((c) => {
      const thoiLuongMs = Math.round((c.endSec - c.startSec) * 1000);

      // Chữ bật ra rồi tắt phụt là thứ phân biệt video nghiệp dư với video quảng cáo.
      // \fad làm chữ hiện lên và tắt đi mềm; thời gian mờ phải ngắn hơn hẳn thời lượng
      // của mẩu, nếu không chữ chưa kịp rõ đã bắt đầu mờ.
      const fadeVao = c.style === 'Overlay' ? 220 : 120;
      const fadeRa = c.style === 'Overlay' ? 200 : 100;
      const fade = thoiLuongMs > (fadeVao + fadeRa) * 2
        ? `\\fad(${fadeVao},${fadeRa})`
        : '';

      // Tiêu đề thêm một nhịp phóng nhẹ trong 250ms đầu: mắt bắt được chuyển động
      // trước khi đọc chữ. Phụ đề KHÔNG làm vậy — chữ chạy theo lời nói mà còn nhúc
      // nhích thì khó đọc.
      const nhan = c.style === 'Overlay' && thoiLuongMs > 900
        ? '\\t(0,250,\\fscx104\\fscy104)\\t(250,420,\\fscx100\\fscy100)'
        : '';

      /**
       * Làm mềm cạnh viền và bóng.
       *
       * `\blur` toả nhẹ mép. Không có nó, viền dù mỏng vẫn là một đường kẻ cứng
       * quanh nét chữ; có nó thì chữ "nổi" trên hình thay vì bị "dán" lên hình.
       *
       * 0,6 cho tiêu đề (chữ to, viền dày hơn nên cần toả nhiều hơn), 0,4 cho phụ
       * đề. Trên 1,0 thì chữ bắt đầu nhoè và khó đọc trên nền đang chuyển động.
       */
      const lamMem = c.style === 'Overlay' ? '\\blur0.6' : '\\blur0.4';

      const theTag = [
        c.fontSize ? `\\fs${Math.round(c.fontSize)}` : '',
        lamMem,
        fade,
        nhan,
      ].filter(Boolean).join('');

      // Trường thứ ba trong bộ ba lề là MarginV. Số 0 nghĩa là "dùng lề của style",
      // nên chỉ ghi số khác 0 khi cue này thật sự muốn lề riêng.
      const leRieng = Number.isFinite(Number(c.marginV)) && Number(c.marginV) > 0
        ? Math.round(Number(c.marginV))
        : 0;

      return `Dialogue: 0,${toAssTime(c.startSec)},${toAssTime(c.endSec)},${c.style},,0,0,${leRieng},,`
        + (theTag ? `{${theTag}}` : '')
        + escapeAssText(c.text);
    });

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
