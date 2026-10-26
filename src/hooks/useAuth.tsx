/**
 * Viprosell — Auth Context (Hardened for Production)
 *
 * Defensive patterns:
 * - logout() wrapped in try/catch with force-clear fallback
 * - onAuthStateChange always sets isLoading=false (even on error)
 * - Auth timeout prevents infinite loading states
 * - All auth operations return user-friendly errors
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthService, type UserProfile, type AppRole } from '@/services/auth.service';
import { AffiliateService } from '@/services/affiliate.service';
import { isAbortOrLockError } from '@/lib/errorUtils';
import { toast } from 'sonner';
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

/** Max time to wait for auth initialization before force-resolving */
const AUTH_INIT_TIMEOUT_MS = 10000;

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
    if (error && error !== 'Chưa đăng nhập') {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      console.warn('[affiliate] Referral failed, removing pending ref:', error);
    }
  } catch {
    console.warn('[affiliate] Failed to process pending referral');
  }
}

/**
 * Force-clear all Supabase auth state from browser storage.
 * Used as last-resort fallback when signOut() API call fails,
 * preventing the user from being stuck in a zombie session.
 */
function forceClearAuthStorage() {
  try {
    // Clear Supabase-specific keys from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Also clear sessionStorage
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        sessionStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error('[Auth] forceClearAuthStorage failed:', e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole>('guest');
  const [isLoading, setIsLoading] = useState(true);
  const initResolvedRef = useRef(false);

  const loadUserData = useCallback(async (supaUser: SupabaseUser | null) => {
    if (!supaUser) {
      setUser(null);
      setProfile(null);
      setRole('guest');
      return;
    }
    setUser(supaUser);

    // Delegate to AuthService — no direct DB access in hooks
    try {
      const [prof, r] = await Promise.all([
        AuthService.fetchProfile(supaUser.id),
        AuthService.fetchRole(supaUser.id),
      ]);
      setProfile(prof);
      setRole(r);
    } catch (err) {
      // Profile/role fetch failed — set user but with fallback role
      console.error('[Auth] Failed to load profile/role:', err);
      setProfile(null);
      setRole('user'); // Safe fallback — user exists but role unknown
    }

    // Process pending referral on first authenticated session
    await processPendingReferral();
  }, []);

  useEffect(() => {
    let isMounted = true;

    /** Resolve auth initialization — called by whichever path fires first */
    const resolveInit = async (session: { user: SupabaseUser } | null) => {
      // Only the first caller wins — skip if already resolved
      if (initResolvedRef.current || !isMounted) return;
      initResolvedRef.current = true;

      try {
        await loadUserData(session?.user ?? null);
      } catch (err) {
        if (!isAbortOrLockError(err)) {
          console.error('[Auth] Init loadUserData error:', err);
        }
        // Fallback: clear user state so app shows login
        setUser(null);
        setProfile(null);
        setRole('guest');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    /* ─── Path 1: onAuthStateChange (ongoing listener) ──────────────
     * Handles: INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED.
     * If Supabase is reachable, INITIAL_SESSION fires almost immediately.
     * ─────────────────────────────────────────────────────────────── */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;

        if (!initResolvedRef.current) {
          // First event = initial session bootstrap
          await resolveInit(session);
        } else {
          // Subsequent events = session changes (login/logout/refresh)
          try {
            await loadUserData(session?.user ?? null);
          } catch (err) {
            if (!isAbortOrLockError(err)) {
              console.error('[Auth] onAuthStateChange error:', err);
            }
          }
        }
      }
    );

    /* ─── Path 2: getSession() with 8s timeout (fallback) ──────────
     * If onAuthStateChange never fires (Supabase unreachable, network
     * issues, Cloudflare Tunnel down), this resolves the app in ≤8s
     * instead of hanging until the 10s safety timeout.
     * ─────────────────────────────────────────────────────────────── */
    const SESSION_TIMEOUT_MS = 8000;

    const sessionPromise = supabase.auth.getSession()
      .then(({ data: { session } }) => session)
      .catch((err) => {
        if (!isAbortOrLockError(err)) {
          console.warn('[Auth] getSession() failed:', err);
        }
        return null;
      });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn('[Auth] getSession() timed out after 3s — resolving with no session');
        resolve(null);
      }, SESSION_TIMEOUT_MS);
    });

    Promise.race([sessionPromise, timeoutPromise]).then((session) => {
      if (isMounted) resolveInit(session);
    });

    /* ─── Safety net: absolute maximum wait ─────────────────────── 
     * MUST be unconditional. resolveInit sets initResolvedRef=true
     * BEFORE loadUserData completes — if loadUserData hangs, the
     * old guard (!initResolvedRef.current) would never fire.
     * ─────────────────────────────────────────────────────────── */
    const absoluteTimeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Absolute timeout reached — forcing isLoading=false');
        initResolvedRef.current = true;
        setIsLoading(false);
      }
    }, AUTH_INIT_TIMEOUT_MS);

    return () => {
      isMounted = false;
      clearTimeout(absoluteTimeoutId);
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await AuthService.login(email, password);
      return { error };
    } catch (err: any) {
      const msg = err?.message || 'Không thể kết nối đến server. Vui lòng thử lại.';
      return { error: msg };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await AuthService.signUp(email, password);
      return { error };
    } catch (err: any) {
      const msg = err?.message || 'Không thể kết nối đến server. Vui lòng thử lại.';
      return { error: msg };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await AuthService.signInWithGoogle();
      return { error };
    } catch (err: any) {
      const msg = err?.message || 'Không thể kết nối Google. Vui lòng thử lại.';
      return { error: msg };
    }
  }, []);

  /**
   * HARDENED LOGOUT
   * 1. Try Supabase signOut API
   * 2. If fails → force-clear localStorage/sessionStorage
   * 3. Always reset React state to prevent zombie session
   * 4. Toast on error so user knows what happened
   */
  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (err: any) {
      console.error('[Auth] Logout API failed, force-clearing storage:', err);
      toast.error('Phiên đăng nhập đã bị lỗi. Đã buộc đăng xuất thành công.');
    } finally {
      // ALWAYS clear both React state AND browser storage
      // This runs regardless of success/failure — zero zombie sessions
      forceClearAuthStorage();
      setUser(null);
      setProfile(null);
      setRole('guest');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const [prof, r] = await Promise.all([
        AuthService.fetchProfile(user.id),
        AuthService.fetchRole(user.id),
      ]);
      setProfile(prof);
      setRole(r);
    } catch (err) {
      console.error('[Auth] refreshProfile failed:', err);
    }
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
