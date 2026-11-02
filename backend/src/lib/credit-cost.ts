/**
 * Viprosell — Tính số credit cho một lần dựng video
 *
 * Chốt ngày 30/10/2026: **1 credit cho mỗi 15 giây bắt đầu**, không phụ phí gì khác.
 *
 * ── Vì sao bỏ bảng cũ ──
 *
 * Bản 28/10 lấy "1 credit = 1 video chuẩn" rồi cộng thêm: +1 giọng đọc, +1 độ phân
 * giải 1080p, +1 bỏ watermark. Nghe thì hợp lý, nhưng đo ra thế này:
 *
 *   video câm, 720p, dán watermark .......... 1 credit =  4.300₫  (không ai đăng)
 *   video có giọng .......................... 2 credit =  8.600₫  (thực tế mọi video)
 *   video 1080p, có giọng, không watermark .. 4 credit = 18.429₫  (thứ khách muốn)
 *
 * Tức "từ 1 credit/video" chỉ đúng với thứ không ai dùng, còn giá thật để có một video
 * đăng được là gấp 4,3 lần con số quảng cáo.
 *
 * ── Vì sao phụ phí không đáng giữ ──
 *
 * Chi phí biến đổi đo thật là **332₫/video**, bằng 0,26% của gói Starter 129.000₫.
 * Chi phí cố định 2,59 triệu/tháng áp đảo hoàn toàn. Tính ra:
 *
 *   bảng cũ, video dùng được (18.429₫) ... cần bán 21 gói/tháng
 *   bảng này, video 30 giây  (4.300₫) .... cần bán 22–24 gói/tháng
 *
 * Giảm giá hơn bốn lần chỉ tốn thêm vài gói bán mỗi tháng. Phụ phí "có giọng đọc"
 * tính thêm 4.300₫ cho một khoản tốn 170₫ — và nó nhân đôi giá niêm yết để đổi lấy
 * gần như không gì.
 *
 * ── Vì sao mốc 15 giây ──
 *
 * aidancing.net trừ **0,12 credit mỗi giây**, giá 2.500₫/credit (10 USD = 104 credit,
 * đo ngày 30/10). Thành ra video 20 giây của họ là 5.887₫. Họ **sinh** video bằng
 * diffusion trên GPU; Viprosell chỉ **ghép** ảnh tĩnh, rẻ hơn hàng chục lần để chạy —
 * nên để họ rẻ hơn mình là vô lý.
 *
 * Mốc 15 giây cho giá Starter 2.150₫ (15s) và 4.300₫ (30s), tức rẻ hơn họ 51% ở mọi
 * thời lượng, và vẫn rẻ hơn ở mọi điểm sát ranh giới bậc.
 *
 * Bậc cũng dễ bán hơn bảng của họ: "1 video = 1 credit" thắng "1,2 / 1,8 / 2,4 / 3,0"
 * trên mọi trang giá.
 *
 * ── Vì sao không dùng 0,5 credit ──
 *
 * `credit_ledger.delta`, `balance_after` và `plans.credits` đều là INTEGER. Thay vì
 * đổi kiểu cột tiền, nhân đôi cả thang: gói Starter 60 credit thay vì 30. Giá mỗi
 * video y hệt, và số dư cũ giữ nguyên ý nghĩa — video 20 giây có giọng trước đây
 * 2 credit, theo bảng này vẫn 2 credit.
 *
 * ── Còn độ phân giải và watermark thì sao ──
 *
 * Chúng thành **quyền của gói**, không phải phụ phí mỗi lần dựng: Free thì 720p và có
 * watermark, gói trả tiền thì không. Khách trả tiền rồi thì không phải trả lần nữa cho
 * cùng một thứ.
 */

export interface RenderSpec {
  durationSec: number;
  /**
   * Giữ lại để không phải sửa mọi nơi đang dựng spec, nhưng KHÔNG còn ảnh hưởng giá —
   * độ phân giải giờ là quyền của gói. Xem phần đầu file.
   */
  resolution?: '720p' | '1080p';
  /** Giữ lại cho tương thích; không còn ảnh hưởng giá. */
  voice?: boolean;
  /** Giữ lại cho tương thích; không còn ảnh hưởng giá. */
  watermark?: boolean;
}

/** Mỗi khối thời lượng tốn 1 credit. */
export const GIAY_MOI_CREDIT = 15;

/** Thời lượng mặc định khi đơn hàng không nói rõ. */
export const BASE_DURATION_SEC = 20;

/** Video ngắn nhất vẫn tốn 1 credit. */
export const BASE_CREDITS = 1;

/**
 * Số credit cho một lần dựng: 1 credit cho mỗi 15 giây BẮT ĐẦU.
 *
 *   ≤ 15 giây → 1    ≤ 30 giây → 2    ≤ 45 giây → 3    ≤ 60 giây → 4
 *
 * Luôn trả về số nguyên ≥ 1: dữ liệu hỏng cũng không được cho ra 0 credit, vì 0 nghĩa
 * là dựng miễn phí không giới hạn.
 */
export function creditsFor(spec: Partial<RenderSpec> | null | undefined): number {
  const duration = Number((spec ?? {}).durationSec);
  const giay = Number.isFinite(duration) && duration > 0 ? duration : BASE_DURATION_SEC;
  return Math.max(BASE_CREDITS, Math.ceil(giay / GIAY_MOI_CREDIT));
}

/**
 * Suy ra RenderSpec từ ĐƠN KHÁCH ĐẶT, không từ thứ AI dựng ra.
 *
 * Đây là cách tính đúng, và `specFromRender` bên dưới chỉ còn là đường lui cho các
 * dòng render cũ không có `raw_input`.
 *
 * Vì sao phải đổi: `specFromRender` lấy thời lượng từ timeline của kế hoạch dựng, tức
 * là từ thứ AI sinh ra. Khách đặt 20 giây mà kế hoạch ra 21 giây thì có thể nhảy bậc
 * — **đắt thêm vì một giây**, do máy quyết chứ không phải do khách. Không báo trước
 * được, không kiểm soát được, và không giải thích được khi khách hỏi.
 *
 * Giờ chỉ còn MỘT yếu tố tính giá, và nó nằm trọn trong lựa chọn của khách: thời lượng.
 * Nên giá báo trước và giá trừ thật luôn bằng nhau.
 */
export function specFromRequest(
  rawInput: { duration_seconds?: unknown } | null | undefined,
  renderMode: string | null | undefined
): RenderSpec {
  const mode = String(renderMode ?? '');
  const dat = Number((rawInput ?? {}).duration_seconds);

  return {
    durationSec: Number.isFinite(dat) && dat > 0 ? dat : BASE_DURATION_SEC,
    // Ba trường dưới không còn ảnh hưởng giá, nhưng vẫn điền đúng để sổ cái và
    // nhật ký còn đọc được chuyện gì đã xảy ra.
    resolution: mode === 'premium_cloud' ? '1080p' : '720p',
    voice: mode === 'draft_local_tts' || mode === 'premium_cloud',
    watermark: true,
  };
}

/**
 * Suy ra RenderSpec từ một dòng `renders` và kế hoạch dựng.
 *
 * CHỈ dùng cho dòng cũ không có `raw_input`. Việc tính giá theo đầu ra của AI là sai
 * về nguyên tắc — xem `specFromRequest` ở trên.
 */
export function specFromRender(
  render: { render_mode?: string | null; aspect_ratio?: string | null } | null | undefined,
  plan?: { export?: { resolution?: string } | null; timeline?: Array<{ end_sec?: number }> | null } | null
): RenderSpec {
  const mode = String(render?.render_mode ?? '');
  const resolution: '720p' | '1080p' =
    /1920|1080x|1080p/.test(String(plan?.export?.resolution ?? '')) ? '1080p' : '720p';

  const timeline = plan?.timeline ?? [];
  const durationSec = timeline.length
    ? Math.max(...timeline.map((t) => Number(t?.end_sec) || 0))
    : BASE_DURATION_SEC;

  return {
    durationSec: durationSec > 0 ? durationSec : BASE_DURATION_SEC,
    resolution,
    voice: mode === 'draft_local_tts' || mode === 'premium_cloud',
    watermark: true,
  };
}

export interface DongGiai {
  /** Nhãn hiện cho khách. */
  nhan: string;
  /** Số credit dòng này cộng vào. */
  credit: number;
}

/**
 * Bóc tách số credit thành từng khoản, để khách thấy TẠI SAO lại là con số đó.
 *
 * Dùng chung một hàm cho giao diện báo giá và cho ghi chú trong sổ cái: hai nơi giải
 * thích khác nhau về cùng một lần trừ tiền là cách nhanh nhất để mất lòng tin.
 *
 * Tổng các dòng ở đây LUÔN bằng `creditsFor(spec)` — có test canh.
 *
 * Giờ chỉ còn một dòng, và đó là điều tốt: bảng giá nào cần ba dòng để giải thích một
 * con số thì bảng đó đang giấu gì đó.
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
 * Các mốc thời lượng hiện cho khách chọn, kèm số credit tương ứng.
 *
 * Một nguồn duy nhất cho cả giao diện tạo dự án lẫn trang kịch bản: hai chỗ cho khách
 * chọn thời lượng mà hiện hai bảng giá khác nhau là cách nhanh nhất để mất lòng tin.
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
