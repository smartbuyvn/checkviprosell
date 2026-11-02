/**
 * Viprosell — Settings Service (Real Supabase)
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

    // Phân biệt ba tình huống, trước đây gộp làm một và đó là nguồn gốc lỗi
    // "gạt công tắc xong nó bật lại":
    //
    //   - đọc lỗi (RLS chặn, mất mạng) → dùng mặc định, nhưng NÓI RA
    //   - bảng rỗng (chưa seed)        → dùng mặc định, nhưng NÓI RA
    //   - có dòng                      → dùng giá trị thật
    //
    // Gộp lại thì giao diện hiện mặc định LOCALONLYMODE=true mà không ai biết
    // đó là mặc định, nên tưởng cài đặt không lưu được.
    if (error) {
      console.warn(
        `[Settings] Không đọc được system_settings (${error.message}). ` +
        'Đang hiện giá trị mặc định — KHÔNG phải trạng thái thật của hệ thống.'
      );
      return { ...DEFAULT_SYSTEM_SETTINGS };
    }

    if (!data || data.length === 0) {
      console.warn(
        '[Settings] Bảng system_settings rỗng. Đang hiện giá trị mặc định — ' +
        'chạy migration seed để giao diện phản ánh đúng thứ đang chạy.'
      );
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

    // If LOCALONLYMODE is being enabled, auto-fix on client too for instant feedback
    const fixedUpdates = { ...updates };
    if (fixedUpdates.LOCALONLYMODE === true) {
      fixedUpdates.ALLOWEXTERNALAIAPIS = false;
      fixedUpdates.PREMIUMRENDERENABLED = false;
      fixedUpdates.CLOUDFALLBACKENABLED = false;
    }

    // Call backend for validated + audited update
    const { data, error } = await AdminService.updateSettingsSecure(fixedUpdates);
    if (error) return { error };

    return { error: null, autoFixed: data?.auto_fixed };
  },

  isFeatureAllowed(settings: SystemSettings, feature: 'external_ai' | 'premium_render' | 'cloud_fallback'): boolean {
    switch (feature) {
      case 'external_ai':
        return !settings.LOCALONLYMODE && settings.ALLOWEXTERNALAIAPIS;
      case 'premium_render':
        return settings.PREMIUMRENDERENABLED && !settings.LOCALONLYMODE;
      case 'cloud_fallback':
        return settings.CLOUDFALLBACKENABLED && !settings.LOCALONLYMODE;
      default:
        return false;
    }
  },
};
