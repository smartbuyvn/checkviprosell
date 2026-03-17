/**
 * Viprosell â€” Project Service (Real Supabase)
 */

import { supabase } from '@/integrations/supabase/client';

export interface CreateProjectInput {
  title: string;
  package_type: 'quick_ads' | 'review_video' | 'conversion_video';
  category: 'beauty' | 'fashion' | 'home' | 'other';
  source_url?: string;
  manual_notes?: string;
  language?: string;
}

export const ProjectService = {
  async create(input: CreateProjectInput) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { project: null, error: 'ChÆ°a Ä‘Äƒng nháº­p' };

    const { data, error } = await supabase
      .from('projects')
      .insert({
        title: input.title,
        package_type: input.package_type,
        category: input.category,
        source_url: input.source_url ?? null,
        manual_notes: input.manual_notes ?? null,
        language: input.language ?? 'vi',
        user_id: user.id,
        status: 'draft',
      })
      .select()
      .single();
    return { project: data, error: error?.message ?? null };
  },

  async update(projectId: string, updates: Partial<Pick<CreateProjectInput, 'title' | 'category' | 'source_url' | 'manual_notes'>>) {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);
    return { error: error?.message ?? null };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    return { project: data, error: error?.message ?? null };
  },

  async listByUser() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    return { projects: data ?? [], error: error?.message ?? null };
  },

  async updateStatus(projectId: string, status: 'draft' | 'analyzing' | 'concept_ready' | 'script_ready' | 'render_queued' | 'rendering' | 'completed' | 'failed') {
    const { error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', projectId);
    return { error: error?.message ?? null };
  },

  async deleteProject(projectId: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    return { error: error?.message ?? null };
  },
};
