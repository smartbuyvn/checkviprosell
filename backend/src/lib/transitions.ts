/**
 * Viprosell — Chuyển cảnh giữa các cảnh
 *
 * Kế hoạch dựng ĐÃ nói rõ từng cảnh muốn vào bằng gì: `transition_in: "fade"` hoặc
 * `"cut"`. Worker trước 29/10/2026 bỏ qua hoàn toàn — nó chỉ fade ở đầu và cuối
 * video, còn giữa các cảnh là cắt cứng qua `concat`. Đo trên render `a7d667cc`: sáu
 * cảnh, kế hoạch xin fade ở cảnh 1, worker cắt cứng cả sáu.
 *
 * Cắt cứng giữa những tấm ảnh tĩnh zoom chậm chính là thứ làm video trông y như hàng
 * do công cụ AI miễn phí làm ra. Chuyển mềm là khác biệt rẻ nhất mua được.
 *
 * ── Vì sao `xfade` chứ không phải fade-đen từng cảnh ──
 *
 * Cho mỗi cảnh tự mờ ra rồi cảnh sau mờ vào thì giữa hai cảnh có một khoảnh khắc đen.
 * Dễ làm, nhưng trông cũ và làm video có cảm giác rời rạc. `xfade` hoà trực tiếp hai
 * cảnh vào nhau — đó là thứ mắt đọc ra là "dựng chuyên nghiệp".
 *
 * ── Bài toán khó: giữ nguyên mốc thời gian ──
 *
 * `xfade` NUỐT thời gian: hoà hai cảnh 3 giây với overlap 0,4 giây ra 5,6 giây chứ
 * không phải 6. Phụ đề ASS dùng mốc TUYỆT ĐỐI lấy từ kế hoạch, nên mỗi lần nuốt là
 * phụ đề lệch dần — tới cảnh cuối thì chữ chạy trước hình cả giây.
 *
 * Cách giải: kéo dài mỗi cảnh thêm đúng bằng overlap nó nhường cho cảnh sau. Phần kéo
 * dài bị hoà nuốt, nên mọi mốc bắt đầu khớp lại đúng kế hoạch và `offset` của `xfade`
 * chính là `start_sec` của cảnh sau. Phụ đề không phải sửa một con số nào.
 *
 * ── Vì sao cắt cứng cũng đi qua `xfade` ──
 *
 * Trộn `concat` với `xfade` trong cùng một đồ thị làm phép tính mốc thời gian tách
 * làm hai nhánh, và nhánh nào cũng phải đúng. Coi cắt cứng là một lần hoà dài ĐÚNG
 * MỘT KHUNG HÌNH thì mắt không phân biệt được với cắt thật, mà số học chỉ còn một
 * đường duy nhất: mọi ranh giới đều có overlap, mọi cảnh đều được kéo dài.
 */

/** Tên hiệu ứng `xfade` cho từng loại chuyển cảnh mà kế hoạch có thể yêu cầu. */
const BANG_XFADE: Record<string, string> = {
  fade: 'fade',
  dissolve: 'fade',
  crossfade: 'fade',
  fadeblack: 'fadeblack',
  slide_left: 'slideleft',
  slide_right: 'slideright',
  slide_up: 'slideup',
  slide_down: 'slidedown',
  wipe: 'wiperight',

  // ── Nhóm xoay lật, dùng để tôn sản phẩm ──
  //
  // `squeezeh`/`squeezev` ép khung theo một trục rồi mở ra khung mới — mắt đọc
  // thành một cú lật, như xoay một tấm thẻ. Hợp với hàng có hai mặt: áo trước/sau,
  // hộp sản phẩm, bảng thông số.
  //
  // `zoomin` kéo khung sau tiến tới — như máy quay đẩy xuyên qua cảnh. Dùng ở chỗ
  // chuyển từ toàn cảnh sang cận cảnh chi tiết.
  //
  // `circleopen` mở từ tâm ra. Dùng để hé lộ sản phẩm.
  lat_ngang: 'squeezeh',
  lat_doc: 'vertclose',
  xuyen_qua: 'zoomin',
  he_lo: 'circleopen',
  xoay_quanh: 'radial',

  // Tên cũ, giữ để không làm hỏng kế hoạch đã lưu từ trước.
  zoom: 'smoothleft',
};

/**
 * Hiệu ứng `xfade` đã CHẠY THỬ và an toàn trên bản ffmpeg của dự án.
 *
 * ── Vì sao cần danh sách trắng ──
 *
 * Không phải hiệu ứng nào ffmpeg liệt kê cũng chạy được. Thử thật ngày 30/10/2026,
 * mỗi hiệu ứng một lần dựng 6 cảnh ở 1080×1920:
 *
 *   SẬP (SIGSEGV):  squeezev (3/3 lần), vertopen, dissolve
 *   CHẠY ĐƯỢC:      fade, squeezeh, zoomin, circleopen, circleclose, radial,
 *                   vertclose, horzopen, horzclose, pixelize, wipetl, diagtl,
 *                   hblur, slideleft/right/up/down, wiperight
 *
 * Cùng một lớp lỗi với preset x264 `medium` trở lên: ffmpeg nhận tham số, không báo
 * gì, rồi sập giữa chừng. Người dùng chỉ thấy một mã số vô nghĩa.
 *
 * Tên lạ thì lùi về `fade` chứ không truyền thẳng xuống — một hiệu ứng không có
 * trong danh sách này chưa từng được thử, và thử trên máy khách không phải chỗ để thử.
 */
const AN_TOAN = new Set([
  'fade', 'fadeblack', 'fadewhite',
  'slideleft', 'slideright', 'slideup', 'slidedown',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'wipetl', 'wipetr', 'wipebl', 'wipebr',
  'squeezeh',
  'zoomin',
  'circleopen', 'circleclose',
  'radial',
  'vertclose', 'horzopen', 'horzclose',
  'pixelize', 'hblur',
  'diagtl', 'diagtr', 'diagbl', 'diagbr',
  'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
]);

/** Tên hiệu ứng ffmpeg đã kiểm, hoặc `fade` nếu tên đó chưa từng được thử. */
function locAnToan(ten: string, traceId = ''): string {
  if (AN_TOAN.has(ten)) return ten;
  console.warn(`[Chuyen canh] "${ten}" chua duoc thu — lui ve fade${traceId ? ` [${traceId}]` : ''}`);
  return 'fade';
}

/**
 * Thời lượng hoà mềm, giây.
 *
 * 0,35: đủ để mắt đọc ra là chuyển mềm, chưa đủ để sốt ruột. Dưới 0,25 gần như không
 * phân biệt được với cắt; trên 0,5 thì video 20 giây sáu cảnh mất hơn 10% thời lượng
 * cho riêng việc chuyển.
 */
export const THOI_LUONG_HOA = 0.35;

/**
 * Thời lượng "hoà" cho chỗ cắt cứng: một khung hình ở 30fps.
 *
 * Không đặt 0 được — `xfade` đòi duration > 0. Một khung là mức nhỏ nhất vẫn hợp lệ
 * và mắt không thấy.
 */
export const THOI_LUONG_CAT = 0.034;

/**
 * So khung du ra cong them vao moi canh NUOI mot chuyen canh.
 *
 * `xfade` doi dau vao thu nhat DAI HON `offset + duration`, khong chap nhan bang.
 * Keo dai dung bang phan bi nuot la du ve toan hoc nhung khong du ve thuc te: `-t`
 * chi ghi duoc toi phan tram giay, va ffmpeg lam tron so khung XUONG, nen canh that
 * luon ngan hon ke hoach mot chut.
 *
 * Khi dieu kien vo, `xfade` khong bao loi — no tra ve mot luong cut ngun va ffmpeg
 * van thoat 0. Do that ngay 30/10 tren render f1f588fa: 6 canh, ke hoach 21,12 giay,
 * file ra 4,83 giay, khong mot dong canh bao nao.
 *
 * Ba khung (0,1 giay o 30fps) du bu moi sai so lam tron, va vi phan du nam o DUOI
 * `offset` nen `xfade` nuot het — khong moc thoi gian nao doi, khong khung thua nao
 * lot vao video.
 */
export const BIEN_KHUNG_AN_TOAN = 3;

/**
 * So khung ffmpeg phai sinh cho mot canh, da tinh ca phan `xfade` se nuot.
 *
 * Tach rieng khoi worker de phep kiem chay duoc ma khong phai nap ca worker — nap
 * worker la mo ket noi realtime, va bo kiem treo vinh vien cho no dong.
 *
 * `laCanhCuoi` quan trong: canh cuoi khong nuoi chuyen canh nao, nen moi khung du ra
 * deu LOT VAO video that. Chi canh co `keoDai > 0` moi duoc cong bien an toan.
 */
export function soKhungCanh(
  daiKeHoach: number,
  keoDai: number,
  fps: number
): number {
  const can = Math.max(0, daiKeHoach) + Math.max(0, keoDai);
  const bien = keoDai > 0 ? BIEN_KHUNG_AN_TOAN : 0;
  return Math.max(1, Math.ceil(can * fps) + bien);
}

/**
 * Gia tri `-t` cho dau vao anh, du de ffmpeg sinh dung `soKhung` khung.
 *
 * Nua khung du ra: `-t` dat dung `soKhung / fps` van co the ra thieu mot khung vi
 * sai so dau phay dong, va thieu mot khung la du lam sup chuoi `xfade`.
 */
export function tDauVaoCanh(soKhung: number, fps: number): number {
  return (soKhung + 0.5) / fps;
}

export interface RanhGioi {
  /** Chỉ số cảnh đứng TRƯỚC ranh giới này. */
  sau: number;
  /** Tên hiệu ứng truyền cho `xfade`. */
  hieuUng: string;
  /** Thời lượng hoà, giây. */
  thoiLuong: number;
  /** Mốc bắt đầu hoà, tính từ đầu video — chính là `start_sec` của cảnh kế. */
  moc: number;
  /** Đây có phải chuyển mềm thật không, hay chỉ là cắt cứng trá hình. */
  mem: boolean;
}

export interface KeHoachChuyen {
  /** Một phần tử cho MỖI ranh giới giữa hai cảnh. Rỗng khi video chỉ có một cảnh. */
  ranhGioi: RanhGioi[];
  /** Mỗi cảnh phải dựng dài thêm bao nhiêu giây. Phần tử cuối luôn là 0. */
  keoDai: number[];
  /** Có ít nhất một chuyển mềm hay không. Không có thì dùng `concat` cho rẻ. */
  coChuyenMem: boolean;
}

interface MucTimeline {
  start_sec?: number;
  end_sec?: number;
  transition_in?: string | null;
  transition_out?: string | null;
}

/** Thời lượng một mục timeline; 0 khi dữ liệu hỏng. */
function thoiLuong(m: MucTimeline | undefined): number {
  const d = Number(m?.end_sec) - Number(m?.start_sec);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * Chọn hiệu ứng từ hai trường của kế hoạch; `null` nghĩa là cắt cứng.
 *
 * Lấy hợp chứ không lấy giao: model điền một trong hai trường là đủ hiểu ý, bắt cả
 * hai cùng khớp thì hầu hết ranh giới sẽ rơi về cắt cứng.
 *
 * `cut` là ý định rõ ràng, phải tôn trọng — cắt đúng nhịp cũng là một lựa chọn dựng
 * phim, không phải thiếu sót.
 */
function chonHieuUng(
  vao: string | null | undefined,
  ra: string | null | undefined
): string | null {
  for (const ten of [vao, ra]) {
    const k = String(ten ?? '').trim().toLowerCase();
    if (!k || k === 'cut' || k === 'none') continue;
    if (k in BANG_XFADE) return BANG_XFADE[k];
  }
  return null;
}

/**
 * Đọc kế hoạch dựng ra danh sách ranh giới.
 *
 * Cảnh quá ngắn thì hạ thời lượng hoà xuống: hoà 0,35 giây vào một cảnh dài 0,5 giây
 * là gần như không còn lúc nào thấy cảnh đó rõ.
 */
export function lapKeHoachChuyen(
  timeline: MucTimeline[] | null | undefined,
  thoiLuongHoa: number = THOI_LUONG_HOA
): KeHoachChuyen {
  const tl = Array.isArray(timeline) ? timeline : [];
  const ranhGioi: RanhGioi[] = [];
  const keoDai = new Array(Math.max(0, tl.length)).fill(0);

  if (tl.length < 2) return { ranhGioi, keoDai, coChuyenMem: false };

  let coChuyenMem = false;

  for (let i = 0; i < tl.length - 1; i++) {
    const truoc = tl[i];
    const sau = tl[i + 1];

    const ten = chonHieuUng(sau?.transition_in, truoc?.transition_out);
    // Hoà không được dài quá nửa cảnh ngắn hơn.
    const toiDa = Math.min(thoiLuong(truoc), thoiLuong(sau)) / 2;
    const mem = Boolean(ten) && toiDa > THOI_LUONG_CAT;

    const d = mem
      ? Math.max(THOI_LUONG_CAT, Math.min(thoiLuongHoa, toiDa))
      : THOI_LUONG_CAT;

    const moc = Number(sau?.start_sec);
    ranhGioi.push({
      sau: i,
      hieuUng: mem ? ten! : 'fade',
      thoiLuong: Number(d.toFixed(3)),
      moc: Number.isFinite(moc) && moc >= 0 ? moc : 0,
      mem,
    });
    keoDai[i] = Number(d.toFixed(3));
    if (mem) coChuyenMem = true;
  }

  return { ranhGioi, keoDai, coChuyenMem };
}

/**
 * Dựng chuỗi filter `xfade` nối các nhãn cảnh lại.
 *
 * `null` khi không có chuyển mềm nào — người gọi dùng `concat` như cũ, vừa nhanh hơn
 * vừa ít chỗ hỏng hơn.
 *
 * `offset` của `xfade` tính từ đầu chuỗi ĐANG CÓ, mà chuỗi đang có luôn bắt đầu từ
 * giây 0 của video, nên dùng thẳng `start_sec` của cảnh sau.
 */
export function dungChuoiXfade(
  keHoach: KeHoachChuyen,
  nhanCanh: (i: number) => string,
  nhanRa: string
): string[] | null {
  const n = keHoach.ranhGioi.length + 1;
  if (n < 2 || !keHoach.coChuyenMem) return null;

  const buoc: string[] = [];
  let hienTai = nhanCanh(0);

  for (let i = 1; i < n; i++) {
    const r = keHoach.ranhGioi[i - 1];
    const ketQua = i === n - 1 ? nhanRa : `xf${i}`;
    buoc.push(
      `[${hienTai}][${nhanCanh(i)}]xfade=transition=${locAnToan(r.hieuUng)}:` +
      `duration=${r.thoiLuong}:offset=${r.moc.toFixed(3)}[${ketQua}]`
    );
    hienTai = ketQua;
  }

  return buoc;
}
