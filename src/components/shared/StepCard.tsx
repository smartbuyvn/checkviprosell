/**
 * Viprosell â€” Step Card for How It Works
 */
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StepCardProps {
  step: number;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function StepCard({ step, icon: Icon, title, description, className }: StepCardProps) {
  return (
    <div className={cn('relative flex flex-col items-center text-center', className)}>
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 relative">
        <Icon className="w-6 h-6 text-primary" />
        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <h3 className="font-display text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
