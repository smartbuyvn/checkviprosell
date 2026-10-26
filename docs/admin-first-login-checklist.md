# Admin First Login Checklist

Hệ thống mặc định đăng nhập là `user`. Để đẩy tài khoản lên System Admin:
[ ] B1: Truy cập web Hostinger dăng ký một nick mới cho bạn (ví dụ: `boss@vidiosell.vn`).
[ ] B2: Mở giao diện Supabase Dashboard -> Table Editor -> Bảng `profiles`.
[ ] B3: Tìm Data row của Email bạn, chuyển cột `system_role` (hoặc `role` nếu xài chung) thành `admin`.
[ ] B4: F5 lại trình duyệt Frontend, mục Menu Dashboard (bên trái) sẽ xuất hiện icon mỏ lết "Quản trị hệ thống". Vào điều chỉnh System Settings cơ bản.
