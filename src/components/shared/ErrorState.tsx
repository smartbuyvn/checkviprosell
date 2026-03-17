/**
 * Shared error state component.
 */

import { AlertCircle, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ icon: Icon = AlertCircle, title = 'Đã xảy ra lỗi', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <Icon className="w-12 h-12 text-destructive/70 mb-4" />
      <h3 className="font-display text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">Thử lại</Button>
      )}
    </div>
  );
}
