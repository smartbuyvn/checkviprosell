# Stripe Configuration Checklist

Để module Billing hoạt động chính xác trên local và production, Operator BẮT BUỘC chèn đúng các thông số sau vào `backend/.env`. Thiếu bất kỳ một biến nào cũng khiến API Checkout fail ngay vòng gửi thông tin.

## 1. Secret Keys
- [ ] `STRIPE_SECRET_KEY` : (Bắt đầu bằng `sk_test_...` hoặc `sk_live_...`). Khác với Publishable Key. Dùng tạo API Server-to-Server.
- [ ] `STRIPE_WEBHOOK_SECRET` : (Bắt đầu bằng `whsec_...`). Dùng để xác thực payload gọi ngược về Webhook IP Ingress.

## 2. Price Mappings
Tạo sẵn 3 Product/Price bên trong Dashboard Stripe và lấy ID tương ứng:
- [ ] `STRIPE_PRICE_ID_BASIC` : (Ví dụ `price_1PabcXYZ...`) - Map với gói Basic (250 credit).
- [ ] `STRIPE_PRICE_ID_PRO` : (Ví dụ `price_1PdefXYZ...`) - Map với gói Pro (600 credit).
- [ ] `STRIPE_PRICE_ID_PREMIUM` : (Ví dụ `price_1PghiXYZ...`) - Map với gói Premium (1500 credit).

## 3. CORS & Callback Origins
- [ ] `VITE_APP_BASE_URL` : Phải cung cấp base URL của client (ví dụ `http://localhost:8080`) để Stripe gọi redirect `?payment=success`.
- Trong Stripe Dashboard Webhook, thêm URL: `https://<public-backend-url>/api/v1/webhooks/stripe`. Đảm bảo bật filter cho event `checkout.session.completed` và `charge.refunded`.
