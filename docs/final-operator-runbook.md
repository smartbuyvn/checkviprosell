# Final Operator Runbook (Internal Vault)

Luồng hoạt động đã bị siết chặt thông số bảo mật Billing và Telemetry. Đây là Runbook thực chiến duy nhất cần đọc.

## Giai đoạn 0: Injection (Chích Auth)
1. **Frontend**: Điền `VITE_API_BASE_URL` trỏ vào Cloudflare CNAME.
2. **Backend**: 
   - Điền bộ ba Stripe (PK, SK, Webhook).
   - Điền Supabase (API, Anon, Service-Role).
   - Phân quyền Host: `ALLOWED_ORIGINS=https://vidiosell.vn`

## Giai đoạn 1: Bootstrap UI
1. Di chuyển vào `D:\vidiosell`. Tiến hành Build `npm run build`.
2. Zip rỗng ruột thư mục `dist/`. Chuyển sang hPanel / Vercel thả file nén. UI đã sống.

## Giai đoạn 2: Lắp Đạn Lõi Trạm Điều Khiển 
*(Diễn ra ngay trên PC vật lý của bạn)*
1. **Trái Tim Dữ Liệu**: `docker compose up redis -d`.
2. **Brain LLM**: Mở phần mềm Ollama chạy nền chờ sẵn port `11434`.
3. **Mạch Giao Tiếp**: `cloudflared tunnel run [Zone]`. Đảm bảo luồng xuyên vỏ Internet hoạt động.
4. **Phân Phối Lệnh (LoadBalancer)**: Bật terminal -> `npm run backend:dev`.
   - *Lưu ý*: Nếu URL Health trả HTTP Code 503 thay vì 200, tức là Docker Redis chưa chạy. Phải khắc phục ngay.
5. **Công Nhân Tốc Độ Máy (GPU/CPU)**: Bật liền 2 Tab cmd: `npm run worker:ai` và `npm run worker:render`. Cả 2 sẽ thức canh Job từ Redis mãi mãi.

## Giai đoạn 3: Rót Quyền Quản Trị
1. Khách hàng Vô Danh tạo đăng ký nick lần đầu qua Hosted SPA.
2. Mở Supabase Query / Table Editor. Filter Email của bạn. Edit Table, thay Role thành `admin`.
3. Load lại Front-end. Điều phối Setup tại Panel Admin. Quá Trình Bắt Đầu. Mọi Request đều là Thật. Hệ thống Zero Mocking Activating!
