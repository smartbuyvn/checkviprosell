/**
 * Viprosell â€” Public Footer
 * Logo 36x29px, consistent links.
 */

import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import logoSrc from '@/assets/logo.png';

export const PublicFooter = forwardRef<HTMLElement>((_, ref) => {
  return (
    <footer ref={ref} className="py-10 border-t border-border bg-background">
      <div className="container px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src={logoSrc} alt="Viprosell" className="w-[36px] h-[29px] object-contain" />
              <span className="font-display text-lg font-bold">
                <span className="text-foreground">Vidio</span>
                <span className="text-gradient-primary">Sell</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Video bÃ¡n hÃ ng cho seller thÃ´ng minh.
              <br />
              Tá»« áº£nh sáº£n pháº©m tháº­t â†’ video chá»‘t Ä‘Æ¡n.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Sáº£n pháº©m</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to={ROUTES.PRICING} className="hover:text-foreground transition-colors w-fit">Báº£ng giÃ¡</Link>
              <Link to="/#demo" className="hover:text-foreground transition-colors w-fit">Demo</Link>
              <Link to="/#faq" className="hover:text-foreground transition-colors w-fit">FAQ</Link>
              <Link to={ROUTES.LOGIN} className="hover:text-foreground transition-colors w-fit">ÄÄƒng nháº­p</Link>
            </div>
          </div>

          {/* Legal placeholders */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">PhÃ¡p lÃ½</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="cursor-default opacity-60">Äiá»u khoáº£n sá»­ dá»¥ng</span>
              <span className="cursor-default opacity-60">ChÃ­nh sÃ¡ch báº£o máº­t</span>
              <span className="cursor-default opacity-60">LiÃªn há»‡: support@Viprosell.com</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Â© 2026 Viprosell. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
});

PublicFooter.displayName = 'PublicFooter';
