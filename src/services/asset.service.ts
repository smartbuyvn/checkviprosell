/**
 * Viprosell — Asset Service (Real Supabase)
 */

import { supabase } from '@/integrations/supabase/client';
import { currentUserId } from '@/lib/currentUser';
export { assetUrls } from '@/lib/assetUrls';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
/**
 * Trần dung lượng TÁCH RIÊNG cho ảnh và video.
 *
 * Trần cũ là 20MB chung cho cả hai. Một clip 30 giây quay bằng điện thoại nặng 50–150MB,
 * nên trần 20MB loại gần như MỌI video thật: tính năng coi như không tồn tại dù giao diện
 * vẫn mời tải lên và vẫn nhận `video/mp4` trong thẻ `accept`.
 *
 * Ảnh vẫn giữ 20MB — một tấm JPEG sản phẩm không có lý do gì nặng hơn thế.
 */
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

/**
 * 100MB — đi CẶP với trần 30 giây ở backend (`video-asset.ts`).
 *
 * Hai trần này phải suy ra từ nhau. Chọn theo chế độ quay ngốn nhất còn hợp lý,
 * 1080p/60 ở ~26 Mbps, thì 100MB cho đúng 31 giây.
 *
 * Lý do chọn 100MB không phải tiết kiệm dung lượng — với hạn giữ 24 giờ thì 100MB và
 * 200MB chênh nhau 3.800đ/tháng ở mức 1.000 dự án. Lý do là thời gian tải lên: mạng
 * di động Việt Nam khoảng 10 Mbps, 200MB mất 160 giây nhìn thanh tiến trình.
 */
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MIN_IMAGES = 3;
const MAX_IMAGES = 8;

/**
 * Tối đa 3 clip, không phải 1.
 *
 * Một clip duy nhất chỉ cho được một góc máy, nên video ra vẫn đơn điệu đúng như lỗi
 * ảnh tĩnh mà luồng này sinh ra để khắc phục. Ba clip đủ cho hook – cận cảnh – cảnh
 * dùng thật, mà vẫn giữ tổng dung lượng tải lên trong mức chịu được.
 */
const MAX_VIDEOS = 3;

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
    const laAnh = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const laVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!laAnh && !laVideo) {
      errors.push({ file: file.name, message: `Định dạng không hỗ trợ (${file.type || 'unknown'})` });
      continue;
    }

    // Kiểm loại TRƯỚC rồi mới kiểm dung lượng: phải biết nó là ảnh hay video thì mới
    // biết áp trần nào. Bản cũ áp một trần chung nên báo "vượt 20MB" cho cả video.
    const tran = laVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > tran) {
      errors.push({
        file: file.name,
        message: `${laVideo ? 'Video' : 'Ảnh'} nặng ${(file.size / 1024 / 1024).toFixed(0)}MB, vượt mức ${tran / 1024 / 1024}MB.`,
      });
      continue;
    }

    if (laAnh) images.push(file);
    else videos.push(file);
  }

  if (images.length > MAX_IMAGES) {
    errors.push({ file: '', message: `Tối đa ${MAX_IMAGES} ảnh. Bạn đã chọn ${images.length} ảnh.` });
  }
  if (videos.length > MAX_VIDEOS) {
    errors.push({ file: '', message: `Tối đa ${MAX_VIDEOS} clip. Bạn đã chọn ${videos.length}.` });
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
    // Goi MOT LAN MOI FILE. Voi `auth.getUser()` thi tai 5 anh la 5 vong mang va 5
    // lan xep hang cho khoa phien; `currentUserId()` nho lai nen chi doc mot lan.
    const uid = await currentUserId();
    if (!uid) return { asset: null, error: 'Chưa đăng nhập' };

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${uid}/${projectId}/${Date.now()}_${safeName}`;

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
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MIN_IMAGES,
  MAX_IMAGES,
  MAX_VIDEOS,
};
