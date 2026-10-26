/**
 * Viprosell — Asset Service (Real Supabase)
 */

import { supabase } from '@/integrations/supabase/client';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MIN_IMAGES = 3;
const MAX_IMAGES = 8;
const MAX_VIDEOS = 1;

export type AssetValidationError = {
  file: string;
  message: string;
};

export function validateFiles(files: File[]): {
  valid: boolean;
  images: File[];
  videos: File[];
  errors: AssetValidationError[];
} {
  const errors: AssetValidationError[] = [];
  const images: File[] = [];
  const videos: File[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      errors.push({ file: file.name, message: `Vượt quá giới hạn 20MB (${(file.size / 1024 / 1024).toFixed(1)}MB)` });
      continue;
    }
    if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      images.push(file);
    } else if (ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      videos.push(file);
    } else {
      errors.push({ file: file.name, message: `Định dạng không hỗ trợ (${file.type || 'unknown'})` });
    }
  }

  if (images.length > MAX_IMAGES) {
    errors.push({ file: '', message: `Tối đa ${MAX_IMAGES} ảnh. Bạn đã chọn ${images.length} ảnh.` });
  }
  if (videos.length > MAX_VIDEOS) {
    errors.push({ file: '', message: `Tối đa ${MAX_VIDEOS} video mẫu. Bạn đã chọn ${videos.length} video.` });
  }

  // Explain why validation fails for insufficient assets
  if (images.length > 0 && images.length < MIN_IMAGES && videos.length === 0) {
    errors.push({ file: '', message: `Cần tối thiểu ${MIN_IMAGES} ảnh hoặc 1 video mẫu. Hiện có ${images.length} ảnh.` });
  }

  return {
    valid: errors.length === 0 && (images.length >= MIN_IMAGES || videos.length > 0),
    images,
    videos,
    errors,
  };
}

export function getFileCountMessage(images: File[], videos: File[]): string {
  const parts: string[] = [];
  if (images.length > 0) parts.push(`${images.length} ảnh`);
  if (videos.length > 0) parts.push(`${videos.length} video`);
  return parts.join(' + ') || 'Chưa có file';
}

export interface UploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export const AssetService = {
  /**
   * Upload a single asset file to storage and record in project_assets.
   */
  async uploadAsset(projectId: string, file: File, sortOrder: number = 0): Promise<{ asset: any; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { asset: null, error: 'Chưa đăng nhập' };

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${projectId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(filePath, file);

    if (uploadError) return { asset: null, error: uploadError.message };

    // Private bucket — use signed URL (24h expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('project-assets')
      .createSignedUrl(filePath, 86400); // 24 hours

    if (signedError || !signedData?.signedUrl) {
      return { asset: null, error: 'Không tạo được link file: ' + (signedError?.message || 'unknown') };
    }

    const fileUrl = signedData.signedUrl;
    const assetType = file.type.startsWith('video/') ? 'video' : 'image';

    const { data, error } = await supabase
      .from('project_assets')
      .insert({
        project_id: projectId,
        asset_type: assetType,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        sort_order: sortOrder,
      })
      .select()
      .single();

    return { asset: data, error: error?.message ?? null };
  },

  /**
   * Upload multiple assets with progress tracking.
   * Returns results for each file.
   */
  async uploadMultiple(
    projectId: string,
    files: File[],
    onProgress?: (progress: UploadProgress[]) => void,
  ): Promise<{ results: { file: string; success: boolean; error?: string }[] }> {
    const progressList: UploadProgress[] = files.map(f => ({
      fileName: f.name,
      progress: 0,
      status: 'pending',
    }));

    const results: { file: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      progressList[i] = { ...progressList[i], status: 'uploading', progress: 10 };
      onProgress?.([...progressList]);

      const { error } = await this.uploadAsset(projectId, files[i], i);

      if (error) {
        progressList[i] = { ...progressList[i], status: 'error', progress: 100, error };
        results.push({ file: files[i].name, success: false, error });
      } else {
        progressList[i] = { ...progressList[i], status: 'done', progress: 100 };
        results.push({ file: files[i].name, success: true });
      }
      onProgress?.([...progressList]);
    }

    return { results };
  },

  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from('project_assets')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');
    return { assets: data ?? [], error: error?.message ?? null };
  },

  async deleteAsset(assetId: string) {
    const { error } = await supabase
      .from('project_assets')
      .delete()
      .eq('id', assetId);
    return { error: error?.message ?? null };
  },

  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_FILE_SIZE,
  MIN_IMAGES,
  MAX_IMAGES,
  MAX_VIDEOS,
};
