/**
 * Viprosell — App Sidebar Navigation
 * Logo 36x29px, credit balance, auth-aware.
 */

import { useState, useEffect } from 'react';
import logoSrc from '@/assets/logo.svg';
import {
  LayoutDashboard, FolderPlus, Settings, LogOut,
  UserCircle, Coins, Users,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { CreditService } from '@/services/credit.service';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const mainNav = [
  { title: 'Dashboard', url: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { title: 'Tạo mới', url: ROUTES.NEW_PROJECT, icon: FolderPlus },
  { title: 'Tiếp thị LK', url: ROUTES.AFFILIATE, icon: Users },
  { title: 'Thanh toán (Billing)', url: ROUTES.BILLING, icon: Coins },
  { title: 'Tài khoản', url: ROUTES.ACCOUNT, icon: UserCircle },
];

const adminNav = [
  { title: 'Admin Settings', url: ROUTES.ADMIN_SETTINGS, icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isAdmin, isAuthenticated, logout } = useAuth();
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    CreditService.getBalance().then(({ balance }) => setCreditBalance(balance));
  }, [isAuthenticated]);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 border-b border-sidebar-border">
          <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2">
            <img src={logoSrc} alt="Viprosell" className="w-[36px] h-[29px] object-contain" />
            {!collapsed && (
              <span className="font-display text-lg font-bold">
                <span className="text-foreground">Vipro</span>
                <span className="text-gradient-primary">Sell</span>
              </span>
            )}
          </Link>
        </div>

        {/* Credit Balance */}
        {!collapsed && creditBalance !== null && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <Link to={ROUTES.BILLING} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credits</p>
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {creditBalance}
                </p>
              </div>
            </Link>
          </div>
        )}
        {collapsed && creditBalance !== null && (
          <div className="px-2 py-2 border-b border-sidebar-border">
            <Link to={ROUTES.BILLING} className="flex items-center justify-center" title={`${creditBalance} credits`}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{creditBalance}</span>
              </div>
            </Link>
          </div>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Navigation */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            window.location.href = '/login';
          }}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && <span>Đăng xuất</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
