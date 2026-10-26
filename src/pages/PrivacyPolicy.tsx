/**
 * Viprosell — Chính sách Bảo mật (Privacy Policy)
 * Chuẩn hóa cho mô hình SaaS bán Credits + Subscription.
 * Nội dung bảo mật dữ liệu, cookie, bên thứ ba.
 */

import { Link } from 'react-router-dom';
import { MoveLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicLayout } from '@/components/layout/PublicLayout';

export default function PrivacyPolicy() {
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
          Chính sách Bảo mật
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Cập nhật lần cuối: 14 tháng 4, 2026
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Thông tin Thu thập</h2>
            <p className="mb-3">Chúng tôi thu thập các loại thông tin sau khi bạn sử dụng Dịch vụ:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Thông tin Tài khoản:</strong> Email, tên hiển thị, ảnh đại diện (avatar) khi bạn đăng ký qua email hoặc Google OAuth.
              </li>
              <li>
                <strong className="text-foreground">Dữ liệu Nội dung:</strong> Ảnh sản phẩm, video, URL sản phẩm và nội dung văn bản bạn cung cấp để tạo video bán hàng.
              </li>
              <li>
                <strong className="text-foreground">Dữ liệu Thanh toán:</strong> Các giao dịch được xử lý qua SePay. Viprosell <strong className="text-foreground">không lưu trữ</strong> thông tin thẻ ngân hàng hoặc tài khoản thanh toán trực tiếp.
              </li>
              <li>
                <strong className="text-foreground">Dữ liệu Sử dụng:</strong> Lịch sử dự án, thời gian render, chế độ render, nhật ký lỗi và mã truy vết (trace ID) phục vụ bảo trì hệ thống.
              </li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Mục đích Sử dụng Dữ liệu</h2>
            <p className="mb-3">Dữ liệu thu thập được sử dụng <strong className="text-foreground">duy nhất</strong> cho các mục đích:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Vận hành, duy trì và cải thiện Dịch vụ tạo video bán hàng.</li>
              <li>Xử lý giao dịch thanh toán và ghi nhận sổ cái credits (credit ledger) an toàn.</li>
              <li>Phân tích hiệu suất hệ thống, xử lý hàng đợi render, và khắc phục sự cố kỹ thuật.</li>
              <li>Gửi thông báo quản trị: xác nhận tài khoản, hoàn tất render, biến động tín dụng.</li>
              <li>Vận hành chương trình Affiliate (theo dõi mã giới thiệu, tính hoa hồng).</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Bảo mật Dữ liệu và Hạ tầng</h2>
            <p className="mb-3">
              Viprosell sử dụng kiến trúc phân tầng cơ sở dữ liệu (isolated database layers) với Row Level Security (RLS) được kích hoạt trên mọi bảng dữ liệu.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Xác thực người dùng được quản lý bởi <strong className="text-foreground">Supabase Auth</strong> với mã hóa JWT.</li>
              <li>Tài sản media (ảnh, video) được lưu trữ tạm thời trên Render Workers và xóa sau khi encode hoàn tất.</li>
              <li>Video đầu ra được lưu trong cloud storage bảo mật, chỉ có chủ sở hữu dự án mới có quyền truy cập.</li>
              <li>Mọi kết nối API sử dụng HTTPS/TLS và Bearer token authentication.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Tích hợp Bên thứ ba</h2>
            <p className="mb-3">Dịch vụ tích hợp với các bên thứ ba sau:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">SePay:</strong> Đối soát chuyển khoản ngân hàng nội địa Việt Nam qua webhook API.</li>
              <li><strong className="text-foreground">Supabase:</strong> Cơ sở dữ liệu, xác thực, và lưu trữ file.</li>
              <li><strong className="text-foreground">AI APIs:</strong> Các dịch vụ AI (khi được Admin kích hoạt) để phân tích sản phẩm và viết kịch bản. Dữ liệu gửi tới API AI không bao gồm thông tin cá nhân.</li>
            </ul>
            <p className="mt-3">
              Viprosell <strong className="text-foreground">không bán, trao đổi hoặc chia sẻ</strong> dữ liệu cá nhân của bạn cho bất kỳ bên thứ ba nào vì mục đích tiếp thị.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Cookie và Lưu trữ Trình duyệt</h2>
            <p>
              Dịch vụ sử dụng cookie phiên (session cookies) và localStorage để duy trì trạng thái đăng nhập, lưu mã giới thiệu (referral code), và các tùy chọn giao diện. Chúng tôi không sử dụng cookie theo dõi quảng cáo (advertising tracking cookies).
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Quyền của Người dùng</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Quyền truy cập:</strong> Bạn có thể xem toàn bộ dữ liệu cá nhân qua trang Tài khoản.</li>
              <li><strong className="text-foreground">Quyền xóa:</strong> Bạn có thể xóa dự án, tài sản, và tài khoản bất kỳ lúc nào qua trang Cài đặt Tài khoản. Dữ liệu sẽ được xóa vĩnh viễn trong vòng 30 ngày.</li>
              <li><strong className="text-foreground">Quyền phản đối:</strong> Bạn có thể từ chối nhận email thông báo (trừ thông báo giao dịch bắt buộc) bằng cách liên hệ <a href="mailto:support@viprosell.com" className="text-primary hover:underline transition-colors font-semibold">support@viprosell.com</a>.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Lưu giữ Dữ liệu</h2>
            <p>
              Dữ liệu tài khoản được lưu giữ trong suốt thời gian tài khoản hoạt động. Sau khi xóa tài khoản, toàn bộ dữ liệu cá nhân và dự án sẽ được xóa vĩnh viễn trong vòng 30 ngày, ngoại trừ hồ sơ giao dịch tài chính cần lưu giữ theo quy định pháp luật.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Cập nhật Chính sách</h2>
            <p>
              Chúng tôi có thể cập nhật Chính sách Bảo mật này theo thời gian. Mọi thay đổi sẽ được đăng tải trên trang này. Việc tiếp tục sử dụng Dịch vụ sau khi thay đổi đồng nghĩa với việc bạn chấp nhận chính sách mới.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Liên hệ</h2>
            <p>
              Mọi câu hỏi về Chính sách Bảo mật, vui lòng liên hệ: <a href="mailto:support@viprosell.com" className="text-primary hover:underline transition-colors font-semibold">support@viprosell.com</a>
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
