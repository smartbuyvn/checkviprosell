/**
 * Viprosell — Account Page
 * All operations routed through AuthService (no direct DB access).
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, KeyRound, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/services/auth.service';
import { BillingService } from '@/services/billing.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { isAbortOrLockError, getUserErrorMessage } from '@/lib/errorUtils';

const Account = () => {
  const { user, profile, role, isLoading: authLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  // Display name editing
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Current plan (derived from payment history)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile]);

  useEffect(() => {
    setPlanLoading(true);
    setPlanError(null);
    BillingService.getBillingSummary()
      .then(({ summary }) => {
        setCurrentPlan(summary?.currentPlan?.name ?? null);
      })
      .catch((err) => {
        if (!isAbortOrLockError(err)) {
          setPlanError(getUserErrorMessage(err, 'Không tải được thông tin gói'));
        }
      })
      .finally(() => setPlanLoading(false));
  }, []);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await AuthService.updateProfile(user.id, {
      display_name: displayName.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Lỗi', description: error, variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Đã lưu', description: 'Cập nhật thông tin thành công.' });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Lỗi', description: 'Mật khẩu tối thiểu 6 ký tự', variant: 'destructive' });
      return;
    }
    setChangingPw(true);
    const { error } = await AuthService.updatePassword(newPassword);
    setChangingPw(false);
    if (error) {
      toast({ title: 'Lỗi', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Đã cập nhật', description: 'Mật khẩu đã được đổi thành công.' });
      setNewPassword('');
    }
  };

  if (authLoading) return <LoadingState message="Đang tải tài khoản..." />;
  if (!user) return <ErrorState message="Không tìm thấy thông tin người dùng." />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Tài khoản</h1>
        <p className="text-sm text-muted-foreground">Quản lý thông tin cá nhân và bảo mật.</p>
      </div>

      {/* Profile info */}
      <div className="rounded-xl bg-card p-5 space-y-4">
        <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Thông tin cá nhân
        </h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> Email
            </Label>
            <Input value={user?.email ?? ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName" className="text-xs text-muted-foreground">Tên hiển thị</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hiển thị"
            />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" /> Vai trò: <span className="font-medium text-foreground capitalize">{role}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CreditCard className="w-3 h-3" /> Gói:{' '}
              <span className="font-medium text-foreground capitalize">
                {planLoading ? '...' : planError ? 'N/A' : (currentPlan ?? 'Free')}
              </span>
            </div>
          </div>
          <Button onClick={handleUpdateProfile} disabled={saving} size="sm">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl bg-card p-5 space-y-4">
        <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" /> Đổi mật khẩu
        </h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="newPw" className="text-xs text-muted-foreground">Mật khẩu mới</Label>
            <Input
              id="newPw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              minLength={6}
            />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPw} size="sm" variant="outline">
            {changingPw ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default Account;
