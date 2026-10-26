/**
 * Viprosell — Status Pill
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
  draft: 'Nháp',
  analyzing: 'Đang phân tích',
  conceptready: 'Concept sẵn sàng',
  scriptready: 'Script sẵn sàng',
  renderqueued: 'Chờ render',
  rendering: 'Đang render',
  completed: 'Hoàn thành',
  failed: 'Thất bại',
  pending: 'Đang chờ',
  active: 'Hoạt động',
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
