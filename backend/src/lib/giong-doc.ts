/**
 * Viprosell — Bảng giọng đọc
 *
 * ── Vì sao có file này ──
 *
 * `synthesize()` vốn đã nhận tham số `voice` và tính nó vào khoá cache, nhưng không
 * chỗ nào truyền xuống: worker luôn dùng `VIENEU_VOICE` trong `.env`, nên mọi video
 * của mọi khách đều cùng một giọng.
 *
 * ── Danh sách lấy từ đâu ──
 *
 * Không đoán. Hỏi thẳng nhà cung cấp ngày 30/10/2026 bằng một mã giọng sai, và nó
 * trả về danh sách hợp lệ:
 *
 *     unknown voice 'leminh'. Available: fci_phuongan, fci_xuantoan, std_banmai,
 *     std_kimngan, std_minhquang, std_quanganh, std_vietkhoa
 *
 * Đã chạy thử cả bảy, tất cả đều tổng hợp được (2,59–2,92 giây cho cùng một câu).
 * Giới tính suy từ tên tiếng Việt.
 */

export type GioiTinhGiong = 'nu' | 'nam';

export interface Giong {
  ma: string;
  ten: string;
  gioiTinh: GioiTinhGiong;
  /** Mô tả ngắn cho người bán chọn, không phải thuật ngữ kỹ thuật. */
  moTa: string;
}

/**
 * Bảy giọng nhà cung cấp hỗ trợ.
 *
 * Thứ tự trong mảng là thứ tự ưu tiên: phần tử đầu của mỗi giới tính là mặc định.
 */
export const BANG_GIONG: Giong[] = [
  { ma: 'std_banmai',    ten: 'Ban Mai',    gioiTinh: 'nu',  moTa: 'Nữ miền Bắc, trong và rõ' },
  { ma: 'std_kimngan',   ten: 'Kim Ngân',   gioiTinh: 'nu',  moTa: 'Nữ, ấm và gần gũi' },
  { ma: 'fci_phuongan',  ten: 'Phương An',  gioiTinh: 'nu',  moTa: 'Nữ, nhẹ nhàng' },
  { ma: 'std_minhquang', ten: 'Minh Quang', gioiTinh: 'nam', moTa: 'Nam miền Bắc, chắc tiếng' },
  { ma: 'std_quanganh',  ten: 'Quang Anh',  gioiTinh: 'nam', moTa: 'Nam, trẻ và nhanh' },
  { ma: 'std_vietkhoa',  ten: 'Việt Khoa',  gioiTinh: 'nam', moTa: 'Nam, trầm và điềm đạm' },
  { ma: 'fci_xuantoan',  ten: 'Xuân Toàn',  gioiTinh: 'nam', moTa: 'Nam, rõ từng chữ' },
];

const THEO_MA = new Map(BANG_GIONG.map((g) => [g.ma, g]));

/**
 * Chọn mã giọng từ yêu cầu của khách.
 *
 * Nhận cả ba dạng khách có thể gửi:
 *   - mã đầy đủ (`std_banmai`) — dùng nguyên
 *   - giới tính (`nu` / `nam`) — lấy giọng mặc định của giới đó
 *   - rỗng / không hợp lệ — lấy giọng trong `.env`, rồi mới tới mặc định
 *
 * Không bao giờ ném lỗi: một mã giọng lạ không được phép giết cả lần dựng video.
 * Nhà cung cấp trả HTTP 400 cho mã sai, và lỗi đó xảy ra SAU khi đã tiêu tiền LLM.
 */
export function chonGiong(yeuCau: string | null | undefined): string {
  const x = String(yeuCau ?? '').trim().toLowerCase();

  if (THEO_MA.has(x)) return x;

  if (x === 'nu' || x === 'nữ' || x === 'female') {
    return BANG_GIONG.find((g) => g.gioiTinh === 'nu')!.ma;
  }
  if (x === 'nam' || x === 'male') {
    return BANG_GIONG.find((g) => g.gioiTinh === 'nam')!.ma;
  }

  const tuEnv = String(process.env.VIENEU_VOICE ?? '').trim();
  if (THEO_MA.has(tuEnv)) return tuEnv;

  return BANG_GIONG[0].ma;
}

/** Giới tính của một mã giọng, để hiển thị lại cho khách. */
export function gioiTinhCua(ma: string): GioiTinhGiong | null {
  return THEO_MA.get(String(ma ?? '').trim())?.gioiTinh ?? null;
}
