/**
 * Viprosell — Lấy URL ảnh/clip dùng được từ hàng `project_assets`.
 *
 * Để riêng khỏi `asset.service.ts` vì file đó nạp Supabase client, mà client lại đọc
 * `import.meta.env` ngay lúc import — test chạy ngoài Vite sẽ vỡ trước khi tới được
 * hàm cần kiểm. Hàm thuần thì không nên kéo theo thứ gì.
 */

/**
 * Cột thật trong bảng là `file_url`, KHÔNG phải `url`.
 *
 * `AssetService.getByProject` dùng `select('*')` nên trả về hàng thô và TypeScript
 * không bắt giúp được. Đọc nhầm `a.url` cho ra `undefined` ở MỌI hàng, và hậu quả đi
 * qua hai giai đoạn — cả hai đều tệ:
 *
 *   1. Mảng `[undefined, …]` đi thẳng xuống worker và nổ ở `u.split('/')`.
 *   2. Sau khi thêm bộ lọc null, nó thành mảng RỖNG và chặn cứng với thông báo
 *      "Chưa có ảnh nào tải lên được" — trong khi ảnh vẫn nằm đủ trong cơ sở dữ liệu.
 *
 * Sai tên cột là lỗi im lặng; `assetUrls.test.ts` là chỗ duy nhất bắt được nó.
 */
export function assetUrls(assets: unknown[] | null | undefined): string[] {
  return (assets ?? [])
    .map((a) => {
      const r = a as Record<string, unknown> | null;
      // `url` giữ làm phương án dự phòng, phòng khi service đổi sang trả hàng đã ánh xạ.
      return (r?.file_url ?? r?.url) as unknown;
    })
    .filter((u): u is string => typeof u === 'string' && u.trim() !== '');
}
