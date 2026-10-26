# Stripe Production Checklist

[ ] Tạo tài khoản Stripe / Active Business.
[ ] Bật Webhook, trỏ Endpoint URL về địa chỉ Tunnel công khai: `https://api.vidiosell.vn/api/v1/webhooks/stripe`.
[ ] Chọn List Events: Chỉ lắng nghe `checkout.session.completed`, `checkout.session.async_payment_failed`, `charge.refunded`.
[ ] Lấy API Secret Key (`sk_live_...`) dán vào `backend/.env` (biến `STRIPE_SECRET_KEY`).
[ ] Lấy Webhook Secret (`whsec_...`) dán vào `backend/.env` (biến `STRIPE_WEBHOOK_SECRET`).
[ ] Vào catalog products, tạo 3 gói (Basic, Pro, Premium).
[ ] Copy 3 biến ID (`price_...`) điền vào `.env`: `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_PREMIUM`.
