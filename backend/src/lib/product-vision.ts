/**
 * Viprosell — Nạp ảnh sản phẩm cho tầng AI nhìn
 *
 * ── Vì sao tách ra thành module riêng ──
 *
 * Có HAI đường gọi tầng 1, và trước 29/10/2026 chỉ một đường nhìn được ảnh:
 *
 *   `ai.service.ts`         (trang Phân tích sản phẩm)  → CÓ truyền ảnh
 *   `scene-graph.service.ts` (worker, đường DỰNG VIDEO) → KHÔNG truyền gì
 *
 * Đường thứ hai mới là đường làm ra video khách nhận. Nó chỉ gửi TÊN TỆP:
 *
 *     image_notes: anhHopLe.map((u) => u.split('/').pop()).join(', ')
 *
 * Hậu quả đo được trên render `a7d667cc`: brief trả về
 * `"Chỉ nhận được tên tệp ảnh, chưa xác minh nội dung hình ảnh"`, `core_offer: null`,
 * `key_benefits: []`, `needs_human_review: true`. Rồi tầng 2 viết hook từ cái brief
 * rỗng đó, cho ra **"Đang chọn đồng hồ hay laptop?"** — một câu không nhắc tới sản
 * phẩm nào. Năm video gần nhất đều cùng một kiểu.
 *
 * Nói cách khác: hook dở không phải vì AI viết dở, mà vì nó bị bịt mắt rồi bảo viết.
 *
 * Đặt chung một chỗ để lần sau thêm đường gọi thứ ba thì không phải nhớ nối lại.
 */
import { spawn } from 'child_process';
import { safeDownload } from './fetch-guard';

export interface AnhChoModel {
  mimeType: string;
  base64: string;
}

/** Số ảnh tối đa gửi cho model. Gemini tính phí theo từng ảnh nên đây là vấn đề chi phí. */
export const VISION_MAX_IMAGES = parseInt(process.env.AI_VISION_MAX_IMAGES || '4', 10);

/**
 * Trần dung lượng TẢI VỀ.
 *
 * Nâng từ 1,5 MB lên 12 MB vì mức cũ loại gần hết ảnh thật: đo ngày 29/10, hai trong
 * ba ảnh của dự án bị chặn ở 2,2 MB và 2,4 MB — cỡ bình thường của ảnh điện thoại.
 * Kết quả là model chỉ nhìn được 1/3 ảnh.
 *
 * Trần này chỉ để chặn tệp khổng lồ; thứ quyết định chi phí là bước thu nhỏ bên dưới.
 */
export const VISION_MAX_BYTES = parseInt(process.env.AI_VISION_MAX_BYTES || '12000000', 10);

/**
 * Cạnh dài tối đa khi gửi cho model.
 *
 * Gemini tự thu nhỏ ảnh về lưới ô của nó, nên gửi ảnh 4000px chỉ tốn băng thông và
 * thời gian chứ không cho model thấy rõ hơn. 1024px đủ để đọc chữ trên bao bì và
 * nhận ra chất liệu — hai thứ tầng 1 cần.
 */
const VISION_CANH_DAI = parseInt(process.env.AI_VISION_MAX_EDGE || '1024', 10);

/**
 * Thu nhỏ ảnh bằng ffmpeg trước khi gửi.
 *
 * Dùng ffmpeg vì nó đã là phụ thuộc cốt lõi — cả sản phẩm này không chạy nếu thiếu
 * nó — nên thêm một thư viện xử lý ảnh chỉ để đổi kích thước là trả giá bảo trì cho
 * không.
 *
 * Hỏng thì trả lại ảnh gốc: thu nhỏ là tối ưu, không phải điều kiện. Thà gửi ảnh
 * nặng còn hơn không gửi gì.
 */
async function thuNho(goc: Buffer, traceId: string): Promise<{ buf: Buffer; mime: string }> {
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-i', 'pipe:0',
      // `min(iw,{N})` giữ nguyên ảnh đã nhỏ hơn mức cần, không phóng to vô ích.
      '-vf', `scale='min(iw,${VISION_CANH_DAI})':'min(ih,${VISION_CANH_DAI})':force_original_aspect_ratio=decrease`,
      '-f', 'mjpeg', '-q:v', '4',
      'pipe:1',
    ];
    const p = spawn('ffmpeg', args);
    const ra: Buffer[] = [];
    let loi = '';

    p.stdout.on('data', (d) => ra.push(d));
    p.stderr.on('data', (d) => { loi += d; });
    p.on('error', () => resolve({ buf: goc, mime: 'image/jpeg' }));
    p.on('close', (code) => {
      const nho = Buffer.concat(ra);
      if (code !== 0 || nho.length === 0) {
        console.warn(`[Vision] Thu nho that bai, gui anh goc [${traceId}]: ${loi.slice(0, 120)}`);
        return resolve({ buf: goc, mime: 'image/jpeg' });
      }
      resolve({ buf: nho, mime: 'image/jpeg' });
    });

    p.stdin.on('error', () => { /* ffmpeg đóng sớm; `close` ở trên xử lý */ });
    p.stdin.end(goc);
  });
}

const MIME_THEO_DUOI: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Đoán kiểu ảnh từ đuôi tên tệp hoặc đuôi trong URL.
 *
 * Phải thử cả hai: ảnh lưu trên Supabase Storage có URL dạng
 * `.../0.AInfPpYb9aW-8Wyr8Z94cy6uYay4zZSh5UApfDDYRQQ` — KHÔNG có đuôi. Chỉ cột
 * `file_name` mới giữ tên gốc. Ngược lại, đường worker chỉ có URL chứ không có
 * `file_name`.
 */
export function kieuAnh(tenTep?: string | null, url?: string | null): string | null {
  for (const nguon of [tenTep, url]) {
    const s = String(nguon ?? '').split('?')[0];
    const duoi = s.includes('.') ? s.split('.').pop()!.toLowerCase() : '';
    if (duoi && duoi in MIME_THEO_DUOI) return MIME_THEO_DUOI[duoi];
  }
  return null;
}

export interface NguonAnh {
  url: string;
  /** Tên tệp gốc, nếu có. URL trên Supabase Storage không mang đuôi. */
  fileName?: string | null;
}

/**
 * Tải ảnh sản phẩm về dạng base64 cho model nhìn.
 *
 * Hỏng một ảnh thì bỏ qua ảnh đó: thiếu một ảnh vẫn viết được kịch bản, còn chặn cả
 * luồng chỉ vì một URL lỗi thì tệ hơn nhiều.
 *
 * Khi không tải được ảnh nào mà đầu vào có ảnh, hàm ghi log CẢNH BÁO rõ ràng — đó là
 * tình huống model sẽ viết mù, và nó phải nhìn thấy được trong log chứ không im lặng.
 */
export async function napAnhSanPham(
  nguon: NguonAnh[],
  traceId: string
): Promise<AnhChoModel[]> {
  if (!nguon?.length) return [];

  const chon = nguon.filter((n) => n?.url).slice(0, VISION_MAX_IMAGES);
  const ra: AnhChoModel[] = [];

  for (const n of chon) {
    const mimeType = kieuAnh(n.fileName, n.url);
    if (!mimeType) {
      console.warn(`[Vision] Bo qua ${n.fileName ?? n.url}: khong doan duoc kieu anh [${traceId}]`);
      continue;
    }
    try {
      // safeDownload chặn SSRF và giới hạn dung lượng.
      const goc = await safeDownload(n.url, { maxBytes: VISION_MAX_BYTES });
      const { buf, mime } = await thuNho(goc, traceId);
      if (buf.length < goc.length) {
        console.log(
          `[Vision] ${n.fileName ?? 'anh'}: ${(goc.length / 1024).toFixed(0)}KB -> ` +
          `${(buf.length / 1024).toFixed(0)}KB [${traceId}]`
        );
      }
      ra.push({ mimeType: buf === goc ? mimeType : mime, base64: buf.toString('base64') });
    } catch (err: any) {
      console.warn(`[Vision] Khong tai duoc ${n.fileName ?? n.url} [${traceId}]: ${err.message}`);
    }
  }

  if (ra.length === 0 && chon.length > 0) {
    console.warn(
      `[Vision] Khong tai duoc anh nao trong ${chon.length} anh — model se viet mu, ` +
      `hook se ra chung chung kieu "Gap van de nay moi ngay a?" [${traceId}]`
    );
  } else if (ra.length > 0) {
    console.log(`[Vision] Gui ${ra.length}/${chon.length} anh cho model [${traceId}]`);
  }

  return ra;
}

/** Dạng hàng `project_assets` → nguồn ảnh. */
export function tuProjectAssets(assets: any[] | null | undefined): NguonAnh[] {
  return (assets ?? [])
    .filter((a) => a?.file_url)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((a) => ({ url: a.file_url, fileName: a.file_name }));
}

/** Danh sách URL trần → nguồn ảnh. Dùng ở đường worker, nơi chỉ có URL. */
export function tuDanhSachUrl(urls: unknown): NguonAnh[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u): u is string => typeof u === 'string' && u.trim() !== '')
    .map((url) => ({ url, fileName: null }));
}
