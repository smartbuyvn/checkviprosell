# Viprosell — Kế hoạch phát triển V2 (bản chốt cho dev)

Oct 19, 2026 · @Someone

## Bối cảnh & quyết định đã chốt

Viprosell V2 phục vụ affiliate TikTok Shop và shop nhỏ bán đa sàn ở Việt Nam, bán gói nạp qua VietQR, render bằng CPU. Chưa có khách trả tiền, nên dev được đổi schema, giá và API mà không cần di trú dữ liệu thanh toán.

| Chủ đề | Quyết định | Lý do |
| --- | --- | --- |
| Thị trường | Việt Nam trước (tháng 0–6). Quốc tế thử song song qua plugin WooCommerce. Đông Nam Á chỉ mở khi đạt cổng ở mục Kiểm thử thị trường | Lợi thế tiếng Việt, VietQR, cộng đồng; Mỹ/EU chi phí kéo khách quá cao |
| Khách đầu | Affiliate TikTok Shop đăng ≥ 1 video/ngày; shop nhỏ bán Shopee + TikTok + FB/Zalo | Nhà sáng tạo affiliate tăng 140% năm 2025; công cụ AI của TikTok nằm trong Seller Center |
| Định vị | "Video ra đơn, an toàn cho tài khoản": nội dung gốc, đúng luật quảng cáo, xuất đa nền tảng | "Ảnh → video có giọng" đã có công cụ miễn phí |
| Phạm vi v1 | Ảnh + clip quay theo hướng dẫn → 10 biến thể khác nhau thật → giọng Việt + phụ đề → tải / trang chia sẻ → gói nạp VietQR | Đủ để đo tỷ lệ video được đăng và tỷ lệ trả tiền |
| Không làm ở v1 | Face-swap, avatar AI, cảnh AI motion, đăng thẳng lên TikTok, Stripe / PayPal / Lemon Squeezy, Redis / BullMQ, render canvas trên trình duyệt, Remotion | Tốn công, rủi ro pháp lý, chưa có tín hiệu trả tiền |
| Giới thiệu bạn bè | v1 thưởng bằng credit, không trả tiền mặt. Hoa hồng tiền mặt chỉ cho đối tác được duyệt tay, mở lại sau tuần 6 | Chưa có doanh thu; credit giả mạo chỉ tốn giá vốn \~300đ/video, tiền mặt thì mất thật |
| Tương thích | Được reset schema, bảng giá, API. Trước khi reset: xuất CSV danh sách user hiện có | Chưa có giao dịch thật cần giữ |

Điều chỉnh so với bản đề xuất ngày 19/10: kiểm thử thị trường chạy song song với sprint 1, không chờ build xong; chương trình hoa hồng tiền mặt bị hoãn.
