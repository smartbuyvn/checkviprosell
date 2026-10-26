# Supabase Project Setup Guide

*Lưu ý: Antigravity không thể truy cập giao diện Supabase Dashboard của bạn. Bạn (Operator) phải thao tác bằng tay các bước này.*

## 1. Trích xuất Secrets
Ngay khi tạo Project Supabase:
- Vào **Project Settings** -> **API**.
- Copy `Project URL` dán vào `SUPABASE_URL` và `VITE_SUPABASE_URL` ở cả 2 `.env`.
- Copy `anon public` dán vào `SUPABASE_ANON_KEY` và `VITE_SUPABASE_ANON_KEY`.
- Copy `service_role secret` dán vào `SUPABASE_SERVICE_ROLE_KEY` (Chỉ dán vào `.env` backend, tuyệt đối không đưa xuống frontend).

## 2. Cấu hình Redirect Authentication (Origin Assumptions)
Frontend sử dụng email login và OAuth. Để Supabase biết nơi điều hướng quay về:
- Vào **Authentication** -> **URL Configuration**.
- Trình đơn **Site URL**: Điền `https://vidiosell.vn` (Domain thật trên Hostinger của bạn).
- Trình đơn **Redirect URLs**: Bấm Add, điền `https://vidiosell.vn/*` và `http://localhost:8080/*` (Cho debug auth localhost).

## 3. Seed Quyền Quản Trị Hệ Thống
Hệ thống Admin UI (Control Node) bị ẩn và chặn truy cập nếu User không có Role.
- Đăng nhập bằng Email của bạn trên trang Web 1 lần để Supabase khởi tạo User ID.
- Lên Supabase Dashboard -> **Table Editor** -> Chọn bảng `profiles`.
- Tìm Row có chứa Email của bạn. Cột `role` đổi từ `user` sang `admin`. (Nhớ gõ bằng chữ thường viết liền).
- Mở lại trang Web, bấm F5, nút "Quản trị hệ thống" tại Sidebar sẽ chui ra khỏi mặt đất.
