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
const MAX_RETRY = 2;
const RETRY_DELAY_MS = 1500;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<string>('Free');
  const [renderCount, setRenderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const retryCountRef = useRef(0);

  const handleDelete = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    
    const isProcessing = ['analyzing', 'queued', 'processing', 'rendering'].includes(project.status);
    const msg = isProcessing 
      ? 'Video đang được xử lý. Hủy tiến trình và chuyển vào thùng rác?'
      : 'Xóa video khỏi dashboard? Credits, thanh toán và hoa hồng sẽ không thay đổi.';

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
        ProjectService.listByUser(),
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
          setProjects(projRes.value.projects || []);
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

  /* ─── CRITICAL: Wait for auth to fully resolve before fetching ───
   * This prevents the race condition where Dashboard API calls 
   * compete with onAuthStateChange for Supabase session locks.
   * ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (authLoading) return; // Auth still resolving — wait
    if (!user) return;       // Not authenticated — AuthGuard will redirect
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

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold text-foreground">Dự án gần đây</h2>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            title="Chưa có dự án nào"
            description="Tạo dự án đầu tiên để bắt đầu tạo video bán hàng."
            actionLabel="Tạo dự án đầu tiên"
            onAction={() => navigate(ROUTES.NEW_PROJECT)}
          />
        ) : (
          <div className="space-y-2">
            {projects.slice(0, 5).map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(getProjectRoute(p))}
                className="rounded-xl bg-surface shadow-card p-4 flex items-center justify-between cursor-pointer hover:shadow-card-hover hover:translate-y-[-1px] transition-all"
              >
                <div>
                  <p className="font-display text-sm font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.package_type} • {new Date(p.created_at).toLocaleDateString('vi')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={p.status} />
                  <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-2" onClick={(e) => handleDelete(e, p)}>
                    {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent renders */}
      <div>
        <h2 className="font-display text-base font-semibold text-foreground mb-3">Video đã render</h2>
        {renderCount === 0 ? (
          <div className="rounded-xl bg-surface shadow-card p-6 text-center">
            <Film className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Chưa có video nào. Tạo dự án và render video đầu tiên.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-surface shadow-card p-6 text-center">
            <Film className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">{renderCount} video đã render</p>
            <p className="text-xs text-muted-foreground mt-1">Xem trong từng dự án để tải video.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Dashboard;
