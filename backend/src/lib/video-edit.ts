/**
 * Viprosell — Dựng lại clip khách tự quay: phần quyết định bằng CODE
 *
 * Luồng này có hai lần gọi LLM, không phải bốn:
 *
 *   Call 1 — đọc clip: model xem các khung hình + transcript, kể lại thứ nó THẤY.
 *   Call 2 — kế hoạch dựng: chọn đoạn nào, theo vai trò nào.
 *
 * Chuỗi 4 tầng của nhánh ảnh KHÔNG dùng ở đây, và đó là chủ ý. Bốn tầng tồn tại để
 * *sáng tác* một kịch bản từ con số không. Với clip khách tự quay thì nội dung đã có
 * sẵn — việc là dựng, không phải viết. Ép qua 4 tầng sẽ khiến model nghĩ ra một kịch
 * bản rồi cố bẻ footage cho vừa, tức làm hỏng đúng thứ luồng này sinh ra để giữ.
 *
 * File này chứa phần KHÔNG hỏi model: bảng theme, bản đồ sang ffmpeg, và giới hạn
 * biên độ. Cùng lý do đã đưa tầng 4 về code — dịch tên sang tham số là việc máy móc,
 * hỏi model chỉ tốn token và thêm một lớp lỗi JSON.
 */
/* ─────────────────── Kiểu dữ liệu ─────────────────── */

export type Theme = 'tu_nhien' | 'sach' | 'cao_cap' | 'demo_tay';
export type Crop = 'hold' | 'punch_in' | 'punch_out';
export type SegmentRole = 'hook' | 'product' | 'proof' | 'cta';
export type MusicBed = 'none' | 'soft' | 'pulse';
export type Grade = 'none' | 'clean' | 'premium';
export type Stabilize = 'off' | 'light' | 'medium';

export interface Segment {
  id: string;
  role: SegmentRole;
  in_ms: number;
  out_ms: number;
  crop: Crop;
  speed: number;
  transition_out: 'cut' | 'xfade_160';
  overlay: string;
}

/* ─────────────────── Giới hạn ─────────────────── */

/** Thành phẩm 15–26 giây. Ngắn hơn không kịp kể, dài hơn là người xem lướt. */
export const MIN_TOTAL_MS = 15_000;
export const MAX_TOTAL_MS = 26_000;

/**
 * Dưới mức này thì không còn là video bán hàng, chỉ là một đoạn cắt.
 *
 * 6 giây đủ cho hook + một cảnh sản phẩm + CTA, mỗi phần 2 giây. Ngắn hơn thì không
 * đủ chỗ cho ba vai trò, và thiếu vai nào thì video cũng không bán được gì.
 */
export const ABS_MIN_TOTAL_MS = 6_000;

/**
 * Mức tối thiểu THỰC TẾ cho một clip nguồn cụ thể.
 *
 * Không thể đòi 15 giây thành phẩm từ một clip 8 giây nếu không lặp lại hình. Cả bốn
 * clip mẫu ngày 28/10 đều đúng 8 giây, nên quy tắc cứng 15 giây sẽ chặn sạch — chặn
 * một clip hợp lệ chỉ vì nó ngắn là chặn oan.
 *
 * Chừa 10% vì không bao giờ dùng hết clip: `pickSegment` bỏ nửa giây đầu, và các đoạn
 * bỏ đi (im lặng, câu lặp) cũng ăn mất một phần.
 */
export function minTotalFor(clipDurationMs: number): number {
  if (!Number.isFinite(clipDurationMs) || clipDurationMs <= 0) return MIN_TOTAL_MS;
  return Math.max(ABS_MIN_TOTAL_MS, Math.min(MIN_TOTAL_MS, Math.floor(clipDurationMs * 0.9)));
}

/** Mức tối đa thực tế: không vượt quá thứ clip thật sự có. */
export function maxTotalFor(clipDurationMs: number): number {
  if (!Number.isFinite(clipDurationMs) || clipDurationMs <= 0) return MAX_TOTAL_MS;
  return Math.min(MAX_TOTAL_MS, Math.max(ABS_MIN_TOTAL_MS, clipDurationMs));
}

/**
 * Tua 0.85–1.15×. Ngoài khoảng này tai nghe ra ngay giọng bị méo, và mất luôn
 * cảm giác người thật — thứ duy nhất luồng này có mà nhánh ảnh không có.
 */
export const MIN_SPEED = 0.85;
export const MAX_SPEED = 1.15;

/** Chữ trên màn hình tối đa 6 từ: người xem có nửa giây cho mỗi dòng. */
export const MAX_OVERLAY_WORDS = 6;

/* ─────────────────── Bảng theme ─────────────────── */

export interface ThemeConfig {
  music: MusicBed;
  grade: Grade;
  stabilize: Stabilize;
  /** Số cảnh mong muốn. Ít cảnh = nhịp chậm, sang hơn. */
  targetSegments: number;
  /** Có được phép dùng xfade giữa các đoạn không. */
  allowXfade: boolean;
  label: string;
  hint: string;
}

export const THEMES: Record<Theme, ThemeConfig> = {
  // Mặc định. Đúng lời hứa "giữ nguyên cảm giác bạn tự quay": không nhạc, không
  // chỉnh màu, ổn định nhẹ nhất có thể.
  tu_nhien:  { music: 'none',  grade: 'none',    stabilize: 'light',  targetSegments: 4, allowXfade: false,
               label: 'Tự nhiên', hint: 'Giữ nguyên cảm giác bạn tự quay. Ít cắt, không nhạc, không chỉnh màu.' },

  sach:      { music: 'soft',  grade: 'clean',   stabilize: 'light',  targetSegments: 5, allowXfade: true,
               label: 'Gọn gàng', hint: 'Cắt theo nhịp nói, tương phản nhẹ, có nhạc nền êm.' },

  cao_cap:   { music: 'soft',  grade: 'premium', stabilize: 'medium', targetSegments: 3, allowXfade: true,
               label: 'Cao cấp', hint: 'Ít cắt, chuyển chậm, màu trầm, chữ thưa.' },

  // Chỉ hiện khi Call 1 báo có tay trong khung.
  demo_tay:  { music: 'pulse', grade: 'clean',   stabilize: 'medium', targetSegments: 5, allowXfade: false,
               label: 'Thao tác tay', hint: 'Ưu tiên đoạn tay đang dùng sản phẩm, bỏ phần giới thiệu dài.' },
};

/** Theme hợp lệ, mặc định `tu_nhien`. Không bao giờ trả undefined. */
export function resolveTheme(name: string | null | undefined): Theme {
  const s = String(name ?? '').trim();
  return s in THEMES ? (s as Theme) : 'tu_nhien';
}

/* ─────────────────── Bản đồ sang ffmpeg ─────────────────── */

/**
 * Biên độ crop cho từng kiểu. `punch_in` đi từ 1.00 lên, `punch_out` đi ngược lại.
 *
 * Con số đích chỉ là MONG MUỐN, không phải cam kết: `cropFilter` sẽ hạ xuống cho vừa
 * ngân sách bước nếu đoạn quá ngắn. Bản đề xuất ngày 28/10 ghi "zoompan 1.00 → 1.30,
 * bước mỗi khung ≤ 0.001" — hai điều đó không cùng đúng được: một đoạn 6 giây ở 30fps
 * chỉ có 180 khung, tức đi được tối đa 0.18, không tới 0.30.
 */
const CROP_RANGE: Record<Crop, { from: number; to: number }> = {
  hold:      { from: 1.00, to: 1.00 },
  punch_in:  { from: 1.00, to: 1.18 },
  punch_out: { from: 1.18, to: 1.00 },
};

/** Bước zoom tối đa mỗi khung. Vượt là mắt thấy giật. */
export const MAX_CROP_STEP = 0.001;

/**
 * Chuỗi filter cho phần khung hình của một đoạn.
 *
 * `hold` KHÔNG dùng zoompan: crop tĩnh thì không có gì để nội suy, thêm zoompan chỉ
 * tốn một lượt scale 2× vô ích.
 */
export function cropFilter(
  crop: Crop,
  width: number,
  height: number,
  durationFrames: number,
  fps: number
): string {
  // `Math.max(1, Math.round(NaN))` vẫn ra NaN — mọi so sánh với NaN đều false nên nó
  // lọt qua `Math.max`. Phải kiểm Number.isFinite riêng, nếu không ffmpeg nhận
  // `zoompan=z='1.0000+NaN*on'` và cảnh đó ra đen. Cùng cái bẫy đã cắn ở
  // `camera-moves.ts`, lần này test bắt được trước khi ra video.
  const dai = Number.isFinite(durationFrames) ? Math.max(1, Math.round(durationFrames)) : 1;

  if (crop === 'hold' || CROP_RANGE[crop].from === CROP_RANGE[crop].to) {
    return `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`;
  }

  const r = CROP_RANGE[crop];

  // Cùng nguyên tắc hạ biên độ như nhánh ảnh: thà phóng ít hơn mà mượt còn hơn phóng
  // đủ mà giật. Đoạn càng ngắn thì càng ít khung để chia, nên biên độ phải co lại —
  // giữ nguyên biên độ trên đoạn ngắn chính là cách sinh ra hiện tượng giật.
  const bienDo = Math.min(Math.abs(r.to - r.from), MAX_CROP_STEP * dai);

  const tu = r.from;
  const den = r.to >= r.from ? r.from + bienDo : r.from - bienDo;

  // Ba lần thử, ba kiểu hỏng, đo thật trên clip 8 giây ngày 28/10:
  //
  //   zoompan d=soKhung      → `d` là số khung xuất ra TRÊN MỖI KHUNG VÀO. Đúng với ảnh
  //                            tĩnh (một khung `-loop 1` nở thành cả cảnh), nhưng clip
  //                            đã có sẵn khung của chính nó nên mỗi khung nở thêm một
  //                            lần nữa: đoạn 3,6 giây ra video **396 giây**.
  //   zoompan d=1 + fps=     → ffmpeg SẬP, mã 3221225477 (ACCESS_VIOLATION).
  //   crop w='iw/(1+k*t)'    → crop tính `w`/`h` MỘT LẦN lúc khởi tạo, nên biểu thức
  //                            theo `t` không hợp lệ: -22, không khung nào ra.
  //
  // Cách chạy được: `d=1` và BỎ HẲN tham số `fps` của zoompan. Nhịp khung đã được đặt
  // bằng filter `fps` phía trước; đặt lại lần nữa bên trong zoompan là thứ làm nó sập.
  //
  // Với `d=1`, `on` là chỉ số khung xuất ra và trùng chỉ số khung vào, nên biểu thức
  // zoom theo `on` vẫn đúng ý.
  const w2 = width * 2;
  const h2 = height * 2;
  const buoc = ((den - tu) / dai).toFixed(6);

  return (
    `scale=${w2}:${h2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w2}:${h2},` +
    `zoompan=z='${tu.toFixed(4)}+${buoc}*on':d=1:s=${width}x${height}` +
    `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`
  );
}

/** Chỉnh màu theo theme. `none` trả chuỗi rỗng để người gọi bỏ hẳn khâu này. */
export function gradeFilter(grade: Grade): string {
  switch (grade) {
    case 'clean':   return 'eq=contrast=1.06:saturation=1.05';
    case 'premium': return 'eq=contrast=1.08:saturation=0.92:gamma=0.96';
    default:        return '';
  }
}

/**
 * Tham số chống rung.
 *
 * vidstab là bộ lọc HAI LƯỢT: `vidstabdetect` ghi ra file chuyển động, rồi
 * `vidstabtransform` mới nắn hình. Nghĩa là giải mã clip hai lần — đây là lý do nhánh
 * video chậm hơn nhánh ảnh, và là lý do không nên hứa thời gian trước khi đo.
 *
 * `medium` không dùng cho theme `tu_nhien`: nắn mạnh làm mất chính cái rung nhẹ khiến
 * người xem tin đây là người thật cầm máy.
 */
export function stabilizeParams(level: Stabilize): { shakiness: number } | null {
  switch (level) {
    case 'light':  return { shakiness: 3 };
    case 'medium': return { shakiness: 5 };
    default:       return null;
  }
}

/** Số khung của một lần xfade. 5 khung ≈ 167ms ở 30fps — đủ mềm mà không lề mề. */
export const XFADE_FRAMES = 5;

/**
 * Hai đoạn cách nhau quá mức này trên clip gốc thì KHÔNG được xfade.
 *
 * Hoà hai thời điểm khác nhau vào nhau nghĩa là tiếng của hai chỗ chồng lên — nghe
 * như hai bản thu đè lên nhau. Chỗ đó phải cắt cứng cả hình lẫn tiếng.
 */
export const MAX_XFADE_GAP_MS = 80;

/**
 * Độ dài fade ở hai đầu mỗi đoạn tiếng, tính bằng mili giây.
 *
 * 12ms chỉ đủ để xoá tiếng "click" do cắt giữa chu kỳ sóng. Dài hơn là nghe thành
 * tiếng phai, và trên clip có nhạc thì mỗi lần phai là một lần bài hát mờ đi rồi rõ
 * lại — lộ chỗ cắt rõ hơn là để nguyên.
 */
export const AUDIO_EDGE_FADE_MS = 12;

export function xfadeDurationSec(fps: number): number {
  return XFADE_FRAMES / Math.max(1, fps);
}
