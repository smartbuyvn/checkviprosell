import { z } from 'zod';

export const QuickAdsScriptSchema = z.object({
  hooks: z.array(z.string()).length(3),
  selected_hook: z.string(),
  duration_sec: z.number().min(10).max(30),
  script_text: z.string().min(10),
  scene_cards: z.array(z.object({
    scene_no: z.number(),
    duration_sec: z.number(),
    visual_instruction: z.string(),
    overlay_text: z.string(),
    template_binding: z.string().regex(/^QA-(0[1-9]|10)$/)
  })).min(3).max(6),
  cta: z.string().min(2),
  caption_tiktok: z.string(),
  hashtags: z.array(z.string()),
  thumbnail_text: z.string(),
  self_check: z.string()
});

export type QuickAdsScript = z.infer<typeof QuickAdsScriptSchema>;

const SYSTEM_PROMPT = `Bạn là một chuyên gia sáng tạo kịch bản TikTok Affiliate hàng đầu Việt Nam.
Nhiệm vụ: Viết kịch bản Quick Ads (15-20s) dựa trên thông tin sản phẩm và hình ảnh được cung cấp.

Yêu cầu BẮT BUỘC:
1. Văn phong: Nói chuyện tự nhiên bằng tiếng Việt (Spoken Vietnamese only), bắt trend. Không dùng ngôn ngữ PR sáo rỗng.
2. Cấu trúc: Đề xuất 3 hooks khác nhau (chạm nỗi đau/sự sung sướng 2-3s đầu), chọn 1 hook tốt nhất đưa vào kịch bản (selected_hook).
3. Hạn chế: Max 1 angle chính, max 2 USPs cốt lõi. KHÔNG overclaim, KHÔNG fake reviews, KHÔNG fake metrics, KHÔNG cam kết y tế/chữa bệnh.
4. Hình ảnh: Tất cả phân cảnh (scene_cards) phải có thể build được từ asset được cung cấp thực tế.
5. Template Binding: Gắn nhãn template_binding từ "QA-01" đến "QA-10" cho mỗi cảnh.
6. Return JSON CHUẨN XÁC theo schema có chứa caption_tiktok, hashtags, thumbnail_text và tự đánh giá (self_check).`;

const CRITIQUE_PROMPT = `Hãy đọc kỹ kịch bản bạn vừa viết và tự đánh giá (self_check):
1. Có bị overclaim hay tựa fake review không? Sửa ngay nếu có hơi hướng đa cấp.
2. Template có nằm trong dải QA-01 đến QA-10 không?
3. Các scene có ráp được bằng ảnh/video tệp đính kèm không?

Trả về CHỈ JSON theo đúng schema. Giảm thiểu số lượng token thừa, output trực diện gọn gàng.`;

export class QuickAdsEngine {
  static buildPrompt(intel: any, assets: any[]) {
    return `
Thông tin sản phẩm:
- Tên: ${intel.product_name}
- Concept: ${intel.category}
- USPs: ${intel.usp_list?.join(', ')}
- Nỗi đau của khách (Pain points): ${intel.pain_points?.join(', ')}

Tài nguyên hình ảnh/video có sẵn:
${assets.map((a, i) => `[ID: asset_${i}]: ${a.file_name} (${a.asset_type})`).join('\n')}

Hãy tạo kịch bản Quick Ads tuân thủ tuyệt đối System Prompt.
Trình bày kết quả bằng JSON chặt chẽ:
{
  "hooks": ["Hook 1...", "Hook 2...", "Hook 3..."],
  "selected_hook": "Hook 1...",
  "duration_sec": 15,
  "script_text": "Toàn bộ lời thoại...",
  "scene_cards": [
    { "scene_no": 1, "duration_sec": 4, "visual_instruction": "Hiển thị asset_1...", "overlay_text": "Chữ ngắn gọn", "template_binding": "QA-01" }
  ],
  "cta": "Mua ngay!",
  "caption_tiktok": "Caption giật gân...",
  "hashtags": ["xuhuong", "deal"],
  "thumbnail_text": "HỐT NGAY",
  "self_check": "Tôi đã check không có overclaim..."
}
`;
  }

  static getCritiquePrompt(scriptStr: string) {
    return `${CRITIQUE_PROMPT}\n\nKịch bản cũ của bạn:\n${scriptStr}`;
  }
}
