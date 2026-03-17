/**
 * Viprosell â€” Auth Context (Real Supabase)
 * Delegates ALL auth + profile + role operations to AuthService.
 * Handles referral code persistence on first authenticated session.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthService, type UserProfile, type AppRole } from '@/services/auth.service';
import { AffiliateService } from '@/services/affiliate.service';
import { isAbortOrLockError } from '@/lib/errorUtils';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextValue {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  role: AppRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFERRAL_STORAGE_KEY = 'Viprosell_pending_ref';

/** Persist pending referral code on first authenticated session */
async function processPendingReferral() {
  const pendingRef = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!pendingRef) return;

  try {
    const { error } = await AffiliateService.setReferredBy(pendingRef);
    if (!error) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
    // If error (e.g. invalid code), also remove to avoid retry loops
    if (error && error !== 'ChÆ°a Ä‘Äƒng nháº­p') {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      console.warn('[affiliate] Referral failed, removing pending ref:', error);
    }
  } catch {
    console.warn('[affiliate] Failed to process pending referral');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole>('guest');
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = useCallback(async (supaUser: SupabaseUser | null) => {
    if (!supaUser) {
      setUser(null);
      setProfile(null);
      setRole('guest');
      return;
    }
    setUser(supaUser);

    // Delegate to AuthService â€” no direct DB access in hooks
    const [prof, r] = await Promise.all([
      AuthService.fetchProfile(supaUser.id),
      AuthService.fetchRole(supaUser.id),
    ]);
    setProfile(prof);
    setRole(r);

    // Process pending referral on first authenticated session
    await processPendingReferral();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          await loadUserData(session?.user ?? null);
        } catch (err) {
          if (!isAbortOrLockError(err)) {
            console.error('[Auth] onAuthStateChange error:', err);
          }
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserData(session?.user ?? null)
        .catch((err) => {
          if (!isAbortOrLockError(err)) console.error('[Auth] getSession error:', err);
        })
        .finally(() => setIsLoading(false));
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await AuthService.login(email, password);
    return { error };
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const { error } = await AuthService.signUp(email, password);
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await AuthService.signInWithGoogle();
    return { error };
  }, []);

  const logout = useCallback(async () => {
    await AuthService.logout();
    setUser(null);
    setProfile(null);
    setRole('guest');
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const [prof, r] = await Promise.all([
      AuthService.fetchProfile(user.id),
      AuthService.fetchRole(user.id),
    ]);
    setProfile(prof);
    setRole(r);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isLoading,
        isAuthenticated: user !== null,
        isAdmin: role === 'admin',
        login,
        signup,
        signInWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Store referral code for deferred processing after email verification */
export function storePendingReferral(refCode: string) {
  localStorage.setItem(REFERRAL_STORAGE_KEY, refCode);
}
