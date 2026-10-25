import { z } from 'zod';

export const ConversionVideoScriptSchema = z.object({
  hooks: z.array(z.string()).length(3),
  selected_hook: z.string(),
  main_objection_handled: z.string(),
  proof_used: z.string(),
  duration_sec: z.number().min(30).max(60),
  script_text: z.string().min(50),
  scene_cards: z.array(z.object({
    scene_no: z.number(),
    duration_sec: z.number(),
    visual_instruction: z.string(),
    overlay_text: z.string(),
    template_binding: z.string().regex(/^CV-(0[1-9]|10)$/)
  })).min(4).max(10),
  cta: z.string().min(5),
  caption_tiktok: z.string(),
  hashtags: z.array(z.string()),
  thumbnail_text: z.string(),
  self_check: z.string()
});

export type ConversionVideoScript = z.infer<typeof ConversionVideoScriptSchema>;

const SYSTEM_PROMPT = `Bạn là Copywriter chuyển đổi (Conversion Copywriter) TikTok/Shorts xuất sắc tại Việt Nam.
Nhiệm vụ: Viết kịch bản Conversion Video (30-60s) tập trung tối đa vào tỷ lệ chốt đơn, nhưng phải nghe thực dụng và minh bạch.

Yêu cầu BẮT BUỘC:
1. Cấu trúc chuẩn xác (Pain -> Proof -> Objection -> Offer -> CTA):
   - Hook (Pain / Vấn đề): Chạm ngay vào nỗi đau lớn nhất trong 3s đầu. (Phải xuất ra 3 hooks và chọn 1).
   - Proof (Bằng chứng): MANG LÊN SỚM. Đưa bằng chứng/Trust Signals ra ngay lập tức để giữ chân tín nhiệm.
   - Objection (Xử lý từ chối): Trực tiếp giải quyết ít nhất 1 sự băn khoăn (main_objection_handled) và phá vỡ nó hợp lý.
   - Offer (Chào mời hời): Nhấn mạnh ưu đãi thực tế.
   - CTA (Kêu gọi hành động): Trực tiếp, cấp bách nhưng tự nhiên ("Chấm giỏ hàng góc trái").
2. No Fake Trust: TUYỆT ĐỐI không dùng fake scarcity (như "chỉ còn 1 suất cuối"), fake trust, fake numbers ("10 triệu người tin dùng" nếu không có thật).
3. Template Binding (Từ CV-01 đến CV-10): BẮT BUỘC Gán cho toàn bộ scene logic (VD "CV-01", "CV-05").
4. Asset Buildability: Cảnh quay phải logic với các 'tài nguyên' (assets) đính kèm.
5. Sơ đồ: Xây dựng Schema đẩy đủ bao gồm caption_tiktok, hashtags và self_check.`;

const CRITIQUE_PROMPT = `Hãy tự đánh giá kịch bản lấy chuyển đổi làm gốc (self_check):
1. Bạn có dùng "Fake Scarcity" (như 'duy nhất hôm nay', 'còn 1 món') hoặc "Fake Numbers" không? Nếu có, hãy xóa đi sửa thành Offer thực tế.
2. Proof có xuất hiện sớm không? Đã xử lý triệt để Objection nào chưa?
3. Template có được gán ĐÚNG CV-01 đến CV-10 không?

Bạn tuyệt đối CHỈ trả về JSON chuẩn xác đã được vá (fix) lỗi. Văn phong sau fix phải tự nhiên, cực kỳ mượt mà.`;

export class ConversionVideoEngine {
  static buildPrompt(intel: any, assets: any[]) {
    const assetDesc = assets.length > 0 
      ? assets.map((a, i) => `[ID: asset_${i}]: ${a.file_name} (${a.asset_type})`).join('\n')
      : 'User chưa có asset, yêu cầu gợi ý chèn Stock photos tĩnh (CV Template)';

    return `
Thông tin sản phẩm:
- Tên: ${intel.product_name}
- Nỗi đau (Pain points): ${intel.pain_points?.join(', ')}
- Bảo chứng độ tin cậy (Trust Signals): ${intel.trust_signals?.join(', ')}
- Sự băn khoăn / Từ chối (Objections): ${intel.objections?.join(', ')}
- Giá thị trường / Phân khúc (Price Band): ${intel.price_band}

Tài nguyên hình/video khả dụng:
${assetDesc}

Hãy viết kịch bản Conversion Video ngay bây giờ.
Nhớ áp dụng cấu trúc Pain -> Proof -> Objection -> Offer -> CTA vững chắc và cấm dùng Fake Scarcity.
Trình bày kết quả bằng JSON HỢP LỆ:
{
  "hooks": ["Hook 1", "Hook 2", "Hook 3"],
  "selected_hook": "Hook 1",
  "main_objection_handled": "Xử lý lo ngại về giá / độ an toàn",
  "proof_used": "Nhắc đến trust signal XY",
  "duration_sec": 45,
  "script_text": "Kịch bản đầy đủ...",
  "scene_cards": [
    { 
      "scene_no": 1, 
      "duration_sec": 4, 
      "visual_instruction": "Hiển thị asset_1 miêu tả nỗi đau...", 
      "overlay_text": "Chữ đánh vào nỗi đau ngắn gọn",
      "template_binding": "CV-01"
    }
  ],
  "cta": "Mua ngay tại giỏ hàng...",
  "caption_tiktok": "Deal hot hôm nay không nên bỏ lỡ...",
  "hashtags": ["xuhuong", "dealhot"],
  "thumbnail_text": "DEAL SỐC",
  "self_check": "Không có fake numbers, Proof đưa lên sớm đoạn 10s."
}
`;
  }

  static getCritiquePrompt(scriptStr: string) {
    return `${CRITIQUE_PROMPT}\n\nKịch bản trước đó:\n${scriptStr}`;
  }
}
