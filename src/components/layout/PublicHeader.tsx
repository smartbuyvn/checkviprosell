/**
 * Viprosell — Public Header
 * Auth-aware: shows Avatar + Dropdown for authenticated users, Login/Signup for guests.
 * Includes mobile responsive hamburger menu and strictly safe routing.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Menu, X, LayoutDashboard, UserCircle, LogOut } from 'lucide-react';
import logoSrc from '@/assets/logo.svg';

interface PublicHeaderProps {
  variant?: 'transparent' | 'solid';
}

const PUBLIC_NAV = [
  { label: 'Tính năng', href: '/#features' },
  { label: 'Demo', href: '/#demo' },
  { label: 'Quy trình', href: '/#packages' },
  { label: 'Chọn gói', href: '/#pricing' },
];

const AUTH_NAV = [
  { label: 'Bảng điều khiển', href: ROUTES.DASHBOARD },
  { label: 'Chọn gói', href: '/#pricing' },
  { label: 'Nạp coin', href: ROUTES.BILLING },
];

/** Get user initials for avatar fallback */
function getInitials(displayName: string | null | undefined, email: string | undefined): string {
  if (displayName) {
    return displayName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return email ? email[0].toUpperCase() : '?';
}

export function PublicHeader({ variant = 'transparent' }: PublicHeaderProps) {
  const { isAuthenticated, isLoading, user, profile, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const NAV_LINKS = isAuthenticated ? AUTH_NAV : PUBLIC_NAV;

  const bgClass = variant === 'transparent'
    ? 'bg-glass-strong'
    : 'bg-card/80 backdrop-blur-md border-b border-border';

  /** * [FIXED] Safety Net: Khóa cuộn trang nền khi mở Mobile Menu
   */
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup khi component bị hủy
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileOpen]);


  /**
   * Menu neo (/#features, /#demo…): đang ở trang chủ thì cuộn, ở trang khác thì về
   * trang chủ rồi cuộn.
   *
   * Bản cũ làm `navigate('/' + href)` trong khi `href` ĐÃ là `/#features` — ra
   * `//#features`, và menu trên đầu không hoạt động ở bất kỳ trang nào không phải
   * trang chủ.
   *
   * Sửa dấu gạch thừa thôi vẫn chưa đủ: React Router chỉ đổi URL chứ không tự cuộn
   * tới neo khi chuyển trang. Phần cuộn do Landing lo khi nó gắn vào DOM.
   */
  const handleHashNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setMobileOpen(false);

    const hash = href.slice(href.indexOf('#'));

    if (window.location.pathname === '/') {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
      // Cập nhật thanh địa chỉ để người dùng chép link được, nhưng không nạp lại trang.
      window.history.replaceState(null, '', hash);
    } else {
      navigate('/' + hash);
    }
  };

  /** True if link is a hash-scroll link like /#features */
  const isHashLink = (href: string) => href.startsWith('/#');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayName = profile?.display_name || user?.email || '';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || '';
  const initials = getInitials(profile?.display_name, user?.email);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 ${bgClass}`}>
      <div className="container px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logoSrc} alt="Viprosell" className="w-[36px] h-[29px] object-contain" />
          <span className="font-display text-xl font-bold">
            <span className="text-foreground">Vipro</span>
            <span className="text-gradient-primary">Sell</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          {NAV_LINKS.map((link) => {
            const isActive = !isHashLink(link.href) && pathname === link.href;
            const cls = `hover:text-foreground transition-colors cursor-pointer ${isActive ? 'text-foreground font-semibold border-b border-primary pb-px' : ''
              }`;

            // Internal routes → use <Link>
            if (!isHashLink(link.href)) {
              return (
                <Link key={link.href} to={link.href} className={cls}>
                  {link.label}
                </Link>
              );
            }

            // Hash scroll links → use <button>
            return (
              <button
                key={link.href}
                onClick={(e) => handleHashNavClick(e, link.href)}
                className={`${cls} bg-transparent border-none`}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Desktop auth CTA */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            /* ── Authenticated: Avatar + Dropdown ── */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  id="user-menu-trigger"
                >
                  <Avatar className="h-8 w-8">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                    {displayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.display_name || 'Người dùng'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => navigate(ROUTES.DASHBOARD)}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Bảng điều khiển
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => navigate(ROUTES.ACCOUNT)}
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Tài khoản
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to={ROUTES.LOGIN}>
                <Button variant="outline" size="sm" className="font-medium text-white hover:text-white focus:text-white border-white/30 hover:bg-white/10">Đăng nhập</Button>
              </Link>
              <Link to={ROUTES.SIGNUP}>
                <Button size="sm" className="glow-primary font-display text-white hover:text-white active:text-white">Đăng ký miễn phí</Button>
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
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md px-4 py-4 space-y-3 shadow-lg">
          {NAV_LINKS.map((link) => {
            const isActive = !isHashLink(link.href) && pathname === link.href;
            const baseCls = `block w-full text-left text-sm hover:text-foreground transition-colors py-2 cursor-pointer ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
              }`;

            if (!isHashLink(link.href)) {
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={baseCls}
                >
                  {link.label}
                </Link>
              );
            }

            return (
              <button
                key={link.href}
                onClick={(e) => handleHashNavClick(e, link.href)}
                className={`${baseCls} bg-transparent border-none`}
              >
                {link.label}
              </button>
            );
          })}
          <div className="border-t border-border pt-3 space-y-2">
            {isAuthenticated ? (
              <>
                {/* Mobile: User info row */}
                <div className="flex items-center gap-3 px-1 py-2">
                  <Avatar className="h-8 w-8">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">
                      {profile?.display_name || 'Người dùng'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                  </div>
                </div>
                <Link to={ROUTES.DASHBOARD} onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full glow-primary font-display text-white hover:text-white active:text-white">Bảng điều khiển</Button>
                </Link>
                <Link to={ROUTES.ACCOUNT} onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">Tài khoản</Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    setMobileOpen(false);
                    await handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Đăng xuất
                </Button>
              </>
            ) : (
              <>
                <Link to={ROUTES.LOGIN} onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full text-white hover:text-white focus:text-white border-white/30 hover:bg-white/10">Đăng nhập</Button>
                </Link>
                <Link to={ROUTES.SIGNUP} onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full glow-primary font-display text-white hover:text-white active:text-white">Đăng ký miễn phí</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}