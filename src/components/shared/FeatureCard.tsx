/**
 * Viprosell — Feature Card for "Why Viprosell"
 */
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <div className={cn(
      'rounded-xl p-5 bg-surface shadow-card hover:shadow-card-hover transition-all duration-300',
      className
    )}>
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
