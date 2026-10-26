# Provider Config Checklist

## 1. STRIPE [Status: Ready for operator config]
- [ ] Chèn Secret Keys (`sk_live_...`) và Webhook Secret (`whsec_...`) vào `.env` backend.
- [ ] Tạo 3 gói Pricing trong dashboard Stripe, lấy ID dán vào 3 biến `STRIPE_PRICE_ID_*`.

## 2. SUPABASE [Status: Ready for operator config]
- [ ] Thiết lập Project Public URL qua `.env` hai bên.
- [ ] Vào trình đơn Auth > URL Configuration, gán Site URL là `https://vidiosell.vn`.

## 3. HOSTINGER [Status: Ready for operator config]
- [ ] Trỏ Domain A Record về IP Hostinger.
- [ ] Config Webserver (đã có `public/.htaccess`).
- [ ] Upload file nén `/dist` tĩnh thuần Javascript.

## 4. CLOUDFLARE TUNNEL [Status: Ready for operator config]
- [ ] Chạy lệnh `cloudflared` ở PC local.
- [ ] Liên kết tên miền con `api.vidiosell.vn` vào địa chỉ `127.0.0.1:3001`.

## 5. RENDER CLOUD PROVIDER [Status: Blocked by missing real provider implementation]
- *Lý do khóa:* Mọi API trỏ lên dịch vụ Cloud API GPU Render bên thứ ba chưa được Implement thật trong SDK, toàn bộ MVP đang khóa chết cờ `PREMIUM_RENDER_ENABLED=false`. Hẹn Phase 2.
