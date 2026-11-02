/**
 * Viprosell — Nâng độ phân giải ảnh sản phẩm trước khi dựng
 *
 * ── Vì sao đây là việc đáng làm nhất cho chất lượng ──
 *
 * Đo ngày 30/10 trên 40 ảnh khách đã tải lên: trung vị chiều ngắn **1024px**, nhỏ
 * nhất 300px, và chỉ **16/40** đủ pixel để cắt cận `detail_macro` (1,28×) mà vẫn nét
 * ở khung 1080.
 *
 * Đo mất nét khi cắt cận, so với cùng ảnh ở 2400px (SSIM):
 *
 *      600px → 0,9101        1024px → 0,9677        1382px → 0,9811
 *      800px → 0,9281        1200px → 0,9633        2000px → 0,9909
 *
 * Để so sánh: lần chọn bộ mã hoá ngày 29/10, tôi lấy `faster+CRF16` thay
 * `veryfast+4M` cho chênh lệch SSIM **0,0024**. Khoảng cách giữa 1024px và 2000px là
 * **0,023** — gấp mười lần. Mọi tinh chỉnh ở bộ mã hoá đều nhỏ hơn thứ này một bậc.
 *
 * ── Lợi ích kép ──
 *
 * Ảnh 1024px chỉ gánh được 2 cảnh trông khác nhau (góc rộng + lia dọc). Vượt 1382px
 * thì cắt cận dùng được, thành 3 cảnh. Ba tấm ảnh vì thế mở được mốc **30 giây thay
 * vì 20** — vừa nét hơn vừa bán được mốc dài hơn. Xem `lib/credit-cost.ts`.
 *
 * ── Vì sao KHÔNG dùng lanczos ──
 *
 * Phép đo SSIM ở trên ĐÃ phóng bằng lanczos rồi. Phóng tuyến tính không thêm thông
 * tin nào — nó chỉ trải cùng số pixel ra rộng hơn. Muốn hơn thì phải có mô hình đoán
 * được chi tiết, tức Real-ESRGAN hoặc tương đương.
 *
 * Nên file này KHÔNG có "đường lui bằng lanczos": không có bộ nâng thật thì trả về
 * ảnh gốc và nói rõ, chứ không giả vờ đã nâng.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Chiều ngắn tối thiểu để cắt cận `detail_macro` 1,28× vẫn nét ở khung 1080.
 *
 * `1080 × 1,28 = 1382`. Giữ đồng bộ với `PX_CHO_CAN_CANH` trong `credit-cost.ts` —
 * có phép kiểm canh hai bên không lệch nhau.
 */
export const PX_CAN_CO = 1382;

/**
 * Dưới mức này thì nâng lên cũng vô ích.
 *
 * Real-ESRGAN phóng 4×, nên ảnh phải có ít nhất `1382 / 4 = 346px` mới chạm ngưỡng.
 * Thấp hơn nữa là ảnh thumbnail, và đoán chi tiết từ đó chỉ ra bề mặt nhựa bóng chứ
 * không ra sản phẩm thật.
 */
export const PX_TOI_THIEU = Math.ceil(PX_CAN_CO / 4);

/** Trần đầu ra: cao hơn nữa chỉ tốn thời gian, khung dựng chỉ 1080–1920. */
export const PX_TRAN = 2400;

export interface KetQuaNang {
  /** Đường dẫn ảnh dùng để dựng — ảnh đã nâng, hoặc chính ảnh gốc. */
  duongDan: string;
  /** Đã thật sự nâng hay chưa. */
  daNang: boolean;
  /** Lý do không nâng, để ghi nhật ký. Rỗng khi đã nâng. */
  lyDo: string;
}

/** Đường dẫn bộ nâng ảnh; để trống thì tính năng tắt hẳn. */
export function duongBoNang(): string {
  return String(process.env.NANG_ANH_BIN ?? '').trim();
}

/**
 * Tên mô hình cho `realesrgan-ncnn-vulkan`.
 *
 * `realesrgan-x4plus` là mô hình ẢNH THẬT. Mặc định của binary là
 * `realesr-animevideov3` — mô hình cho tranh vẽ, áp lên ảnh sản phẩm thì nó làm phẳng
 * vân vải và bề mặt da thành mảng màu trơn.
 */
function tenMoHinh(): string {
  return String(process.env.NANG_ANH_MODEL ?? 'realesrgan-x4plus').trim();
}

/**
 * Thư mục chứa model, tính TUYỆT ĐỐI từ vị trí binary.
 *
 * `-m` mặc định là `models`, và binary hiểu đường dẫn đó theo THƯ MỤC LÀM VIỆC của
 * tiến trình gọi nó — tức thư mục gốc của worker, nơi không có `models` nào. Thiếu
 * tham số này thì binary báo "find_blob_index_by_name ... failed" rồi thoát khác 0, và
 * mọi ảnh lặng lẽ không được nâng.
 */
function thuMucModel(): string {
  const tuBien = String(process.env.NANG_ANH_MODELS ?? '').trim();
  if (tuBien) return tuBien;
  return path.join(path.dirname(duongBoNang()), 'models');
}

/**
 * Có nên nâng tấm ảnh này không, dựa trên chiều ngắn của chính nó.
 *
 * Tách riêng để kiểm được mà không cần chạy binary nào.
 */
export function canNang(canhNgan: number | null | undefined): { nen: boolean; lyDo: string } {
  const px = Number(canhNgan);
  if (!Number.isFinite(px) || px <= 0) {
    return { nen: false, lyDo: 'khong do duoc kich thuoc' };
  }
  if (px >= PX_CAN_CO) {
    return { nen: false, lyDo: `da du net (${Math.round(px)}px >= ${PX_CAN_CO}px)` };
  }
  if (px < PX_TOI_THIEU) {
    return { nen: false, lyDo: `qua nho (${Math.round(px)}px < ${PX_TOI_THIEU}px), nang len cung khong du` };
  }
  return { nen: true, lyDo: '' };
}

/**
 * Nâng một tấm ảnh. Không bao giờ ném lỗi.
 *
 * Nâng hỏng thì trả về ảnh gốc: một tấm ảnh hơi mềm vẫn dựng được video, còn ném lỗi
 * ở đây là giết cả lần dựng vì một bước làm đẹp.
 */
export async function nangAnh(
  duongVao: string,
  canhNgan: number | null | undefined,
  thuMucRa: string
): Promise<KetQuaNang> {
  const bin = duongBoNang();
  if (!bin) {
    return { duongDan: duongVao, daNang: false, lyDo: 'chua dat NANG_ANH_BIN' };
  }

  const xet = canNang(canhNgan);
  if (!xet.nen) return { duongDan: duongVao, daNang: false, lyDo: xet.lyDo };

  const ten = path.basename(duongVao).replace(/\.[^.]+$/, '');
  const ra = path.join(thuMucRa, `${ten}_nang.png`);

  const xong = await new Promise<boolean>((resolve) => {
    // `-s 4` phóng 4×; khổ thừa được hạ về `PX_TRAN` ở bước chuẩn hoá phía sau.
    const p = spawn(bin, [
      '-i', duongVao, '-o', ra,
      '-n', tenMoHinh(),
      '-m', thuMucModel(),
      '-s', '4',
    ], {
      // Bộ nâng in tiến độ ra stderr liên tục; nuốt đi để nhật ký worker còn đọc được.
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const hetGio = setTimeout(() => { try { p.kill(); } catch { /* da chet */ } resolve(false); }, 120_000);
    p.on('error', () => { clearTimeout(hetGio); resolve(false); });
    p.on('close', (ma) => { clearTimeout(hetGio); resolve(ma === 0); });
  });

  if (!xong || !fs.existsSync(ra) || fs.statSync(ra).size === 0) {
    return { duongDan: duongVao, daNang: false, lyDo: 'bo nang chay hong' };
  }
  return { duongDan: ra, daNang: true, lyDo: '' };
}
