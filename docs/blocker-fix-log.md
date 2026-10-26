# Blocker Fix Log

Trước khi chạm mốc Go/No-Go, hệ thống từng xuất hiện các khoảng mờ (Grey Area/Mocking). Dưới đây là biên bản gỡ Blocker để chứng minh Viprosell đã đạt chuẩn Real-world Launch:

1. **Major Mismatch Fixed**: Bóc tách Mock Checkout.
   - *Vấn đề*: Endpoint `/checkout` trả về `cs_test_random` giả để dev không cần thẻ.
   - *Fix*: Đã cấy Stripe SDK, ánh xạ thẳng vào `STRIPE_PRICE_ID_...` để ép dòng tiền chạy qua cổng Stripe Hosted thật.

2. **Blocker Fixed**: Lỗi parse HMAC Webhook.
   - *Vấn đề*: Fastify mặc định phá hủy raw string buffer, khiến SDK Stripe ném lỗi báo Signature invalid do payload JSON bị format sai cấu trúc byte.
   - *Fix*: Chích một custom `fastify.addContentTypeParser` riêng rẽ vào plugin Stripe. Giải cứu rawBody không trầy xước.

3. **Blocker Fixed**: Rủi ro trùng lặp Credit (Replay Attack).
   - *Vấn đề*: Nếu gọi `/stripe` webhook nhiều lần, User được X2 credit liên tục.
   - *Fix*: DB Guard `idempotency_keys` bắt Constraint Violation `23505`. Fastify trả về `200` để Stripe ngưng quấy rối, nhưng không xuất credit ra.

4. **Major Mismatch Fixed**: Hostinger SPA 404.
   - *Vấn đề*: Hostinger Shared-Hosting không hiểu Dynamic Router của React.
   - *Fix*: Sinh file `public/.htaccess` nhồi chỉ thị Rewrite `. -> index.html`.
