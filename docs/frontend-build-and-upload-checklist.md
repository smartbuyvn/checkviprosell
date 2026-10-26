# Frontend Build & Upload Checklist

[ ] B1: Mở thư mục root (`d:\vidiosell`).
[ ] B2: Chỉnh sửa file `.env.production` đảm bảo `VITE_API_BASE_URL` trỏ về API Cloudflare Tunnel của bạn, không trỏ về `localhost`.
[ ] B3: Vào Terminal gõ lệnh: `npm install` (nếu chưa cài).
[ ] B4: Gõ tiếp: `npm run build`.
[ ] B5: Đợi Vite chạy xong, kiểm tra thư mục `/dist` vừa xuất hiện. Đảm bảo file `.htaccess` nằm sẵn trong `/dist`.
[ ] B6: Zip toàn bộ ruột của thư mục `/dist`. (Không zip thư mục cha `dist`, chỉ zip các file bên trong).
[ ] B7: Đăng nhập Hostinger hPanel -> File Manager -> Mở thư mục `public_html`.
[ ] B8: Xóa sạch rác cũ (như `default.php`), upload file ZIP vừa tạo lên.
[ ] B9: Extract (Giải nén) ngay tại `public_html`.
[ ] B10: Truy cập domain thật kiểm tra màn hình Login tải thành công.
