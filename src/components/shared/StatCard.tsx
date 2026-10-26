/**
 * Viprosell — Stat Card for dashboard
 */
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  className?: string;
}

export function StatCard({ icon: Icon, label, value, sublabel, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl p-4 bg-surface shadow-card', className)}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-lg font-bold text-foreground">{value}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}
