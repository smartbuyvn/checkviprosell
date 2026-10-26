/**
 * Viprosell — Package Card for landing & dashboard
 */
import { Video, ArrowRight, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PackageCardProps {
  name: string;
  tagline: string;
  useCase: string;
  duration: string;
  benefits: string[];
  /** Các chặng của video, hiện thành dải storyboard. Bỏ trống thì suy từ `name`. */
  storyboard?: string[];
  ctaLabel?: string;
  onCta?: () => void;
  featured?: boolean;
  className?: string;
}

/** Cấu trúc kịch bản từng gói, lấy theo đúng useCase mô tả trên landing. */
const STORYBOARDS: Record<string, string[]> = {
  'Quick Ads': ['Hook', 'USP', 'CTA'],
  'Review Video': ['Mở đầu', 'Trải nghiệm', 'Chốt'],
  'Conversion Video': ['Pain', 'Proof', 'Offer'],
};

const FALLBACK_STORYBOARD = ['Hook', 'Nội dung', 'CTA'];

export function PackageCard({
  name, tagline, useCase, duration, benefits, storyboard,
  ctaLabel = 'Bắt đầu', onCta, featured, className
}: PackageCardProps) {
  const frames = storyboard ?? STORYBOARDS[name] ?? FALLBACK_STORYBOARD;
  return (
    <div className={cn(
      // flex-col + mt-auto ở nút: số chip mỗi gói khác nhau nên nếu không ghim đáy
      // thì nút CTA ba thẻ lệch nhau.
      'group relative flex h-full flex-col rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-2px]',
      featured
        ? 'bg-surface-elevated border-glow shadow-card-hover'
        : 'bg-surface shadow-card hover:shadow-card-hover',
      className
    )}>
      {featured && (
        <div className="absolute -top-3 left-6 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
          Phổ biến nhất
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
      {/* Storyboard: mỗi khung là một chặng của video, tỉ lệ 9:16 như đầu ra thật */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          {frames.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <div className="relative aspect-[9/16] max-h-24 rounded-lg overflow-hidden border border-border bg-gradient-to-b from-primary/15 via-surface to-surface">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-primary/20 blur-xl" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-[26%] w-[46%] h-[30%] rounded-md bg-primary/30" />
                  <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1.5">
                    <span className="block h-[2px] w-2/3 rounded-full bg-primary/60" />
                    <span className="mt-[3px] block h-[2px] w-1/3 rounded-full bg-foreground/20" />
                  </div>
                  <span className="absolute top-1 left-1 w-3.5 h-3.5 rounded bg-background/70 text-[8px] font-bold text-muted-foreground flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                {/* Nhãn nằm dưới khung: ở trong khung thì "Trải nghiệm" bị cắt mất.
                    Chiều cao cố định cho 2 dòng — nhãn dài xuống dòng sẽ làm thẻ này
                    cao hơn hai thẻ bên cạnh và nút CTA lệch hàng. */}
                <span className="mt-1 flex h-7 items-start justify-center text-center text-[10px] leading-tight text-muted-foreground">
                  {stage}
                </span>
              </div>
              {i < frames.length - 1 && (
                <ChevronRight className="w-3 h-3 shrink-0 self-start mt-10 text-muted-foreground/50" aria-hidden />
              )}
            </div>
          ))}
        </div>
        {/* Một dòng: hai dòng sẽ đẩy nút CTA của thẻ này lệch khỏi hai thẻ bên cạnh */}
        <p className="mt-2 text-[11px] text-muted-foreground truncate">
          Cấu trúc kịch bản — minh hoạ bố cục
        </p>
      </div>
      <Button size="sm" onClick={onCta} className="mt-auto w-full group-hover:glow-primary transition-shadow">
        {ctaLabel} <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Button>
    </div>
  );
}
