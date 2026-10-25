import { z } from 'zod';

export const ReviewVideoScriptSchema = z.object({
  persona: z.string(),
  duration_sec: z.number().min(20).max(60),
  script_text: z.string().min(50),
  scene_cards: z.array(z.object({
    scene_no: z.number(),
    duration_sec: z.number(),
    visual_instruction: z.string(),
    overlay_text: z.string(),
    persona_action: z.string(),
    template_binding: z.string().regex(/^RV-(0[1-9]|10)$/).optional()
  })).min(3).max(8),
  cta: z.string().min(5),
  caption_tiktok: z.string(),
  hashtags: z.array(z.string()),
  thumbnail_text: z.string(),
  self_check: z.string()
});

export type ReviewVideoScript = z.infer<typeof ReviewVideoScriptSchema>;

const SYSTEM_PROMPT = `Bạn là một KOC/Reviewer TikTok/Shorts cực kỳ uy tín tại Việt Nam.
Nhiệm vụ: Viết kịch bản Review Video (25-45s) tự nhiên, chân thật, dựa trên trải nghiệm thực tế.

Yêu cầu BẮT BUỘC:
1. Persona & Tone (Spoken Vietnamese): Giọng điệu chân thực như đang tâm sự. Xác lập 1 'persona' rõ ràng ở output (VD: "Chuyên gia Skincare mộc mạc", "Bà mẹ bỉm sữa kĩ tính").
2. Chân thực (Trust-first details): Phải đưa vào ít nhất 1 chi tiết cực kỳ cụ thể tạo độ trust (VD: "mới bóp ra nó hơi đặc dính xíu, nhưng thoa 3 giây là thấm...", "đường chỉ may hơi nhiều chỉ thừa xíu nhưng form bù lại rất đẹp"). KHÔNG bịa đặt trải nghiệm sai lệch hoàn toàn với tài nguyên cung cấp. Khách quan 80% khen, 20% chân thật.
3. Soft CTA: Kêu gọi hành động tự nhiên, không đa cấp ép mua ("ai da dầu chấm thử link dưới nha", "để giỏ hàng cho bà nào cần nè").
4. Asset Buildability & FaceFusion: KHÔNG tự động đòi hỏi FaceFusion Avatar nếu tài nguyên (assets) chỉ là ảnh tĩnh tĩnh. Ưu tiên hướng dẫn lướt ảnh (slideshow/pan-zoom) hoặc ghép review video gốc. Chỉ yêu cầu FaceFusion nếu người dùng explicitly yêu cầu trong notes (nhưng mặc định là KHÔNG).
5. Schema mở rộng: Trả về chính xác cấu trúc JSON có chứa 'caption_tiktok', 'hashtags', 'thumbnail_text', và 'self_check'. Optional 'template_binding' (RV-01 đến RV-10) nếu scene map khớp template, nếu không chỉ cần 'persona_action'.`;

const CRITIQUE_PROMPT = `Hãy tự kiểm duyệt chéo kịch bản bạn vừa xuất ra (self_check):
1. Có nghe giống 1 bài PR sáo rỗng hay TVC truyền thống ("Sản phẩm số 1, nâng tầm đẳng cấp") không? Nếu có, hãy đập đi viết lại thành văn nói chân thật.
2. Có chi tiết "Trust-first" (chê khéo hoặc mô tả chi tiết giác quan) chưa?
3. Scene Cards có thật sự ghép được bằng các asset tĩnh/video gốc cung cấp không?
4. Định dạng trả về có chính xác JSON không?

Output CHỈ LÀ JSON HỢP LỆ.`;

export class ReviewVideoEngine {
  static buildPrompt(intel: any, assets: any[]) {
    const baseVideos = assets.filter(a => a.asset_type === 'video');
    const imageAssets = assets.filter(a => a.asset_type === 'image');

    const assetDesc = [
      ...baseVideos.map((a, i) => `[ID: video_${i}]: ${a.file_name} (Base Review Video có thể dùng làm nền)`),
      ...imageAssets.map((a, i) => `[ID: image_${i}]: ${a.file_name} (Ảnh sản phẩm tệp đính kèm)`)
    ].join('\n');

    return `
Thông tin sản phẩm:
- Tên: ${intel.product_name}
- Concept/Category: ${intel.category}
- Đối tượng sử dụng: ${intel.target_buyer}
- Ưu điểm thực tế (USPs): ${intel.usp_list?.join(', ')}
- Trải nghiệm/Bối cảnh (Use Context): ${intel.use_context?.join(', ')}
- Bảo chứng độ tin cậy (Trust Signals): ${intel.trust_signals?.join(', ')}

Tài nguyên khả dụng:
${assetDesc || 'Chưa có file, yêu cầu chỉ dùng Text/Overlay kết hợp ảnh minh họa cơ bản, KHÔNG vẽ ra video quay mặt người (FaceFusion) nếu không có base video.'}

Hãy viết kịch bản Review Video đáng tin cậy. Tuân thủ tuyệt đối System Prompt.
Trình bày kết quả bằng JSON:
{
  "persona": "Mẹ bỉm sữa",
  "duration_sec": 30,
  "script_text": "Toàn bộ lời thoại tâm sự...",
  "scene_cards": [
    { 
      "scene_no": 1, 
      "duration_sec": 5, 
      "visual_instruction": "Zoom nhẹ vào image_0", 
      "overlay_text": "Chân ái cho da dầu",
      "persona_action": "KOC cầm sản phẩm (nếu có base video)",
      "template_binding": "RV-01"
    }
  ],
  "cta": "Câu soft CTA",
  "caption_tiktok": "Thật sự bất ngờ với ẻm này...",
  "hashtags": ["review", "xuhuong"],
  "thumbnail_text": "CÓ ĐÁNG MUA?",
  "self_check": "Đã thêm 1 chi tiết chê nhẹ để tăng độ trust."
}
`;
  }

  static getCritiquePrompt(scriptStr: string) {
    return `${CRITIQUE_PROMPT}\n\nKịch bản trước đó:\n${scriptStr}`;
  }
}
