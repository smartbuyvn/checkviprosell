/**
 * Viprosell — Public Footer
 * Logo 36x29px, consistent links.
 * Legal links point to /terms and /privacy pages.
 */

import { forwardRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import logoSrc from '@/assets/logo.svg';

export const PublicFooter = forwardRef<HTMLElement>((_, ref) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /** Handle anchor links: scroll if on landing, else navigate to landing with scroll */
  const handleAnchorClick = (e: React.MouseEvent, hash: string) => {
    e.preventDefault();
    if (pathname === '/') {
      const el = document.querySelector(hash);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Dùng chung pattern với Header: Nối thẳng hash vào URL để browser tự trượt
      navigate('/' + hash);
    }
  };

  return (
    <footer ref={ref} className="py-10 border-t border-border bg-background">
      <div className="container px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src={logoSrc} alt="Viprosell" className="w-[36px] h-[29px] object-contain" />
              <span className="font-display text-lg font-bold">
                <span className="text-foreground">Vipro</span>
                <span className="text-gradient-primary">Sell</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Video bán hàng cho seller thông minh.
              <br />
              Từ ảnh sản phẩm thật → video chốt đơn.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Sản phẩm</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <a
                href="#pricing"
                onClick={(e) => handleAnchorClick(e, '#pricing')}
                className="hover:text-foreground transition-colors w-fit cursor-pointer"
              >
                Bảng giá
              </a>
              <a
                href="#demo"
                onClick={(e) => handleAnchorClick(e, '#demo')}
                className="hover:text-foreground transition-colors w-fit cursor-pointer"
              >
                Demo
              </a>
              <a
                href="#faq"
                onClick={(e) => handleAnchorClick(e, '#faq')}
                className="hover:text-foreground transition-colors w-fit cursor-pointer"
              >
                FAQ
              </a>
              <Link to={ROUTES.LOGIN} className="hover:text-foreground transition-colors w-fit">Đăng nhập</Link>
            </div>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Pháp lý</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to={ROUTES.TERMS} className="hover:text-foreground transition-colors w-fit">
                Điều khoản sử dụng
              </Link>
              <Link to={ROUTES.PRIVACY} className="hover:text-foreground transition-colors w-fit">
                Chính sách bảo mật
              </Link>
              <a href="mailto:support@viprosell.com" className="hover:text-foreground transition-colors w-fit">
                Liên hệ: support@viprosell.com
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Viprosell. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
});

PublicFooter.displayName = 'PublicFooter';
