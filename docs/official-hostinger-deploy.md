# Official Hostinger Deploy

Cấu hình Front-End Deploy duy nhất của dự án. Framework là **React + Vite**, không dùng NodeJS Server-side rendering.

### Bước 1: Build & Bake Env
- Chuẩn bị `.env.production` ở thư mục Root chứa: `VITE_API_BASE_URL` trỏ về API đích (Ngrok/Cloudflare), và `VITE_SUPABASE_URL` của bạn.
- Click Terminal: `npm run build`.

### Bước 2: Chuẩn Bị File Mồi (.htaccess)
- Chắc chắn trong thư mục `/public` có file `.htaccess` (Antigravity đã tạo nó). Nội dung nó chứa lệnh `RewriteRule ^ index.html [L]` để Fix lỗi 404 trắng trang khi khách hàng F5 trang `/dashboard`.

### Bước 3: Upload Vận Hành
- Lên hPanel của Hostinger.
- Mở Web File Manager -> truy cập nhánh `public_html`.
- Nén thư mục `/dist` sau khi build -> Kéo thả lên Manager và Xả nén. (Nội dung của dist phải rải đều ở root public_html). 
- Chạy thử link HTTPS xem React bắt được Component chưa. Nếu Auth Login sáng diện mạo -> Thành công.
