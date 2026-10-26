/**
 * Viprosell — Auth Service (Real Supabase)
 * Single source of truth for all auth operations.
 * No component should call supabase.auth directly.
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  affiliate_code: string | null;
  referred_by: string | null;
}

export type AppRole = 'guest' | 'user' | 'admin';

export const AuthService = {
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getSession() {
    return getSessionSafe(supabase);
  },

  /** Fetch profile — single source of truth (no direct DB in hooks) */
  async fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url, affiliate_code, referred_by')
      .eq('id', userId)
      .maybeSingle();
    return data;
  },

  /** Fetch role — single source of truth */
  async fetchRole(userId: string): Promise<AppRole> {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (data && data.some((r: any) => r.role === 'admin')) return 'admin';
    if (data && data.length > 0) return 'user';
    return 'guest';
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { user: data?.user ?? null, error: error?.message ?? null };
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data?.user ?? null, error: error?.message ?? null };
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  },

  async updateProfile(userId: string, updates: { display_name?: string | null }) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    return { error: error?.message ?? null };
  },

  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error?.message ?? null };
  },
};
