# Final Operator Steps

Các bước dưới đây không chứa sự phỏng đoán. 100% là thao tác vật lý trên máy vật lý.

### Giai đoạn 1: Khởi động Lõi & Data (Tại Server Nội Bộ)
1. Bật Docker: `docker compose up redis -d`.
2. Mở trình duyệt Supabase, dán `STRIPE_WEBHOOK_SECRET` và thông tin Supabase vào `backend/.env`. Khai báo `STRIPE_PRICE_ID` của 3 gói cước.
3. Chạy lệnh: `cd backend && npm install`. Bật Server `npm run start`.
4. Bật Terminals cấp dưới chạy Queue: `npm run worker:ai` và `npm run worker:render`.
5. Bật cổng xuyên tường: `cloudflared tunnel run vidiosell` (lấy URL tunnel: `https://api.vidiosell.vn`). Khai báo origin backend `.env` cho phép Hostinger: `ALLOWED_ORIGINS=https://vidiosell.vn`. Set backend khởi động lại.

### Giai đoạn 2: Bơm UI lên Hostinger
1. Mở `frontend/.env.production`, ghi `VITE_API_BASE_URL=https://api.vidiosell.vn/api/v1`.
2. Gõ `npm install && npm run build`.
3. Nhét toàn bộ file trong `/dist` vào file Zip.
4. Quăng lên File Manager `public_html` của Hostinger, giải nén.

### Giai đoạn 3: Rót Quyền Lực (Admin)
1. Truy cập `https://vidiosell.vn`, tạo nick bình thường bằng Email (Signup/Login Auth cơ bản).
2. Vào lại bảng `profiles` của Supabase. Trỏ nick vừa tạo cột role thành `admin`.
3. F5 trang Web. Bạn chính thức là chủ hệ sinh thái. Tiến hành cấu hình cấm cửa Cloud (đối chiếu file `admin-operator-runbook.md`).
