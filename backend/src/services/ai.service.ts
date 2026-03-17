/**
 * Viprosell v1.2 AI Service (Mock/Dummy for Phase 1 structure)
 */

export const AIService = {
  async analyzeProduct(sourceUrl?: string, manualNotes?: string) {
    console.log(`Analyzing product from ${sourceUrl} with notes: ${manualNotes}`);
    return {
      product_name: 'Sản phẩm Mẫu',
      category: 'other',
      usp_list: ['Chất lượng cao', 'Giá tốt'],
      confidence_score: 0.95
    };
  },

  async generateScript(summary: any, packageType: string) {
    console.log(`Generating script for package ${packageType}`);

    if (packageType === 'conversion_video') {
      return {
        duration_sec: 25,
        script_text: 'Bạn đang đau đầu vì vấn đề này? Đã có giải pháp dành cho bạn...',
        scene_cards: [
          { scene_no: 1, duration_sec: 5, visual_instruction: 'Show pain point', overlay_text: 'Đau đầu vì...' }, // Pain
          { scene_no: 2, duration_sec: 5, visual_instruction: 'Show product solving it', overlay_text: 'Giải pháp là đây' }, // Proof
          { scene_no: 3, duration_sec: 5, visual_instruction: 'Show offer/discount', overlay_text: 'Giảm giá 50%' }, // Offer
          { scene_no: 4, duration_sec: 5, visual_instruction: 'Countdown/limited stock', overlay_text: 'Chỉ còn 10 suất' }, // Urgency
          { scene_no: 5, duration_sec: 5, visual_instruction: 'Call to action', overlay_text: 'Mua ngay hôm nay' } // CTA
        ],
        cta: 'Nhấn vào giỏ hàng ngay!'
      };
    } else if (packageType === 'review_video') {
      return {
        duration_sec: 30,
        script_text: 'Hello các bà, hôm nay tôi sẽ review một món rật hot...',
        scene_cards: [
          { scene_no: 1, duration_sec: 5, visual_instruction: 'KOC holding product', overlay_text: 'Đập hộp siêu phẩm' },
          { scene_no: 2, duration_sec: 10, visual_instruction: 'Using product', overlay_text: 'Chất lượng xịn xò' },
          { scene_no: 3, duration_sec: 15, visual_instruction: 'Final thought/rating', overlay_text: 'Chấm 9/10, khuyên dùng' }
        ],
        cta: 'Tham khảo góc trái nha!'
      };
    }

    // Default: quick_ads
    return {
      duration_sec: 15,
      script_text: 'Săn ngay deal hot...',
      scene_cards: [
        { scene_no: 1, duration_sec: 5, visual_instruction: 'Strong hook', overlay_text: 'Deal sốc' },
        { scene_no: 2, duration_sec: 5, visual_instruction: 'Show best USP', overlay_text: 'Nhỏ gọn tiện lợi' },
        { scene_no: 3, duration_sec: 5, visual_instruction: 'CTA', overlay_text: 'Chốt đơn' }
      ],
      cta: 'Mua ngay kẻo lỡ!'
    };
  },

  async generateSceneGraph(script: any) {
    console.log(`Generating aspect-agnostic scene graph from script`);
    return {
      version: '1.2',
      aspect_agnostic: true,
      scenes: script.scene_cards.map((s: any) => ({
        id: `scene_${s.scene_no}`,
        durationFrames: s.duration_sec * 30, // assuming 30fps
        elements: [
          {
            type: 'text',
            text: s.overlay_text,
            style: 'headline',
            alignment: 'center'
          },
          {
            type: 'media_placeholder',
            asset_ref: `asset_${s.scene_no}`,
            // AI detected focal point for smart_pan mode
            focal_point: { x: 50, y: 50, priority: 'face_or_product' }
          }
        ],
        safe_zones: {
          '9:16': { top: 100, bottom: 200 },
          '16:9': { left: 100, right: 100 },
          '1:1': { top: 50, bottom: 50 }
        }
      }))
    };
  }
};
