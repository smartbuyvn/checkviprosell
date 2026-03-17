/**
 * Viprosell â€” Dashboard Page (Real Data)
 * With proper loading, empty, and error states.
 * Shows credit exhaustion warning for free users.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderPlus, Video, Coins, CreditCard,
  ArrowRight, LayoutGrid, Film, AlertTriangle,
} from 'lucide-react';
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
import { CreditNotificationService } from '@/services/credit-notification.service';
import { isAbortOrLockError, getUserErrorMessage } from '@/lib/errorUtils';

/** Map project status to the furthest screen the user can resume */
function getProjectRoute(project: { id: string; status: string }): string {
  switch (project.status) {
    case 'draft':
    case 'analyzing':
      return buildRoute(ROUTES.PROJECT_ANALYSIS, { projectId: project.id });
    case 'concept_ready':
      return buildRoute(ROUTES.PROJECT_CONCEPTS, { projectId: project.id });
    case 'script_ready':
    case 'render_queued':
    case 'rendering':
    case 'completed':
    case 'failed':
      return buildRoute(ROUTES.PROJECT_SCRIPT, { projectId: project.id });
    default:
      return buildRoute(ROUTES.PROJECT_ANALYSIS, { projectId: project.id });
  }
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<string>('Free');
  const [renderCount, setRenderCount] = useState(0);
  const [latestRenderDate, setLatestRenderDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, creditRes, renderRes, payRes] = await Promise.all([
        ProjectService.listByUser(),
        BillingService.getCreditBalance(),
        RenderService.getCompletedCount(),
        BillingService.getPaymentHistory(),
      ]);
      if (projRes.error) throw new Error(projRes.error);
      setProjects(projRes.projects);
      setCreditBalance(creditRes.balance);
      setRenderCount(renderRes.count);
      setLatestRenderDate(renderRes.latestDate);

      // Derive current plan
      const latestSub = payRes.payments.find(
        (p: any) => p.order_type === 'plan_subscription' && p.status === 'paid' && p.plan_code
      );
      setCurrentPlan(latestSub?.plan_code ?? 'Free');
    } catch (err: any) {
      // Silently ignore AbortError/lock errors â€” session is syncing
      if (isAbortOrLockError(err)) {
        console.warn('[Dashboard] Auth lock error, will retry silently');
        setLoading(false);
        return;
      }
      setError(getUserErrorMessage(err, 'KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Äang táº£i dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Quáº£n lÃ½ dá»± Ã¡n video bÃ¡n hÃ ng cá»§a báº¡n.</p>
        </div>
        <Button onClick={() => navigate(ROUTES.NEW_PROJECT)} className="glow-primary font-display shrink-0">
          <FolderPlus className="w-4 h-4 mr-2" /> Táº¡o dá»± Ã¡n má»›i
        </Button>
      </div>

      {/* Credit exhaustion warning */}
      {creditBalance === 0 && currentPlan === 'Free' && (
        <div className="rounded-xl p-4 bg-warning/10 border border-warning/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Credits Ä‘Ã£ háº¿t</p>
            <p className="text-xs text-muted-foreground">Báº¡n Ä‘Ã£ sá»­ dá»¥ng háº¿t credits miá»…n phÃ­. NÃ¢ng cáº¥p Ä‘á»ƒ tiáº¿p tá»¥c táº¡o video.</p>
          </div>
          <Button size="sm" onClick={() => navigate(ROUTES.BILLING)} className="shrink-0 glow-primary">
            NÃ¢ng cáº¥p
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CreditCard} label="GÃ³i hiá»‡n táº¡i" value={currentPlan} sublabel={currentPlan === 'Free' ? 'ChÆ°a Ä‘Äƒng kÃ½' : 'Äang sá»­ dá»¥ng'} />
        <StatCard icon={Coins} label="Credits cÃ²n láº¡i" value={creditBalance} sublabel="Credit balance" />
        <StatCard icon={LayoutGrid} label="Dá»± Ã¡n" value={projects.length} sublabel={projects.length === 0 ? 'ChÆ°a cÃ³ dá»± Ã¡n' : `${projects.length} dá»± Ã¡n`} />
        <StatCard icon={Film} label="Video Ä‘Ã£ render" value={renderCount} sublabel={renderCount === 0 ? 'ChÆ°a render' : `${renderCount} video`} />
      </div>

      {/* Package shortcuts */}
      <div>
        <h2 className="font-display text-base font-semibold text-foreground mb-3">Táº¡o nhanh theo gÃ³i</h2>
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
                <span className="text-[10px] text-muted-foreground">â± {pkg.duration}</span>
                <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold text-foreground">Dá»± Ã¡n gáº§n Ä‘Ã¢y</h2>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            title="ChÆ°a cÃ³ dá»± Ã¡n nÃ o"
            description="Táº¡o dá»± Ã¡n Ä‘áº§u tiÃªn Ä‘á»ƒ báº¯t Ä‘áº§u táº¡o video bÃ¡n hÃ ng."
            actionLabel="Táº¡o dá»± Ã¡n Ä‘áº§u tiÃªn"
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
                  <p className="text-xs text-muted-foreground">{p.package_type} â€¢ {new Date(p.created_at).toLocaleDateString('vi')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={p.status} />
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent renders */}
      <div>
        <h2 className="font-display text-base font-semibold text-foreground mb-3">Video Ä‘Ã£ render</h2>
        {renderCount === 0 ? (
          <div className="rounded-xl bg-surface shadow-card p-6 text-center">
            <Film className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">ChÆ°a cÃ³ video nÃ o. Táº¡o dá»± Ã¡n vÃ  render video Ä‘áº§u tiÃªn.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-surface shadow-card p-6 text-center">
            <Film className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">{renderCount} video Ä‘Ã£ render</p>
            <p className="text-xs text-muted-foreground mt-1">Xem trong tá»«ng dá»± Ã¡n Ä‘á»ƒ táº£i video.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Dashboard;
