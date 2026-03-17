/**
 * Viprosell â€” Checkout Dialog
 * Shows selected plan summary with VND pricing, payment method choice, and checkout states.
 */
import { useState } from 'react';
import { CreditCard, Wallet, Check, Loader2, AlertTriangle, RotateCcw, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PaymentBadges } from '@/components/shared/PaymentBadges';
import { cn } from '@/lib/utils';
import { CheckoutService, type CheckoutRequest } from '@/services/checkout.service';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/formatCurrency';

type CheckoutState = 'select' | 'loading' | 'success' | 'failed' | 'pending';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: { code: string; name: string; price: number; credits: number; currency?: string } | null;
  orderType: 'plan_subscription' | 'credit_pack';
}

const PAYMENT_METHODS = [
  { id: 'card', label: 'Visa / Mastercard', icon: CreditCard, description: 'Tháº» quá»‘c táº¿' },
  { id: 'paypal', label: 'PayPal', icon: Wallet, description: 'TÃ i khoáº£n PayPal' },
] as const;

export function CheckoutDialog({ open, onOpenChange, plan, orderType }: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [state, setState] = useState<CheckoutState>('select');
  const { toast } = useToast();

  const currency = plan?.currency || 'VND';

  const handleCheckout = async () => {
    if (!plan) return;
    setState('loading');

    const request: CheckoutRequest = {
      orderType,
      planCode: orderType === 'plan_subscription' ? plan.code : undefined,
      creditPackCode: orderType === 'credit_pack' ? plan.code : undefined,
      paymentMethod,
      amount: plan.price,
      currency,
    };

    const { error, redirectUrl } = await CheckoutService.initiateCheckout(request);

    if (error) {
      setState('failed');
      toast({ title: 'Lá»—i thanh toÃ¡n', description: error, variant: 'destructive' });
    } else if (redirectUrl) {
      window.open(redirectUrl, '_blank');
      setState('success');
    } else {
      setState('pending');
    }
  };

  const handleRetry = () => setState('select');

  const handleClose = () => {
    setState('select');
    onOpenChange(false);
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">
            {state === 'success' ? 'Thanh toÃ¡n thÃ nh cÃ´ng' : state === 'failed' ? 'Thanh toÃ¡n tháº¥t báº¡i' : state === 'pending' ? 'Sáº¯p ra máº¯t' : 'XÃ¡c nháº­n thanh toÃ¡n'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {state === 'select' && 'Chá»n phÆ°Æ¡ng thá»©c vÃ  xÃ¡c nháº­n Ä‘Æ¡n hÃ ng.'}
            {state === 'loading' && 'Äang xá»­ lÃ½ thanh toÃ¡n...'}
            {state === 'success' && 'ÄÆ¡n hÃ ng cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n.'}
            {state === 'failed' && 'ÄÃ£ xáº£y ra lá»—i. Vui lÃ²ng thá»­ láº¡i.'}
            {state === 'pending' && 'TÃ­nh nÄƒng thanh toÃ¡n Ä‘ang Ä‘Æ°á»£c phÃ¡t triá»ƒn.'}
          </DialogDescription>
        </DialogHeader>

        {/* Order summary */}
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">GÃ³i</span>
            <span className="text-sm font-medium text-foreground">{plan.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Credits</span>
            <span className="text-sm font-medium text-foreground">{plan.credits}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm font-medium text-foreground">Tá»•ng</span>
            <span className="font-display text-lg font-bold text-primary">
              {formatPrice(plan.price, currency)}
            </span>
          </div>
        </div>

        {/* Payment method selection */}
        {state === 'select' && plan.price > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">PhÆ°Æ¡ng thá»©c thanh toÃ¡n</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={cn(
                    'rounded-lg p-3 text-left transition-all border',
                    paymentMethod === method.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  )}
                >
                  <method.icon className={cn('w-5 h-5 mb-1', paymentMethod === method.id ? 'text-primary' : 'text-muted-foreground')} />
                  <p className="text-xs font-medium text-foreground">{method.label}</p>
                  <p className="text-[10px] text-muted-foreground">{method.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              <PaymentBadges size="sm" />
            </div>
          </div>
        )}

        {/* States */}
        {state === 'loading' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Äang káº¿t ná»‘i cá»•ng thanh toÃ¡n...</p>
          </div>
        )}

        {state === 'success' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-foreground font-medium">Thanh toÃ¡n Ä‘Ã£ Ä‘Æ°á»£c ghi nháº­n!</p>
            <p className="text-xs text-muted-foreground text-center">
              Credits sáº½ Ä‘Æ°á»£c cá»™ng sau khi xÃ¡c nháº­n tá»« cá»•ng thanh toÃ¡n.
            </p>
          </div>
        )}

        {state === 'failed' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-foreground font-medium">Thanh toÃ¡n khÃ´ng thÃ nh cÃ´ng</p>
            <p className="text-xs text-muted-foreground text-center">Vui lÃ²ng kiá»ƒm tra thÃ´ng tin vÃ  thá»­ láº¡i.</p>
          </div>
        )}

        {state === 'pending' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <p className="text-sm text-foreground font-medium">Thanh toÃ¡n online sáº¯p ra máº¯t</p>
            <p className="text-xs text-muted-foreground text-center">
              Cá»•ng thanh toÃ¡n Ä‘ang Ä‘Æ°á»£c tÃ­ch há»£p. Báº¡n sáº½ Ä‘Æ°á»£c thÃ´ng bÃ¡o khi sáºµn sÃ ng.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {state === 'select' && (
            <>
              <Button variant="outline" onClick={handleClose} className="flex-1">Há»§y</Button>
              <Button onClick={handleCheckout} className="flex-1 glow-primary font-display" disabled={plan.price === 0}>
                {plan.price === 0 ? 'GÃ³i hiá»‡n táº¡i' : 'Thanh toÃ¡n'}
              </Button>
            </>
          )}
          {state === 'failed' && (
            <>
              <Button variant="outline" onClick={handleClose} className="flex-1">ÄÃ³ng</Button>
              <Button onClick={handleRetry} className="flex-1">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Thá»­ láº¡i
              </Button>
            </>
          )}
          {(state === 'success' || state === 'pending') && (
            <Button onClick={handleClose} className="w-full">ÄÃ³ng</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
