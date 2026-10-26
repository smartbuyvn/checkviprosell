# Hostinger Final Build Steps

Bộ quy tắc cuối cùng để biên dịch mã nguồn Viprosell lên Hostinger tĩnh trong Môi trường Zero-Trust (Cloudflare Tunnel).

## Bước 1. Bake Biến Môi Trường (Cực Kỳ Quan Trọng)
Mọi biến môi trường `VITE_` đều bị "Nấu" (Bake) chết vào file Javascript tại lúc bạn gõ lệnh Build. Đổi file `.env` trên Hostinger là VÔ NGHĨA.
- Mở file `.env` ngay trên máy tính lập trình của bạn.
- Rà soát `VITE_API_BASE_URL` trỏ tới Server Tunnel (Ví dụ: `https://api.xyzbuy.net/api/v1`).
- Rà soát `VITE_SUPABASE_URL`.

## Bước 2. Biên Dịch (Build)
Chạy lệnh ngay tại gốc thư mục dự án `vidiosell`:
```bash
npm run build
```
Lệnh này sẽ tạo ra 1 thư mục tên `dist/`.

## Bước 3. Quăng Lên Hostinger
- Mở Hostinger hPanel > Web File Manager.
- Xóa sạch mọi thứ trong folder `public_html/`.
- Nén Zip cái thư mục `dist/` vừa Build ném lên -> Extract bung lụa nó ra.

## Bước 4. Kiểm Tra Spa Fallback (`.htaccess`)
- Nhìn vào `public_html/` xem đã có mặt file ẩn `.htaccess` chưa.
- Lên trình duyệt vào trang web. Chuyển tap `xyzbuy.com/login`. Rồi nhấn nút F5 Reload trình duyệt. -> Nếu Trang Web không sập (Vẫn React) tức là Nginx Hostinger đã cấu hình hoàn hảo.
