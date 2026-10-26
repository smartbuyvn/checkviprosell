/**
 * Viprosell — OAuth Callback Page
 * Handles redirect after Google OAuth sign-in.
 * Session is set automatically by the lovable auth module;
 * this page just waits for onAuthStateChange to fire and redirects.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { LoadingState } from '@/components/shared/LoadingState';

const AuthCallback = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
    if (!isLoading && !isAuthenticated) {
      // Check if we are currently processing an OAuth redirect in the hash
      if (window.location.hash.includes('access_token') || window.location.hash.includes('error=')) {
        // Wait for Supabase to process it
        return;
      }
      // OAuth failed or was cancelled, and no hash is present
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LoadingState message="Đang xác thực..." />
    </div>
  );
};

export default AuthCallback;
