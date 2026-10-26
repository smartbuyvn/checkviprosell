# Supabase Config Checklist

[ ] Khởi tạo Supabase Project.
[ ] Lấy biến `URL`, `Anon Key`, `Service Role Key` bỏ vào `backend/.env` VÀ `frontend/.env`.
[ ] **Auth Providers**: Bật Email/Password. Tắt Require Email Confirmation nếu muốn user đăng nhập thẳng.
[ ] **Site URL / Redirect URLs**: Vào Supabase -> Authentication -> URL Configuration.
  - Sửa Site URL thành: `https://vidiosell.vn` (Domain trên Hostinger).
  - Thêm Redirect URI: `http://localhost:8080` (để dùng lúc dev code).
[ ] SQL Editor: Chạy file setup SQL để seed DB (đảm bảo bảng `idempotency_keys` có mặt).
