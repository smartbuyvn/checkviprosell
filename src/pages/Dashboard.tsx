/**
 * Viprosell — Dashboard Page (Real Data)
 * With proper loading, empty, and error states.
 * Shows credit exhaustion warning for free users.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderPlus, Video, Coins, CreditCard,
  ArrowRight, LayoutGrid, Film, AlertTriangle, Trash2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { StatCard } from '@/components/shared/StatCard';
import { StatusPill } from '@/components/shared/StatusPill';
import { VideoCard, stageOf } from '@/components/shared/VideoCard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES, buildRoute } from '@/constants/routes';
import { PACKAGE_LIST } from '@/constants/packages';
import { ProjectService } from '@/services/project.service';
import { BillingService } from '@/services/billing.service';
import { RenderService } from '@/services/render.service';
import { CreditService } from '@/services/credit.service';
import { useAuth } from '@/hooks/useAuth';
import { isAbortOrLockError, getUserErrorMessage } from '@/lib/errorUtils';

/** Map project status to the furthest screen the user can resume */
function getProjectRoute(project: { id: string; status: string }): string {
  switch (project.status) {
    case 'draft':
    case 'analyzing':
      return buildRoute(ROUTES.PROJECT_ANALYSIS, { projectId: project.id });
    case 'conceptready':
      return buildRoute(ROUTES.PROJECT_CONCEPTS, { projectId: project.id });
    case 'scriptready':
    case 'renderqueued':
    case 'rendering':
    case 'completed':
    case 'failed':
      return buildRoute(ROUTES.PROJECT_SCRIPT, { projectId: project.id });
    default:
      return buildRoute(ROUTES.PROJECT_ANALYSIS, { projectId: project.id });
  }
}

/** Max number of automatic retries on AbortError / Lock broken */
/** 24 vua kin man hinh rong nhat (6 cot x 4 hang) ma van nhe. */
const PAGE_SIZE = 24;

const MAX_RETRY = 2;
const RETRY_DELAY_MS = 1500;

/** Bộ lọc trạng thái, gom các mã trong CSDL về nhóm người bán hiểu được. */
const STATUS_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'done', label: 'Hoàn thành' },
  // Tách "đang dựng" khỏi "chưa hoàn tất". Gộp chung thì tab "Đang xử lý" đếm cả
  // bản nháp — ngày 28/10 nó hiện 21 mục trong khi cơ sở dữ liệu không có một job
  // nào đang chạy. Người bán nhìn con số đó và tưởng hệ thống đang tắc.
  { key: 'working', label: 'Đang dựng' },
  { key: 'waiting', label: 'Chưa hoàn tất' },
  { key: 'failed', label: 'Không thành công' },
] as const;

type StatusFilterKey = (typeof STATUS_FILTERS)[number]['key'];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  /** Còn trang sau không: lấy đủ PAGE_SIZE nghĩa là nhiều khả năng còn. */
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<string>('Free');
  const [renderCount, setRenderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  /** Đã xử lý bao nhiêu trong lượt dọn — dọn 36 dự án mất khá lâu, phải cho thấy nhịp. */
  const [bulkDone, setBulkDone] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');

  /**
   * Lọc ở phía trình duyệt, không gọi lại máy chủ.
   *
   * Một người bán có vài chục tới vài trăm dự án, đã nằm sẵn trong bộ nhớ — gọi lại
   * máy chủ mỗi lần gõ một chữ là chậm hơn và tốn hơn mà không được gì.
   */
  const filteredVideos = projects.filter((p: any) => {
    const q = query.trim().toLowerCase();
    if (q && !String(p.title ?? '').toLowerCase().includes(q)) return false;

    if (statusFilter === 'done') return !!p.video;
    if (statusFilter === 'failed') return p.status === 'failed';

    // Dùng chính hàm mà thẻ video dùng. Hai danh sách trạng thái song song là cách
    // chắc chắn để bộ lọc và cái thẻ nó lọc ra nói hai điều khác nhau.
    const stage = stageOf(p.video ? 'completed' : p.status, !!p.video?.output_url);
    if (statusFilter === 'working') return stage === 'working';
    if (statusFilter === 'waiting') return stage === 'waiting';
    return true;
  });
  const retryCountRef = useRef(0);

  const handleDelete = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    
    const isProcessing = ['analyzing', 'queued', 'processing', 'rendering'].includes(project.status);
    const msg = isProcessing 
      // Nói rõ hai điều khách cần biết trước khi bấm: còn cứu được bao lâu, và
      // sau đó mất hẳn. Bản cũ ghi "Xóa video khỏi dashboard" nghe như chỉ ẩn đi.
      ? 'Video đang được xử lý. Hủy tiến trình và chuyển vào thùng rác?\n\nVideo nằm trong thùng rác 30 ngày, sau đó bị xóa vĩnh viễn khỏi máy chủ.'
      : 'Chuyển video vào thùng rác?\n\nVideo nằm đó 30 ngày rồi bị xóa vĩnh viễn khỏi máy chủ — kể cả link đã chia sẻ cũng sẽ hỏng.\n\nCredits đã dùng không được hoàn lại.';

    if (!window.confirm(msg)) return;

    setDeletingId(project.id);
    const res = await ProjectService.trashProject(project.id);
    setDeletingId(null);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.cancel_requested ? 'Đã hủy và đưa vào thùng rác' : 'Đã xóa dự án');
      // Optimistic UI update
      setProjects(prev => prev.filter(p => p.id !== project.id));
      if (!isProcessing && project.status === 'completed') {
        setRenderCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  /**
   * Dọn mọi bản nháp dở dang đang hiện trong bộ lọc.
   *
   * Xoá từng cái khi có 24 dự án treo là cực hình, và chính vì vậy người bán sẽ không
   * dọn — họ bỏ qua, rồi bảng điều khiển ngày càng khó dùng.
   *
   * Chỉ áp cho nhóm "chưa hoàn tất": KHÔNG đụng tới video đã xong (khách mất thành
   * phẩm) và KHÔNG đụng tới thứ máy đang dựng (huỷ giữa chừng vẫn tốn credit đã trừ).
   */
  /**
   * Những dự án được phép dọn hàng loạt, theo tab đang chọn.
   *
   * KHÔNG BAO GIỜ gồm video đã hoàn thành (khách mất thành phẩm) và video đang dựng
   * (huỷ giữa chừng vẫn tốn credit đã trừ). Hai nhóm đó chỉ xoá được từng cái, có
   * hộp xác nhận riêng.
   *
   * Bản đầu chỉ bắt nhóm 'waiting' nên 5 dự án HỎNG không dọn được — mà video hỏng
   * mới là thứ người bán muốn dọn nhất.
   */
  const nhomDonDuoc = (() => {
    const cho = filteredVideos.filter((p: any) => !p.video && stageOf(p.status, false) === 'waiting');
    const hong = filteredVideos.filter((p: any) => !p.video && p.status === 'failed');

    if (statusFilter === 'waiting') return { ds: cho, nhan: 'bản nháp chưa hoàn tất' };
    if (statusFilter === 'failed') return { ds: hong, nhan: 'video không thành công' };
    if (statusFilter === 'all') return { ds: [...cho, ...hong], nhan: 'dự án dở dang và hỏng' };
    // Tab "Hoàn thành" và "Đang dựng": không cho dọn hàng loạt.
    return { ds: [] as any[], nhan: '' };
  })();

  const handleBulkDelete = async () => {
    const { ds, nhan } = nhomDonDuoc;
    if (ds.length === 0) return;

    const msg =
      `Chuyển ${ds.length} ${nhan} vào thùng rác?

` +
      `Chúng nằm đó 30 ngày rồi bị xoá vĩnh viễn khỏi máy chủ.

` +
      `Video đã hoàn thành và video đang dựng KHÔNG bị ảnh hưởng.`;
    if (!window.confirm(msg)) return;

    setBulkDeleting(true);
    setBulkDone(0);

    // Tuần tự chứ không song song: hàng chục lệnh xoá cùng lúc dễ chạm giới hạn tần
    // suất, và lỗi giữa chừng thì không biết cái nào đã xoá.
    const ok: string[] = [];
    const loi: string[] = [];
    for (const p of ds) {
      const res = await ProjectService.trashProject(p.id);
      if (res.error) loi.push(res.error);
      else ok.push(p.id);
      setBulkDone(ok.length + loi.length);
    }

    setBulkDeleting(false);
    setBulkDone(0);

    if (ok.length > 0) setProjects((prev) => prev.filter((p: any) => !ok.includes(p.id)));
    if (loi.length === 0) {
      toast.success(`Đã dọn ${ok.length} dự án`);
    } else {
      // Nói rõ lý do đầu tiên thay vì chỉ đếm: "thử lại" mà không biết vì sao hỏng
      // thì lần sau cũng hỏng y hệt.
      toast.error(`Dọn được ${ok.length}/${ds.length}. Lỗi: ${loi[0]}`);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      /* ─── Promise.allSettled: Each data source fails independently ───
       * If renders table doesn't exist, projects + credits still load.
       * If billing summary fails, dashboard still shows projects.
       * No single failure kills the entire page.
       * ─────────────────────────────────────────────────────────────── */
      const [projRes, creditRes, renderRes, summaryRes] = await Promise.allSettled([
        // Lấy kèm video và độ dài trong MỘT truy vấn, để lưới thẻ có đủ dữ liệu mà
        // không phải gọi thêm một lượt cho mỗi dự án.
        ProjectService.listWithVideos(),
        CreditService.getBalance(),
        RenderService.getCompletedCount(),
        BillingService.getBillingSummary(),
      ]);

      /* ─── Auto-Retry: If any result hit AbortError, retry after delay ─── */
      const allResults = [projRes, creditRes, renderRes, summaryRes];
      const hasLockError = allResults.some(
        r => r.status === 'rejected' && isAbortOrLockError(r.reason)
      );
      if (hasLockError && retryCountRef.current < MAX_RETRY) {
        retryCountRef.current++;
        console.warn(`[Dashboard] Lock error detected — auto-retry ${retryCountRef.current}/${MAX_RETRY} in ${RETRY_DELAY_MS}ms`);
        setTimeout(() => load(), RETRY_DELAY_MS);
        return; // Don't update state yet — let retry handle it
      }

      // Reset retry counter on successful pass
      retryCountRef.current = 0;

      // ── Projects (critical — show error if this fails) ──
      if (projRes.status === 'fulfilled') {
        if (projRes.value.error) {
          console.error('[Dashboard] Projects query error:', projRes.value.error);
          setError('Không tải được danh sách dự án: ' + projRes.value.error);
        } else {
          const rows = projRes.value.projects || [];
          setProjects(rows);
          // Lay du mot trang thi nhieu kha nang con nua. Khong dung count(*) vi
          // dem toan bang moi lan mo trang dat hon la thinh thoang hien thua mot nut.
          setHasMore(rows.length >= PAGE_SIZE);
        }
      } else {
        console.error('[Dashboard] Projects fetch rejected:', projRes.reason);
        if (!isAbortOrLockError(projRes.reason)) {
          setError('Không tải được danh sách dự án. Vui lòng tải lại trang.');
        }
      }

      // ── Credits (non-critical — fallback to 0) ──
      if (creditRes.status === 'fulfilled') {
        setCreditBalance(creditRes.value.balance || 0);
      } else {
        console.warn('[Dashboard] Credits fetch failed, defaulting to 0:', creditRes.reason);
        setCreditBalance(0);
      }

      // ── Render count (non-critical — fallback to 0) ──
      if (renderRes.status === 'fulfilled') {
        setRenderCount(renderRes.value.count || 0);
      } else {
        console.warn('[Dashboard] Render count failed, defaulting to 0:', renderRes.reason);
        setRenderCount(0);
      }

      // ── Billing summary (non-critical — fallback to 'Free') ──
      if (summaryRes.status === 'fulfilled') {
        setCurrentPlan(summaryRes.value.summary?.currentPlan?.name ?? 'Free');
      } else {
        console.warn('[Dashboard] Billing summary failed, defaulting to Free:', summaryRes.reason);
        setCurrentPlan('Free');
      }
    } catch (err: any) {
      // Catch-all for truly unexpected exceptions
      if (isAbortOrLockError(err) && retryCountRef.current < MAX_RETRY) {
        retryCountRef.current++;
        console.warn(`[Dashboard] Catch-all lock error — auto-retry ${retryCountRef.current}/${MAX_RETRY}`);
        setTimeout(() => load(), RETRY_DELAY_MS);
        return;
      }
      retryCountRef.current = 0;
      console.error('[Dashboard] Unexpected load error:', err);
      setError(getUserErrorMessage(err, 'Không tải được dữ liệu dashboard. Kiểm tra kết nối mạng hoặc Database.'));
    } finally {
      setLoading(false);
    }
  }, []);

  /** Tải thêm một trang, nối vào cuối danh sách hiện có. */
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await ProjectService.listWithVideos(PAGE_SIZE, projects.length);
      const rows = res.projects || [];
      // Loc theo id phong khi co du an moi chen vao dau trong luc dang xem:
      // khong loc thi cung mot the hien hai lan va React canh bao trung key.
      setProjects((prev) => {
        const seen = new Set(prev.map((p: any) => p.id));
        return [...prev, ...rows.filter((r: any) => !seen.has(r.id))];
      });
      setHasMore(rows.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [projects.length]);

  /* ─── CRITICAL: Wait for auth to fully resolve before fetching ───
   * This prevents the race condition where Dashboard API calls 
   * compete with onAuthStateChange for Supabase session locks.
   * ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (authLoading) return; // Auth still resolving — wait
    if (!user) {
      // Không có phiên đăng nhập thì AuthGuard sẽ chuyển hướng, nhưng phải tắt cờ
      // loading ở đây. Trước đây hàm này thoát sớm mà không tắt, nên loading giữ
      // nguyên giá trị khởi tạo true và trang quay vòng mãi không bao giờ dừng.
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  // Polling for active renders (with AbortError suppression)
  useEffect(() => {
    const hasActiveRender = projects.some(p => ['renderqueued', 'rendering'].includes(p.status));
    if (!hasActiveRender) return;

    let mounted = true;
    const intervalId = setInterval(() => {
      ProjectService.listByUser()
        .then(res => { if (mounted && !res.error) setProjects(res.projects || []); })
        .catch(err => { if (!isAbortOrLockError(err)) console.error('[Dashboard] Poll projects error:', err); });
      RenderService.getCompletedCount()
        .then(res => { if (mounted) setRenderCount(res.count || 0); })
        .catch(err => { if (!isAbortOrLockError(err)) console.error('[Dashboard] Poll renders error:', err); });
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [projects]);

  if (loading) return <LoadingState message="Đang tải dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Quản lý dự án video bán hàng của bạn.</p>
        </div>
        <Button onClick={() => navigate(ROUTES.NEW_PROJECT)} className="glow-primary font-display shrink-0">
          <FolderPlus className="w-4 h-4 mr-2" /> Tạo dự án mới
        </Button>
      </div>

      {/* Credit exhaustion warning */}
      {creditBalance === 0 && currentPlan === 'Free' && (
        <div className="rounded-xl p-4 bg-warning/10 border border-warning/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Credits đã hết</p>
            <p className="text-xs text-muted-foreground">Bạn đã sử dụng hết credits miễn phí. Nâng cấp để tiếp tục tạo video.</p>
          </div>
          <Button size="sm" onClick={() => navigate(ROUTES.BILLING)} className="shrink-0 glow-primary">
            Nâng cấp
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CreditCard} label="Gói hiện tại" value={currentPlan} sublabel={currentPlan === 'Free' ? 'Chưa đăng ký' : 'Đang sử dụng'} />
        <StatCard icon={Coins} label="Credits còn lại" value={creditBalance} sublabel="Credit balance" />
        <StatCard icon={LayoutGrid} label="Dự án" value={projects.length} sublabel={projects.length === 0 ? 'Chưa có dự án' : `${projects.length} dự án`} />
        <StatCard icon={Film} label="Video đã render" value={renderCount} sublabel={renderCount === 0 ? 'Chưa render' : `${renderCount} video`} />
      </div>

      {/* Package shortcuts */}
      <div>
        <h2 className="font-display text-base font-semibold text-foreground mb-3">Tạo nhanh theo gói</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {PACKAGE_LIST.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => navigate(ROUTES.NEW_PROJECT)}
              className="group rounded-xl p-4 bg-surface shadow-card hover:shadow-card-hover transition-all text-left hover:translate-y-[-1px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground">{pkg.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{pkg.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">⏱ {pkg.duration}</span>
                <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Thư viện video ───
          Thay hai mục cũ ("Dự án gần đây" dạng danh sách + "Video đã render" chỉ đếm
          số rồi bảo khách tự vào từng dự án mà tìm). Người bán mở trang này để lấy
          video đi đăng, nên video phải nhìn thấy và lấy được ngay tại đây. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-foreground">
            Video của bạn
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {filteredVideos.length}
              {filteredVideos.length !== projects.length && ` / ${projects.length}`}
            </span>
          </h2>

          <div className="flex items-center gap-2">
          {nhomDonDuoc.ds.length >= 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {bulkDeleting
                ? `Đang dọn ${bulkDone}/${nhomDonDuoc.ds.length}...`
                : `Dọn ${nhomDonDuoc.ds.length}`}
            </Button>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên..."
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                statusFilter === f.key
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="Bạn chưa có video nào"
            description="Tạo dự án đầu tiên để bắt đầu làm video bán hàng."
            actionLabel="Tạo video đầu tiên"
            onAction={() => navigate(ROUTES.NEW_PROJECT)}
          />
        ) : filteredVideos.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Không có video nào khớp bộ lọc.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredVideos.map((p) => (
              <VideoCard
                key={p.id}
                video={{
                  id: p.id,
                  title: p.title,
                  status: p.video ? 'completed' : p.status,
                  durationSec: p.durationSec ?? null,
                  outputUrl: p.video?.output_url ?? null,
                  thumbnailUrl: p.video?.thumbnail_url ?? null,
                  createdAt: p.created_at,
                }}
                onOpen={() => navigate(getProjectRoute(p))}
                onDelete={(e) => handleDelete(e, p)}
                deleting={deletingId === p.id}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center pt-1">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Đang tải...' : 'Xem thêm'}
            </Button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Bạn có thể đóng trình duyệt trong lúc chờ — video vẫn được dựng tiếp.
        </p>
      </div>
    </motion.div>
  );
};

export default Dashboard;
