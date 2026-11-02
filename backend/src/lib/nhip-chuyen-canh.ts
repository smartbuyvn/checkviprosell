/**
 * Viprosell — Nhịp chuyển cảnh
 *
 * ── Vấn đề ──
 *
 * `render-plan.ts` viết cứng:
 *
 *     transition_in: i === 0 ? 'fade' : 'cut',
 *     transition_out: i === scenes.length - 1 ? 'fade' : 'cut',
 *
 * Nên MỌI ranh giới bên trong đều là cắt cứng. Module `transitions.ts` biết dựng
 * `xfade` nhưng chưa bao giờ được yêu cầu làm gì — đo trên render `ea39bbcb` ngày
 * 30/10: sáu cảnh, năm ranh giới, cả năm đều `cut`.
 *
 * Cộng với việc góc máy chỉ xoay giữa hai kiểu phóng to, video thành ra sáu lần
 * phóng ảnh giống hệt nhau, cắt phựt giữa các lần.
 *
 * ── Vì sao không hoà mềm tất cả ──
 *
 * Hoà hết thì video nhão. Dựng phim quảng cáo thật dùng cắt cứng làm chủ đạo — cắt
 * đúng nhịp là một lựa chọn có chủ ý, không phải thiếu sót — và dành chuyển mềm cho
 * những chỗ ĐỔI Ý: từ nêu vấn đề sang giới thiệu sản phẩm, từ sản phẩm sang chốt đơn.
 *
 * ── Nhịp chọn ──
 *
 * Mở bằng `fade` từ màn đen. Đóng bằng `fade` về màn đen. Ở giữa luân phiên theo một
 * khuôn có chu kỳ, để mắt nhận ra là có người dựng chứ không phải máy nối ảnh:
 *
 *     cut → fade → cut → slide → cut → fade → ...
 *
 * Hai phần ba là cắt cứng, một phần ba là chuyển mềm, và chuyển mềm xen kẽ giữa hoà
 * và trượt. Riêng ranh giới NGAY TRƯỚC cảnh cuối luôn là hoà mềm: đó là chỗ vào lời
 * chốt, và một cú hoà ở đấy báo cho người xem biết sắp hết.
 */

/** Tên chuyển cảnh mà `transitions.ts` hiểu. */
export type TenChuyen =
  | 'cut'
  | 'fade'
  | 'slide_left'
  | 'slide_up'
  | 'wipe'
  // Nhóm xoay lật — xem `BANG_XFADE` trong `transitions.ts`.
  | 'lat_ngang'
  | 'lat_doc'
  | 'xuyen_qua'
  | 'he_lo';

/**
 * Khuôn lặp cho các ranh giới ở giữa.
 *
 * Bắt đầu bằng `cut` vì ranh giới đầu tiên (cảnh 0 → 1) đến ngay sau cú fade mở
 * màn — hoà tiếp ở đó là hai hiệu ứng mềm liền nhau, trông lề mề.
 */
const KHUON: TenChuyen[] = [
  'cut',
  'lat_ngang',   // cú lật đầu tiên — mắt nhận ra ngay là có người dựng
  'cut',
  'xuyen_qua',   // đẩy máy vào chi tiết
  'cut',
  'fade',
  'cut',
  'lat_doc',
  'cut',
  'he_lo',
];

export interface NhipCanh {
  transition_in: TenChuyen;
  transition_out: TenChuyen;
}

/**
 * Nhịp chuyển cảnh cho một video `soCanh` cảnh.
 *
 * Trả về một mục cho mỗi cảnh. `transition_in` của cảnh `i` mô tả ranh giới giữa
 * cảnh `i-1` và `i`; `transition_out` của cảnh cuối là cú đóng màn.
 *
 * Video dưới 3 cảnh thì giữ đơn giản: fade mở, fade đóng, ở giữa cắt. Thêm hiệu ứng
 * vào một video hai cảnh chỉ làm nó rối.
 */
export function nhipChuyenCanh(soCanh: number): NhipCanh[] {
  const n = Math.max(0, Math.floor(soCanh));
  if (n === 0) return [];
  if (n === 1) return [{ transition_in: 'fade', transition_out: 'fade' }];

  const ra: NhipCanh[] = [];
  for (let i = 0; i < n; i++) {
    let vao: TenChuyen;

    if (i === 0) {
      // Mở màn từ đen.
      vao = 'fade';
    } else if (n >= 4 && i === n - 1) {
      // Vào lời chốt: luôn hoà mềm, báo cho người xem biết sắp hết.
      vao = 'fade';
    } else if (n < 3) {
      vao = 'cut';
    } else {
      // Ranh giới thứ `i-1` trong khuôn lặp.
      vao = KHUON[(i - 1) % KHUON.length];
    }

    ra.push({
      transition_in: vao,
      transition_out: i === n - 1 ? 'fade' : 'cut',
    });
  }

  return ra;
}

/** Số ranh giới được hoà mềm trong một nhịp. Dùng cho log và test. */
export function demChuyenMem(nhip: NhipCanh[]): number {
  // Ranh giới `i` (giữa cảnh i và i+1) đọc `transition_in` của cảnh i+1.
  let n = 0;
  for (let i = 1; i < nhip.length; i++) {
    if (nhip[i].transition_in !== 'cut') n++;
  }
  return n;
}
