/**
 * Viprosell â€” Concept Service
 * Generate, read, and select commerce angles.
 * Uses shared edge function caller.
 */

import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/services/edge.client';

export interface Concept {
  id: string;
  project_id: string;
  angle_type: 'pain_first' | 'review_trust' | 'offer_conversion';
  title: string;
  big_idea: string | null;
  hook: string | null;
  cta: string | null;
  why_it_works: string | null;
  score: number | null;
  is_selected: boolean;
  created_at: string;
}

export interface GenerateResponse {
  concepts: Concept[] | null;
  trace_id?: string;
  error: string | null;
  details?: string[];
}

export const ConceptService = {
  /** Read persisted concepts for a project */
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('concepts')
      .select('*')
      .eq('project_id', projectId)
      .order('score', { ascending: false });
    return { concepts: (data ?? []) as Concept[], error: error?.message ?? null };
  },

  /** Trigger AI concept generation via shared edge client */
  async generate(projectId: string): Promise<GenerateResponse> {
    const traceId = crypto.randomUUID();
    const { data, error } = await callEdgeFunction<any>('commerce-concepts', {
      project_id: projectId,
      trace_id: traceId,
    });

    if (error) {
      return {
        concepts: null,
        error,
        details: data?.details,
        trace_id: data?.trace_id,
      };
    }

    // Re-fetch from DB to get IDs
    const { concepts } = await ConceptService.getByProject(projectId);
    return { concepts, trace_id: data?.trace_id, error: null };
  },

  /** Select a concept (deselect others) */
  async select(projectId: string, conceptId: string) {
    // Deselect all for this project
    await supabase
      .from('concepts')
      .update({ is_selected: false })
      .eq('project_id', projectId);

    // Select the chosen one
    const { error } = await supabase
      .from('concepts')
      .update({ is_selected: true })
      .eq('id', conceptId)
      .eq('project_id', projectId);

    return { error: error?.message ?? null };
  },
};
