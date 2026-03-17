/**
 * Viprosell â€” Demo Thumbnail Card
 */
import { Play, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemoThumbnailProps {
  packageBadge: string;
  title: string;
  hook: string;
  duration: string;
  className?: string;
}

export function DemoThumbnail({ packageBadge, title, hook, duration, className }: DemoThumbnailProps) {
  return (
    <div className={cn(
      'group relative rounded-xl overflow-hidden bg-surface shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer hover:translate-y-[-2px]',
      className
    )}>
      {/* Thumbnail area */}
      <div className="aspect-[9/16] max-h-[220px] bg-muted/30 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center z-10 group-hover:bg-primary/30 transition-colors">
          <Play className="w-4 h-4 text-primary ml-0.5" />
        </div>
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary/90 text-primary-foreground text-[10px] font-semibold rounded-md">
          {packageBadge}
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-background/70 rounded text-[10px] text-muted-foreground">
          <Clock className="w-2.5 h-2.5" /> {duration}
        </div>
      </div>
      {/* Info */}
      <div className="p-3">
        <h4 className="font-display text-sm font-semibold text-foreground truncate">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{hook}</p>
      </div>
    </div>
  );
}
