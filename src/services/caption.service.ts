/**
 * Viprosell — Caption Export Service (Real Supabase)
 * Read-only from client. AI orchestrator creates captions.
 */

import { supabase } from '@/integrations/supabase/client';

export const CaptionService = {
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('caption_exports')
      .select('*')
      .eq('project_id', projectId)
      .single();
    return { caption: data, error: error?.message ?? null };
  },
};
