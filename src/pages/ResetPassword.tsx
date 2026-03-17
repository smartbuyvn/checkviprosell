/**
 * Viprosell â€” Reset Password Page
 * User arrives here via email link with type=recovery in URL hash.
 * All auth operations routed through AuthService.
 */
import { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AuthService } from '@/services/auth.service';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
    // Listen for PASSWORD_RECOVERY event (read-only listener, not a mutation)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Lá»—i', description: 'Máº­t kháº©u tá»‘i thiá»ƒu 6 kÃ½ tá»±', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Lá»—i', description: 'Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await AuthService.updatePassword(password);
    setLoading(false);
    if (error) {
      toast({ title: 'Lá»—i', description: error, variant: 'destructive' });
    } else {
      setDone(true);
      setTimeout(() => navigate(ROUTES.DASHBOARD), 2000);
    }
  };

  if (!isRecovery && !done) {
    return (
      <PublicLayout hideFooter headerVariant="solid">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Link khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.</p>
          <Button variant="outline" onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}>
            YÃªu cáº§u link má»›i
          </Button>
        </div>
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
          <span className="font-display text-2xl font-bold inline-block mb-2">
            <span className="text-foreground">Vidio</span>
            <span className="text-gradient-primary">Sell</span>
          </span>
          <p className="text-sm text-muted-foreground">Táº¡o máº­t kháº©u má»›i</p>
        </div>

        {done ? (
          <div className="rounded-xl bg-card p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <h2 className="font-display text-base font-semibold text-foreground">ÄÃ£ cáº­p nháº­t!</h2>
            <p className="text-sm text-muted-foreground">Äang chuyá»ƒn Ä‘áº¿n dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Máº­t kháº©u má»›i</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirm">XÃ¡c nháº­n máº­t kháº©u</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Nháº­p láº¡i máº­t kháº©u"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full font-display" disabled={loading}>
              {loading ? 'Äang cáº­p nháº­t...' : 'Äáº·t máº­t kháº©u má»›i'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
    </PublicLayout>
  );
};

export default ResetPassword;
