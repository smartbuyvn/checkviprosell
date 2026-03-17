/**
 * Viprosell â€” Public Header
 * Auth-aware: shows Dashboard link for authenticated users, Login/Signup for guests.
 * Includes mobile responsive hamburger menu.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Menu, X } from 'lucide-react';
import logoSrc from '@/assets/logo.png';

interface PublicHeaderProps {
  variant?: 'transparent' | 'solid';
}

const NAV_LINKS = [
  { label: 'TÃ­nh nÄƒng', href: '/#features' },
  { label: 'Demo', href: '/#demo' },
  { label: 'Quy trÃ¬nh', href: '/#packages' },
];

export function PublicHeader({ variant = 'transparent' }: PublicHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const bgClass = variant === 'transparent'
    ? 'bg-glass-strong'
    : 'bg-card/80 backdrop-blur-md border-b border-border';

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith('/#')) {
      // Scroll to section on landing page
      if (window.location.pathname === '/') {
        const el = document.querySelector(href.replace('/', ''));
        el?.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate(href.replace('/#', '/?scroll='));
      }
    } else {
      navigate(href);
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 ${bgClass}`}>
      <div className="container px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logoSrc} alt="Viprosell" className="w-[36px] h-[29px] object-contain" />
          <span className="font-display text-xl font-bold">
            <span className="text-foreground">Vidio</span>
            <span className="text-gradient-primary">Sell</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Desktop auth CTA â€” always show fallback buttons even during loading */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <Link to={ROUTES.DASHBOARD}>
              <Button size="sm" className="glow-primary font-display">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to={ROUTES.LOGIN}>
                <Button variant="ghost" size="sm" className="text-foreground hover:text-primary font-medium">ÄÄƒng nháº­p</Button>
              </Link>
              <Link to={ROUTES.SIGNUP}>
                <Button size="sm" className="glow-primary font-display">ÄÄƒng kÃ½ miá»…n phÃ­</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md px-4 py-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-2 bg-transparent border-none cursor-pointer"
            >
              {link.label}
            </button>
          ))}
          <div className="border-t border-border pt-3 space-y-2">
            {isAuthenticated ? (
              <Link to={ROUTES.DASHBOARD} onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full glow-primary font-display">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to={ROUTES.LOGIN} onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">ÄÄƒng nháº­p</Button>
                </Link>
                <Link to={ROUTES.SIGNUP} onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full glow-primary font-display">ÄÄƒng kÃ½ miá»…n phÃ­</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
