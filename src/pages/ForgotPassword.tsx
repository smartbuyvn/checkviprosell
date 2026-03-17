/**
 * Viprosell â€” Forgot Password Page
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ArrowLeft, Mail } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/services/auth.service';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await AuthService.resetPassword(email);
    setLoading(false);
    if (error) {
      toast({ title: 'Lá»—i', description: error, variant: 'destructive' });
    } else {
      setSent(true);
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
          <p className="text-sm text-muted-foreground">Äáº·t láº¡i máº­t kháº©u</p>
        </div>

        {sent ? (
          <div className="rounded-xl bg-card p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-base font-semibold text-foreground">Kiá»ƒm tra email</h2>
            <p className="text-sm text-muted-foreground">
              Náº¿u tÃ i khoáº£n tá»“n táº¡i, chÃºng tÃ´i Ä‘Ã£ gá»­i link Ä‘áº·t láº¡i máº­t kháº©u Ä‘áº¿n <strong className="text-foreground">{email}</strong>.
            </p>
          </div>
        ) : (
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
            <Button type="submit" className="w-full font-display" disabled={loading}>
              {loading ? 'Äang gá»­i...' : 'Gá»­i link Ä‘áº·t láº¡i máº­t kháº©u'}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link to={ROUTES.LOGIN} className="text-primary hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Quay láº¡i Ä‘Äƒng nháº­p
          </Link>
        </p>
      </motion.div>
    </div>
    </PublicLayout>
  );
};

export default ForgotPassword;
