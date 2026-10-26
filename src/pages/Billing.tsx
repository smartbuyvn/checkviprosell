import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Loader2, Coins, AlertCircle, RefreshCw, CreditCard, QrCode, X, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BillingService, PlanPackage, PaymentTransaction, PaymentStatus, PlanCode, BillingSummary, SePayCheckoutData } from '@/services/billing.service';
import { CreditService } from '@/services/credit.service';
import { useAuth } from '@/hooks/useAuth';

/* ─── Fix #5: Currency Formatter Helper ─────────────────────────────────────
 * Replaces the hardcoded `$` prefix in the transaction history table.
 * Uses the `currency` field from PaymentTransaction when available.
 * Heuristic fallback: amounts > 1000 are assumed VND, otherwise USD.
 * ────────────────────────────────────────────────────────────────────────── */
function formatTransactionAmount(amount: number, currency?: string | null): string {
  if (amount === 0) return 'Miễn phí';

  // Determine effective currency: explicit field → heuristic fallback
  const effectiveCurrency: string = currency
    ? currency.toUpperCase()
    : (amount > 1000 ? 'VND' : 'USD');

  if (effectiveCurrency === 'VND') {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }

  if (effectiveCurrency === 'USD') {
    return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  }

  // Fallback for any other currency code
  return `${new Intl.NumberFormat('en-US').format(amount)} ${effectiveCurrency}`;
}

/* ─── Fix #2: Deterministic Sort Helper ─────────────────────────────────────
 * Sorts payments by `created_at` descending (newest first) before accessing
 * index [0]. Never assumes the API returns a pre-sorted array.
 * ────────────────────────────────────────────────────────────────────────── */
function sortPaymentsByDateDesc(payments: PaymentTransaction[]): PaymentTransaction[] {
  return [...payments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

const StatusBadge = ({ status }: { status: PaymentStatus | string }) => {
  switch (status) {
    case 'paid': 
      return <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs font-semibold uppercase tracking-wider">Đã TT</span>;
    case 'pending': 
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs font-semibold uppercase tracking-wider">Chờ XN</span>;
    case 'failed': 
      return <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs font-semibold uppercase tracking-wider">Lỗi</span>;
    case 'refunded': 
      return <span className="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 rounded text-xs font-semibold uppercase tracking-wider">Hoàn Tiền</span>;
    default: 
      return <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs font-semibold uppercase tracking-wider">{status}</span>;
  }
};

/* ─── Polling constants ─────────────────────────────────────────────────── */
const POLL_INTERVAL_MS = 5000;      // 5 seconds between polls
const POLL_MAX_ATTEMPTS = 12;       // 12 × 5s = 60 seconds max

export default function Billing() {
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [packages, setPackages] = useState<PlanPackage[]>([]);
  const [plansError, setPlansError] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const { profile } = useAuth();

  /* ─── Payment Modal State ────────────────────────────────────────────── */
  const [selectedPlan, setSelectedPlan] = useState<PlanPackage | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sepayData, setSepayData] = useState<SePayCheckoutData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contentCopied, setContentCopied] = useState(false);

  /* ─── Fix #4: Polling ref for cleanup on unmount ──────────────────────── */
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCountRef = useRef<number>(0);
  const baselineBalanceRef = useRef<number | null>(null);

  /** Cleanup any active polling interval */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingCountRef.current = 0;
  }, []);

  /** Start background polling for balance changes after a pending payment */
  const startPendingPaymentPolling = useCallback((currentBalance: number) => {
    // Guard: don't stack multiple polling loops
    if (pollingIntervalRef.current !== null) return;

    baselineBalanceRef.current = currentBalance;
    pollingCountRef.current = 0;

    pollingIntervalRef.current = setInterval(async () => {
      pollingCountRef.current += 1;

      // Max attempts reached — give up gracefully
      if (pollingCountRef.current > POLL_MAX_ATTEMPTS) {
        stopPolling();
        toast.info(
          'Hệ thống chưa nhận được xác nhận từ cổng thanh toán. Vui lòng tải lại trang sau 1-2 phút.',
          { duration: 6000 }
        );
        return;
      }

      try {
        const { balance: freshBalance } = await CreditService.getBalance();

        // Balance changed → webhook arrived and credits were granted
        if (freshBalance !== baselineBalanceRef.current) {
          stopPolling();
          setBalance(freshBalance);
          toast.success(
            `Thanh toán xác nhận thành công! Tín dụng đã được cộng: ${freshBalance} credits.`,
            { duration: 5000 }
          );
        }
      } catch {
        // Silently retry — network hiccup during polling is expected
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  /* ─── Cleanup polling on unmount ──────────────────────────────────────── */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  /* ─── Main data loader ────────────────────────────────────────────────── */
  useEffect(() => {
    // Drop legacy stripe payment=success
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'cancelled' || paymentStatus === 'failed') {
      toast.error('Thanh toán chưa hoàn tất hoặc đã bị hủy.');
      window.history.replaceState(null, '', window.location.pathname);
    }

    const provider = searchParams.get('provider');
    const isVerificationFlow = provider === 'sepay' || paymentStatus === 'verifying';
    if (isVerificationFlow) {
      setIsVerifying(true);
      // Xóa query param để ẩn evidence redirect, tránh loop
      window.history.replaceState(null, '', window.location.pathname);
    }

    async function loadData() {
      /* ─── Fix #1: Independent error boundaries via Promise.allSettled ─── *
       * If Plans API fails but Summary succeeds, the balance bar and        *
       * payment history still render normally. Only the Pricing Cards       *
       * section shows an error state.                                       *
       * ─────────────────────────────────────────────────────────────────── */

      // Step 1: Always fetch balance first (independent, critical)
      let currentBalance = 0;
      try {
        const { balance: newBalance } = await CreditService.getBalance();
        currentBalance = newBalance;
        setBalance(newBalance);
      } catch {
        // Balance fetch failed — show 0 but don't block the page
        setBalance(0);
      }

      // Step 2: Fetch plans + summary in parallel with independent error handling
      const [plansResult, summaryResult] = await Promise.allSettled([
        BillingService.getPlans(),
        BillingService.getBillingSummary()
      ]);

      // ── Handle Plans result ──
      if (plansResult.status === 'fulfilled') {
        const plansRes = plansResult.value;
        if (plansRes.ok && plansRes.plans && plansRes.plans.length > 0) {
          setPackages(plansRes.plans);
        } else {
          setPlansError(true);
        }
      } else {
        // Plans API threw — mark error but don't toast (summary might still work)
        setPlansError(true);
        console.error('[Billing] Plans fetch rejected:', plansResult.reason);
      }

      // ── Handle Summary result ──
      if (summaryResult.status === 'fulfilled') {
        const summaryRes = summaryResult.value;
        if (summaryRes.ok && summaryRes.summary) {
          setSummary(summaryRes.summary);

          if (isVerificationFlow) {
            /* ─── Fix #2: Sort payments before accessing [0] ──────────── *
             * The API contract doesn't guarantee sort order.               *
             * We deterministically sort by created_at DESC here.           *
             * ─────────────────────────────────────────────────────────── */
            const sortedPayments = sortPaymentsByDateDesc(summaryRes.summary.payments || []);
            const latestPayment = sortedPayments[0] ?? null;

            const isRecent = latestPayment && (
              new Date().getTime() - new Date(latestPayment.created_at).getTime() < 10 * 60 * 1000
            );
            
            if (isRecent && latestPayment.status === 'paid') {
              toast.success(`Thanh toán thành công qua ${latestPayment.payment_method || 'cổng giao dịch'}! Đã đồng bộ.`);
            } else if (isRecent && latestPayment.status === 'failed') {
              toast.error('Giao dịch của bạn bị từ chối hoặc thất bại.');
            } else if (isRecent && latestPayment.status === 'pending') {
              toast.success('Hệ thống đã ghi nhận giao dịch. Vui lòng hoàn thành chuyển khoản/hoặc chờ xác nhận thanh toán.');

              /* ─── Fix #4: Start polling when latest payment is pending ── *
               * Polls CreditService.getBalance() every 5s (max 12 rounds). *
               * If balance changes → webhook arrived → auto-update UI.     *
               * ──────────────────────────────────────────────────────────── */
              startPendingPaymentPolling(currentBalance);
            } else {
               // Có thể webhook chưa tới, báo cho user biết.
              toast.loading('Hệ thống đang chờ đối soát với cổng thanh toán. Vui lòng tải lại trang sau 1-2 phút nếu chưa thấy credits.', { duration: 6000 });
            }
          }
        }
      } else {
        // Summary API threw — toast a warning but page still renders plans
        console.error('[Billing] Summary fetch rejected:', summaryResult.reason);
        toast.error('Không thể tải lịch sử giao dịch. Vui lòng tải lại trang.');
      }

      setIsVerifying(false);
      setIsFetching(false);
    }

    loadData();
  }, [searchParams, startPendingPaymentPolling]);

  /* ═══════════════════════════════════════════════════════════════════════
     Payment Modal Handlers
     ═══════════════════════════════════════════════════════════════════════ */

  /** Open the payment gateway selection modal for a plan */
  const openPaymentModal = (pkg: PlanPackage) => {
    setSelectedPlan(pkg);
    setSepayData(null);
    setIsProcessing(false);
    setContentCopied(false);
    setIsPaymentModalOpen(true);
  };

  /** Close and reset all modal state */
  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    // Delay state reset so Dialog exit animation completes
    setTimeout(() => {
      setSelectedPlan(null);
      setSepayData(null);
      setIsProcessing(false);
      setContentCopied(false);
    }, 200);
  };


  /** SePay: create QR checkout and display in-modal */
  const handleSePay = async () => {
    if (!selectedPlan) return;
    try {
      setIsProcessing(true);
      const data = await BillingService.checkoutSePay(selectedPlan.id);
      setSepayData(data);
      setIsProcessing(false);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi tạo mã QR chuyển khoản.');
      setIsProcessing(false);
    }
  };

  /** User confirms they completed the bank transfer */
  const handleTransferComplete = () => {
    closePaymentModal();
    toast.success(
      'Cảm ơn bạn! Hệ thống sẽ tự động cộng credits trong 1-2 phút sau khi nhận được chuyển khoản.',
      { duration: 8000 }
    );
    // Start polling for balance change
    if (balance !== null) {
      startPendingPaymentPolling(balance);
    }
  };

  /** Copy transfer content to clipboard */
  const handleCopyContent = async () => {
    if (!sepayData?.content) return;
    try {
      await navigator.clipboard.writeText(sepayData.content);
      setContentCopied(true);
      toast.success('Đã sao chép nội dung chuyển khoản!');
      setTimeout(() => setContentCopied(false), 3000);
    } catch {
      toast.error('Không thể sao chép. Vui lòng copy thủ công.');
    }
  };

  /** Retry a failed transaction — opens modal for that plan */
  const handleRetry = (planCode: PlanCode | null) => {
    if (!planCode) return;
    const pkg = packages.find(p => p.id === planCode);
    if (pkg) {
      openPaymentModal(pkg);
    }
  };

  const currentPlan = summary?.currentPlan;
  const history = summary?.payments || [];

  /* ─── Fix #2 (render-path): Sort history for display as well ────────── */
  const sortedHistory = sortPaymentsByDateDesc(history);

  return (
    <div className="container max-w-5xl py-6 space-y-8 animate-in fade-in duration-500">
      <div className="mb-2 space-y-1">
        <h1 className="text-3xl font-bold font-display tracking-tight">Quản lý Nạp Tiền &amp; Tín dụng</h1>
        <p className="text-muted-foreground">Mua thêm Credit để render video thương mại chốt đơn.</p>
      </div>

      {isVerifying ? (
        <div className="flex flex-col items-center justify-center p-16 border rounded-lg bg-card/50 shadow-sm animate-in zoom-in duration-300">
          <Loader2 className="animate-spin w-10 h-10 text-primary mb-4" />
          <h3 className="text-xl font-bold font-display">Đang tự động xác minh...</h3>
          <p className="text-muted-foreground mt-2">Hệ thống đang đồng bộ an toàn trạng thái thanh toán từ cổng giao dịch SePay.</p>
        </div>
      ) : isFetching ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>
      ) : (
        <>
          {/* Status Bar */}
          <Card className="bg-gradient-to-br from-primary/5 to-background border-primary/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="text-primary w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Tín dụng hiện tại của bạn</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold font-display shadow-sm">{balance ?? 0}</h2>
                  <span className="text-sm font-semibold uppercase tracking-wider text-primary">Credits</span>
                </div>
                {/* Dynamically render verified currentPlan safely without asserting fake data */}
                {currentPlan && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Gói hiện tại: <span className="font-semibold text-foreground">{currentPlan.name}</span>
                    {currentPlan.expiresAt && ` (Hết hạn: ${new Date(currentPlan.expiresAt).toLocaleDateString()})`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pricing Cards */}
          <div className="space-y-4">
            {/* Banner khuyến mãi +10% */}
            {profile?.referred_by && (
              <div className="flex gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-500 text-sm">Ưu đãi Khách hàng giới thiệu!</p>
                  <p className="text-xs text-emerald-500/80 mt-0.5">
                    Bạn đang sử dụng mã giới thiệu <strong className="font-mono text-emerald-400 tracking-wider bg-emerald-500/20 px-1 py-0.5 rounded">{profile.referred_by}</strong>. 
                    Bạn sẽ được <strong className="text-emerald-400">+10% Credits</strong> thưởng thêm vào tài khoản sau mỗi lần nạp thành công.
                  </p>
                </div>
              </div>
            )}
            
            {plansError || packages.length === 0 ? (
              <div className="text-center py-10 border rounded-lg bg-muted/20">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Chưa có thông tin gói cước. Vui lòng tải lại trang sau.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                {packages.map((pkg) => (
                  <Card key={pkg.id} className={`relative flex flex-col ${pkg.popular ? 'border-primary shadow-lg ring-1 ring-primary/30' : 'border-border'}`}>
                    {pkg.popular && (
                      <div className="absolute top-0 right-0 py-1 px-3 bg-primary text-primary-foreground text-xs font-bold rounded-bl-lg rounded-tr-lg">
                        HOT
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">{pkg.name}</CardTitle>
                      <CardDescription>
                        <span className="text-3xl font-bold text-foreground">{pkg.price}</span>
                        {pkg.price !== 'Miễn phí' && pkg.price !== '0₫' && (
                          <span className="text-sm text-muted-foreground ml-1">/tháng</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full font-semibold" 
                        variant={pkg.popular ? "default" : "outline"}
                        onClick={() => openPaymentModal(pkg)}
                        disabled={isProcessing}
                      >
                        {pkg.id === 'free' ? 'Bắt đầu miễn phí' : 'Chọn gói này'}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {/* Payment Supported Info */}
            <div className="flex justify-center mt-6 pt-4 border-t opacity-70">
              <p className="text-sm text-muted-foreground font-medium">Thanh toán an toàn qua SePay — chuyển khoản VietQR</p>
            </div>
          </div>

          {/* Payment History */}
          <div className="pt-8">
            <h3 className="text-xl font-bold mb-4 font-display">Lịch sử giao dịch</h3>
            {sortedHistory.length === 0 ? (
              <div className="text-center py-10 border rounded-lg bg-muted/20">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Chưa có giao dịch nào.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[520px]">
                  <thead className="bg-muted text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Ngày</th>
                      <th className="px-4 py-3">Gói</th>
                      <th className="px-4 py-3">Số tiền</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedHistory.map((txn, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{new Date(txn.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium uppercase">{txn.plan_code || '---'}</td>
                        {/* Fix #5: Dynamic currency formatting instead of hardcoded $ */}
                        <td className="px-4 py-3 font-semibold text-primary">{formatTransactionAmount(txn.amount, txn.currency)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={txn.status} />
                        </td>
                        <td className="px-4 py-3">
                          {txn.status === 'failed' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => handleRetry(txn.plan_code)}
                              disabled={isProcessing}
                            >
                              <RefreshCw className="w-3 h-3" /> Thử lại
                            </Button>
                          )}
                          {/* Future Invoices CTA rendered here if available via summary.invoices */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         Payment Gateway Selection Modal
         ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isPaymentModalOpen} onOpenChange={(open) => { if (!open) closePaymentModal(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {sepayData ? 'Chuyển khoản VietQR' : 'Chọn phương thức thanh toán'}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan && !sepayData && (
                <>Bạn đang chọn gói <strong className="text-foreground">{selectedPlan.name}</strong> — <strong className="text-primary">{selectedPlan.price}</strong></>
              )}
              {sepayData && (
                <>Quét mã QR hoặc chuyển khoản thủ công theo thông tin bên dưới.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* ─── State 1: Gateway Selection ─── */}
          {!sepayData && (
            <div className="space-y-4 pt-2">
              {/* SePay — Domestic VietQR */}
              <button
                onClick={handleSePay}
                disabled={isProcessing}
                className="w-full group relative flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-400">
                  <QrCode className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm sm:text-base">Chuyển khoản VietQR</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ngân hàng nội địa — quét QR hoặc chuyển thủ công qua SePay</p>
                </div>
                {isProcessing && (
                  <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                )}
              </button>

              {/* Trust note */}
              <p className="text-center text-xs text-muted-foreground pt-2 opacity-70">
                🔒 Mọi giao dịch được mã hóa và xử lý an toàn
              </p>
            </div>
          )}

          {/* ─── State 2: SePay QR Display ─── */}
          {sepayData && (
            <div className="space-y-5 pt-2">
              {/* QR Image */}
              <div className="flex justify-center">
                <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                  <img
                    src={sepayData.qr_url}
                    alt="VietQR Chuyển khoản"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                    loading="eager"
                  />
                </div>
              </div>

              {/* Transfer Details */}
              <div className="space-y-3">
                {/* Amount */}
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Số tiền</span>
                  <span className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat('vi-VN').format(sepayData.amount)}₫
                  </span>
                </div>

                {/* Transfer content — critical for auto-matching */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Nội dung chuyển khoản</p>
                      <p className="text-sm font-mono font-bold text-foreground break-all">
                        {sepayData.content}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-8 w-8 p-0"
                      onClick={handleCopyContent}
                    >
                      {contentCopied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-200/80">
                    <strong>Quan trọng:</strong> Vui lòng giữ nguyên nội dung chuyển khoản <strong>"{sepayData.content}"</strong> để hệ thống tự động cộng credits.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  onClick={handleTransferComplete}
                  className="w-full font-semibold glow-primary"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Tôi đã chuyển khoản xong
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setSepayData(null)}
                >
                  ← Quay lại chọn phương thức khác
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
