/**
 * Thẻ video trong lưới Dashboard.
 *
 * Mỗi thẻ trả lời bốn câu người bán hỏi khi mở trang: video nào, dài bao lâu,
 * xem được chưa, và lấy đi đâu. Ảnh đại diện là thứ nhận ra nhanh nhất nên nó
 * chiếm phần lớn thẻ; chữ chỉ để phân biệt khi ảnh giống nhau.
 */
import { useRef, useState } from 'react';
import { Play, Download, Share2, Clock, Loader2, AlertCircle, Film, PencilLine, ArrowRight, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface VideoCardData {
  id: string;
  title: string;
  status: string;
  durationSec: number | null;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

/** 25 -> "0:25". Không rõ độ dài thì trả chuỗi rỗng để không bịa số. */
export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Hoàn thành',
  rendering: 'Đang dựng',
  renderqueued: 'Trong hàng đợi',
  processing: 'Đang xử lý',
  analyzing: 'Chưa phân tích xong',
  failed: 'Không thành công',
  draft: 'Bản nháp',
  // Thiếu hai nhãn này nên khách nhìn thấy đúng chữ `conceptready` — tên enum
  // trong mã nguồn, in thẳng lên thẻ video của họ.
  conceptready: 'Chọn concept',
  scriptready: 'Chờ dựng',
};

/**
 * Trạng thái MÁY đang làm thật. Chỉ những cái này mới được quay spinner.
 */
const MAY_DANG_CHAY = new Set(['renderqueued', 'rendering', 'processing', 'queued']);

/**
 * Trạng thái đang chờ NGƯỜI DÙNG làm tiếp — không ai đang xử lý chúng cả.
 */
const CHO_NGUOI_DUNG = new Set(['draft', 'analyzing', 'conceptready', 'scriptready']);

export type VideoStage = 'ready' | 'working' | 'waiting' | 'failed';

/**
 * Thẻ này đang ở giai đoạn nào.
 *
 * Bản cũ chỉ chia hai: xong hoặc "đang xử lý". Hậu quả đo được ngày 28/10: 33 dự án
 * (22 bản nháp + 7 phân tích dở + 4 chờ chọn concept) quay spinner kèm dòng chữ
 * "Đang xử lý..." trong khi KHÔNG có render nào chạy — không một job pending nào
 * trong cơ sở dữ liệu. Spinner bảo người dùng hãy chờ một việc không bao giờ tới,
 * nên thao tác duy nhất còn dùng được là xóa.
 *
 * Thẻ còn tự mâu thuẫn: nhãn góc ghi "Bản nháp", thân thẻ ghi "Đang xử lý...".
 *
 * Không nhận ra trạng thái thì coi là 'waiting' chứ KHÔNG phải 'working': đoán sai
 * về phía 'waiting' thì người dùng thấy nút "Tiếp tục" hơi thừa; đoán sai về phía
 * 'working' thì họ ngồi chờ vĩnh viễn — đúng cái lỗi này.
 */
export function stageOf(status: string, hasOutput: boolean): VideoStage {
  if (status === 'completed' && hasOutput) return 'ready';
  if (status === 'failed') return 'failed';
  if (MAY_DANG_CHAY.has(status)) return 'working';
  if (CHO_NGUOI_DUNG.has(status)) return 'waiting';
  return 'waiting';
}

export function VideoCard({
  video,
  onOpen,
  onDelete,
  deleting,
}: {
  video: VideoCardData;
  onOpen: () => void;
  /**
   * Xoá dự án này. Thiếu thì thẻ không hiện nút xoá.
   *
   * `Dashboard.handleDelete` vốn đã viết đầy đủ — có hộp xác nhận nói rõ thùng rác 30
   * ngày, có cập nhật lạc quan — nhưng KHÔNG chỗ nào gọi tới, và thẻ cũng không có
   * prop để nhận. Người dùng có 24 dự án dở dang và không cách nào dọn.
   */
  onDelete?: (e: React.MouseEvent) => void;
  /** Đang xoá: khoá nút để không bấm hai lần. */
  deleting?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const stage = stageOf(video.status, !!video.outputUrl);
  const ready = stage === 'ready';
  const failed = stage === 'failed';
  const waiting = stage === 'waiting';
  const duration = formatDuration(video.durationSec);

  async function share() {
    if (!video.outputUrl) return;
    // Trình duyệt di động có hộp chia sẻ hệ thống; máy tính thì chép link là đủ.
    if (navigator.share) {
      try {
        await navigator.share({ title: video.title, url: video.outputUrl });
        return;
      } catch {
        // Người dùng bấm huỷ — không phải lỗi, đừng báo gì.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(video.outputUrl);
      toast.success('Đã chép link video');
    } catch {
      toast.error('Không chép được link. Bấm Tải về rồi chia sẻ tệp.');
    }
  }

  return (
    <div className="group rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col transition-shadow hover:shadow-lg">
      {/* ─── Khung 9:16, luôn giữ tỉ lệ để lưới không nhảy khi ảnh tải xong ─── */}
      <div className="relative aspect-[9/16] bg-black/40">
        {ready && playing ? (
          <video
            ref={videoRef}
            src={video.outputUrl!}
            poster={video.thumbnailUrl ?? undefined}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => (ready ? setPlaying(true) : onOpen())}
            className="absolute inset-0 w-full h-full"
            aria-label={ready ? `Phát ${video.title}` : `Mở ${video.title}`}
          >
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                {failed ? (
                  <AlertCircle className="w-8 h-8 text-destructive/70" />
                ) : ready ? (
                  <Film className="w-8 h-8 text-muted-foreground/40" />
                ) : waiting ? (
                  // Bút chì, không phải spinner: việc này đang nằm ở người dùng.
                  <PencilLine className="w-7 h-7 text-muted-foreground/50" />
                ) : (
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                )}
              </div>
            )}

            {ready && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-black/55 p-3 backdrop-blur-sm transition-transform group-hover:scale-110">
                  <Play className="w-6 h-6 text-white fill-white" />
                </span>
              </span>
            )}

            {duration && (
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {duration}
              </span>
            )}

            {!ready && (
              <span
                className={cn(
                  'absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium',
                  failed ? 'bg-destructive/85 text-white' : 'bg-black/70 text-white'
                )}
              >
                {STATUS_LABEL[video.status] ?? video.status}
              </span>
            )}

            {onDelete && (
              // Luôn hiện trên màn cảm ứng, nơi không có trạng thái hover — ẩn theo
              // hover thì trên điện thoại không ai tìm ra nút xoá.
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                disabled={deleting}
                aria-label={`Xoá ${video.title}`}
                title="Chuyển vào thùng rác"
                className={cn(
                  'absolute top-1.5 right-1.5 z-10 rounded-md p-1.5 transition-all',
                  'bg-black/60 text-white/90 hover:bg-destructive hover:text-white',
                  'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
                  deleting && 'opacity-100 pointer-events-none'
                )}
              >
                {deleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </button>
        )}
      </div>

      {/* ─── Tên + thao tác ─── */}
      <div className="p-2.5 space-y-2">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left text-xs font-medium text-foreground line-clamp-2 hover:text-primary transition-colors"
          title={video.title}
        >
          {video.title}
        </button>

        {ready ? (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-[11px]" onClick={share}>
              <Share2 className="w-3 h-3" /> Chia sẻ
            </Button>
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 gap-1 text-[11px]">
              <a href={video.outputUrl!} download target="_blank" rel="noopener noreferrer">
                <Download className="w-3 h-3" /> Tải
              </a>
            </Button>
          </div>
        ) : waiting ? (
          // Việc đang nằm ở người dùng, nên thẻ phải đưa ra một nút bấm được —
          // không phải một dòng chữ bảo họ chờ.
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 gap-1 text-[11px] text-primary hover:text-primary"
            onClick={onOpen}
          >
            <ArrowRight className="w-3 h-3" /> Tiếp tục
          </Button>
        ) : failed ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 gap-1 text-[11px] text-destructive hover:text-destructive"
            onClick={onOpen}
          >
            <RotateCcw className="w-3 h-3" /> Xem lý do & thử lại
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground">Đang dựng...</p>
        )}
      </div>
    </div>
  );
}
