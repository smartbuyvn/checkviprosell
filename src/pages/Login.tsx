/**
 * Viprosell â€” Login Page
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GoogleAuthButton } from '@/components/shared/GoogleAuthButton';
import { Separator } from '@/components/ui/separator';
import { PublicLayout } from '@/components/layout/PublicLayout';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { error } = await login(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'ÄÄƒng nháº­p tháº¥t báº¡i', description: error, variant: 'destructive' });
    } else {
      navigate(ROUTES.DASHBOARD);
    }
  };

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
          <p className="text-sm text-muted-foreground">ÄÄƒng nháº­p Ä‘á»ƒ tiáº¿p tá»¥c</p>
        </div>

        <GoogleAuthButton label="ÄÄƒng nháº­p vá»›i Google" />

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
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full font-display" disabled={loading}>
            {loading ? 'Äang Ä‘Äƒng nháº­p...' : 'ÄÄƒng nháº­p'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <Link to={ROUTES.FORGOT_PASSWORD} className="text-xs text-muted-foreground hover:text-primary transition-colors">
            QuÃªn máº­t kháº©u?
          </Link>
          <p className="text-sm text-muted-foreground">
            ChÆ°a cÃ³ tÃ i khoáº£n?{' '}
            <Link to={ROUTES.SIGNUP} className="text-primary hover:underline">ÄÄƒng kÃ½</Link>
          </p>
        </div>
      </motion.div>
    </div>
    </PublicLayout>
  );
};

export default Login;
