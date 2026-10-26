# Checkout Retest Checklist

Chạy danh sách kiểm thử này ngay sau khi thêm biến môi trường Stripe SDK để xác nhận Phase Regression an toàn.

- [ ] **Missing ENV Protection**: 
  - Thử xóa `STRIPE_SECRET_KEY` trong `.env`.
  - Khởi tạo thanh toán tại frontend.
  - Expect: UI văng lỗi toast "Thiếu STRIPE_SECRET_KEY" thay vì crash server.
- [ ] **Missing Plan/Price ID**:
  - Gửi request mua gói *Premium* nhưng xóa `STRIPE_PRICE_ID_PREMIUM` trong `.env`.
  - Expect: Lỗi 400 Request "Chưa khai báo STRIPE_PRICE_ID_PREMIUM".
- [ ] **Create Session Success**:
  - Nhập đủ ENV.
  - Tại UI, chọn "Basic" $250k.
  - Xử lý mượt -> Chuyển hướng sang trang thanh toán Hosted của Stripe thật. 
- [ ] **Cancel Flow**:
  - Tại màn hình thanh toán Stripe -> bấm dấu mũi tên / "Back to store".
  - Chuyển hướng về `/dashboard?payment=cancelled`. Đảm bảo không bị trừ tiền ảo hay credits rác.
- [ ] **Webhook Paid**:
  - Hoàn tất test card trên UI Stripe (thẻ `4242...`).
  - Ghi nhận Stripe bắn hook về `/webhooks/stripe`. Credit được cộng đúng số `250`.
- [ ] **Webhook Duplicate**:
  - Nút Retry Webhook trên Dashboard Stripe, bắn lại chính event session đó.
  - Expect: Terminal Fastify in ra warning "[Webhook] Idempotency block — already processed session..". Account không bị X2 credit.
- [ ] **Refund Event**:
  - Từ Dashboard Stripe, thực hiện Refund transaction đó.
  - Expect: Dữ liệu bảng `payments` xuống 'refunded', bảng `affiliate_events` xuống 'rejected'. Mọi commission đóng băng.
