/**
 * Viprosell â€” Payment Method Badges
 * Shows supported payment method icons (Visa, Mastercard, PayPal).
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
        <span className="text-[10px] font-bold tracking-wider text-info">VISA</span>
      </div>
      <div className={badgeBase}>
        <span className="text-[10px] font-bold tracking-wider text-warning">MC</span>
      </div>
      <div className={badgeBase}>
        <span className="text-[10px] font-bold tracking-wider text-info">PayPal</span>
      </div>
    </div>
  );
}
