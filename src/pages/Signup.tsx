/**
 * Viprosell — Signup Page
 * Supports ?ref= query param for affiliate referral tracking.
 * Referral is deferred to first authenticated session (after email verification).
 */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { useAuth, storePendingReferral } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GoogleAuthButton } from '@/components/shared/GoogleAuthButton';
import { Separator } from '@/components/ui/separator';
import { PublicLayout } from '@/components/layout/PublicLayout';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  const { signup } = useAuth();
  const { toast } = useToast();

  // Store referral before Google OAuth redirect (will be processed after auth)
  const handleGoogleWithRef = () => {
    if (refCode) {
      storePendingReferral(refCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) {
      toast({ title: 'Lỗi', description: 'Mật khẩu tối thiểu 6 ký tự', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signup(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Đăng ký thất bại', description: error, variant: 'destructive' });
    } else {
      if (refCode) {
        storePendingReferral(refCode);
      }
      setSignupDone(true);
    }
  };

  // Success confirmation screen
  if (signupDone) {
    return (
      <PublicLayout hideFooter headerVariant="solid">
      <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-2">Kiểm tra email</h2>
            <p className="text-sm text-muted-foreground">
              Chúng tôi đã gửi link xác nhận đến{' '}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Nhấn vào link trong email để kích hoạt tài khoản.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link to={ROUTES.LOGIN} className="text-primary hover:underline">
              Quay lại đăng nhập
            </Link>
          </p>
      </motion.div>
      </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout hideFooter headerVariant="solid">
    <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <Link to="/" className="font-display text-2xl font-bold inline-block mb-2">
            <span className="text-foreground">Vipro</span>
            <span className="text-gradient-primary">Sell</span>
          </Link>
          <p className="text-sm text-muted-foreground">Tạo tài khoản mới</p>
          {refCode && (
            <p className="text-xs text-primary mt-1">🎁 Bạn được giới thiệu bởi: {refCode}</p>
          )}
        </div>

        <div onClick={handleGoogleWithRef}>
          <GoogleAuthButton label="Đăng ký với Google" />
        </div>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">hoặc</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="Tối thiểu 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full font-display glow-primary text-white hover:text-white active:text-white" disabled={loading}>
            {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link to={ROUTES.LOGIN} className="text-primary hover:underline">Đăng nhập</Link>
        </p>
      </motion.div>
    </div>
    </PublicLayout>
  );
};

export default Signup;
