/**
 * Viprosell â€” Intel Service
 * Triggers AI product analysis and reads results.
 * No cross-domain methods â€” concepts/scripts live in their own services.
 */

import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/services/edge.client';

export interface IntelResult {
  product_name: string;
  category: string;
  target_buyer: string;
  price_band: string;
  usp_list: string[];
  pain_points: string[];
  objections: string[];
  trust_signals: string[];
  use_context: string[];
  recommended_package_fit: string[];
  confidence_score: number;
}

export interface IntelResponse {
  intel: IntelResult | null;
  trace_id?: string;
  error: string | null;
  details?: string[];
}

export const IntelService = {
  /** Read persisted intel for a project */
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('product_intelligence')
      .select('*')
      .eq('project_id', projectId)
      .single();
    return { intel: data, error: error?.message ?? null };
  },

  /** Trigger AI analysis via edge function */
  async analyze(projectId: string): Promise<IntelResponse> {
    const traceId = crypto.randomUUID();
    const { data, error } = await callEdgeFunction<any>('product-intel', {
      project_id: projectId,
      trace_id: traceId,
    });

    if (error) {
      return {
        intel: null,
        error,
        details: data?.details,
        trace_id: data?.trace_id,
      };
    }

    return {
      intel: data.intel,
      trace_id: data.trace_id,
      error: null,
    };
  },

  /** Update persisted intel fields (user edits) */
  async updateIntel(projectId: string, updates: Partial<IntelResult>) {
    const dbUpdates: Record<string, any> = { ...updates };
    const { error } = await supabase
      .from('product_intelligence')
      .update(dbUpdates as any)
      .eq('project_id', projectId);
    return { error: error?.message ?? null };
  },
};
