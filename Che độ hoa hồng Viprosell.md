# Hoàn tất Nâng cấp Hệ thống Affiliate

Dựa trên bản thiết kế đã thống nhất (chuẩn mô hình ai.dancing.net), tôi đã triển khai hoàn tất các tính năng Affiliate mới cho Viprosell với độ ổn định cao và logic được tối ưu 1 tầng.

## 1. Nâng cấp cốt lõi Backend (Webhooks)

Logic xử lý khi thanh toán qua SePay và Lemon Squeezy (`Stripe`) đã được viết lại:
- **Hoa hồng trọn đời (Lifetime Recurring):** Gỡ bỏ chốt "First-paid only", từ giờ Affiliate sẽ nhận hoa hồng trên **tất cả** giao dịch nạp Credit của người dùng họ giới thiệu.
- **Tính năng Hạng Bạc/Vàng (Dynamic Tiering):** Hệ thống tự động tính tổng số tiền hoa hồng tích lũy hợp lệ (Approved + Paid + Pending). Nếu đạt ngưỡng `2.500.000 VNĐ`, tỷ lệ hoa hồng sẽ tự động áp dụng mức **15% (Vàng)** thay vì **10% (Bạc)**.
- **Buyer Bonus +10%:** Khi tài khoản có chứa `referred_by` mua Credit, hệ thống sẽ tự động thưởng thêm 10% giá trị gói (được cộng thẳng vào Ledger).

## 2. API Cập nhật (`getDashboard`)

- Bổ sung trường dữ liệu `tier` (Hạng) và `totalAccumulatedVnd` (Tổng tích lũy) để Frontend có thể thiết kế thanh tiến trình.
- Cập nhật Policy trả về: thiết lập ngưỡng rút tối thiểu `125,000 VNĐ`.

## 3. Giao diện Affiliate Dashboard

- Thêm Box "Hạng Đối Tác" hiển thị Trạng thái (Bạc/Vàng).
- Tích hợp thanh Tiến trình (Progress bar) trực quan cho những tài khoản hạng Bạc, giúp họ có động lực đạt mốc 2.5 triệu VNĐ.
- Box quy chế được viết lại rõ ràng, tập trung vào ưu điểm: Hoa hồng trọn đời và ưu đãi giảm giá cho người được giới thiệu.

## 4. Giao diện Nạp Credit (Billing)

- Tích hợp "Banner Khuyến Mãi". Nếu hệ thống phát hiện người dùng đang xài mã giới thiệu của ai đó, một banner màu xanh Ngọc lục bảo sẽ hiện ra báo rằng họ sẽ được **+10% Credits thưởng thêm** mỗi khi nạp tiền, tạo động lực chốt đơn ngay lập tức.

> [!TIP]
> Hãy vào mục Nạp Credit bằng 1 tài khoản phụ (đã nhập mã giới thiệu) để kiểm tra độ "hấp dẫn" của banner khuyến mãi này! Mọi thay đổi đều đã lưu thẳng vào source code.
