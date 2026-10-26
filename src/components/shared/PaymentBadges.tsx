/**
 * Viprosell — Payment Method Badges
 * Hiển thị phương thức thanh toán ĐANG dùng được: chuyển khoản VietQR qua SePay.
 * Không quảng cáo thẻ quốc tế/PayPal — v1 không nhận các hình thức đó.
 */

import { cn } from '@/lib/utils';

interface PaymentBadgesProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function PaymentBadges({ className, size = 'sm' }: PaymentBadgesProps) {
  const h = size === 'sm' ? 'h-5' : 'h-6';
  const badgeBase = cn('px-2 py-0.5 rounded bg-muted border border-border flex items-center justify-center', h);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={badgeBase}>
        <span className="text-[10px] font-bold tracking-wider text-info">VIETQR</span>
      </div>
      <div className={badgeBase}>
        <span className="text-[10px] font-bold tracking-wider text-foreground">CHUYỂN KHOẢN</span>
      </div>
    </div>
  );
}
