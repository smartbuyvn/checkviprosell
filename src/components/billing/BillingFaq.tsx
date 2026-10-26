/**
 * Viprosell — Billing FAQ Component
 */
import { HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ_ITEMS = [
  { q: 'Thanh toán bằng gì?', a: 'Chuyển khoản ngân hàng qua mã VietQR. Quét mã, giữ nguyên nội dung chuyển khoản, hệ thống tự cộng credit sau vài phút. Chưa nhận thẻ quốc tế.' },
  { q: 'Có thể hủy gói bất kỳ lúc nào không?', a: 'Có. Bạn có thể hủy gói đăng ký bất kỳ lúc nào. Gói sẽ còn hiệu lực đến hết chu kỳ thanh toán hiện tại.' },
  { q: 'Credits chưa dùng có bị mất không?', a: 'Không. Credits không có hạn sử dụng và sẽ được giữ nguyên cho đến khi bạn sử dụng.' },
  { q: 'Có hoàn tiền không?', a: 'Chúng tôi hỗ trợ hoàn tiền trong 7 ngày đầu kể từ lần thanh toán đầu tiên nếu bạn chưa sử dụng dịch vụ. Liên hệ support để được hỗ trợ.' },
  { q: 'Nâng cấp gói thì credits cũ ra sao?', a: 'Khi nâng cấp, credits cũ vẫn giữ nguyên. Credits mới của gói sẽ được cộng thêm vào tài khoản.' },
  { q: 'Có thể mua thêm credits ngoài gói không?', a: 'Có. Bạn có thể mua credit packs bổ sung bất kỳ lúc nào từ trang Billing.' },
];

export function BillingFaq() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-4 h-4 text-primary" />
        <h2 className="font-display text-base font-semibold text-foreground">Câu hỏi về thanh toán</h2>
      </div>
      <Accordion type="single" collapsible className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`bfaq-${i}`} className="bg-card rounded-xl border-none px-5">
            <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground pb-4">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
