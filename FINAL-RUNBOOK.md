# VIPROSELL FINAL OPERATOR RUNBOOK

Mọi thứ đã được ghép nối hoàn thiện thành một cỗ máy Local-first SaaS. Dưới đây là các bước duy nhất bạn (Operator) cần làm để boot toàn bộ server lên chạy thương mại thật.

## I. YÊU CẦU ĐẦU VÀO TỪ OPERATOR (REQUIRED INPUTS)

Trước khi chạy, bạn phải chuẩn bị sẵn 3 loại nguyên liệu sau:

**1. SUPABASE PROJECT KEYS:**
- `SUPABASE_URL` (ví dụ: `https://xyz.supabase.co`)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Chỉ dành cho Backend)

**2. PAYMENT CREDENTIALS (Sống còn cho màn Billing - Chọn 1 trong 2 hoặc cả hai):**
*SePay (Mặc định cho KH Việt Nam):*
- Đăng nhập My SePay -> Tích hợp -> Lấy `SEPAY_API_TOKEN` và `SEPAY_WEBHOOK_SECRET`.
- Cài Webhook URL: `https://api.xyzbuy.net/api/v1/webhooks/sepay`. Trạng thái sẽ cập nhật tự động khi khách ck xong.

*Lemon Squeezy (Mặc định cho Quốc tế/PayPal):*
- Đăng nhập Lemon Squeezy -> Tạo Store -> Lấy `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`.
- Settings -> Webhooks -> Add Endpoint -> URL: `https://<domain_cua_ban>/api/v1/webhooks/lemonsqueezy`. Lấy mã `LEMONSQUEEZY_WEBHOOK_SECRET`.

*(Lưu ý: Provider Stripe đã vào diện Deprecated/Legacy, vui lòng KHÔNG dùng làm kênh thanh toán chính dù vẫn còn key trong env cũ).*

**3. OLLAMA Bật Sẵn:**
- Tải Ollama. Chạy màn hình đen `ollama run qwen2.5:7b`. Để đó cho port 11434 mở mạng.

---

## II. LỆNH CÀI ĐẶT & ENV (PRE-FLIGHT)

Mở Terminal root folder `d:\vidiosell`. Đảm bảo có NodeJS (v18+) và Redis đã được Dockerized hoặc bật sẵn localhost:6379. Đoạn tiếp theo:

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Mở `backend/.env` lên và điền tất cả các khóa bí mật bạn lụm được từ phần I gồm `SUPABASE_*`, và các key cho SePay / Lemon Squeezy. Các key `STRIPE_*` không còn hiệu lực bắt buộc. Khai báo `INTERNAL_CALLBACK_SECRET` bằng cách tạo random HEX 32 byte. Đảm bảo `BACKEND_PUBLIC_BASE_URL` trỏ về API gốc (VD: Cloudflare Tunnel ngrok của bạn).

### 2. Database
- Vào giao diện quản lý SQL của Supabase dán nguyên ruột `d:\vidiosell\db\01-schema.sql` vào chạy. Nó sẽ tự tạo Bảng `idempotency_keys`, `credit_ledger`, v.v...

### 3. Frontend
```bash
cd ..
npm install
cp .env.example .env
```
Mở `.env` điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.  
Sửa `VITE_API_BASE_URL` chĩa vô API Backend port 3001 (Nếu local là `http://localhost:3001/api/v1`).

---

## III. THỨ TỰ KHỞI ĐỘNG CỖ MÁY (BOOT SEQUENCE)

Để ứng dụng chạy mà không có lỗi đứt gãy nào, bạn phải bật thành **4 process song song** (Mở 4 Tab Terminal).

**Terminal 1 (Redis):**
Nếu chưa có Redis Native trên máy thì chạy Docker:
```bash
docker compose -f backend/docker-compose.dev.yml up redis -d
```

**Terminal 2 (Core API):** Core Router (tiếp nhận thanh toán, nhận lệnh API từ Frontend)
```bash
cd backend
npm run backend:dev
```

**Terminal 3 (Worker Render FFmpeg + AI):** Nô lệ cày Render bằng card đồ họa máy tính bạn. Không bật cái này thì UI Load mãi ở nhãn "Đang chờ hàng đợi".
```bash
cd backend
npm run worker:render
```

**Terminal 4 (Frontend UI SPA):** 
```bash
npm run dev
```

---

## IV. BÀI TEST NGHIỆM THU CUỐI CÙNG CHO OPERATOR

1. **Test User Đăng Ký**: Mở ẩn danh vào localhost:8080. Đăng nhập bằng Google. Đăng nhập xong, chĩa API vô Database xem bảng `auth.users` và `public.profiles` có ID chưa? 
2. **Test Nạp VIP**: Ấn vào Tab `Nạp Tín Dụng`, ấn vào Gói `$9`. Tùy theo SePay/Lemon Squeezy đang bật, nó đẩy ra QR Code SePay hoặc Link thanh toán Checkout quốc tế. Test thử theo chế độ Sandbox.
3. **Test Webhook nảy số (QUAN TRỌNG)**: Nhìn Terminal 2 (Backend) xem có dòng log `[Webhook] verified...` của SePay hoặc Lemon Squeezy và `[Webhook] Inserted payment`. Webhook là nguồn sự thật duy nhất (Source-of-truth). Vặn UI Load lại xem Tín dụng có nhảy lên 250 không. Đừng tin màn redirect trên frontend.
4. **Test Màn Hình Admin Toggle Mâu Thuẫn**: Dùng tài khoản bạn vừa tạo, tự vô DB insert vào bảng `user_roles` quyền `admin` cho UUID của bạn. Đăng nhập lại. Hiện Tab "Quản trị hệ thống". Vào bật "Allow External API" -> Bấm lưu -> Lỗi chửi mâu thuẫn chính sách văng ra vì LOCAL_ONLY đang bật.
5. **Test Đẩy Lệnh Render Mượt**: Ấn tạo dự án Video -> Up Đại ảnh -> Get Script -> Render. Chuyển UI ra Dashboard ngồi nhìn Tab Video. Bên Terminal 3 Worker cục kịch chạy vèo vèo -> 20s sau Dashboard UI tự nhảy vèo chữ "Khởi tạo thành công" (API Callback). Trừ đi 20 tín dụng. Hoàn hảo. Tải MP4 từ `/public/renders`.
