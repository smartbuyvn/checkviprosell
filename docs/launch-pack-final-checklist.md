# Launch Pack Final Checklist

Tất cả cấu hình đã chuẩn bị xong. Operator chạy E2E Testing Path này như một người dùng độc lập.

- [ ] (1) Truy cập Domain Hostinger (`vidiosell.vn`), màn hình hiện Signup. Không văng lỗi mạng.
- [ ] (2) Đăng ký account mới. Chuyển vào trang /dashboard (Supabase Auth qua mặt Frontend).
- [ ] (3) Mua gói Credit Basic. Màn hình điều hướng trượt qua Stripe Hosted UI mượt mà.
- [ ] (4) Điền số thẻ test Stripe (`4242...`), thanh toán. Return về `vidiosell.vn/dashboard?payment=success`.
- [ ] (5) Xem Credit nhảy số (`250`). (Chứng minh Webhook ở nhà chọc thủng Cloudflare Tunnel OK).
- [ ] (6) Tạo App/Dự án -> Chạy luồng QA.
- [ ] (7) Console log tại nhà hiển thị: Ollama Intelligence chạy -> BullMQ Queue hoàn tất.
- [ ] (8) Video Render gửi Job tới Queue Render, bảng Terminal Render Worker báo `[Exec] FFmpeg running...`.
- [ ] (9) Bảng Lịch sử thanh toán tại `/billing` có dữ liệu Payment Intent mới cứng. No duplicated hooks.
