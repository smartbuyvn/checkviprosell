/**
 * Viprosell — Bố cục chữ trên video
 *
 * ── Vì sao tách ra file riêng ──
 *
 * Hệ thống có HAI luồng dựng: ảnh sản phẩm (`render.worker.ts`) và clip tự quay
 * (`video-edit.job.ts`). Mỗi luồng tự tính cỡ chữ và lề của riêng nó, nên cùng một
 * khách bấm hai nút khác nhau thì được hai bố cục khác nhau — và mọi lần chỉnh bố cục
 * chỉ sửa được một nửa hệ thống.
 *
 * Đo ngày 30/10: luồng ảnh dùng Montserrat với chữ neo mép dưới; luồng clip dùng
 * Arial với `overlayMarginV = 0,17·h` và `subMarginV = 0,18·h` — hai lề cách nhau 1%
 * chiều cao, tức tiêu đề đè gần trùng lên phụ đề kể từ khi Overlay đổi sang neo mép
 * dưới (alignment 8 → 2).
 *
 * Giờ cả hai luồng đọc chung file này.
 */

/**
 * Font cho phụ đề.
 *
 * Máy nào không có Montserrat thì đặt `ASS_FONT_NAME='Arial'` — Windows nào cũng có
 * và đủ dấu tiếng Việt.
 */
export const FONT_CHU =
  process.env.ASS_FONT_NAME || (process.platform === 'win32' ? 'Montserrat' : 'DejaVu Sans');

export interface BoCucChu {
  overlayFontSize: number;
  subFontSize: number;
  /** Khoảng cách từ MÉP DƯỚI lên, cho tiêu đề (px). */
  overlayMarginV: number;
  /** Khoảng cách từ MÉP DƯỚI lên, cho phụ đề (px). */
  subMarginV: number;
  /** Lề trái/phải — vùng an toàn, giữ chữ không chạm mép (px). */
  marginH: number;
}

/**
 * Cỡ chữ và lề cho một khung hình, tính theo TỈ LỆ khung chứ không viết cứng.
 *
 * ── Cỡ chữ ──
 *
 * Bản cũ đặt 52 và 30 cho mọi khung hình. Trên 1080 bề ngang, 30 chỉ là 2,8% — quá
 * nhỏ để đọc lướt trên điện thoại, và khung 1:1 hay 16:9 thì chữ còn nhỏ hơn nữa so
 * với khung.
 *
 * Mức chọn: tiêu đề 6,5% bề ngang (70px tại 1080), phụ đề 4,2% (45px) — khoảng
 * caption của TikTok và Reels, đủ to để đọc lướt mà chưa che mất sản phẩm.
 *
 * ── Phần tư dưới, và vì sao chỉ khung DỌC mới phải chừa ──
 *
 * Quy tắc 25% lấy từ hướng dẫn video dọc: TikTok, Reels và Shorts đều đặt chú thích,
 * tên tài khoản và nút hành động ở phần tư dưới của khung 9:16.
 *
 * Nhưng video 1:1 hay 16:9 đăng lên những ứng dụng đó thì được LỒNG KHUNG — lớp phủ
 * nằm trên dải đen Ở DƯỚI video, không đè lên nội dung. Chừa lại một phần tư chiều
 * cao của khung vuông là chừa chỗ cho một thứ không bao giờ tới, và đẩy chữ lên giữa
 * ảnh sản phẩm.
 *
 * Đo thật ngày 30/10 trên khung 1080×1080: tiêu đề nằm ở 61% tính từ đỉnh, cắt ngang
 * thân váy. Sau khi sửa: cụm chữ nằm ở 70–93%, gọn dưới chân.
 *
 * ── Khoảng cách tiêu đề ↔ phụ đề ──
 *
 * Vẫn phải chừa đủ hai dòng phụ đề — phụ đề neo mép dưới và mọc lên, nên thiếu chỗ là
 * nó chui lên đè vào tiêu đề.
 *
 * Nhưng khoảng thở thì bản cũ lấy 2% chiều cao khung: trên khung dọc 1920 là 38px,
 * cộng với hai dòng thành một khoảng trống rõ rệt giữa hai cụm chữ. Chữ của cùng một
 * video phải đọc như MỘT cụm, nên khoảng thở buộc phải tỉ lệ với CỠ CHỮ — 0,3 lần cỡ
 * chữ, tức sát nhau nhưng không dính.
 *
 * ── Lề hai bên ──
 *
 * Cột nút của TikTok (thích, bình luận, chia sẻ) và nút hành động của Shorts đều nằm
 * ở CẠNH PHẢI. 13% mỗi bên: chữ nằm gọn trong 74% giữa khung. Giữ đối xứng thay vì
 * lùi riêng bên phải — phụ đề căn giữa mà lề lệch thì nhìn ra ngay.
 */
/**
 * Bề ngang trung bình một ký tự chiếm, tính theo cỡ chữ.
 *
 * Đo thật ngày 30/10: dựng bốn câu tiếng Việt ở cỡ 45px trên khung rộng không lề, rồi
 * lấy khung bao bằng `cropdetect`:
 *
 *     49 ký tự →  868px → 0,394 × cỡ chữ
 *     25 ký tự →  468px → 0,416
 *     20 ký tự →  402px → 0,447
 *     50 ký tự →  956px → 0,425      trung bình **0,420**
 *
 * Lấy 0,44 chứ không lấy 0,420: ước THIẾU số dòng thì phụ đề tràn lên đè vào tiêu đề,
 * còn ước THỪA thì chỉ dư một khoảng trống. Sai về phía an toàn.
 */
export const BE_RONG_KY_TU = 0.44;

/**
 * Số dòng một câu phụ đề sẽ chiếm sau khi libass tự ngắt trong phạm vi lề.
 *
 * Kẹp ở 2: quá hai dòng thì chữ chiếm gần nửa khung, và tầng 3 vốn đã giới hạn độ dài
 * lời thoại theo thời lượng cảnh.
 */
export function uocSoDong(text: string, coChu: number, beRongDung: number): number {
  const chu = String(text ?? '').trim();
  if (!chu) return 1;
  const moiDong = Math.max(8, Math.floor(beRongDung / (coChu * BE_RONG_KY_TU)));
  return Math.max(1, Math.min(2, Math.ceil(chu.length / moiDong)));
}

/**
 * `soDongPhuDe`: số dòng THẬT SỰ cần chừa chỗ, tính từ chính các câu sắp hiện.
 *
 * Bản trước luôn chừa hai dòng. Khi phụ đề chỉ có một dòng — trường hợp thường gặp —
 * dòng chừa thừa biến thành một khoảng trống nhìn thấy được giữa tiêu đề và phụ đề.
 * Đo trên khung 1080×1080: khoảng trống đó là 56px, đúng bằng một dòng.
 *
 * Để trống thì vẫn chừa hai dòng, vì thiếu chỗ nguy hiểm hơn thừa chỗ: phụ đề neo mép
 * dưới và mọc LÊN, nên thiếu là nó chui lên đè vào tiêu đề.
 */
export function boCucChu(
  width: number,
  height: number,
  opts: { soDongPhuDe?: number } = {}
): BoCucChu {
  const overlayFontSize = Math.round(width * 0.065);
  const subFontSize = Math.round(width * 0.042);

  const khungDoc = height / width >= 1.5;

  /**
   * Lần hạ thứ hai cho khung KHÔNG dọc, ngày 30/10.
   *
   * Mức 0,05 vẫn còn một dải trống gần 7% chiều cao dưới chân chữ. Trên khung dọc dải
   * đó là chỗ TikTok đặt caption nên phải chừa; trên khung vuông thì video được lồng
   * vào khung 9:16, lớp phủ nằm trên dải đen BÊN DƯỚI video, nên dải trống ấy không
   * phục vụ gì — nó chỉ đẩy chữ lên khỏi mép.
   *
   * 0,02 giữ lại đúng một khoảng thở để chữ không dính mép khung.
   */
  const phanTuDuoi = khungDoc ? 0.25 : 0.02;
  const subMarginV = Math.round((phanTuDuoi + 0.01) * height);

  /**
   * Khoảng thở giữa tiêu đề và phụ đề: 0,15 lần cỡ chữ.
   *
   * Hành trình qua ba lần: 2% chiều cao khung → 0,3 lần cỡ chữ → mức này. Vẫn phải
   * chừa đủ hai dòng phụ đề bên dưới, vì phụ đề neo mép dưới và mọc LÊN — thiếu chỗ
   * là nó chui lên đè vào tiêu đề.
   *
   * Dưới 0,1 thì hai cụm bắt đầu dính nhau khi phụ đề tràn hai dòng.
   */
  const soDong = Math.max(1, Math.min(2, Math.round(Number(opts.soDongPhuDe) || 2)));
  const khoiPhuDe = Math.round(subFontSize * 1.25 * soDong);
  const khoangTho = Math.round(subFontSize * 0.15);

  return {
    overlayFontSize,
    subFontSize,
    subMarginV,
    overlayMarginV: subMarginV + khoiPhuDe + khoangTho,
    marginH: Math.round(0.13 * width),
  };
}
