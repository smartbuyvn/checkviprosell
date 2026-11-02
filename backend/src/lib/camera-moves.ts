/**
 * Viprosell — Bảng góc máy và giới hạn bước zoom
 *
 * Trước đây tầng 4 là một lần gọi LLM: nó tự nghĩ ra `zoom_start`, `zoom_end`,
 * `resolution`, và đã có lần trả "1080x1080" khiến video ra vuông dù khách chọn 9:16.
 * Dịch tên góc máy sang tham số là việc máy móc, không cần model — làm bằng code thì
 * hết tốn token, hết một lớp lỗi JSON, và kết quả đoán trước được.
 *
 * Giới hạn bước zoom mỗi khung là thứ quyết định mượt hay giật: zoompan dịch khung cắt
 * theo bước rời rạc, bước càng nhỏ mắt càng không thấy nhảy.
 */

export type CameraMove =
  | 'hero_push'
  | 'detail_macro'
  | 'reveal_up'
  | 'lifestyle_hold'
  | 'endcard_lock';

export interface CameraParams {
  zoomStart: number;
  zoomEnd: number;
  /** Dịch dọc, tính theo tỉ lệ chiều cao. Dương là bắt đầu thấp hơn rồi đi lên. */
  panYStart: number;
  panYEnd: number;
  /** Bước zoom tối đa mỗi khung hình. Vượt là mắt thấy giật. */
  maxStepPerFrame: number;
  /** Góc này có hoạt ảnh không, hay đứng yên hoàn toàn. */
  animated: boolean;
}

/**
 * Bảng tham số. Các số này bám theo thứ đã chạy thật trên máy render hiện tại.
 *
 * `maxStepPerFrame` khác nhau theo góc vì mắt nhạy với chuyển động khác nhau: cận
 * cảnh phóng to thì một bước nhỏ cũng thấy rõ, nên phải chậm hơn hẳn góc toàn.
 */
/**
 * Trần bước nâng lên gấp ~2,5 lần, chốt 29/10/2026.
 *
 * Trần cũ (0.0008) ép `hero_push` trên cảnh 2 giây xuống còn 1.00→1.048 — mắt gần như
 * không thấy chuyển động, và người bán kêu video "đơn điệu".
 *
 * Trần đó dựng ra để chống GIẬT. Nhưng giật thật ra do `zoompan d=durationFrames` nhân
 * số khung lên 50 lần, không phải do bước zoom lớn — sửa xong lỗi `d` thì trần cũ chỉ
 * còn làm video phẳng mà không đổi lấy gì.
 *
 * Mức mới cho `hero_push` đi trọn 1.00→1.12 trên cảnh 2 giây (60 khung × 0.002 = 0.12),
 * tức Ken Burns 12% — đúng mức phim quảng cáo thật dùng.
 */
export const CAMERA_TABLE: Record<CameraMove, CameraParams> = {
  hero_push:      { zoomStart: 1.00, zoomEnd: 1.12, panYStart: 0,    panYEnd: 0, maxStepPerFrame: 0.0020, animated: true },
  detail_macro:   { zoomStart: 1.18, zoomEnd: 1.28, panYStart: 0,    panYEnd: 0, maxStepPerFrame: 0.0010, animated: true },
  reveal_up:      { zoomStart: 1.08, zoomEnd: 1.08, panYStart: 0.06, panYEnd: 0, maxStepPerFrame: 0.0020, animated: true },
  lifestyle_hold: { zoomStart: 1.00, zoomEnd: 1.05, panYStart: 0,    panYEnd: 0, maxStepPerFrame: 0.0008, animated: true },
  endcard_lock:   { zoomStart: 1.00, zoomEnd: 1.00, panYStart: 0,    panYEnd: 0, maxStepPerFrame: 0,      animated: false },
};

/** Tên góc máy cũ trong schema tầng 3 → góc máy mới. Giữ tương thích ngược. */
const ALIAS: Record<string, CameraMove> = {
  zoom_in: 'hero_push',
  push_in: 'hero_push',
  zoom_out: 'lifestyle_hold',
  pan_up: 'reveal_up',
  pan_left: 'reveal_up',
  pan_right: 'reveal_up',
  static: 'endcard_lock',
};

/**
 * MỌI tên góc máy hệ thống chấp nhận: bộ mới cộng bộ cũ qua ALIAS.
 *
 * Xuất ra để `validators.ts` đọc thẳng từ đây thay vì giữ một danh sách riêng.
 *
 * Hai danh sách song song là thứ đã làm hỏng render ngày 28/10: tôi thêm bộ tên mới
 * (`hero_push`, `detail_macro`…) vào bảng này, `buildRenderPlan` phát ra chúng, nhưng
 * validator vẫn chỉ nhận bộ cũ — nên kế hoạch render tự trượt cổng kiểm của chính nó
 * với sáu dòng lỗi "is not supported".
 */
export const SUPPORTED_CAMERA_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(CAMERA_TABLE),
  ...Object.keys(ALIAS),
]);

export function normalizeCamera(name: string | null | undefined): CameraMove {
  const s = String(name ?? '').trim();
  if (s in CAMERA_TABLE) return s as CameraMove;
  if (s in ALIAS) return ALIAS[s];
  return 'hero_push';
}

export interface ResolvedMove extends CameraParams {
  move: CameraMove;
  /** True khi phải hạ biên độ zoom vì cảnh quá ngắn. */
  clamped: boolean;
}

/**
 * Tham số cuối cho một cảnh, đã ép về trong giới hạn bước.
 *
 * Cảnh ngắn mà biên độ zoom giữ nguyên thì bước mỗi khung lớn lên — đó chính là lúc
 * giật. Thay vì để vậy, hạ biên độ xuống cho vừa số khung có được: thà phóng ít hơn
 * mà mượt còn hơn phóng đủ mà giật.
 */
export function resolveMove(name: string | null | undefined, durationFrames: number): ResolvedMove {
  const move = normalizeCamera(name);
  const p = CAMERA_TABLE[move];

  // NaN khong lot duoc qua `durationFrames <= 1` (moi so sanh voi NaN deu false),
  // nen phai kiem Number.isFinite rieng — khong thi buocToiDa thanh NaN va zoomEnd
  // thanh NaN, roi ffmpeg nhan 'zoom=NaN' va canh do den thui.
  if (!p.animated || !Number.isFinite(durationFrames) || durationFrames <= 1) {
    return { ...p, move, clamped: false };
  }

  const bienDo = Math.abs(p.zoomEnd - p.zoomStart);
  const buocToiDa = p.maxStepPerFrame * durationFrames;

  // So sanh co dung sai: 1.12 - 1.00 ra 0.12000000000000011, con 0.0008 x 150 ra
  // dung 0.12. Khong co EPS thi canh dai vua du van bi ep xuong vo co.
  const EPS = 1e-9;
  if (bienDo <= buocToiDa + EPS) return { ...p, move, clamped: false };

  const huong = p.zoomEnd >= p.zoomStart ? 1 : -1;
  // LAM TRON XUONG, khong lam tron gan nhat: lam tron len la vuot gioi han buoc,
  // dung cai thu nay sinh ra de tranh.
  const buocLamTron = Math.floor(buocToiDa * 10000) / 10000;
  return {
    ...p,
    move,
    zoomEnd: p.zoomStart + huong * buocLamTron,
    clamped: true,
  };
}

/**
 * Chọn góc máy cho từng cảnh sao cho KHÔNG lặp lại liên tiếp.
 *
 * Toàn bộ video dùng một góc là dấu hiệu nghiệp dư rõ nhất — và đó đúng là thứ đã xảy
 * ra ngày 28/10: cả 30 giây chỉ một ảnh phóng to dần. Prompt đã dặn model đa dạng hoá,
 * đây là lớp bảo đảm cuối: model vẫn lặp thì code đổi.
 */
/**
 * Rải ảnh ra các cảnh sao cho KHÔNG lặp lại liên tiếp và dùng hết số ảnh đang có.
 *
 * Model hay chọn một ảnh cho phần lớn cảnh: đo thật ngày 29/10 trên một video có 3 ảnh
 * — `image_1` dùng ở **4/6 cảnh**. Cộng với zoom gần như không thấy, video thành ra một
 * tấm ảnh tĩnh kéo dài 20 giây.
 *
 * Giữ lựa chọn của model khi nó đã rải đều; chỉ can thiệp chỗ lặp liên tiếp hoặc chỗ
 * còn ảnh chưa được dùng. Prompt tầng 3 đã dặn đa dạng hoá — đây là lớp bảo đảm cuối.
 */
export function spreadAssets(refs: Array<string | null | undefined>, available: string[]): string[] {
  if (available.length === 0) return refs.map((r) => String(r ?? ''));
  if (available.length === 1) return refs.map(() => available[0]);

  const ketQua: string[] = [];
  const demDung = new Map<string, number>(available.map((a) => [a, 0]));

  for (let i = 0; i < refs.length; i++) {
    const muon = String(refs[i] ?? '');
    const hopLe = available.includes(muon);
    const truoc = i > 0 ? ketQua[i - 1] : null;

    const ungVien = available.filter((a) => a !== truoc);
    const itNhat = Math.min(...ungVien.map((a) => demDung.get(a) ?? 0));

    // Giữ lựa chọn của model CHỈ KHI nó chưa được dùng nhiều hơn các ảnh khác.
    //
    // Chỉ kiểm "khác cảnh trước" là chưa đủ: model dồn hết vào một ảnh thì ảnh đó vẫn
    // chiếm mọi ô xen kẽ (a,b,a,c,a,b,a — a dùng 5/9 lần). Phải so với mức dùng của
    // các ảnh còn lại thì mới rải đều thật.
    const giuDuoc = hopLe && muon !== truoc && (demDung.get(muon) ?? 0) <= itNhat;

    const chon = giuDuoc
      ? muon
      // Ảnh ÍT DÙNG NHẤT trong số ảnh khác cảnh trước — mọi ảnh đều lên hình, thay vì
      // xoay vòng cứng theo thứ tự.
      : ungVien.reduce((a, b) => ((demDung.get(a) ?? 0) <= (demDung.get(b) ?? 0) ? a : b));

    demDung.set(chon, (demDung.get(chon) ?? 0) + 1);
    ketQua.push(chon);
  }

  return ketQua;
}

export function diversify(moves: Array<string | null | undefined>): CameraMove[] {
  /**
   * Rải góc máy ra KHẮP bảng, không chỉ tránh trùng cảnh liền trước.
   *
   * Bản cũ chỉ đổi khi góc trùng đúng cảnh ngay trước, rồi luôn lấy phần tử ĐẦU của
   * danh sách luân phiên — nên nó xoay giữa đúng hai góc. Đo thật trên render
   * `ea39bbcb` ngày 30/10:
   *
   *   hero_push, detail_macro, hero_push, detail_macro, hero_push, hero_push
   *
   * Cả hai góc đó đều là phóng to thuần, nên video thành ra sáu lần phóng ảnh giống
   * hệt nhau — đúng lời khách: "chuyển cảnh chỉ là phóng to ảnh dần". `reveal_up`
   * (lia dọc) và `lifestyle_hold` chưa bao giờ tới lượt.
   *
   * Cách mới dùng chung ý với `spreadAssets`: giữ lựa chọn của model CHỈ KHI góc đó
   * chưa được dùng nhiều hơn các góc khác. Nhờ vậy mọi góc đều lên hình.
   */
  const ketQua: CameraMove[] = [];
  // Mọi góc CÓ chuyển động. `endcard_lock` đứng yên nên để riêng cho cảnh cuối.
  const coDong: CameraMove[] = ['hero_push', 'detail_macro', 'reveal_up', 'lifestyle_hold'];
  const demDung = new Map<CameraMove, number>(coDong.map((m) => [m, 0]));

  for (let i = 0; i < moves.length; i++) {
    const muon = normalizeCamera(moves[i]);
    const laCuoi = i === moves.length - 1;

    // Cảnh cuối là endcard thì tôn trọng: đó là lựa chọn dựng phim có chủ ý.
    if (laCuoi && muon === 'endcard_lock') {
      ketQua.push(muon);
      continue;
    }

    const truoc = i > 0 ? ketQua[i - 1] : null;
    const ungVien = coDong.filter((m) => m !== truoc);
    const itNhat = Math.min(...ungVien.map((m) => demDung.get(m) ?? 0));

    // Giữ ý model khi góc đó khác cảnh trước VÀ chưa bị dùng nhiều hơn góc khác.
    const giuDuoc =
      coDong.includes(muon) && muon !== truoc && (demDung.get(muon) ?? 0) <= itNhat;

    const chon = giuDuoc
      ? muon
      : ungVien.reduce((a, b) => ((demDung.get(a) ?? 0) <= (demDung.get(b) ?? 0) ? a : b));

    demDung.set(chon, (demDung.get(chon) ?? 0) + 1);
    ketQua.push(chon);
  }

  return ketQua;
}
