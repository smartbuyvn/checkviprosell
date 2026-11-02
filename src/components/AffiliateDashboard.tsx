/**
 * Viprosell — Affiliate Dashboard Component
 * Glassmorphism-styled dashboard displaying referral stats,
 * personal referral link with copy functionality, and conversion history.
 * Consumes data from GET /api/affiliate/me via AffiliateService.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Copy, Check, Users, TrendingUp, Clock, Wallet,
  Info, ExternalLink, ShieldCheck, ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AffiliateService } from '@/services/affiliate.service';

/* ──────────────────────── Types ──────────────────────── */

interface AffiliateEvent {
  id: string;
  eventType: string;
  referredUserId: string;
  commissionVnd: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  createdAt: string;
  note: string;
}

interface AffiliateSummary {
  totalReferrals: number;
  firstPaidConversions: number;
  pendingCommissionVnd: number;
  approvedCommissionVnd: number;
  paidCommissionVnd: number;
  rejectedCommissionVnd: number;
  /** Rút được ngay bây giờ = đã duyệt trừ phần đang nằm trong yêu cầu chưa xử lý. */
  availableVnd: number;
  /** Đang nằm trong yêu cầu rút chưa trả xong. */
  lockedVnd: number;
}

interface AffiliateWithdrawal {
  id: string;
  amount_vnd: number;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  note: string | null;
  requested_at: string;
  processed_at: string | null;
}

interface AffiliatePolicy {
  commissionRate: number;
  firstPaidOnly: boolean;
  holdDays: number;
  minWithdrawalVnd: number;
  tierThresholdVnd: number;
}

interface AffiliateData {
  affiliateCode: string;
  tier: 'silver' | 'gold';
  totalAccumulatedVnd: number;
  referralLink: string;
  policy: AffiliatePolicy;
  summary: AffiliateSummary;
  events: AffiliateEvent[];
  withdrawals: AffiliateWithdrawal[];
}

/* ──────────────── Skeleton Loading State ──────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Referral link skeleton */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="flex gap-2 mt-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 space-y-3"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Error State ──────────────── */

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <ShieldCheck className="w-8 h-8 text-destructive" />
      </div>
      <p className="text-lg font-semibold text-foreground">Không thể tải dữ liệu</p>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.
      </p>
      <Button onClick={onRetry} className="glow-primary font-display mt-2">
        Thử lại
      </Button>
    </div>
  );
}

/* ──────────────── Status Badge ──────────────── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    paid: {
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      text: 'text-emerald-400',
      label: 'Đã thanh toán',
    },
    approved: {
      bg: 'bg-blue-500/10 border-blue-500/20',
      text: 'text-blue-400',
      label: 'Khả dụng',
    },
    pending: {
      bg: 'bg-amber-500/10 border-amber-500/20',
      text: 'text-amber-400',
      label: 'Chờ soát xét',
    },
    rejected: {
      bg: 'bg-red-500/10 border-red-500/20',
      text: 'text-red-400',
      label: 'Từ chối',
    },
  };

  const c = config[status] || {
    bg: 'bg-muted/30 border-border',
    text: 'text-muted-foreground',
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text} whitespace-nowrap`}
    >
      {c.label}
    </span>
  );
}

/* ──────────────── Stat Card ──────────────── */

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  accentClass?: string;
}

function StatCard({ label, value, subtext, icon, accentClass = '' }: StatCardProps) {
  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border border-white/[0.06]
        bg-white/[0.03] backdrop-blur-xl p-5
        hover:border-white/[0.12] hover:bg-white/[0.05]
        transition-all duration-300 ease-out
      `}
    >
      {/* Ambient glow dot */}
      <div
        className={`absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 ${accentClass}`}
      />

      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold font-display tracking-tight text-foreground">
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-muted-foreground">{subtext}</p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   AffiliateDashboard — Main Component
   ════════════════════════════════════════════════════════ */

/**
 * Form yêu cầu rút. Mọi kiểm tra thật nằm ở backend — phần kiểm ở đây chỉ để
 * báo sớm cho người dùng, không được tin là đủ.
 */
/**
 * Định dạng tiền Việt. Để ở phạm vi module chứ không trong component chính:
 * WithdrawalForm nằm ngoài component đó nên không thấy được biến cục bộ của nó.
 */
const fmtVnd = (n: number) => n.toLocaleString('vi-VN') + 'đ';

function WithdrawalForm({
  availableVnd,
  minVnd,
  hasOpenRequest,
  onDone,
}: {
  availableVnd: number;
  minVnd: number;
  hasOpenRequest: boolean;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [sending, setSending] = useState(false);

  if (hasOpenRequest) {
    return (
      <p className="text-sm text-muted-foreground">
        Bạn đang có một yêu cầu rút chờ xử lý. Chúng tôi sẽ báo khi chuyển khoản xong.
      </p>
    );
  }

  if (availableVnd < minVnd) {
    return (
      <p className="text-sm text-muted-foreground">
        Số dư rút được hiện là <span className="text-foreground font-medium">{fmtVnd(availableVnd)}</span>,
        chưa đạt mức tối thiểu {fmtVnd(minVnd)}.
      </p>
    );
  }

  async function submit() {
    const value = Number(String(amount).replace(/[^0-9]/g, ''));
    if (!value) return toast.error('Nhập số tiền muốn rút');
    if (value > availableVnd) return toast.error(`Chỉ rút được tối đa ${fmtVnd(availableVnd)}`);
    if (value < minVnd) return toast.error(`Mỗi lần rút tối thiểu ${fmtVnd(minVnd)}`);
    if (!bank.trim() || !accountNo.trim() || !accountName.trim()) {
      return toast.error('Điền đủ ngân hàng, số tài khoản và tên chủ tài khoản');
    }

    setSending(true);
    try {
      await AffiliateService.requestWithdrawal({
        amountVnd: value,
        bank: bank.trim(),
        accountNo: accountNo.trim(),
        accountName: accountName.trim(),
      });
      toast.success('Đã gửi yêu cầu rút. Chúng tôi sẽ xử lý trong vài ngày làm việc.');
      setAmount('');
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Không gửi được yêu cầu');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          placeholder={`Số tiền (tối đa ${fmtVnd(availableVnd)})`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
        />
        <Input placeholder="Ngân hàng (VD: MBBank)" value={bank} onChange={(e) => setBank(e.target.value)} />
        <Input
          placeholder="Số tài khoản"
          value={accountNo}
          onChange={(e) => setAccountNo(e.target.value)}
          inputMode="numeric"
        />
        <Input
          placeholder="Tên chủ tài khoản"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
        />
      </div>
      <Button onClick={submit} disabled={sending} size="sm">
        {sending ? 'Đang gửi...' : 'Gửi yêu cầu rút'}
      </Button>
    </div>
  );
}


export default function AffiliateDashboard() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await AffiliateService.getReferralStats();
      if (!result) {
        setHasError(true);
      } else {
        setData(result as AffiliateData);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyLink = async () => {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      toast.success('Đã copy link giới thiệu!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể copy, vui lòng copy thủ công.');
    }
  };

  // fmtVnd nay da chuyen len pham vi module de WithdrawalForm dung chung.

  /* ──────── Render ──────── */
  return (
    <div className="container max-w-4xl py-8 space-y-6 animate-in fade-in duration-500">
      {/* ── Page title ── */}
      <div className="mb-2 space-y-1">
        <h1 className="text-3xl font-bold font-display tracking-tight">
          Đối tác giới thiệu{' '}
          <span className="text-gradient-primary">(Affiliate)</span>
        </h1>
        <p className="text-muted-foreground">
          Giới thiệu người dùng mới tham gia Viprosell và nhận hoa hồng tiền mặt từ giao dịch của họ.
        </p>
      </div>

      {/* ── Tier & Policy info box ── */}
      {/*
        Chốt `data?.policy` là thứ bắt buộc, không phải phòng xa.

        Khối này đọc `data.tier` và `data.policy.*`, nhưng nó nằm TRÊN chốt
        isLoading/hasError ở dưới — nên lần render đầu tiên, khi `data` còn là null,
        nó nổ `Cannot read properties of null (reading 'tier')`. Không có error
        boundary nên cả cây React chết theo: trang /affiliate trắng hoàn toàn với
        MỌI người dùng, kể cả khi API hoàn toàn bình thường.

        Chốt theo `policy` chứ không chỉ `data`: thiếu `policy` thì thà ẩn hộp này
        còn hơn hiện sai tỉ lệ hoa hồng — đây là con số tiền thật của đối tác.
      */}
      {data?.policy && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5">
           <h3 className="font-semibold text-lg text-foreground mb-4">Hạng Đối Tác</h3>
           <div className="flex items-center gap-3 mb-4">
             <div className={`w-12 h-12 rounded-full flex items-center justify-center ${data.tier === 'gold' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-400/20 text-slate-400'}`}>
               <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
               <p className={`font-bold text-xl ${data.tier === 'gold' ? 'text-yellow-500' : 'text-slate-400'}`}>
                 {data.tier === 'gold' ? 'Hạng Vàng (15%)' : 'Hạng Bạc (10%)'}
               </p>
               <p className="text-xs text-muted-foreground">Hoa hồng trọn đời</p>
             </div>
           </div>
           
           {data.tier === 'silver' && (
             <div className="space-y-2 mt-4">
               <div className="flex justify-between text-xs">
                 <span className="text-muted-foreground">Tiến trình lên Vàng</span>
                 <span className="text-foreground font-semibold">{fmtVnd(data.totalAccumulatedVnd)} / {fmtVnd(data.policy.tierThresholdVnd)}</span>
               </div>
               <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
                 <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (data.totalAccumulatedVnd / data.policy.tierThresholdVnd) * 100)}%` }} />
               </div>
             </div>
           )}
        </div>
        
        <div className="md:col-span-2 relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04] backdrop-blur-xl p-5 flex items-center">
           <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/10 blur-3xl" />
           <div className="relative z-10 flex gap-3 text-sm text-foreground">
             <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
             <div>
               <p className="font-semibold mb-1.5">Quy chế hệ thống đối tác mới</p>
               <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                 <li>
                   <strong className="text-foreground">Hoa hồng trọn đời:</strong> Nhận {data.policy.commissionRate * 100}% cho <strong className="text-foreground">mọi giao dịch</strong> mua Credit của người dùng do bạn giới thiệu.
                 </li>
                 <li>
                   <strong className="text-foreground">Người mua được lợi:</strong> Khách hàng nhập mã giới thiệu của bạn sẽ được tặng thêm +10% Credits vào tài khoản mỗi lần thanh toán.
                 </li>
                 <li>
                   Thời gian trễ chờ soát xét chống refund là {data.policy.holdDays} ngày trước khi chuyển thành "Khả dụng". Rút tối thiểu: <strong className="text-foreground">{fmtVnd(data.policy.minWithdrawalVnd)}</strong>.
                 </li>
               </ul>
             </div>
           </div>
        </div>
      </div>
      )}

      {/* ── Loading / Error / Data ── */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : hasError || !data ? (
        <DashboardError onRetry={fetchData} />
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* ═══════ Referral Link Card ═══════ */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
            {/* Ambient gradient */}
            <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative z-10 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold font-display">Link Giới Thiệu Của Bạn</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Mã đối tác hệ thống:{' '}
                <strong className="font-mono text-foreground tracking-wider">
                  {data.affiliateCode}
                </strong>
              </p>

              <div className="flex gap-2 relative">
                <Input
                  readOnly
                  value={data.referralLink}
                  className="bg-white/[0.04] border-white/[0.08] font-mono text-sm pr-[130px] focus-visible:ring-primary/30"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  onClick={copyLink}
                  className={`absolute top-1 right-1 h-8 gap-1.5 font-semibold transition-all duration-200 ${
                    copied
                      ? 'bg-emerald-500 hover:bg-emerald-500 text-white'
                      : 'glow-primary'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Đã copy
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Sao chép
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* ═══════ Stats Grid ═══════ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Lượt đăng ký"
              value={data.summary.totalReferrals}
              subtext="Người dùng đã đăng ký"
              icon={<Users className="w-4 h-4" />}
              accentClass="bg-blue-500"
            />
            <StatCard
              label="Chuyển đổi"
              value={data.summary.firstPaidConversions}
              subtext="Giao dịch hợp lệ"
              icon={<TrendingUp className="w-4 h-4" />}
              accentClass="bg-emerald-500"
            />
            <StatCard
              label="Chờ duyệt"
              value={fmtVnd(data.summary.pendingCommissionVnd)}
              subtext={`Hold ${data.policy.holdDays} ngày`}
              icon={<Clock className="w-4 h-4" />}
              accentClass="bg-amber-500"
            />
            <StatCard
              label="Khả dụng"
              value={fmtVnd(data.summary.availableVnd ?? data.summary.approvedCommissionVnd)}
              subtext={
                data.summary.lockedVnd > 0
                  ? `Đang chờ rút ${fmtVnd(data.summary.lockedVnd)}`
                  : 'Sẵn sàng rút'
              }
              icon={<Wallet className="w-4 h-4" />}
              accentClass="bg-primary"
            />
          </div>

          {/* ═══════ Paid Commission Summary Row ═══════ */}
          {data.summary.paidCommissionVnd > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                  Tổng đã chi trả
                </p>
                <p className="text-lg font-bold font-display text-emerald-400">
                  {fmtVnd(data.summary.paidCommissionVnd)}
                </p>
              </div>
            </div>
          )}

          {/* ═══════ Rút hoa hồng ═══════ */}
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">Rút hoa hồng</CardTitle>
              <CardDescription>
                Tối thiểu {fmtVnd(data.policy.minWithdrawalVnd)} mỗi lần. Hoa hồng được giữ{' '}
                {data.policy.holdDays} ngày trước khi rút được, để phòng trường hợp khách hoàn tiền.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WithdrawalForm
                availableVnd={data.summary.availableVnd ?? 0}
                minVnd={data.policy.minWithdrawalVnd}
                hasOpenRequest={(data.withdrawals ?? []).some(
                  (w) => w.status === 'requested' || w.status === 'approved'
                )}
                onDone={fetchData}
              />

              {(data.withdrawals ?? []).length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Lịch sử rút</p>
                  <ul className="space-y-1.5">
                    {(data.withdrawals ?? []).map((w) => (
                      <li key={w.id} className="flex items-center justify-between text-sm gap-3">
                        <span className="text-muted-foreground shrink-0">
                          {new Date(w.requested_at).toLocaleDateString('vi-VN')}
                        </span>
                        <span className="font-medium text-foreground">{fmtVnd(w.amount_vnd)}</span>
                        <StatusBadge status={w.status === 'requested' ? 'pending' : w.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>


          {/* ═══════ Conversion History Table ═══════ */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
            <div className="p-6 pb-4 space-y-1">
              <h2 className="text-lg font-bold font-display">Lịch Sử Chuyển Đổi</h2>
              <p className="text-sm text-muted-foreground">
                Chi tiết các khoản hoa hồng phát sinh từ tập người dùng bạn giới thiệu.
              </p>
            </div>

            {!data.events || data.events.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">
                  Bạn chưa phát sinh lượt chuyển đổi giao dịch nào.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Chia sẻ link giới thiệu để bắt đầu nhận hoa hồng.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto px-6 pb-6">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Mô tả giao dịch</th>
                      <th className="px-4 py-3 text-right">Hoa hồng (VNĐ)</th>
                      <th className="px-4 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.events.map((ev) => (
                      <tr
                        key={ev.id}
                        className="hover:bg-white/[0.02] transition-colors duration-200"
                      >
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {new Date(ev.createdAt).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-4 min-w-[200px]">
                          <p className="font-semibold text-foreground text-sm">{ev.note}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            UID: {ev.referredUserId.substring(0, 8)}***
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <span
                            className={`font-semibold tracking-tight ${
                              ev.status === 'rejected'
                                ? 'text-muted-foreground line-through'
                                : 'text-primary'
                            }`}
                          >
                            + {ev.commissionVnd.toLocaleString('vi-VN')}₫
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={ev.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
