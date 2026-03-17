import { PackageType } from '@/types';

export interface PackageDefinition {
  id: PackageType;
  name: string;
  description: string;
  duration: string;
  priority: string[];
  outputDescription: string;
}

export const PACKAGES: Record<PackageType, PackageDefinition> = {
  quick_ads: {
    id: 'quick_ads',
    name: 'Quick Ads',
    description: 'Video quảng cáo ngắn để test sản phẩm nhanh trên TikTok, Reels, Shorts',
    duration: '15–20s',
    priority: ['Hook mạnh', '1–2 USP', 'CTA rõ'],
    outputDescription: '1 script + 6 scene cards + overlay + caption',
  },
  review_video: {
    id: 'review_video',
    name: 'Review Video',
    description: 'Video review sản phẩm tăng trust, phong cách KOC / bestie / chủ shop',
    duration: '20–30s',
    priority: ['Giọng văn đời thường', 'Chi tiết tăng tin', 'CTA mềm'],
    outputDescription: '3 hooks + 1 script + 6–8 scene cards + CTA mềm + caption',
  },
  conversion_video: {
    id: 'conversion_video',
    name: 'Conversion Video',
    description: 'Video tối ưu chuyển đổi, tập trung vào pain, proof, offer, urgency',
    duration: '20–30s',
    priority: ['Pain rõ', 'Proof sớm', 'Offer mạnh', 'CTA trực tiếp'],
    outputDescription: '3 hooks + 1 script + 6–8 scene cards + CTA trực tiếp + caption',
  },
};

export const PACKAGE_LIST: PackageDefinition[] = Object.values(PACKAGES);
