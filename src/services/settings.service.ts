/**
 * Viprosell â€” Settings Service (Real Supabase)
 * Reads/writes system_settings table. Admin writes go through edge function.
 */

import { supabase } from '@/integrations/supabase/client';
import { SystemSettings } from '@/types';
import { DEFAULT_SYSTEM_SETTINGS, validateSettings } from '@/constants/settings';
import { AdminService } from '@/services/admin.service';

export const SettingsService = {
  async getSettings(): Promise<SystemSettings> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value');

    if (error || !data || data.length === 0) {
      return { ...DEFAULT_SYSTEM_SETTINGS };
    }

    const settings = { ...DEFAULT_SYSTEM_SETTINGS };
    for (const row of data) {
      const key = row.key as keyof SystemSettings;
      if (key in settings) {
        (settings as any)[key] = row.value;
      }
    }
    return settings;
  },

  /** Update settings through backend validation + audit logging */
  async updateSettings(updates: Partial<SystemSettings>): Promise<{ error: string | null; autoFixed?: boolean }> {
    // Client-side pre-validation
    const current = await this.getSettings();
    const merged = { ...current, ...updates };
    const errors = validateSettings(merged);

    // If LOCAL_ONLY_MODE is being enabled, auto-fix on client too for instant feedback
    const fixedUpdates = { ...updates };
    if (fixedUpdates.LOCAL_ONLY_MODE === true) {
      fixedUpdates.ALLOW_EXTERNAL_AI_APIS = false;
      fixedUpdates.PREMIUM_RENDER_ENABLED = false;
      fixedUpdates.CLOUD_FALLBACK_ENABLED = false;
    }

    // Call backend for validated + audited update
    const { data, error } = await AdminService.updateSettingsSecure(fixedUpdates);
    if (error) return { error };

    return { error: null, autoFixed: data?.auto_fixed };
  },

  isFeatureAllowed(settings: SystemSettings, feature: 'external_ai' | 'premium_render' | 'cloud_fallback'): boolean {
    switch (feature) {
      case 'external_ai':
        return !settings.LOCAL_ONLY_MODE && settings.ALLOW_EXTERNAL_AI_APIS;
      case 'premium_render':
        return settings.PREMIUM_RENDER_ENABLED && !settings.LOCAL_ONLY_MODE;
      case 'cloud_fallback':
        return settings.CLOUD_FALLBACK_ENABLED && !settings.LOCAL_ONLY_MODE;
      default:
        return false;
    }
  },
};
