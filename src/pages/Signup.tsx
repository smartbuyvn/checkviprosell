/**
 * Viprosell â€” Signup Page
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
      toast({ title: 'Lá»—i', description: 'Máº­t kháº©u tá»‘i thiá»ƒu 6 kÃ½ tá»±', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signup(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'ÄÄƒng kÃ½ tháº¥t báº¡i', description: error, variant: 'destructive' });
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
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-2">Kiá»ƒm tra email</h2>
            <p className="text-sm text-muted-foreground">
              ChÃºng tÃ´i Ä‘Ã£ gá»­i link xÃ¡c nháº­n Ä‘áº¿n{' '}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Nháº¥n vÃ o link trong email Ä‘á»ƒ kÃ­ch hoáº¡t tÃ i khoáº£n.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link to={ROUTES.LOGIN} className="text-primary hover:underline">
              Quay láº¡i Ä‘Äƒng nháº­p
            </Link>
          </p>
      </motion.div>
      </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout hideFooter headerVariant="solid">
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <Link to="/" className="font-display text-2xl font-bold inline-block mb-2">
            <span className="text-foreground">Vidio</span>
            <span className="text-gradient-primary">Sell</span>
          </Link>
          <p className="text-sm text-muted-foreground">Táº¡o tÃ i khoáº£n má»›i</p>
          {refCode && (
            <p className="text-xs text-primary mt-1">ðŸŽ Báº¡n Ä‘Æ°á»£c giá»›i thiá»‡u bá»Ÿi: {refCode}</p>
          )}
        </div>

        <div onClick={handleGoogleWithRef}>
          <GoogleAuthButton label="ÄÄƒng kÃ½ vá»›i Google" />
        </div>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">hoáº·c</span>
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
            <Label htmlFor="password">Máº­t kháº©u</Label>
            <Input
              id="password"
              type="password"
              placeholder="Tá»‘i thiá»ƒu 6 kÃ½ tá»±"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full font-display" disabled={loading}>
            {loading ? 'Äang táº¡o tÃ i khoáº£n...' : 'ÄÄƒng kÃ½'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ÄÃ£ cÃ³ tÃ i khoáº£n?{' '}
          <Link to={ROUTES.LOGIN} className="text-primary hover:underline">ÄÄƒng nháº­p</Link>
        </p>
      </motion.div>
    </div>
    </PublicLayout>
  );
};

export default Signup;
