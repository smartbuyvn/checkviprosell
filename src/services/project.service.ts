/**
 * Viprosell — Project Service (Real Supabase)
 *
 * All enum values are converted through enumMapper before being sent
 * to Supabase, and converted back when read from Supabase.
 * This resolves the mismatch between Frontend enums (quickads)
 * and Supabase Cloud enums (quick_ads).
 */

import { supabase } from '@/integrations/supabase/client';
import {
  packageTypeToDb,
  packageTypeFromDb,
  projectStatusToDb,
  projectStatusFromDb,
} from '@/lib/enumMapper';

export interface CreateProjectInput {
  title: string;
  package_type: 'quickads' | 'reviewvideo' | 'conversionvideo';
  category: 'beauty' | 'fashion' | 'home' | 'other';
  source_url?: string;
  manual_notes?: string;
  language?: string;
}

export const ProjectService = {
  async create(input: CreateProjectInput) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { project: null, error: 'Chưa đăng nhập' };

    const { data, error } = await supabase
      .from('projects')
      .insert({
        title: input.title,
        package_type: packageTypeToDb(input.package_type) as any,
        category: input.category,
        source_url: input.source_url ?? null,
        manual_notes: input.manual_notes ?? null,
        language: input.language ?? 'vi',
        user_id: user.id,
        status: 'draft',
      })
      .select()
      .single();

    // Convert DB values back to Frontend format for the returned object
    const project = data ? {
      ...data,
      package_type: packageTypeFromDb(data.package_type) as any,
      status: projectStatusFromDb(data.status) as any,
    } : null;

    return { project, error: error?.message ?? null };
  },

  async update(projectId: string, updates: Partial<CreateProjectInput>) {
    // Convert enums before sending to DB
    const dbUpdates: Record<string, any> = { ...updates };
    if (updates.package_type) {
      dbUpdates.package_type = packageTypeToDb(updates.package_type);
    }

    const { error } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', projectId);
    return { error: error?.message ?? null };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    // Convert DB values back to Frontend format
    const project = data ? {
      ...data,
      package_type: packageTypeFromDb(data.package_type) as any,
      status: projectStatusFromDb(data.status) as any,
    } : null;

    return { project, error: error?.message ?? null };
  },

  async listByUser() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Convert DB values back to Frontend format for all projects
    const projects = (data ?? []).map((p: any) => ({
      ...p,
      package_type: packageTypeFromDb(p.package_type),
      status: projectStatusFromDb(p.status),
    }));

    return { projects, error: error?.message ?? null };
  },

  async updateStatus(projectId: string, status: 'draft' | 'analyzing' | 'conceptready' | 'scriptready' | 'renderqueued' | 'rendering' | 'completed' | 'failed') {
    const { error } = await supabase
      .from('projects')
      .update({ status: projectStatusToDb(status) as any })
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

  async trashProject(projectId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Chưa đăng nhập' };

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
      const response = await fetch(`${baseUrl}/projects/${projectId}/trash`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        return { error: data.error || 'Lỗi khi xóa dự án' };
      }
      return { error: null, cancel_requested: data.cancel_requested };
    } catch (err: any) {
      return { error: err.message };
    }
  },
};
