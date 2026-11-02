/**
 * Nhận diện lỗi "hàm Postgres này chưa tồn tại" từ PostgREST.
 *
 * ── Vì sao cần một hàm riêng cho việc này ──
 *
 * Mã gọi một hàm RPC phải phân biệt được ba chuyện rất khác nhau:
 *
 *   1. Hàm chưa tồn tại (migration chưa chạy) → có thể lùi về đường cũ.
 *   2. Hàm có nhưng gọi lỗi (mất mạng, hết quyền, deadlock) → KHÔNG được lùi, vì đường
 *      cũ cũng không chữa được, và lùi chỉ che mất lỗi thật.
 *   3. Hàm chạy xong và trả về kết quả "không được" → đó là câu trả lời, không phải lỗi.
 *
 * Lẫn (1) với (2) là lỗi tốn kém nhất, nhất là trên đường tiền: một sự cố mạng sẽ âm
 * thầm kéo hệ thống về lối kém an toàn, mà log lại nói "thiếu hàm" nên người đọc log đi
 * sửa sai chỗ.
 *
 * ── Vì sao bắt buộc khớp TÊN hàm ──
 *
 * PostgREST trả cùng mã `PGRST202` cho mọi hàm bị thiếu. Không kiểm tên thì một hàm
 * khác bị thiếu cũng kéo đường tiền về lối cũ.
 *
 * Đặt ở `lib/` chứ không trong service là có chủ ý: service tạo client Supabase ngay lúc
 * nạp module, nên import nó trong test sẽ vỡ khi không có biến môi trường. Logic thuần
 * phải nằm ở nơi test nạp được một mình.
 */

/** Lỗi do supabase-js trả về. Chỉ cần hai trường này để quyết định. */
export type LoiRpc = { code?: string; message?: string } | null | undefined;

/**
 * True khi `error` đúng là "hàm `tenHam` không tìm thấy trong schema cache".
 *
 * Nhận cả mã `PGRST202` và thông điệp, vì mã có thể đổi theo phiên bản PostgREST còn
 * thông điệp thì ổn định hơn. Nhưng vẫn phải khớp tên hàm — trừ khi không có thông điệp
 * nào, lúc đó chỉ còn mã để tin.
 */
export function thieuHamRpc(error: LoiRpc, tenHam: string): boolean {
  if (!error) return false;

  const thongDiep = String(error.message ?? '');
  const laThieuHam = error.code === 'PGRST202' || /could not find the function/i.test(thongDiep);
  if (!laThieuHam) return false;

  if (thongDiep === '') return true;
  // So khong phan biet chu hoa, va chi tren TEN — thong diep co ca danh sach tham so.
  return thongDiep.toLowerCase().includes(tenHam.toLowerCase());
}
