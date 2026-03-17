/**
 * Viprosell â€” Package Card for landing & dashboard
 */
import { Video, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PackageCardProps {
  name: string;
  tagline: string;
  useCase: string;
  duration: string;
  benefits: string[];
  ctaLabel?: string;
  onCta?: () => void;
  featured?: boolean;
  className?: string;
}

export function PackageCard({
  name, tagline, useCase, duration, benefits, ctaLabel = 'Báº¯t Ä‘áº§u', onCta, featured, className
}: PackageCardProps) {
  return (
    <div className={cn(
      'group relative rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-2px]',
      featured
        ? 'bg-surface-elevated border-glow shadow-card-hover'
        : 'bg-surface shadow-card hover:shadow-card-hover',
      className
    )}>
      {featured && (
        <div className="absolute -top-3 left-6 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
          Phá»• biáº¿n nháº¥t
        </div>
      )}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <Video className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-display text-lg font-bold text-foreground mb-1">{name}</h3>
      <p className="text-sm text-primary font-medium mb-2">{tagline}</p>
      <p className="text-sm text-muted-foreground mb-4">{useCase}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Clock className="w-3.5 h-3.5" /> {duration}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {benefits.map((b) => (
          <span key={b} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
            {b}
          </span>
        ))}
      </div>
      <div className="h-24 rounded-lg bg-muted/50 border border-border flex items-center justify-center mb-5">
        <span className="text-xs text-muted-foreground">Sample output preview</span>
      </div>
      <Button size="sm" onClick={onCta} className="w-full group-hover:glow-primary transition-shadow">
        {ctaLabel} <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Button>
    </div>
  );
}
