/**
 * Viprosell â€” Visual Pack Service (Real Supabase)
 * Read-only from client. AI orchestrator creates visual packs.
 */

import { supabase } from '@/integrations/supabase/client';

export const VisualPackService = {
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('visual_packs')
      .select('*')
      .eq('project_id', projectId)
      .single();
    return { visualPack: data, error: error?.message ?? null };
  },
};
