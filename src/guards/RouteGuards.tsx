/**
 * Viprosell — Route Guards (Hardened for Production)
 *
 * Defensive patterns:
 * - AuthGuard includes timeout fallback (redirects to login after 10s)
 * - Navigate includes ?returnUrl= for deep-link preservation
 * - Loading state is always visible and branded
 */

import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { LoadingState } from '@/components/shared/LoadingState';
import { ReactNode } from 'react';

interface GuardProps {
  children: ReactNode;
}

/** Max time to display the loading spinner before forcing a redirect */
const GUARD_TIMEOUT_MS = 8000;

/** Requires authenticated user */
export function AuthGuard({ children }: GuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  // Safety timeout: if auth check hangs forever, redirect to login
  useEffect(() => {
    if (!isLoading) return;

    const timer = setTimeout(() => {
      console.warn('[AuthGuard] Auth check timed out after 8s — redirecting to login');
      setTimedOut(true);
    }, GUARD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState message="Đang xác thực..." />
      </div>
    );
  }

  if (!isAuthenticated || timedOut) {
    // Preserve the current URL so Login can redirect back after auth
    const returnUrl = location.pathname + location.search;
    const loginTarget = returnUrl !== '/' && returnUrl !== ROUTES.LOGIN
      ? `${ROUTES.LOGIN}?returnUrl=${encodeURIComponent(returnUrl)}`
      : ROUTES.LOGIN;

    return <Navigate to={loginTarget} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/** Requires admin role */
export function AdminGuard({ children }: GuardProps) {
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      console.warn('[AdminGuard] Auth check timed out — redirecting');
      setTimedOut(true);
    }, GUARD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState message="Đang xác thực..." />
      </div>
    );
  }

  if (!isAuthenticated || timedOut) {
    const returnUrl = location.pathname + location.search;
    const loginTarget = returnUrl !== '/' && returnUrl !== ROUTES.LOGIN
      ? `${ROUTES.LOGIN}?returnUrl=${encodeURIComponent(returnUrl)}`
      : ROUTES.LOGIN;
    return <Navigate to={loginTarget} state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}

/** Redirect to dashboard if already authenticated */
export function GuestGuard({ children }: GuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState message="Đang tải..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
