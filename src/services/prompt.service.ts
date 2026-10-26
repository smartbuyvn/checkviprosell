/**
 * Viprosell — Prompt Service (Real Supabase)
 * CRUD for AI prompt templates. Admin-managed via RLS.
 */

import { supabase } from '@/integrations/supabase/client';
import { packageTypeToDb } from '@/lib/enumMapper';

export const PromptService = {
  async getByCategory(category: string) {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('version', { ascending: false });
    return { prompts: data ?? [], error: error?.message ?? null };
  },

  async getByPackageType(packageType: 'quickads' | 'reviewvideo' | 'conversionvideo') {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('package_type', packageTypeToDb(packageType))
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
    package_type?: 'quickads' | 'reviewvideo' | 'conversionvideo' | null;
    version?: number;
  }) {
    const { data, error } = await supabase
      .from('prompts')
      .insert({
        ...prompt,
        package_type: prompt.package_type ? packageTypeToDb(prompt.package_type) as any : null,
      })
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
