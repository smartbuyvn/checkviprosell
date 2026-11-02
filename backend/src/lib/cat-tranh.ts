/**
 * Viprosell — Cắt tránh dấu bản quyền
 *
 * ── Vì sao cắt tránh chứ không xoá ──
 *
 * Đo ngày 31/10 trên ảnh thật 2752×1536, dấu chữ chiếm 1,8% diện tích ở góc. So SSIM
 * với ảnh sạch:
 *
 *     chưa xử lý ................. 0,9803
 *     sau `delogo` ............... 0,9837   chỉ hơn 0,0034, và để lại VỆT KÉO DỌC
 *     cắt viền 8% đều ............ mất 29% diện tích, dấu vẫn sót
 *     cắt viền 15% đều ........... mất 51% diện tích
 *     **cắt tránh đúng dải dấu**   mất **10%** diện tích, không một vệt nào
 *
 * `delogo` nội suy từ mép khung, nên trên nền phẳng đã thấy vệt; trên vân vải hay
 * hoa văn thì hỏng hẳn. Mọi cách xoá đều phải ĐOÁN xem sau dấu có gì — và trên ảnh
 * sản phẩm, đoán sai một mảng vân vải là khách nhận hàng thấy khác ảnh.
 *
 * ── Vì sao bây giờ mới làm được ──
 *
 * Cắt là mất pixel, và trước đây pixel đã thiếu sẵn: 64% ảnh khách tải lên nằm dưới
 * 1382px. Từ khi có bước nâng ảnh (`lib/nang-anh.ts`), ảnh 1024px thành 4096px, nên
 * cắt bỏ 20% vẫn còn thừa. Hai tính năng này sinh ra cho nhau.
 */

/** Khung theo tỉ lệ 0..1 của ảnh. */
export interface Khung {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Khung cắt cuối cùng, kèm lý do để ghi nhật ký. */
export interface KetQuaCat {
  khung: Khung;
  /** Phần diện tích còn giữ lại, 0..1. */
  giuLai: number;
  /** Mô tả ngắn, viết cho người vận hành đọc nhật ký. */
  moTa: string;
}

/** Phần diện tích tối thiểu phải giữ. Cắt sâu hơn là mất cả sản phẩm. */
export const GIU_TOI_THIEU = 0.45;

/**
 * Nới thêm quanh dấu trước khi cắt, theo tỉ lệ khung.
 *
 * Khung bao của Tesseract bám sát nét chữ, nên cắt đúng sát mép vẫn để lộ bóng đổ và
 * phần mờ quanh dấu. 1,5% là đủ để nuốt phần đó mà chưa ăn vào sản phẩm.
 */
export const NOI_THEM = 0.015;

/**
 * Tính khung cắt lớn nhất không chạm vào dấu nào.
 *
 * ── Cách làm ──
 *
 * Với mỗi dấu, có bốn cách né: cắt bỏ phần trên nó, phần dưới, phần trái, hoặc phần
 * phải. Chọn cách giữ được nhiều diện tích nhất, rồi lặp cho dấu tiếp theo.
 *
 * Tham lam chứ không tối ưu toàn cục: với một hai dấu ở viền — tức gần như mọi
 * trường hợp thật — nó cho cùng kết quả, mà đọc hiểu được trong một phút.
 *
 * Trả về khung đầy đủ khi không có dấu nào, hoặc khi né xong sẽ mất quá nhiều.
 */
export function tinhKhungTranh(
  dauDs: Khung[] | null | undefined,
  opts: { giuToiThieu?: number; noiThem?: number } = {}
): KetQuaCat {
  const giuToiThieu = opts.giuToiThieu ?? GIU_TOI_THIEU;
  const noi = opts.noiThem ?? NOI_THEM;
  const dau = (dauDs ?? []).filter((d) => d && d.w > 0 && d.h > 0);

  let khung: Khung = { x: 0, y: 0, w: 1, h: 1 };
  if (dau.length === 0) {
    return { khung, giuLai: 1, moTa: 'khong co dau nao, giu nguyen khung' };
  }

  let soDaNe = 0;
  let boQua = 0;

  for (const d of dau) {
    const nd: Khung = {
      x: Math.max(0, d.x - noi),
      y: Math.max(0, d.y - noi),
      w: Math.min(1, d.w + noi * 2),
      h: Math.min(1, d.h + noi * 2),
    };
    if (!chongLan(khung, nd)) continue;

    // Bốn cách né, mỗi cách là một khung con không chạm dấu.
    const ungVien: Khung[] = [
      catTren(khung, nd.y + nd.h),
      catDuoi(khung, nd.y),
      catTrai(khung, nd.x + nd.w),
      catPhai(khung, nd.x),
    ].filter((u) => u.w > 0 && u.h > 0);

    if (ungVien.length === 0) { boQua++; continue; }

    const tot = ungVien.reduce((a, b) => (dienTich(b) > dienTich(a) ? b : a));
    if (dienTich(tot) < giuToiThieu) { boQua++; continue; }

    khung = tot;
    soDaNe++;
  }

  const giuLai = dienTich(khung);
  const phan: string[] = [];
  if (soDaNe > 0) phan.push(`ne ${soDaNe} dau, giu ${Math.round(giuLai * 100)}% dien tich`);
  if (boQua > 0) phan.push(`bo qua ${boQua} dau vi ne se mat qua nhieu`);
  if (phan.length === 0) phan.push('dau khong cham khung, giu nguyen');

  return { khung, giuLai, moTa: phan.join('; ') };
}

function dienTich(k: Khung): number {
  return Math.max(0, k.w) * Math.max(0, k.h);
}

function chongLan(a: Khung, b: Khung): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Giữ phần DƯỚI mốc — tức cắt bỏ phần trên. */
function catTren(k: Khung, moc: number): Khung {
  const y = Math.max(k.y, moc);
  return { x: k.x, y, w: k.w, h: k.y + k.h - y };
}
/** Giữ phần TRÊN mốc. */
function catDuoi(k: Khung, moc: number): Khung {
  const y2 = Math.min(k.y + k.h, moc);
  return { x: k.x, y: k.y, w: k.w, h: y2 - k.y };
}
function catTrai(k: Khung, moc: number): Khung {
  const x = Math.max(k.x, moc);
  return { x, y: k.y, w: k.x + k.w - x, h: k.h };
}
function catPhai(k: Khung, moc: number): Khung {
  const x2 = Math.min(k.x + k.w, moc);
  return { x: k.x, y: k.y, w: x2 - k.x, h: k.h };
}

/**
 * Biểu thức `crop` của ffmpeg cho một khung tỉ lệ.
 *
 * Trả chuỗi rỗng khi khung là toàn bộ ảnh — người gọi bỏ hẳn khâu này thay vì thêm
 * một phép cắt không cắt gì, vốn chỉ làm chuỗi filter dài ra và khó đọc hơn.
 */
export function bieuThucCrop(k: Khung): string {
  const gan1 = (n: number) => Math.abs(n - 1) < 1e-6;
  const gan0 = (n: number) => Math.abs(n) < 1e-6;
  if (gan0(k.x) && gan0(k.y) && gan1(k.w) && gan1(k.h)) return '';

  const s = (n: number) => n.toFixed(4);
  return `crop=iw*${s(k.w)}:ih*${s(k.h)}:iw*${s(k.x)}:ih*${s(k.y)}`;
}
