/**
 * Viprosell â€” Pricing Card
 */
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentBadges } from '@/components/shared/PaymentBadges';
import { cn } from '@/lib/utils';

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel?: string;
  onCta?: () => void;
  featured?: boolean;
  showPaymentBadges?: boolean;
  className?: string;
}

export function PricingCard({
  name, price, period, description, features, ctaLabel = 'Báº¯t Ä‘áº§u', onCta, featured, showPaymentBadges = true, className
}: PricingCardProps) {
  return (
    <div className={cn(
      'rounded-2xl p-6 transition-all duration-300',
      featured
        ? 'bg-surface-elevated border-glow shadow-card-hover relative'
        : 'bg-surface shadow-card hover:shadow-card-hover',
      className
    )}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full whitespace-nowrap">
          Phá»• biáº¿n nháº¥t
        </div>
      )}
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="mb-5">
        <span className="font-display text-3xl font-bold text-foreground">{price}</span>
        <span className="text-sm text-muted-foreground ml-1">/{period}</span>
      </div>
      <ul className="space-y-2.5 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-secondary-foreground">
            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        onClick={onCta}
        variant={featured ? 'default' : 'outline'}
        className={cn('w-full mb-3', featured && 'glow-primary')}
      >
        {ctaLabel} <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Button>
      {showPaymentBadges && (
        <div className="flex justify-center">
          <PaymentBadges size="sm" />
        </div>
      )}
    </div>
  );
}
