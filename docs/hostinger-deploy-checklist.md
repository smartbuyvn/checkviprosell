# Hostinger Deploy Checklist

Mọi thủ tục cấu trúc Frontend Vite SPA (Single Page Application) đã được Antigravity thực thi tự động. Repo hiện tại ĐÃ HOSTINGER READY (Ready for operator config). 

Operator chỉ cần Upload mà không cần sửa code.

## 1. Build Tĩnh (Bake Variables)
React/Vite cần nhúng cứng Biến Môi Trường (ENV) vào gói JS. Hệ thống ĐÃ KHÓA cứng 3 biến sau phía Local:
- [ ] `VITE_API_BASE_URL` (ví dụ `https://api.vidiosell.vn/api/v1`)
- [ ] `VITE_SUPABASE_URL` (ví dụ `https://asdfasdf.supabase.co`)
- [ ] `VITE_SUPABASE_ANON_KEY` 
  
Chạy `npm run build` trên máy local.

## 2. Quăng File Lên Hostinger
- [ ] Truy cập hPanel -> File Manager.
- [ ] Mở thư mục `public_html`. (Xóa sạch file mặc định của Hostinger như `default.php`).
- [ ] Upload nén `.zip` của thư mục `dist` bạn vừa build lên và giải nén.

## 3. Xác Nhận .htaccess React Router Fallback
Vì Vite build ra SPA, mọi đường dẫn như `/billing` hay `/render` nếu F5 sẽ sinh lỗi 404 Nginx/Apache. 
- [ ] Antigravity **ĐÃ Verified** tạo file `public/.htaccess`.
- [ ] Kiểm tra lại thư mục `public_html` trên hPanel xem file `.htaccess` có tồn tại không. (Bật chế độ Show Hidden Files ở Hostinger nếu cần). Nội dung của nó ép mọi request trả về `index.html`.

Done Criteria: Truy cập `https://vidiosell.vn/login` từ di động không bị chết trang.
