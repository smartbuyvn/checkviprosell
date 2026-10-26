/**
 * Viprosell — Section Header component
 */
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  className?: string;
  align?: 'center' | 'left';
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ badge, title, subtitle, className, align = 'center' }, ref) => {
    return (
      <div ref={ref} className={cn(align === 'center' ? 'text-center' : 'text-left', 'mb-12', className)}>
        {badge && (
          <span className="inline-block text-xs font-medium tracking-wider uppercase text-primary mb-3 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            {badge}
          </span>
        )}
        <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3 leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    );
  }
);

SectionHeader.displayName = 'SectionHeader';
