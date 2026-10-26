/**
 * Viprosell — Public Layout
 * Wraps public pages with consistent header + footer.
 * Auth pages use compact=true to reduce visual noise.
 */

import { ReactNode } from 'react';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';

interface PublicLayoutProps {
  children: ReactNode;
  /** 'transparent' for landing, 'solid' for inner pages */
  headerVariant?: 'transparent' | 'solid';
  /** Hide footer on auth screens to keep them clean */
  hideFooter?: boolean;
}

export function PublicLayout({ children, headerVariant = 'solid', hideFooter = false }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <PublicHeader variant={headerVariant} />
      <main className="flex-1 pt-14">{children}</main>
      {!hideFooter && <PublicFooter />}
    </div>
  );
}
