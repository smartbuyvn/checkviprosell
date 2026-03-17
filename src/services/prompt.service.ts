/**
 * Viprosell â€” Prompt Service (Real Supabase)
 * CRUD for AI prompt templates. Admin-managed via RLS.
 */

import { supabase } from '@/integrations/supabase/client';

export const PromptService = {
  async getActiveByCategory(category: string) {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('version', { ascending: false });
    return { prompts: data ?? [], error: error?.message ?? null };
  },

  async getByPackageType(packageType: 'quick_ads' | 'review_video' | 'conversion_video') {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('package_type', packageType)
      .eq('is_active', true)
      .order('version', { ascending: false });
    return { prompts: data ?? [], error: error?.message ?? null };
  },

  async getAll() {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('category')
      .order('version', { ascending: false });
    return { prompts: data ?? [], error: error?.message ?? null };
  },

  async upsert(prompt: {
    category: string;
    name: string;
    content: string;
    package_type?: 'quick_ads' | 'review_video' | 'conversion_video' | null;
    version?: number;
  }) {
    const { data, error } = await supabase
      .from('prompts')
      .insert(prompt)
      .select()
      .single();
    return { prompt: data, error: error?.message ?? null };
  },

  async deactivate(promptId: string) {
    const { error } = await supabase
      .from('prompts')
      .update({ is_active: false })
      .eq('id', promptId);
    return { error: error?.message ?? null };
  },
};
