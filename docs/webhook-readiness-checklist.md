# Webhook Readiness Checklist

Endpoint: `POST /api/v1/webhooks/stripe`

### Yêu cầu Tiên Quyết:
- [ ] (A) `VITE_APP_BASE_URL` trong Backend `.env` được cài đặt chính xác là origin Hostinger (`https://vidiosell.vn`). *Node sẽ nhét đường dẫn này vào link trả về của Stripe Checkout.*
- [ ] (B) `STRIPE_WEBHOOK_SECRET` bắt buộc phải là chuỗi `whsec_...` trích xuất được từ bảng quản trị Stripe chứ không phải chuỗi test.
- [ ] (C) Event subscriptions webhook bắt buộc phải tích đủ:
      1. `checkout.session.completed`
      2. `checkout.session.async_payment_failed`
      3. `charge.refunded`

### Retest Verification:
1. `stripe trigger checkout.session.completed` -> Xác nhận Terminal local xuất `[Webhook] Received event: checkout.session.completed`.
2. Supabase DB: bảng `idempotency_keys` lòi ra ID session vừa checkout.
3. Reload trang Hostinger. Cập nhật ví Credit chuẩn.
