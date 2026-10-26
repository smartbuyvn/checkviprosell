/**
 * Viprosell — Dashboard Layout (app shell)
 * Sidebar + top bar with dynamic page title and user info.
 */

import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useAuth } from '@/hooks/useAuth';

export function DashboardLayout() {
  const { user, profile } = useAuth();
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/30 sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground hidden sm:inline">
                {getPageTitle(location.pathname)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {profile?.display_name || user?.email || ''}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname.includes('/projects/new')) return 'Tạo dự án mới';
  if (pathname.includes('/analysis')) return 'Phân tích sản phẩm';
  if (pathname.includes('/concepts')) return 'Chọn concept';
  if (pathname.includes('/script')) return 'Script & Render';
  if (pathname.includes('/billing')) return 'Thanh toán';
  if (pathname.includes('/account')) return 'Tài khoản';
  if (pathname.includes('/affiliate')) return 'Affiliate';
  if (pathname.includes('/admin')) return 'Admin Settings';
  return 'Dashboard';
}
