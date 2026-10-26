/**
 * Viprosell — Settings Hook (Real Supabase)
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { SystemSettings } from '@/types';
import { DEFAULT_SYSTEM_SETTINGS } from '@/constants/settings';
import { SettingsService } from '@/services/settings.service';
import { useToast } from '@/hooks/use-toast';

interface SettingsContextValue {
  settings: SystemSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refreshSettings = useCallback(async () => {
    const loaded = await SettingsService.getSettings();
    setSettings(loaded);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const updateSettings = useCallback(async (updates: Partial<SystemSettings>) => {
    // Optimistic update
    const prev = { ...settings };
    const optimistic = { ...settings, ...updates };

    // Auto-fix contradictions client-side for instant feedback
    if (updates.LOCALONLYMODE === true) {
      optimistic.ALLOWEXTERNALAIAPIS = false;
      optimistic.PREMIUMRENDERENABLED = false;
      optimistic.CLOUDFALLBACKENABLED = false;
    }

    setSettings(optimistic);

    const { error } = await SettingsService.updateSettings(updates);
    if (error) {
      // Revert optimistic update
      setSettings(prev);
      toast({ title: 'Lỗi cập nhật settings', description: error, variant: 'destructive' });
    } else {
      // Refresh to get server state
      await refreshSettings();
    }
  }, [settings, refreshSettings, toast]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
