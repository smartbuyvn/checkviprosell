# Production Auth Fix Checklist

Hướng dẫn Operator xử lý triệt để Auth Callback của Supabase để Web không bao giờ Login văng lỗi.

## 1. Hành Động: Xác Thực Từ Nguồn Code Cứng (`auth.service.ts`)
- Codebase React xử lý Node `signInWithGoogle` đã được Antigravity viết là: `redirectTo: window.location.origin + '/auth/callback'`.
- Điều này có nghĩa: Frontend tự động gọi URL phản hồi đúng bằng tên miền người dùng đang dùng. Nếu họ bấm Login trên `xyzbuy.net` thì nó đòi trả Code về `https://xyzbuy.net/auth/callback`.

## 2. Thao Tác Bắt Buộc Trên Supabase Dashboard
Hệ thống không chạy nếu Dashboard Supabase bị để trống Callback. Bạn vào Dashboard: **Authentication** > **URL Configuration**.

### 🔹 Site URL
Điền chính xác tên miền chạy web:
`https://xyzbuy.net` (Và hãy cẩn thận bạn dùng chữ `.com` hay `.net`)

### 🔹 Redirect URLs
Sẽ là thảm họa nếu bạn điền thiếu. Hãy Add URI các thẻ sau:
- `https://xyzbuy.net/*`
- `https://xyzbuy.net/*` (Đề phòng Cloudflare của bạn nhận tên hiển thị .net)
- `https://xyzbuy.net/auth/callback`

Xong! Giờ đây Code của Antigravity và Nút Bấm Login của Supabase đã nói chuyện qua cùng một đường điện thoại thống nhất.
