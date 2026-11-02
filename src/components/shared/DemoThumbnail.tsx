/**
 * Viprosell — Demo Thumbnail Card
 *
 * Khung 9:16 dựng lại bố cục của video đầu ra: ảnh sản phẩm, overlay text (hook) và
 * thanh phụ đề cháy sẵn.
 *
 * Trước đây dùng gradient thay ảnh, với lý do "bịa ảnh sản phẩm sẽ thành quảng cáo
 * sai". Lý do đó đúng khi chưa có gì để đưa lên — nhưng nay ảnh là khung lấy từ chính
 * video Viprosell dựng ra, nên không còn là bịa.
 *
 * Ảnh đã cắt lấy phần nội dung trong khung điện thoại, bỏ logo cũ ở viền và watermark
 * của công cụ sinh ảnh. WebP 300×534, mỗi tấm 15–27 KB, cả sáu 119 KB — ô chỉ hiển thị
 * ở 124×220 nên kích thước này đã dư cho màn hình retina.
 */
import { Play, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemoThumbnailProps {
  /** Ảnh nền 9:16. Thiếu thì thẻ lui về gradient theo gói. */
  image?: string;
  /**
   * Bấm vào thẻ thì đi đâu.
   *
   * Thẻ có `cursor-pointer` và một nút Play ở giữa, nên nó HỨA là bấm được. Trước đây
   * không có handler nào — người xem bấm rồi không hiểu vì sao không có gì xảy ra.
   */
  onOpen?: () => void;
  packageBadge: string;
  title: string;
  hook: string;
  duration: string;
  className?: string;
}

/** Mỗi gói một tông màu, khớp với badge. Tailwind cần class tĩnh nên viết đủ chuỗi. */
const ACCENTS: Record<string, { field: string; glow: string; subject: string; bar: string }> = {
  'Quick Ads': {
    field: 'bg-gradient-to-br from-amber-500/25 via-orange-500/10 to-background',
    glow: 'bg-amber-400/25',
    subject: 'bg-gradient-to-b from-amber-200/70 to-orange-500/40',
    bar: 'bg-amber-400',
  },
  'Review Video': {
    field: 'bg-gradient-to-br from-emerald-500/25 via-teal-500/10 to-background',
    glow: 'bg-emerald-400/25',
    subject: 'bg-gradient-to-b from-emerald-200/70 to-teal-500/40',
    bar: 'bg-emerald-400',
  },
  Conversion: {
    field: 'bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-background',
    glow: 'bg-violet-400/25',
    subject: 'bg-gradient-to-b from-violet-200/70 to-fuchsia-500/40',
    bar: 'bg-violet-400',
  },
};

const FALLBACK_ACCENT = ACCENTS['Quick Ads'];

/** Hook trong dữ liệu có dấu ngoặc kép bao ngoài; video thật không hiện dấu đó. */
function stripQuotes(text: string): string {
  return text.replace(/^["'“‘]+/, '').replace(/["'”’]+$/, '');
}

export function DemoThumbnail({ image, onOpen, packageBadge, title, hook, duration, className }: DemoThumbnailProps) {
  const accent = ACCENTS[packageBadge] ?? FALLBACK_ACCENT;
  const overlay = stripQuotes(hook);

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      aria-label={onOpen ? `Tạo video ${packageBadge}: ${title}` : undefined}
      className={cn(
        'group relative rounded-xl overflow-hidden bg-surface shadow-card hover:shadow-card-hover transition-all duration-300 hover:translate-y-[-2px]',
        // Chỉ hiện con trỏ bàn tay khi thật sự bấm được. Hứa bằng con trỏ rồi không
        // làm gì là cách nhanh nhất để người dùng kết luận trang bị hỏng.
        onOpen ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : '',
        className
      )}
    >
      {/* ─── Khung video 9:16 ─── */}
      <div className={cn('aspect-[9/16] max-h-[220px] relative overflow-hidden', accent.field)}>
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          /* Đường lui khi thiếu ảnh: gợi ý vùng đặt sản phẩm bằng đồ hoạ. */
          <>
            <div className={cn('absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full blur-2xl', accent.glow)} />
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2 top-[22%] w-[42%] h-[34%] rounded-[1.1rem] blur-[1px]',
                'shadow-lg transition-transform duration-500 group-hover:scale-105',
                accent.subject
              )}
            />
            <div className="absolute left-1/2 -translate-x-1/2 top-[53%] w-[30%] h-2 rounded-full bg-background/25 blur-md" />
          </>
        )}

        {/* Scrim để chữ overlay luôn đọc được, giống video thật */}
        <div className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent',
          // Trên ảnh thật, nền phải đậm hơn: ảnh sản phẩm hay có vùng sáng ngay chỗ
          // đặt chữ, và chữ trắng trên nền sáng là không đọc được.
          image ? 'h-[55%] via-background/90' : 'h-[62%] via-background/80'
        )} />

        {/* Overlay text — đúng vai trò hook trên video */}
        <div className="absolute inset-x-0 bottom-0 px-2 pb-2">
          <p className="text-[11px] leading-[1.25] font-bold text-foreground line-clamp-3 drop-shadow-sm">
            {overlay}
          </p>
          {/* Thanh phụ đề cháy sẵn */}
          <div className="mt-1.5 flex items-center gap-1">
            <span className={cn('h-[3px] w-5 rounded-full', accent.bar)} />
            <span className="h-[3px] flex-1 rounded-full bg-foreground/25" />
            <span className="h-[3px] w-3 rounded-full bg-foreground/15" />
          </div>
        </div>

        {/* Nút play, nổi lên khi hover */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-background/55 backdrop-blur-sm border border-foreground/20 flex items-center justify-center transition-all duration-300 group-hover:bg-background/75 group-hover:scale-110">
            <Play className="w-4 h-4 text-foreground ml-0.5" />
          </div>
        </div>

        {/* Badge chiếm trọn hàng trên: thời lượng xuống phần thông tin để "Review Video" không bị cắt */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary/90 text-primary-foreground text-[10px] font-semibold rounded-md">
          {packageBadge}
        </div>
      </div>

      {/* ─── Thông tin ─── */}
      <div className="p-3">
        <h4 className="font-display text-sm font-semibold text-foreground truncate">{title}</h4>
        {/* Hook đã hiện làm overlay trên khung hình rồi, không lặp lại ở đây */}
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" /> {duration}
        </div>
      </div>
    </div>
  );
}
