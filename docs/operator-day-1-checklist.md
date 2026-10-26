# Operator Day-1 Checklist

*Ngày chạy đà kinh doanh chính thức. Bạn là thuyền trưởng.*

## Buổi Sáng (Setup Cơ Sở)
- [ ] Mở Stripe Dashboard, lấy `whsec_` Token.
- [ ] Mở Supabase Project, lấy Public URL và Service Keys.
- [ ] Ghi tất cả vào `backend/.env`. (Nhớ `LOCAL_ONLY_MODE=true`).

## Buổi Trưa (Triển Khai Trạm Phát Hosted SPA)
- [ ] Nhập `VITE_API_BASE_URL` vào `.env.production` trỏ tới Domain Cloudflare.
- [ ] Gõ `npm run build` trên máy local.
- [ ] Zip gói `dist` (Giữ nguyên `.htaccess` bên trong) ném lên Hostinger `public_html`.
- [ ] Dùng Điện thoại load 4G truy cập tên miền `https://vidiosell.vn` -> Phải thấy màn hình màu sắc hiện lên.

## Buổi Chiều (Rung Chông Server)
- [ ] Chạy Node mạng: `cloudflared tunnel run vidiosell`.
- [ ] Chạy DB cục bộ: `docker compose up redis -d`.
- [ ] Chạy API: `npm run backend:dev`.
- [ ] Chạy Công nhân 1: Ngồi nhìn `npm run worker:ai`.
- [ ] Chạy Công nhân 2: Ngồi nhìn `npm run worker:render`.

## Buổi Tối (Đón Hành Khách Số 1)
- [ ] Đăng ký nick của chính bạn trên Web. Nạp thử 1 gói Credit thật qua mã thẻ ảo Stripe. (Nhìn Terminal báo Webhook Verified thành công).
- [ ] Truy cập Supabase, sửa thông tin nick đó lên Cấp Admin.
- [ ] Chính thức kéo Traffic User đổ về Web!!! 🚀 Mọi việc còn lại máy chủ tự lo.
