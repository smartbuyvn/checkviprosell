# Official Supabase Setup

Quy trình thiết lập CSDL Cloud chuẩn chỉ. Không phỏng đoán. 

### 1. Variables
- Web lấy: `SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
- Tên Server lấy: `SUPABASE_SERVICE_ROLE_KEY`.

### 2. URL Redirects
- Truy cập GUI Supabase -> Authentication -> URL Configuration.
- `Site URL`: `https://vidiosell.vn` (Domain frontend của bạn).
- `Redirect URLs`: `https://vidiosell.vn/*`

### 3. Migrations & Seed
- Schema tự apply thông qua thư mục `supabase/migrations`. Backend Fastify sẽ tự nói chuyện bằng PostgREST.

### 4. Setup Admin Role Chính Thức
- **Source of Truth Code:** Dựa trên Schema thực tế, Cột để Check quyền là cột `role` trong Table `profiles`. (Tuyệt đối không tìm bảng `user_roles` như specs cũ).
- **Hành động:** Operator vào GUI Table Editor -> `profiles` -> Tìm user bản thân -> Đổi `role` thành chữ `admin`.
