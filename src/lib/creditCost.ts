/**
 * Viprosell — Tính chi phí credit ở phía giao diện
 *
 * ⚠️ BẢN SAO CỦA `backend/src/lib/credit-cost.ts`. Hai bản PHẢI cho cùng kết quả.
 *
 * Vì sao phải sao chép thay vì dùng chung: frontend và backend là hai dự án biên dịch
 * riêng, không import chéo được. Rủi ro trôi khỏi nhau là có thật — đã xảy ra với
 * `validators.ts` và `CAMERA_TABLE`, và với `THEME_CARDS` và `THEMES` — nên có test
 * canh ở `backend/tests/credit-cost-sync.test.ts`: nó nạp CẢ HAI bản và so kết quả
 * trên mọi tổ hợp. Lệch một trường hợp là hỏng test.
 *
 * Lệch hai bản ở đây không phải lỗi nhỏ: khách thấy một con số rồi bị trừ con số khác.
 *
 * ── Bảng giá chốt 30/10/2026 ──
 *
 * **1 credit cho mỗi 15 giây bắt đầu**, không phụ phí giọng đọc / độ phân giải /
 * watermark. Lý do đầy đủ nằm ở đầu file bên backend; tóm tắt: ba phụ phí cũ làm giá
 * một video đăng được lên gấp 4,3 lần con số quảng cáo, trong khi chúng chỉ mang lại
 * vài gói bán mỗi tháng vì chi phí biến đổi chỉ là 332₫/video.
 */

export interface RenderSpec {
  durationSec: number;
  /** Không còn ảnh hưởng giá — độ phân giải là quyền của gói. Giữ cho tương thích. */
  resolution?: '720p' | '1080p';
  /** Không còn ảnh hưởng giá. Giữ cho tương thích. */
  voice?: boolean;
  /** Không còn ảnh hưởng giá. Giữ cho tương thích. */
  watermark?: boolean;
}

/** Mỗi khối thời lượng tốn 1 credit. */
export const GIAY_MOI_CREDIT = 15;
export const BASE_CREDITS = 1;
export const BASE_DURATION_SEC = 20;

/**
 * Số credit cho một lần dựng: 1 credit cho mỗi 15 giây BẮT ĐẦU.
 *
 *   ≤ 15 giây → 1    ≤ 30 giây → 2    ≤ 45 giây → 3    ≤ 60 giây → 4
 */
export function creditsFor(spec: Partial<RenderSpec> | null | undefined): number {
  const duration = Number((spec ?? {}).durationSec);
  const giay = Number.isFinite(duration) && duration > 0 ? duration : BASE_DURATION_SEC;
  return Math.max(BASE_CREDITS, Math.ceil(giay / GIAY_MOI_CREDIT));
}

export interface DongGiai {
  nhan: string;
  credit: number;
}

/**
 * Bóc tách số credit thành từng khoản, để khách thấy TẠI SAO lại là con số đó.
 * Tổng các dòng LUÔN bằng `creditsFor(spec)`.
 */
export function giaiThichCredit(spec: Partial<RenderSpec> | null | undefined): DongGiai[] {
  const credit = creditsFor(spec);
  const duration = Number((spec ?? {}).durationSec);
  const giay = Number.isFinite(duration) && duration > 0 ? duration : BASE_DURATION_SEC;

  return [{
    nhan: `Video ${Math.round(giay)} giây (1 credit mỗi ${GIAY_MOI_CREDIT} giây)`,
    credit,
  }];
}

/**
 * Dựng spec từ những thứ khách đã chọn trên giao diện.
 *
 * `renderMode` không còn ảnh hưởng giá, nhưng vẫn nhận vào và điền đúng để sổ cái và
 * nhật ký còn đọc được chuyện gì đã xảy ra.
 */
export function specFromChoices(opts: {
  durationSec: number;
  renderMode: string;
}): RenderSpec {
  const m = String(opts.renderMode ?? '');
  const laPremium = m === 'premiumcloud' || m === 'premium_cloud';
  const coGiong = laPremium || m === 'draftlocaltts' || m === 'draft_local_tts';

  return {
    durationSec: Number.isFinite(opts.durationSec) && opts.durationSec > 0
      ? opts.durationSec
      : BASE_DURATION_SEC,
    resolution: laPremium ? '1080p' : '720p',
    voice: coGiong,
    watermark: true,
  };
}

/**
 * Các mốc thời lượng hiện cho khách chọn, kèm số credit tương ứng.
 *
 * Một nguồn duy nhất cho mọi màn hình có ô chọn thời lượng: hai chỗ cho khách chọn mà
 * hiện hai bảng giá khác nhau là cách nhanh nhất để mất lòng tin.
 */
export const MOC_THOI_LUONG: Array<{ giay: number; nhan: string; credit: number }> =
  // Tran 45 giay: schema tang 1 va tang 3 deu kep `duration_sec` trong 10..45, nen cho
  // khach chon 60 la ban mot thu pipeline khong dung duoc.
  [15, 20, 30, 45].map((giay) => ({
    giay,
    nhan: `${giay} giây`,
    credit: creditsFor({ durationSec: giay }),
  }));

/* ────────────────────────────────────────────────────────────────────────────
 * Sức chứa: nguyên liệu khách đưa vào gánh được bao nhiêu giây
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ── Vì sao không chia thẳng "mỗi ảnh 10 giây" ──
 *
 * Bản đầu lấy `giây ≤ số_ảnh × 10`. Phép chia đó coi một tấm 300px ngang hàng một
 * tấm 2296px, bỏ qua clip tự quay, và bỏ qua những cảnh vốn KHÔNG cần ảnh nào.
 *
 * Đo thật ngày 30/10 trên 40 ảnh khách đã tải lên:
 *
 *   dưới 800px ....  5 ảnh
 *   800–1199px .... 18 ảnh
 *   1200–1599px ...  2 ảnh
 *   từ 1600px ..... 15 ảnh      (trung vị 1024px, nhỏ nhất 300px)
 *
 * Chỉ **16/40** đủ pixel để cắt cận `detail_macro` 1,28× mà vẫn nét ở khung 1080.
 * Nghĩa là 60% số ảnh chỉ chịu được góc rộng và lia dọc — hai cảnh, không phải ba.
 *
 * ── Thứ thật sự giới hạn ──
 *
 * Không phải số ảnh, mà là **số cảnh TRÔNG KHÁC NHAU** dựng được từ nguyên liệu đó.
 * Bảng góc máy (`camera-moves.ts`) cho mỗi ảnh tối đa ba cái nhìn khác nhau:
 *
 *   hero_push / lifestyle_hold  → góc rộng, zoom nhẹ     (ảnh nào cũng được)
 *   reveal_up                   → lia dọc từ trên xuống  (cần đủ pixel)
 *   detail_macro                → cắt cận 1,28×          (cần 1382px = 1080 × 1,28)
 *
 * Và tầng 3 ấn định nhịp: cảnh hook 1,5–2,5 giây, cảnh lập luận 2,5–4 giây, cảnh CTA
 * 2,5–3,5 giây — trung bình 3 giây mỗi cảnh.
 *
 * Nên sức chứa = (số cảnh khác nhau dựng được) × 3 giây.
 */

/** Trung bình mỗi cảnh, lấy từ chính nhịp tầng 3 quy định. */
export const GIAY_MOI_CANH = 3;

/** Pixel chiều ngắn cần có để cắt cận 1,28× mà vẫn nét ở khung 1080. */
export const PX_CHO_CAN_CANH = Math.round(1080 * 1.28);

/** Dưới mức này thì lia dọc cũng lộ vỡ, ảnh chỉ còn gánh được một cảnh góc rộng. */
export const PX_CHO_LIA = 900;

/**
 * Số cảnh một clip tự quay gánh được.
 *
 * Clip khác ảnh về bản chất: `video-edit.job.ts` cắt theo mốc thời gian CÓ THẬT trong
 * clip, nên mỗi lát là một khoảnh khắc khác nhau thật, không phải cùng một khung hình
 * nhìn ở zoom khác.
 */
export const CANH_MOI_CLIP = 8;

/**
 * Cảnh không tiêu ảnh nào.
 *
 * `cta_card` là thẻ chữ ở cuối — tầng 3 dành riêng cảnh cuối cho nó. `text_only` thì
 * prompt khuyên tránh ở cảnh mở ("A text_only opening wastes the hook"), nên chỉ tính
 * một cảnh chữ cho mỗi video.
 */
export const CANH_KHONG_CAN_ANH = 1;

export interface NguonLieu {
  /** Chiều NGẮN của từng ảnh, tính bằng pixel. Chưa đo được thì để trống. */
  anh?: Array<{ canhNgan?: number } | number | null | undefined>;
  /** Số clip tự quay khách tải lên. */
  soClip?: number;
  /**
   * Hệ thống có nâng độ phân giải ảnh trước khi dựng hay không.
   *
   * Bật thì ảnh nhỏ vẫn cắt cận được, nên mỗi ảnh gánh 3 cảnh thay vì 2 — ba tấm ảnh
   * mở được mốc 30 giây thay vì 20. Phụ thuộc `NANG_ANH_BIN` ở máy dựng.
   */
  seNangAnh?: boolean;
}

/** Số cảnh trông khác nhau một tấm ảnh gánh được, theo độ phân giải của chính nó. */
export function soCanhMoiAnh(
  canhNgan: number | null | undefined,
  seNangAnh = false
): number {
  const px = Number(canhNgan);
  // Chưa đo được: lấy 2, đúng với trung vị 1024px đo thật — không đoán rộng tay.
  if (!Number.isFinite(px) || px <= 0) return 2;
  if (px >= PX_CHO_CAN_CANH) return 3;

  /**
   * Khi hệ thống nâng ảnh trước lúc dựng, ngưỡng cắt cận tính trên khổ SAU KHI NÂNG.
   *
   * Real-ESRGAN phóng 4×, nên ảnh từ `PX_CHO_CAN_CANH / 4` trở lên là chạm được
   * ngưỡng. Dưới mức đó thì nâng lên cũng không đủ, và đoán chi tiết từ một tấm
   * thumbnail chỉ ra bề mặt nhựa bóng chứ không ra sản phẩm thật.
   */
  if (seNangAnh && px >= PX_CHO_CAN_CANH / 4) return 3;

  if (px >= PX_CHO_LIA) return 2;
  return 1;
}

/** Tổng số cảnh trông khác nhau dựng được từ nguyên liệu đang có. */
export function soCanhDungDuoc(nguon: NguonLieu | null | undefined): number {
  const n = nguon ?? {};
  const anh = Array.isArray(n.anh) ? n.anh : [];
  const soClip = Number.isFinite(Number(n.soClip)) ? Math.max(0, Math.floor(Number(n.soClip))) : 0;

  const tuAnh = anh.reduce<number>((t, a) => {
    const px = typeof a === 'number' ? a : (a && typeof a === 'object' ? a.canhNgan : undefined);
    return t + soCanhMoiAnh(px, Boolean(n.seNangAnh));
  }, 0);

  const tuClip = soClip * CANH_MOI_CLIP;
  if (tuAnh + tuClip === 0) return 0;

  return tuAnh + tuClip + CANH_KHONG_CAN_ANH;
}

/** Số giây nguyên liệu gánh được mà chưa phải lặp lại một cái nhìn đã dùng. */
export function sucChuaGiay(nguon: NguonLieu | null | undefined): number {
  return soCanhDungDuoc(nguon) * GIAY_MOI_CANH;
}

/**
 * Những mốc thời lượng được phép chào, theo sức chứa của nguyên liệu.
 *
 * Luôn trả về ít nhất một mốc: màn hình chọn thời lượng xuất hiện TRƯỚC khi biết chắc
 * khách tải xong chưa, và một danh sách rỗng thì không có gì để bấm.
 */
export function mocThoiLuongChoPhep(nguon: NguonLieu | number | null | undefined): typeof MOC_THOI_LUONG {
  // Nhận cả dạng cũ (một con số là số ảnh) để nơi gọi cũ không vỡ.
  const n: NguonLieu = typeof nguon === 'number'
    ? { anh: Array.from({ length: Math.max(0, Math.floor(nguon)) }, () => ({})) }
    : (nguon ?? {});

  const tran = sucChuaGiay(n);
  const duoc = MOC_THOI_LUONG.filter((m) => m.giay <= tran);
  return duoc.length > 0 ? duoc : [MOC_THOI_LUONG[0]];
}

/**
 * Lý do một mốc bị khoá, viết cho người bán đọc — và nói rõ LÀM GÌ để mở.
 *
 * Nói "cần thêm ảnh" là chưa đủ khi vấn đề nằm ở độ phân giải: khách tải thêm ba tấm
 * 600px nữa thì vẫn không mở được mốc đó, và họ không hiểu vì sao.
 */
export function viSaoKhoaMoc(
  giay: number,
  nguon: NguonLieu | number | null | undefined
): string {
  const n: NguonLieu = typeof nguon === 'number'
    ? { anh: Array.from({ length: Math.max(0, Math.floor(nguon)) }, () => ({})) }
    : (nguon ?? {});

  const tran = sucChuaGiay(n);
  if (tran >= giay) return '';

  const thieuCanh = Math.ceil((giay - tran) / GIAY_MOI_CANH);
  const anh = Array.isArray(n.anh) ? n.anh : [];
  const nhoNet = anh.filter((a) => {
    const px = typeof a === 'number' ? a : (a && typeof a === 'object' ? a.canhNgan : undefined);
    return Number.isFinite(Number(px)) && Number(px) > 0 && Number(px) < PX_CHO_CAN_CANH;
  }).length;

  if (anh.length === 0 && !n.soClip) {
    return `Cần tải ảnh lên trước — ${giay} giây không dựng được từ con số không.`;
  }

  const them = Math.ceil(thieuCanh / 2);
  const goiY = nhoNet > 0
    ? `Thêm khoảng ${them} ảnh nữa, hoặc thay ${nhoNet} ảnh nhỏ bằng ảnh rộng ít nhất ${PX_CHO_CAN_CANH}px`
    : `Thêm khoảng ${them} ảnh nữa`;

  return `${goiY} — nguyên liệu hiện tại đủ cho khoảng ${tran} giây mà không phải lặp lại cùng một góc nhìn.`;
}
