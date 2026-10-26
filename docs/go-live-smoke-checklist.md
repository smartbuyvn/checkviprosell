# Go-Live Smoke Checklist: Telemetry Grade

Đây là bản Smoke Test tiêu chuẩn cứng được đo đạc dành cho VIPROSELL Core. Khởi chạy khi Giai đoạn 3 của Operator Runbook kết thúc.

- [ ] **1. Tín hiệu HTTP Đầu Vào**: Mở trình duyệt ngoài `vidiosell.vn`/login. UI mượt. Auth Supabase không sụp.
- [ ] **2. Tín hiệu Cổng Chống Cross-Origin (CORS)**: F12 -> Network -> Fetch Auth. Kết thúc 200 OK. Lỗi Blocked nghĩa là `ALLOWED_ORIGINS` gõ sai dấu phẩy hoặc format.
- [ ] **3. Thẩm Tra Telemetry Hệ Thống**: Mở link `/health`. Trả về JSON: `status: ok, redis: up`. Nếu ra giao diện Mạng 503, phải mở Dockerd coi Redis. Nếu ra Timed Out -> Lỗ đục Cloudflared sập.
- [ ] **4. Họng Súng Nhận Tiền Stripe**: Bấm mua Credit, giao diện Checkout Stripe load thành công.
- [ ] **5. Thẩm Định Đạn Webhook**: Thanh toán test card thành công, Webhook Backend báo `[Webhook] Stripe signature verified via SDK ✅`. Database Credit nhẩy số ngay sau đó.
- [ ] **6. Ổn Định Lõi Sinh Lời AI**: Lệnh Generate AI sẽ trễ dưới 2 phút. Lệnh nhả ra kịch bản chuẩn SEO. API Worker chạy bình thản không crash ngang do Prompt Retry Limit Guard đã bọc.
- [ ] **7. Thanh Toán Billing Render Cuối Mùa**: Bấm "Export". `ffmpeg` rít RAM. Terminal báo Callback `"status: exported"`. Check Database Render trừ thẳng **20 Xu**. Logic Credit Deduction hoàn thành chu kỳ sống kín kẽ.

✅ NẾU ĐẠT CHUẨN 7 TIÊU CHÍ, PLATFORM KIẾM TIỀN ĐÃ MỞ CỬA! HÃY NÉM CHO ADs.
