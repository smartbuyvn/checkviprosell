/**
 * Viprosell — Điều khoản Sử dụng (Terms of Service)
 * Chuẩn hóa cho mô hình SaaS bán Credits + Subscription.
 * Thanh toán: SePay (VietQR, nội địa).
 */

import { Link } from 'react-router-dom';
import { MoveLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicLayout } from '@/components/layout/PublicLayout';

export default function TermsOfService() {
  return (
    <PublicLayout headerVariant="solid">
      <div className="container max-w-3xl py-16 px-4 sm:px-6 animate-in fade-in duration-500">
        <Link to="/">
          <Button variant="ghost" className="mb-8 -ml-2 text-muted-foreground hover:text-foreground">
            <MoveLeft className="mr-2 h-4 w-4" />
            Quay lại Trang chủ
          </Button>
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight text-foreground mb-3">
          Điều khoản Sử dụng
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Cập nhật lần cuối: 14 tháng 4, 2026
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Chấp nhận Điều khoản</h2>
            <p>
              Bằng việc truy cập và sử dụng nền tảng Viprosell (sau đây gọi là "Dịch vụ"), bạn xác nhận rằng bạn đã đọc, hiểu và đồng ý tuân thủ toàn bộ các điều khoản được nêu trong tài liệu này. Nếu bạn không đồng ý, vui lòng ngừng sử dụng Dịch vụ.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Mô tả Dịch vụ</h2>
            <p>
              Viprosell là nền tảng tạo video bán hàng (commerce video) sử dụng trí tuệ nhân tạo. Người dùng tải lên ảnh sản phẩm thật hoặc cung cấp link sản phẩm, hệ thống AI sẽ phân tích, viết kịch bản, và dựng video tối ưu cho TikTok, Reels, và các kênh bán hàng trực tuyến.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Tín dụng (Credits) và Gói cước</h2>
            <p className="mb-3">
              Dịch vụ vận hành theo mô hình tín dụng (credit-based). Credits chỉ bị trừ khi video được render và biên dịch (encode) thành công. Các trường hợp render thất bại do lỗi hệ thống <strong className="text-foreground">sẽ không bị tính phí</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Gói Free:</strong> 5 credits miễn phí, không giới hạn thời gian. Giới hạn chế độ render draft (local).</li>
              <li><strong className="text-foreground">Gói Pro / Business / Premium:</strong> Credits được nạp hàng tháng theo gói đăng ký. Credits chưa sử dụng <strong className="text-foreground">không</strong> được cộng dồn sang tháng tiếp theo trừ khi có ghi chú riêng.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Thanh toán và Cổng giao dịch</h2>
            <p className="mb-3">Viprosell nhận thanh toán qua một cổng duy nhất:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">SePay (VietQR):</strong> Chuyển khoản ngân hàng nội địa Việt Nam. Giao dịch được đối soát tự động qua API webhook. Nội dung chuyển khoản phải giữ nguyên để hệ thống nhận diện và cộng credits tự động.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Chính sách Hoàn tiền</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Credits đã sử dụng (đã render video thành công) <strong className="text-foreground">không được hoàn lại</strong> dưới bất kỳ hình thức nào.</li>
              <li>Credits chưa sử dụng trong gói Premium/Business có thể được xem xét hoàn tiền trong vòng 7 ngày kể từ ngày mua, trừ đi phí giao dịch của cổng thanh toán.</li>
              <li>Giao dịch qua SePay đã hoàn tất chuyển khoản nhưng hệ thống cộng credits thành công <strong className="text-foreground">không được hoàn lại</strong>.</li>
              <li>Yêu cầu hoàn tiền gửi về: <a href="mailto:support@ninhle.com" className="text-primary hover:underline transition-colors font-semibold">support@ninhle.com</a></li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Quyền sở hữu Nội dung</h2>
            <p className="mb-3">
              Bạn giữ toàn bộ quyền sở hữu đối với ảnh, video gốc và nội dung bạn tải lên. Khi sử dụng Dịch vụ, bạn cấp cho Viprosell giấy phép tạm thời, hạn chế để xử lý, lưu trữ và biến đổi tài sản của bạn <strong className="text-foreground">chỉ nhằm mục đích tạo video theo yêu cầu</strong>.
            </p>
            <p>
              Nghiêm cấm sử dụng Dịch vụ để tạo nội dung lừa đảo, vi phạm pháp luật, xâm phạm quyền riêng tư, hoặc nội dung phản cảm/độc hại.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Chương trình Affiliate</h2>
            <p>
              Người dùng có thể tham gia chương trình giới thiệu (Affiliate) để nhận hoa hồng khi người được giới thiệu mua gói trả phí. Viprosell có quyền điều chỉnh tỉ lệ hoa hồng và điều kiện chương trình vào bất kỳ thời điểm nào, với thông báo trước ít nhất 7 ngày.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Giới hạn Trách nhiệm</h2>
            <p>
              Dịch vụ được cung cấp trên cơ sở "nguyên trạng" (as-is) mà không kèm theo bất kỳ bảo đảm nào. Viprosell không chịu trách nhiệm cho bất kỳ thiệt hại gián tiếp, ngẫu nhiên, đặc biệt hoặc hậu quả nào phát sinh từ việc sử dụng hoặc không thể sử dụng Dịch vụ.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Thay đổi Điều khoản</h2>
            <p>
              Viprosell có quyền cập nhật các Điều khoản Sử dụng này vào bất kỳ thời điểm nào. Thay đổi có hiệu lực ngay khi được đăng tải. Việc tiếp tục sử dụng Dịch vụ sau khi thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Liên hệ</h2>
            <p>
              Mọi thắc mắc liên quan đến Điều khoản Sử dụng, vui lòng liên hệ: <a href="mailto:support@ninhle.com" className="text-primary hover:underline transition-colors font-semibold">support@ninhle.com</a>
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
