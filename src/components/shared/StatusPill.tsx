/**
 * Viprosell â€” Status Pill
 */
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  analyzing: 'bg-info/15 text-info',
  concept_ready: 'bg-accent/15 text-accent-foreground',
  script_ready: 'bg-accent/15 text-accent-foreground',
  render_queued: 'bg-warning/15 text-warning',
  rendering: 'bg-warning/15 text-warning',
  completed: 'bg-primary/15 text-primary',
  failed: 'bg-destructive/15 text-destructive',
  pending: 'bg-muted text-muted-foreground',
  active: 'bg-primary/15 text-primary',
};

const statusLabels: Record<string, string> = {
  draft: 'NhÃ¡p',
  analyzing: 'Äang phÃ¢n tÃ­ch',
  concept_ready: 'Concept sáºµn sÃ ng',
  script_ready: 'Script sáºµn sÃ ng',
  render_queued: 'Chá» render',
  rendering: 'Äang render',
  completed: 'HoÃ n thÃ nh',
  failed: 'Tháº¥t báº¡i',
  pending: 'Äang chá»',
  active: 'Hoáº¡t Ä‘á»™ng',
};

interface StatusPillProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      statusStyles[status] || statusStyles.draft,
      className
    )}>
      {label || statusLabels[status] || status}
    </span>
  );
}
