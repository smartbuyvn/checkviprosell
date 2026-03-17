import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== TEMPLATE LIBRARY (QA-01 → QA-10) ====================

interface QuickAdsTemplate {
  id: string;
  name: string;
  intent: string;
  opening_pattern: string;
  scene_flow: string[];
  proof_pattern: string;
  cta_pattern: string;
  fit_products: string[];
  risk_notes: string[];
}

const QUICK_ADS_TEMPLATES: QuickAdsTemplate[] = [
  { id: "QA-01", name: "Pain Hook Fast Fix", intent: "scroll-stop + fast solution", opening_pattern: "pain first", scene_flow: ["pain","product reveal","usp","cta"], proof_pattern: "detail close-up or quick result", cta_pattern: "direct short CTA", fit_products: ["beauty","home","daily-use"], risk_notes: ["avoid medical claims","avoid exaggerated before-after"] },
  { id: "QA-02", name: "One USP Hero", intent: "sell exactly 1 strongest USP", opening_pattern: "usp hook", scene_flow: ["hook","usp demo","cta"], proof_pattern: "visual demo of single benefit", cta_pattern: "direct CTA", fit_products: ["simple products","single-benefit items"], risk_notes: ["keep focused on one point only"] },
  { id: "QA-03", name: "Before / After Glimpse", intent: "light before-after contrast without overclaim", opening_pattern: "before state", scene_flow: ["before","after","reason","cta"], proof_pattern: "visual comparison", cta_pattern: "direct CTA", fit_products: ["beauty","organizer","cleaning"], risk_notes: ["no medical overclaim","keep subtle"] },
  { id: "QA-04", name: "Three Reasons to Try", intent: "pack 3 quick buying reasons", opening_pattern: "question or statement hook", scene_flow: ["hook","reason1","reason2","reason3","cta"], proof_pattern: "quick visual per reason", cta_pattern: "direct CTA", fit_products: ["multi-benefit products"], risk_notes: ["keep each reason concise"] },
  { id: "QA-05", name: "Price to Value Snap", intent: "price anchor then value reveal", opening_pattern: "price anchor", scene_flow: ["price anchor","value","proof detail","cta"], proof_pattern: "price comparison or value breakdown", cta_pattern: "direct CTA with price", fit_products: ["mass market","deal-driven"], risk_notes: ["ensure price is accurate"] },
  { id: "QA-06", name: "Daily Problem Demo", intent: "relatable daily situation", opening_pattern: "problem scene", scene_flow: ["problem scene","product use","result","cta"], proof_pattern: "usage demonstration", cta_pattern: "direct CTA", fit_products: ["utility","beauty","home"], risk_notes: ["keep scenario realistic"] },
  { id: "QA-07", name: "Demo in 3 Scenes", intent: "minimal assets, maximum clarity", opening_pattern: "hook", scene_flow: ["hook","demo","result","cta"], proof_pattern: "simple product demonstration", cta_pattern: "direct CTA", fit_products: ["limited asset products"], risk_notes: ["works with as few as 3 images"] },
  { id: "QA-08", name: "Offer Lite Push", intent: "short ad with embedded offer", opening_pattern: "hook", scene_flow: ["hook","usp","offer","cta"], proof_pattern: "offer visualization", cta_pattern: "CTA with offer", fit_products: ["sale","freeship","combo"], risk_notes: ["ensure offer is current"] },
  { id: "QA-09", name: "Myth vs Reality", intent: "correct common misconception", opening_pattern: "myth statement", scene_flow: ["myth","reality","product reason","cta"], proof_pattern: "fact correction with product", cta_pattern: "direct CTA", fit_products: ["misunderstood products"], risk_notes: ["ensure myth is real, not fabricated"] },
  { id: "QA-10", name: "Scroll Stop Question", intent: "question hook targeting pain", opening_pattern: "question", scene_flow: ["question","answer","usp","cta"], proof_pattern: "answer with product demo", cta_pattern: "direct CTA", fit_products: ["problem-solving products"], risk_notes: ["question must be genuinely relatable"] },
];

function selectQuickAdsTemplate(intel: any, concept: any): QuickAdsTemplate {
  const category = (intel.category || "other").toLowerCase();
  const angleType = concept.angle_type || "pain_first";

  const scored = QUICK_ADS_TEMPLATES.map((t) => {
    let score = 0;
    if (t.fit_products.some((f: string) => category.includes(f) || f.includes(category))) score += 3;
    if (angleType === "pain_first" && t.opening_pattern.includes("pain")) score += 2;
    if (angleType === "review_trust" && (t.intent.includes("trust") || t.intent.includes("review"))) score += 2;
    if (angleType === "offer_conversion" && (t.intent.includes("offer") || t.intent.includes("value"))) score += 2;
    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  return top3[Math.floor(Math.random() * top3.length)].template;
}

// ==================== TEMPLATE LIBRARY (RV-01 → RV-10) ====================

interface ReviewTemplate {
  id: string;
  name: string;
  intent: string;
  persona: string;
  opening_pattern: string;
  scene_flow: string[];
  proof_pattern: string;
  cta_pattern: string;
  fit_products: string[];
  risk_notes: string[];
}

const REVIEW_PERSONAS = ["bestie", "koc", "shop_owner", "soft_expert"] as const;
type ReviewPersona = typeof REVIEW_PERSONAS[number];

const PERSONA_VOICE: Record<ReviewPersona, string> = {
  bestie: "Giọng bạn thân chia sẻ, gần gũi, hay dùng 'nè', 'ơi', 'luôn á'. Không formal. Như nhắn tin cho bạn.",
  koc: "Giọng KOC trẻ, tự nhiên, biết hàng nhưng không khoe. Hay dùng 'mình thấy', 'thật sự thì', 'nói thật nha'. Có nhận xét cụ thể.",
  shop_owner: "Giọng chủ shop hiểu sản phẩm, chia sẻ từ góc bán hàng. 'Khách hay hỏi...', 'Mình nhập về vì...'. Thật thà, không PR quá.",
  soft_expert: "Giọng người am hiểu, nhẹ nhàng giải thích. 'Thành phần này...', 'Điểm đặc biệt là...'. Có kiến thức nhưng không lên lớp.",
};

const REVIEW_VIDEO_TEMPLATES: ReviewTemplate[] = [
  { id: "RV-01", name: "Bestie Recommends", intent: "friend sharing recommendation", persona: "bestie", opening_pattern: "soft hook", scene_flow: ["hook","experience","2 likes","soft cta"], proof_pattern: "personal observation details", cta_pattern: "soft CTA", fit_products: ["beauty","fashion","lifestyle"], risk_notes: ["keep authentic tone"] },
  { id: "RV-02", name: "KOC Mini Review", intent: "short trustworthy review", persona: "koc", opening_pattern: "first impression", scene_flow: ["first impression","detail","who fits","cta"], proof_pattern: "specific product details", cta_pattern: "soft CTA", fit_products: ["beauty","skincare","gadgets"], risk_notes: ["no fake expertise"] },
  { id: "RV-03", name: "Shop Owner Honest Talk", intent: "shop owner reduces ad feeling", persona: "shop_owner", opening_pattern: "customer pain", scene_flow: ["customer pain","why I chose this","who fits","soft cta"], proof_pattern: "seller experience as proof", cta_pattern: "soft CTA", fit_products: ["any shop product"], risk_notes: ["must feel genuine not scripted"] },
  { id: "RV-04", name: "First Impression Review", intent: "immediate reaction review", persona: "koc", opening_pattern: "hook", scene_flow: ["hook","first feeling","specific detail","cta"], proof_pattern: "real-time reaction details", cta_pattern: "soft CTA", fit_products: ["unboxing-friendly products"], risk_notes: ["avoid scripted reactions"] },
  { id: "RV-05", name: "Day in Life Use Case", intent: "product in daily context", persona: "bestie", opening_pattern: "situation", scene_flow: ["situation","product use","feeling","soft cta"], proof_pattern: "contextual usage", cta_pattern: "soft CTA", fit_products: ["daily-use","lifestyle"], risk_notes: ["scenario must be realistic"] },
  { id: "RV-06", name: "What I Like / What to Note", intent: "balanced pros and notes for trust", persona: "koc", opening_pattern: "pros first", scene_flow: ["likes","notes","who fits","cta"], proof_pattern: "balanced assessment", cta_pattern: "soft CTA", fit_products: ["any product"], risk_notes: ["notes should be minor, not dealbreakers"] },
  { id: "RV-07", name: "Who Should Buy This", intent: "clear target audience callout", persona: "shop_owner", opening_pattern: "hook", scene_flow: ["hook","user fit description","benefits","cta"], proof_pattern: "persona matching", cta_pattern: "soft CTA", fit_products: ["niche products"], risk_notes: ["be specific about who fits"] },
  { id: "RV-08", name: "Review After Time", intent: "observed review without fake results", persona: "soft_expert", opening_pattern: "time reference", scene_flow: ["after observation","findings","worth it?","cta"], proof_pattern: "time-based observation", cta_pattern: "soft CTA", fit_products: ["skincare","supplements","tools"], risk_notes: ["do not fabricate results"] },
  { id: "RV-09", name: "Compare with Previous Option", intent: "contrast with old way/product", persona: "koc", opening_pattern: "previous frustration", scene_flow: ["old problem","new improvement","soft cta"], proof_pattern: "comparison", cta_pattern: "soft CTA", fit_products: ["upgrade products"], risk_notes: ["no competitor bashing"] },
  { id: "RV-10", name: "FAQ Review Format", intent: "answer common buyer questions", persona: "shop_owner", opening_pattern: "question", scene_flow: ["q1 + a1","q2 + a2","q3 + a3","cta"], proof_pattern: "Q&A format builds trust", cta_pattern: "soft CTA", fit_products: ["products with common doubts"], risk_notes: ["questions must be real buyer concerns"] },
];

function selectReviewTemplate(intel: any, concept: any): ReviewTemplate {
  const category = (intel.category || "other").toLowerCase();
  const angleType = concept.angle_type || "review_trust";

  const scored = REVIEW_VIDEO_TEMPLATES.map((t) => {
    let score = 0;
    if (t.fit_products.some((f: string) => f === "any product" || f === "any shop product" || category.includes(f) || f.includes(category))) score += 3;
    if (angleType === "review_trust") score += 1;
    if (angleType === "pain_first" && t.opening_pattern.includes("pain")) score += 2;
    if (angleType === "offer_conversion" && t.intent.includes("compare")) score += 1;
    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  return top3[Math.floor(Math.random() * top3.length)].template;
}

function selectPersona(template: ReviewTemplate, intel: any): ReviewPersona {
  // Use template's default persona, but override based on category fit
  const defaultPersona = template.persona as ReviewPersona;
  if (REVIEW_PERSONAS.includes(defaultPersona)) return defaultPersona;
  // Fallback
  const cat = (intel.category || "other").toLowerCase();
  if (cat === "beauty" || cat === "fashion") return "bestie";
  if (cat === "home") return "shop_owner";
  return "koc";
}

// ==================== PACKAGE PROMPTS ====================

const PACKAGE_PROMPTS: Record<string, string> = {
  quick_ads: `Bạn là TikTok Commerce Script Engine cho thị trường Việt Nam.
Bạn chuyên viết video quảng cáo ngắn 15-20 giây cho seller/shop online.
Mục tiêu không phải viết TVC đẹp, mà là viết script giống video bán hàng thật trên TikTok:
- nói ngắn, tự nhiên, dễ hiểu trong 1 lần nghe
- hook mạnh trong 2-3 giây đầu
- chỉ bán 1 góc chính + tối đa 2 USP
- dựng được từ ảnh/video sản phẩm có sẵn

RULES:
- tiếng Việt spoken, ngắn, thật miệng
- mỗi voice line tối đa 14 từ nếu là cảnh 2-3 giây
- overlay text tối đa 7 từ
- không bịa review, số lượng bán, chứng nhận hay hiệu quả y tế
- structure ưu tiên: Hook -> USP -> USP/mini demo -> Offer/CTA
- không được nghe như brochure hoặc content AI quá trơn tru`,

  review_video: `Bạn là TikTok Review Script Engine cho social commerce Việt Nam.
Bạn viết video review bán hàng 20-30 giây theo kiểu bestie, KOC mềm, chủ shop chia sẻ thật, hoặc soft expert.

Mục tiêu:
- tăng trust, tạo cảm giác chân thật
- không nói như TVC
- có chi tiết cụ thể khiến người xem tin
- vẫn bán được hàng nhưng CTA phải mềm

RULES:
- spoken Vietnamese đời thường, câu ngắn, có nhịp nói thật
- nên có ít nhất 1 chi tiết cụ thể về texture, form, cảm giác dùng, độ tiện, hoặc tình huống dùng
- structure ưu tiên: Hook review -> cảm nhận/quan sát thật -> 1-2 điểm đáng tiền -> ai nên mua -> CTA mềm
- không bịa trải nghiệm mạnh nếu input không hỗ trợ
- không khẳng định tuyệt đối`,

  conversion_video: `Bạn là TikTok Conversion Script Engine cho social commerce Việt Nam.
Bạn chuyên viết video 20-30 giây để chốt đơn.
Mục tiêu là tăng hành động mua bằng: pain, objection handling, proof, offer, urgency, CTA rõ.

RULES:
- hook phải chạm pain hoặc sai lầm phổ biến
- proof phải xuất hiện sớm
- phải xử lý ít nhất 1 objection lớn nhất
- CTA phải trực tiếp nhưng không thô
- chỉ dùng scene dựng được từ ảnh/video sản phẩm thật
- không bịa review, số lượng bán, claim y tế, hoặc hiệu quả tuyệt đối
- structure ưu tiên: Pain -> Proof -> Objection -> Offer -> CTA
- tiếng Việt spoken, overlay text max 7 từ`,
};

const PACKAGE_DURATION: Record<string, { duration: string; sceneCount: string }> = {
  quick_ads: { duration: "15–20 giây", sceneCount: "5–6 scenes" },
  review_video: { duration: "20–30 giây", sceneCount: "6–8 scenes" },
  conversion_video: { duration: "20–30 giây", sceneCount: "6–8 scenes" },
};

// ==================== PROMPT BUILDERS ====================

function buildSystemPrompt(packageType: string) {
  const prompt = PACKAGE_PROMPTS[packageType] || PACKAGE_PROMPTS.quick_ads;
  return `${prompt}

Output ONLY valid JSON. No markdown, no backticks, no explanation text.
All user-facing text MUST be in Vietnamese.
Each scene must be buildable from product images/videos + text overlays.`;
}

function buildQuickAdsHookPrompt(intel: any, concept: any, template: QuickAdsTemplate) {
  return `PRODUCT INFO:
- Name: ${intel.product_name || "Unknown"}
- Category: ${intel.category || "other"}
- Target buyer: ${intel.target_buyer || "General"}
- Price band: ${intel.price_band || "mid"}
- USPs: ${JSON.stringify(intel.usp_list || [])}
- Pain points: ${JSON.stringify(intel.pain_points || [])}
- Trust signals: ${JSON.stringify(intel.trust_signals || [])}
- Objections: ${JSON.stringify(intel.objections || [])}

SELECTED CONCEPT:
- Angle: ${concept.angle_type}
- Title: ${concept.title}
- Big idea: ${concept.big_idea}

TEMPLATE: ${template.id} — ${template.name}
- Intent: ${template.intent}
- Opening pattern: ${template.opening_pattern}
- Scene flow: ${template.scene_flow.join(" → ")}
- CTA pattern: ${template.cta_pattern}
- Risk notes: ${template.risk_notes.join("; ")}

TASK: Generate EXACTLY 3 hooks for this quick_ads script. Each hook must be:
1. Max 14 từ tiếng Việt
2. Scroll-stop trong 2-3 giây đầu
3. Phong cách TikTok commerce thật (không brochure, không AI)
4. Khác nhau rõ ràng về góc tiếp cận (pain, curiosity, benefit, shock, question, etc.)

Output JSON:
{
  "hooks": [
    { "hook_text": "string", "hook_style": "pain|curiosity|benefit|shock|question|comparison", "score": 0-100, "why": "1 sentence reason" },
    { "hook_text": "string", "hook_style": "...", "score": 0-100, "why": "..." },
    { "hook_text": "string", "hook_style": "...", "score": 0-100, "why": "..." }
  ],
  "best_hook_index": 0
}`;
}

function buildQuickAdsScriptPrompt(
  intel: any, concept: any, template: QuickAdsTemplate,
  bestHook: string, assetSummary: string
) {
  return `PRODUCT INFO:
- Name: ${intel.product_name || "Unknown"}
- Category: ${intel.category || "other"}
- Target buyer: ${intel.target_buyer || "General"}
- Price band: ${intel.price_band || "mid"}
- USPs: ${JSON.stringify(intel.usp_list || [])}
- Pain points: ${JSON.stringify(intel.pain_points || [])}
- Trust signals: ${JSON.stringify(intel.trust_signals || [])}
- Objections: ${JSON.stringify(intel.objections || [])}

SELECTED CONCEPT:
- Angle: ${concept.angle_type}
- Title: ${concept.title}
- Big idea: ${concept.big_idea}
- CTA: ${concept.cta}

TEMPLATE: ${template.id} — ${template.name}
- Scene flow: ${template.scene_flow.join(" → ")}
- Proof pattern: ${template.proof_pattern}
- CTA pattern: ${template.cta_pattern}
- Risk notes: ${template.risk_notes.join("; ")}

WINNING HOOK: "${bestHook}"

AVAILABLE ASSETS: ${assetSummary || "Product images uploaded by user"}

INTERNAL SELF-CRITIQUE (thực hiện trước khi output):
1. Hook có scroll-stop không? Đọc lại — nếu yếu thì đổi.
2. Từng voice_line đọc lớn có tự nhiên không? Có nghe giống người bán hàng thật không?
3. Mỗi scene có dựng được từ asset thật không? Không yêu cầu quay mới.
4. Có overclaim, bịa review, claim y tế, số liệu bịa không? Nếu có — xoá.
5. Tổng thời lượng có đúng 15–20 giây không?
6. Overlay text có quá 7 từ không? Voice line có quá 14 từ không?
Nếu bất kỳ điều nào sai — SỬA TRƯỚC khi trả JSON.

Generate JSON with this EXACT schema:
{
  "script_text": "Full script as continuous text (Vietnamese)",
  "duration_sec": 18,
  "cta": "Final CTA line",
  "template_id": "${template.id}",
  "hooks_generated": [
    { "hook_text": "string", "hook_style": "string", "score": 0, "selected": true|false }
  ],
  "scene_cards": [
    {
      "scene_no": 1,
      "duration_sec": 3,
      "visual_instruction": "What to show (use available assets only)",
      "overlay_text": "Short overlay text or empty string (max 7 words)",
      "voice_line": "What narrator says (max 14 words, spoken Vietnamese)"
    }
  ],
  "overlay_list": [
    {
      "start_sec": 0,
      "end_sec": 3,
      "text": "Overlay text",
      "style": "headline|price|badge|cta"
    }
  ],
  "subtitle_text": "Full subtitle/caption text for the video (Vietnamese)",
  "caption_tiktok": "TikTok post caption with emojis (Vietnamese, max 150 chars)",
  "caption_reels": "Instagram Reels caption (Vietnamese, max 200 chars)",
  "hashtags": ["hashtag1", "hashtag2", "...up to 10"],
  "thumbnail_text": "Short punchy text for video thumbnail (Vietnamese, max 6 words)"
}

IMPORTANT: Generate exactly 5–6 scene cards following the template scene flow: ${template.scene_flow.join(" → ")}. Total duration must be 15–20 giây. Use the WINNING HOOK as the first voice_line.`;
}

function buildGenericUserPrompt(intel: any, concept: any, packageType: string, assetSummary: string) {
  const pkg = PACKAGE_DURATION[packageType] || PACKAGE_DURATION.quick_ads;
  return `PRODUCT INFO:
- Name: ${intel.product_name || "Unknown"}
- Category: ${intel.category || "other"}
- Target buyer: ${intel.target_buyer || "General"}
- Price band: ${intel.price_band || "mid"}
- USPs: ${JSON.stringify(intel.usp_list || [])}
- Pain points: ${JSON.stringify(intel.pain_points || [])}
- Trust signals: ${JSON.stringify(intel.trust_signals || [])}
- Objections: ${JSON.stringify(intel.objections || [])}

SELECTED CONCEPT:
- Angle: ${concept.angle_type}
- Title: ${concept.title}
- Big idea: ${concept.big_idea}
- Hook: ${concept.hook}
- CTA: ${concept.cta}

AVAILABLE ASSETS: ${assetSummary || "Product images uploaded by user"}

INTERNAL SELF-CHECK trước khi trả JSON:
- hook có scroll-stop không?
- câu có tự nhiên khi đọc lớn không?
- scene có build được từ asset thật không?
- có overclaim không?
- nếu có vấn đề, tự sửa rồi mới trả JSON.

Generate JSON with this EXACT schema:
{
  "script_text": "Full script as continuous text (Vietnamese)",
  "duration_sec": ${packageType === "quick_ads" ? 18 : 25},
  "cta": "Final CTA line",
  "scene_cards": [
    {
      "scene_no": 1,
      "duration_sec": 3,
      "visual_instruction": "What to show (use available assets)",
      "overlay_text": "Short overlay text or empty string",
      "voice_line": "What narrator says"
    }
  ],
  "overlay_list": [
    {
      "start_sec": 0,
      "end_sec": 3,
      "text": "Overlay text",
      "style": "headline|price|badge|cta"
    }
  ],
  "subtitle_text": "Full subtitle/caption text for the video (Vietnamese)",
  "caption_tiktok": "TikTok post caption with emojis (Vietnamese, max 150 chars)",
  "caption_reels": "Instagram Reels caption (Vietnamese, max 200 chars)",
  "hashtags": ["hashtag1", "hashtag2", "...up to 10"],
  "thumbnail_text": "Short punchy text for video thumbnail (Vietnamese, max 6 words)"
}

IMPORTANT: Generate exactly ${pkg.sceneCount} scene cards. Total duration must be ${pkg.duration}.`;
}

const REPAIR_PROMPT = `Kết quả trước không hợp lệ. Trả về CHỈ JSON hợp lệ đúng schema: script_text, duration_sec, cta, scene_cards (array), overlay_list (array), subtitle_text, caption_tiktok, caption_reels, hashtags (array), thumbnail_text. Không có text ngoài JSON.`;

// ==================== VALIDATION ====================

const VALID_OVERLAY_STYLES = ["headline", "price", "badge", "cta"];

interface ScriptOutput {
  script_text: string;
  duration_sec: number;
  cta: string;
  template_id?: string;
  hooks_generated?: Array<{ hook_text: string; hook_style: string; score: number; selected: boolean }>;
  scene_cards: Array<{
    scene_no: number;
    duration_sec: number;
    visual_instruction: string;
    overlay_text: string;
    voice_line: string;
  }>;
  overlay_list: Array<{
    start_sec: number;
    end_sec: number;
    text: string;
    style: string;
  }>;
  subtitle_text: string;
  caption_tiktok: string;
  caption_reels: string;
  hashtags: string[];
  thumbnail_text: string;
}

function validateScript(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Not an object"] };

  if (typeof obj.script_text !== "string" || obj.script_text.length < 20) errors.push("script_text too short or missing");
  if (typeof obj.duration_sec !== "number" || obj.duration_sec < 10 || obj.duration_sec > 60) errors.push("duration_sec must be 10-60");
  if (typeof obj.cta !== "string" || !obj.cta.trim()) errors.push("Missing cta");

  if (!Array.isArray(obj.scene_cards) || obj.scene_cards.length < 3) {
    errors.push("scene_cards must have at least 3 items");
  } else {
    for (let i = 0; i < obj.scene_cards.length; i++) {
      const s = obj.scene_cards[i];
      if (!s || typeof s !== "object") { errors.push(`scene_cards[${i}] not an object`); continue; }
      if (typeof s.duration_sec !== "number" || s.duration_sec < 1) errors.push(`scene_cards[${i}]: invalid duration_sec`);
      if (typeof s.visual_instruction !== "string" || !s.visual_instruction.trim()) errors.push(`scene_cards[${i}]: missing visual_instruction`);
      if (typeof s.voice_line !== "string") errors.push(`scene_cards[${i}]: missing voice_line`);
      // Quick ads specific: voice line max 14 words, overlay max 7 words
      if (typeof s.voice_line === "string" && s.voice_line.split(/\s+/).length > 18) errors.push(`scene_cards[${i}]: voice_line too long (>18 words)`);
      if (typeof s.overlay_text === "string" && s.overlay_text.trim() && s.overlay_text.split(/\s+/).length > 10) errors.push(`scene_cards[${i}]: overlay_text too long (>10 words)`);
    }
  }

  if (!Array.isArray(obj.overlay_list)) {
    errors.push("overlay_list must be an array");
  } else {
    for (let i = 0; i < obj.overlay_list.length; i++) {
      const o = obj.overlay_list[i];
      if (!o || typeof o !== "object") continue;
      if (typeof o.text !== "string" || !o.text.trim()) errors.push(`overlay_list[${i}]: missing text`);
    }
  }

  if (typeof obj.subtitle_text !== "string") errors.push("Missing subtitle_text");
  if (typeof obj.caption_tiktok !== "string") errors.push("Missing caption_tiktok");
  if (typeof obj.caption_reels !== "string") errors.push("Missing caption_reels");
  if (!Array.isArray(obj.hashtags)) errors.push("hashtags must be array");
  if (typeof obj.thumbnail_text !== "string") errors.push("Missing thumbnail_text");

  return { valid: errors.length === 0, errors };
}

function validateHooks(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Not an object"] };
  if (!Array.isArray(obj.hooks) || obj.hooks.length < 3) {
    errors.push("Must have exactly 3 hooks");
  } else {
    const styles = new Set<string>();
    for (let i = 0; i < obj.hooks.length; i++) {
      const h = obj.hooks[i];
      if (!h?.hook_text || typeof h.hook_text !== "string") errors.push(`hooks[${i}]: missing hook_text`);
      if (!h?.hook_style) errors.push(`hooks[${i}]: missing hook_style`);
      if (h?.hook_style) styles.add(h.hook_style);
    }
    if (styles.size < 2) errors.push("Hooks must use at least 2 different styles");
  }
  if (typeof obj.best_hook_index !== "number" || obj.best_hook_index < 0 || obj.best_hook_index > 2) {
    errors.push("best_hook_index must be 0, 1, or 2");
  }
  return { valid: errors.length === 0, errors };
}

function normalizeScript(raw: any): ScriptOutput {
  return {
    script_text: String(raw.script_text || ""),
    duration_sec: typeof raw.duration_sec === "number" ? Math.round(raw.duration_sec) : 20,
    cta: String(raw.cta || ""),
    template_id: raw.template_id || undefined,
    hooks_generated: Array.isArray(raw.hooks_generated)
      ? raw.hooks_generated.map((h: any) => ({
          hook_text: String(h?.hook_text || ""),
          hook_style: String(h?.hook_style || "unknown"),
          score: typeof h?.score === "number" ? h.score : 0,
          selected: !!h?.selected,
        }))
      : undefined,
    scene_cards: (Array.isArray(raw.scene_cards) ? raw.scene_cards : []).map((s: any, i: number) => ({
      scene_no: s?.scene_no || i + 1,
      duration_sec: typeof s?.duration_sec === "number" ? Math.round(s.duration_sec) : 3,
      visual_instruction: String(s?.visual_instruction || ""),
      overlay_text: String(s?.overlay_text || ""),
      voice_line: String(s?.voice_line || ""),
    })),
    overlay_list: (Array.isArray(raw.overlay_list) ? raw.overlay_list : []).map((o: any) => ({
      start_sec: typeof o?.start_sec === "number" ? o.start_sec : 0,
      end_sec: typeof o?.end_sec === "number" ? o.end_sec : 3,
      text: String(o?.text || ""),
      style: VALID_OVERLAY_STYLES.includes(o?.style) ? o.style : "headline",
    })),
    subtitle_text: String(raw.subtitle_text || ""),
    caption_tiktok: String(raw.caption_tiktok || "").slice(0, 300),
    caption_reels: String(raw.caption_reels || "").slice(0, 400),
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.map(String).slice(0, 15) : [],
    thumbnail_text: String(raw.thumbnail_text || "").slice(0, 100),
  };
}

// ==================== AI CALL ====================

async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: false,
        temperature: 0.6,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error:", resp.status, errText);
      if (resp.status === 429) throw new Error("RATE_LIMITED");
      if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
      throw new Error(`AI_GATEWAY_ERROR_${resp.status}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("AI_TIMEOUT");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) try { return JSON.parse(match[1].trim()); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

// ==================== REVIEW VIDEO ENGINE ====================

function buildReviewHookPrompt(intel: any, concept: any, template: ReviewTemplate, persona: ReviewPersona) {
  const personaVoice = PERSONA_VOICE[persona];
  return `PRODUCT INFO:
- Name: ${intel.product_name || "Unknown"}
- Category: ${intel.category || "other"}
- Target buyer: ${intel.target_buyer || "General"}
- USPs: ${JSON.stringify(intel.usp_list || [])}
- Pain points: ${JSON.stringify(intel.pain_points || [])}
- Trust signals: ${JSON.stringify(intel.trust_signals || [])}

SELECTED CONCEPT:
- Angle: ${concept.angle_type}
- Title: ${concept.title}
- Big idea: ${concept.big_idea}

TEMPLATE: ${template.id} — ${template.name}
- Intent: ${template.intent}
- Opening pattern: ${template.opening_pattern}
- Persona: ${persona}

PERSONA VOICE: ${personaVoice}

TASK: Generate EXACTLY 3 review-style hooks. Each hook must be:
1. Max 16 từ tiếng Việt
2. Nghe như người thật đang chia sẻ, KHÔNG giống quảng cáo
3. Phù hợp persona ${persona}
4. Khác nhau rõ ràng (personal experience, question, observation, recommendation, surprise)
5. Có ít nhất 1 hook chứa chi tiết cụ thể (texture, cảm giác, tình huống)

Output JSON:
{
  "hooks": [
    { "hook_text": "string", "hook_style": "experience|question|observation|recommendation|surprise", "score": 0-100, "why": "1 sentence reason" },
    { "hook_text": "string", "hook_style": "...", "score": 0-100, "why": "..." },
    { "hook_text": "string", "hook_style": "...", "score": 0-100, "why": "..." }
  ],
  "best_hook_index": 0
}`;
}

function buildReviewScriptPrompt(
  intel: any, concept: any, template: ReviewTemplate,
  persona: ReviewPersona, bestHook: string, assetSummary: string
) {
  const personaVoice = PERSONA_VOICE[persona];
  return `PRODUCT INFO:
- Name: ${intel.product_name || "Unknown"}
- Category: ${intel.category || "other"}
- Target buyer: ${intel.target_buyer || "General"}
- Price band: ${intel.price_band || "mid"}
- USPs: ${JSON.stringify(intel.usp_list || [])}
- Pain points: ${JSON.stringify(intel.pain_points || [])}
- Trust signals: ${JSON.stringify(intel.trust_signals || [])}
- Objections: ${JSON.stringify(intel.objections || [])}
- Use context: ${JSON.stringify(intel.use_context || [])}

SELECTED CONCEPT:
- Angle: ${concept.angle_type}
- Title: ${concept.title}
- Big idea: ${concept.big_idea}
- CTA: ${concept.cta}

TEMPLATE: ${template.id} — ${template.name}
- Scene flow: ${template.scene_flow.join(" → ")}
- Proof pattern: ${template.proof_pattern}
- CTA pattern: ${template.cta_pattern}
- Risk notes: ${template.risk_notes.join("; ")}

PERSONA: ${persona}
PERSONA VOICE: ${personaVoice}

WINNING HOOK: "${bestHook}"

AVAILABLE ASSETS: ${assetSummary || "Product images uploaded by user"}

MANDATORY TRUST RULES:
1. Phải có ÍT NHẤT 1 chi tiết cụ thể tăng trust (ví dụ: texture, mùi, cảm giác dùng, kích thước thật, tình huống dùng cụ thể, so sánh với trải nghiệm trước)
2. KHÔNG bịa trải nghiệm — chỉ mô tả từ thông tin sản phẩm có sẵn
3. KHÔNG dùng superlative tuyệt đối ("tốt nhất", "duy nhất", "100% hiệu quả")
4. CTA phải MỀM — gợi ý, không ép mua ("thử xem nha", "link ở bio á", "ai cần thì xem thêm nè")
5. Giọng văn phải đúng persona ${persona} — KHÔNG nghe như TVC hoặc copywriting AI

INTERNAL SELF-CRITIQUE (thực hiện trước khi output):
1. Đọc lại toàn bộ script — có nghe như NGƯỜI THẬT đang chia sẻ không?
2. Có ít nhất 1 chi tiết cụ thể tăng trust chưa? (texture, cảm giác, tình huống)
3. Có câu nào nghe quá PR hoặc quá trơn tru không? Nếu có — viết lại cho tự nhiên hơn.
4. Mỗi scene có dựng được từ asset thật không?
5. CTA có mềm không? Không ép, không aggressive.
6. Tổng thời lượng có đúng 20–30 giây không?
7. Voice line có quá 16 từ không? Overlay text có quá 7 từ không?
Nếu bất kỳ điều nào sai — SỬA TRƯỚC khi trả JSON.

Generate JSON with this EXACT schema:
{
  "script_text": "Full script as continuous text (Vietnamese, persona voice)",
  "duration_sec": 25,
  "cta": "Soft CTA line",
  "template_id": "${template.id}",
  "persona": "${persona}",
  "trust_detail": "The specific concrete detail used to build trust (for QA tracking)",
  "hooks_generated": [
    { "hook_text": "string", "hook_style": "string", "score": 0, "selected": true|false }
  ],
  "scene_cards": [
    {
      "scene_no": 1,
      "duration_sec": 3,
      "visual_instruction": "What to show (use available assets only)",
      "overlay_text": "Short overlay text or empty string (max 7 words)",
      "voice_line": "What narrator says (max 16 words, spoken Vietnamese, persona voice)"
    }
  ],
  "overlay_list": [
    {
      "start_sec": 0,
      "end_sec": 3,
      "text": "Overlay text",
      "style": "headline|price|badge|cta"
    }
  ],
  "subtitle_text": "Full subtitle/caption text for the video (Vietnamese)",
  "caption_tiktok": "TikTok post caption with emojis (Vietnamese, max 150 chars, review tone)",
  "caption_reels": "Instagram Reels caption (Vietnamese, max 200 chars, review tone)",
  "hashtags": ["hashtag1", "hashtag2", "...up to 10"],
  "thumbnail_text": "Short punchy text for video thumbnail (Vietnamese, max 6 words)"
}

IMPORTANT: Generate exactly 6–8 scene cards following the template scene flow: ${template.scene_flow.join(" → ")}. Total duration must be 20–30 giây. Use the WINNING HOOK as the first voice_line.`;
}

function validateReviewScript(obj: any): { valid: boolean; errors: string[] } {
  // Start with base validation
  const base = validateScript(obj);
  const errors = [...base.errors];

  // Review-specific: must have trust_detail
  if (!obj?.trust_detail || typeof obj.trust_detail !== "string" || obj.trust_detail.length < 5) {
    errors.push("Missing trust_detail — review script must include at least one concrete trust-building detail");
  }

  // Review-specific: CTA should not be aggressive
  if (obj?.cta && typeof obj.cta === "string") {
    const aggressiveWords = ["mua ngay", "đặt ngay", "nhanh tay", "số lượng có hạn", "hết hàng"];
    const ctaLower = obj.cta.toLowerCase();
    if (aggressiveWords.some(w => ctaLower.includes(w))) {
      errors.push("CTA too aggressive for review_video — must be soft CTA");
    }
  }

  // Duration check: 20-30s for review
  if (typeof obj?.duration_sec === "number" && (obj.duration_sec < 18 || obj.duration_sec > 35)) {
    errors.push("duration_sec for review_video should be 20-30s");
  }

  return { valid: errors.length === 0, errors };
}

async function runReviewVideoEngine(
  intel: any, concept: any, template: ReviewTemplate, persona: ReviewPersona,
  assetSummary: string, traceId: string
): Promise<{ script: ScriptOutput | null; rawText: string; errors: string[]; meta: Record<string, any> }> {
  const systemPrompt = buildSystemPrompt("review_video");
  const meta: Record<string, any> = { template_id: template.id, persona };

  // STEP 1: Generate 3 review hooks
  console.log(`[${traceId}] Review Step 1: Generating 3 hooks with template ${template.id}, persona ${persona}`);
  const hookPrompt = buildReviewHookPrompt(intel, concept, template, persona);
  let hookRawText = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: hookPrompt },
  ]);

  let hookParsed = extractJSON(hookRawText);
  let hookValidation = hookParsed ? validateHooks(hookParsed) : { valid: false, errors: ["Failed to parse hook JSON"] };

  if (!hookValidation.valid) {
    console.log(`[${traceId}] Review hook attempt 1 failed: ${hookValidation.errors.join(", ")}. Retrying...`);
    hookRawText = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: hookPrompt },
      { role: "assistant", content: hookRawText },
      { role: "user", content: `Kết quả hooks không hợp lệ. Errors: ${hookValidation.errors.join(", ")}. Trả lại JSON đúng schema: hooks (3 items, mỗi cái có hook_text, hook_style, score, why) và best_hook_index (0-2). CHỈ JSON.` },
    ]);
    hookParsed = extractJSON(hookRawText);
    hookValidation = hookParsed ? validateHooks(hookParsed) : { valid: false, errors: ["Hook retry failed"] };
  }

  let bestHook = concept.hook || "Hook không xác định";
  let hooksForOutput: any[] = [];

  if (hookValidation.valid && hookParsed) {
    const bestIdx = hookParsed.best_hook_index ?? 0;
    bestHook = hookParsed.hooks[bestIdx]?.hook_text || bestHook;
    hooksForOutput = hookParsed.hooks.map((h: any, i: number) => ({
      hook_text: h.hook_text,
      hook_style: h.hook_style,
      score: h.score || 0,
      selected: i === bestIdx,
    }));
    console.log(`[${traceId}] Review best hook (index ${bestIdx}): "${bestHook}"`);
  } else {
    console.log(`[${traceId}] Review hook generation failed, using concept hook`);
  }

  // STEP 2: Generate full review script with persona voice + self-critique
  console.log(`[${traceId}] Review Step 2: Generating full script with template ${template.id}, persona ${persona}`);
  const scriptPrompt = buildReviewScriptPrompt(intel, concept, template, persona, bestHook, assetSummary);
  let rawText = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: scriptPrompt },
  ]);

  let parsed = extractJSON(rawText);
  let validation = parsed ? validateReviewScript(parsed) : { valid: false, errors: ["Failed to parse script JSON"] };

  // Repair attempt with review-specific feedback
  if (!validation.valid) {
    console.log(`[${traceId}] Review script attempt 1 failed: ${validation.errors.join(", ")}. Repairing...`);
    const reviewRepairPrompt = `Kết quả trước không hợp lệ. Lỗi: ${validation.errors.join(", ")}.
Trả về CHỈ JSON hợp lệ đúng schema. Nhớ:
- trust_detail phải có (chi tiết cụ thể tăng trust)
- CTA phải mềm (không "mua ngay", không ép)
- persona phải là "${persona}"
- duration 20-30 giây
Không có text ngoài JSON.`;
    rawText = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: scriptPrompt },
      { role: "assistant", content: rawText },
      { role: "user", content: reviewRepairPrompt },
    ]);
    parsed = extractJSON(rawText);
    validation = parsed ? validateReviewScript(parsed) : { valid: false, errors: ["Review script repair failed"] };
  }

  if (!validation.valid || !parsed) {
    return { script: null, rawText, errors: validation.errors, meta };
  }

  // Inject hooks and metadata
  if (hooksForOutput.length > 0) parsed.hooks_generated = hooksForOutput;
  parsed.template_id = template.id;
  parsed.persona = persona;
  meta.trust_detail = parsed.trust_detail || "none";

  const normalized = normalizeScript(parsed);
  return { script: normalized, rawText, errors: [], meta };
}

// ==================== TEMPLATE LIBRARY (CV-01 → CV-10) ====================

interface ConversionTemplate {
  id: string;
  name: string;
  intent: string;
  opening_pattern: string;
  scene_flow: string[];
  proof_pattern: string;
  cta_pattern: string;
  fit_products: string[];
  risk_notes: string[];
}

const CONVERSION_VIDEO_TEMPLATES: ConversionTemplate[] = [
  { id: "CV-01", name: "Pain -> Proof -> Offer", intent: "classic conversion formula", opening_pattern: "pain first", scene_flow: ["pain","proof","offer","cta"], proof_pattern: "evidence early", cta_pattern: "direct CTA with offer", fit_products: ["any high-intent product"], risk_notes: ["proof must be real"] },
  { id: "CV-02", name: "Objection Killer", intent: "handle biggest objection", opening_pattern: "objection statement", scene_flow: ["objection","proof","reassurance","cta"], proof_pattern: "counter-evidence", cta_pattern: "direct CTA", fit_products: ["products with known objections"], risk_notes: ["objection must be real, not strawman"] },
  { id: "CV-03", name: "Why You Still Delay", intent: "attack delay reasons", opening_pattern: "delay callout", scene_flow: ["common delay","consequence","solution","offer","cta"], proof_pattern: "consequence visualization", cta_pattern: "urgency CTA", fit_products: ["considered purchases"], risk_notes: ["no fear-mongering"] },
  { id: "CV-04", name: "Bad Choice vs Smart Choice", intent: "contrast to push decision", opening_pattern: "wrong way", scene_flow: ["wrong way","right way","product fit","cta"], proof_pattern: "comparison contrast", cta_pattern: "direct CTA", fit_products: ["category with alternatives"], risk_notes: ["no competitor naming"] },
  { id: "CV-05", name: "Proof First Conversion", intent: "lead with evidence", opening_pattern: "proof", scene_flow: ["proof","pain","usp","offer","cta"], proof_pattern: "proof as hook", cta_pattern: "direct CTA with offer", fit_products: ["products with strong proof points"], risk_notes: ["proof must be verifiable"] },
  { id: "CV-06", name: "Bundle Saver", intent: "combo value proposition", opening_pattern: "need identification", scene_flow: ["need","combo value","price logic","cta"], proof_pattern: "value breakdown", cta_pattern: "CTA with bundle price", fit_products: ["bundleable products"], risk_notes: ["pricing must be accurate"] },
  { id: "CV-07", name: "Limited Offer Push", intent: "controlled urgency", opening_pattern: "hook", scene_flow: ["hook","proof","limited offer","cta"], proof_pattern: "scarcity signal", cta_pattern: "urgency CTA", fit_products: ["sale items","limited stock"], risk_notes: ["urgency must be real"] },
  { id: "CV-08", name: "Common Mistake Fix", intent: "educate then sell", opening_pattern: "mistake callout", scene_flow: ["mistake","consequence","better option","cta"], proof_pattern: "education as proof", cta_pattern: "direct CTA", fit_products: ["educational-sell products"], risk_notes: ["mistake must be genuine"] },
  { id: "CV-09", name: "Fast Decision CTA", intent: "compress decision journey", opening_pattern: "why now", scene_flow: ["why now","what user gets","how to act","cta"], proof_pattern: "benefit summary", cta_pattern: "action-oriented CTA", fit_products: ["impulse-friendly products"], risk_notes: ["must still feel natural"] },
  { id: "CV-10", name: "UGC Hard Sell Hybrid", intent: "review surface, conversion core", opening_pattern: "review-like hook", scene_flow: ["review hook","proof","offer","cta"], proof_pattern: "UGC-style proof", cta_pattern: "direct CTA hidden in review", fit_products: ["any product"], risk_notes: ["balance authenticity with selling"] },
];

function selectConversionTemplate(intel: any, concept: any): ConversionTemplate {
  const category = (intel.category || "other").toLowerCase();
  const angleType = concept.angle_type || "offer_conversion";
  const hasObjections = Array.isArray(intel.objections) && intel.objections.length > 0;
  const hasTrustSignals = Array.isArray(intel.trust_signals) && intel.trust_signals.length > 0;

  const scored = CONVERSION_VIDEO_TEMPLATES.map((t) => {
    let score = 0;
    if (t.fit_products.some((f: string) => f.includes("any") || category.includes(f) || f.includes(category))) score += 2;
    if (angleType === "pain_first" && t.opening_pattern.includes("pain")) score += 3;
    if (angleType === "offer_conversion" && (t.intent.includes("offer") || t.intent.includes("conversion"))) score += 2;
    if (hasObjections && t.intent.includes("objection")) score += 3;
    if (hasTrustSignals && t.proof_pattern.includes("proof")) score += 2;
    if (intel.price_band === "high" && t.intent.includes("delay")) score += 2;
    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  return top3[Math.floor(Math.random() * top3.length)].template;
}

function buildConversionHookPrompt(intel: any, concept: any, template: ConversionTemplate) {
  return `PRODUCT INFO:
- Name: ${intel.product_name || "Unknown"}
- Category: ${intel.category || "other"}
- Target buyer: ${intel.target_buyer || "General"}
- Price band: ${intel.price_band || "mid"}
- USPs: ${JSON.stringify(intel.usp_list || [])}
- Pain points: ${JSON.stringify(intel.pain_points || [])}
- Objections: ${JSON.stringify(intel.objections || [])}
- Trust signals: ${JSON.stringify(intel.trust_signals || [])}

SELECTED CONCEPT:
- Angle: ${concept.angle_type}
- Title: ${concept.title}
- Big idea: ${concept.big_idea}

TEMPLATE: ${template.id} — ${template.name}
- Intent: ${template.intent}
- Opening pattern: ${template.opening_pattern}
- Scene flow: ${template.scene_flow.join(" → ")}
- Risk notes: ${template.risk_notes.join("; ")}

TASK: Generate EXACTLY 3 conversion hooks. Each hook must be:
1. Max 14 từ tiếng Việt
2. Chạm pain hoặc objection trong 2-3 giây đầu
3. Khác nhau rõ ràng (pain, objection, proof-lead, mistake, urgency)
4. Phong cách TikTok commerce — không brochure, không formal
5. Phải khiến người xem muốn biết giải pháp

Output JSON:
{
  "hooks": [
    { "hook_text": "string", "hook_style": "pain|objection|proof_lead|mistake|urgency", "score": 0-100, "why": "1 sentence reason" },
    { "hook_text": "string", "hook_style": "...", "score": 0-100, "why": "..." },
    { "hook_text": "string", "hook_style": "...", "score": 0-100, "why": "..." }
  ],
  "best_hook_index": 0
}`;
}

function buildConversionScriptPrompt(
  intel: any, concept: any, template: ConversionTemplate,
  bestHook: string, assetSummary: string
) {
  const biggestObjection = Array.isArray(intel.objections) && intel.objections.length > 0
    ? intel.objections[0] : "giá cao";

  return `PRODUCT INFO:
- Name: ${intel.product_name || "Unknown"}
- Category: ${intel.category || "other"}
- Target buyer: ${intel.target_buyer || "General"}
- Price band: ${intel.price_band || "mid"}
- USPs: ${JSON.stringify(intel.usp_list || [])}
- Pain points: ${JSON.stringify(intel.pain_points || [])}
- Trust signals: ${JSON.stringify(intel.trust_signals || [])}
- Objections: ${JSON.stringify(intel.objections || [])}
- Use context: ${JSON.stringify(intel.use_context || [])}

SELECTED CONCEPT:
- Angle: ${concept.angle_type}
- Title: ${concept.title}
- Big idea: ${concept.big_idea}
- CTA: ${concept.cta}

TEMPLATE: ${template.id} — ${template.name}
- Scene flow: ${template.scene_flow.join(" → ")}
- Proof pattern: ${template.proof_pattern}
- CTA pattern: ${template.cta_pattern}
- Risk notes: ${template.risk_notes.join("; ")}

WINNING HOOK: "${bestHook}"

BIGGEST OBJECTION TO HANDLE: "${biggestObjection}"

AVAILABLE ASSETS: ${assetSummary || "Product images uploaded by user"}

MANDATORY CONVERSION RULES:
1. Pain phải RÕ RÀNG trong 2-3 scene đầu — người xem phải thấy đúng vấn đề của mình
2. Proof phải XUẤT HIỆN SỚM (scene 2-3) — không để quá muộn
3. Phải XỬ LÝ objection "${biggestObjection}" — giải đáp trực tiếp, không né
4. CTA phải TRỰC TIẾP nhưng TỰ NHIÊN — "Bấm link", "Inbox ngay", "Xem thêm ở bio" — không thô bạo
5. Không bịa review, số liệu bán, claim y tế, hoặc hiệu quả tuyệt đối
6. Scene phải dựng được từ asset thật — không yêu cầu quay mới

INTERNAL SELF-CRITIQUE (thực hiện trước khi output):
1. Pain có đập trúng nỗi đau thật của target buyer không?
2. Proof có xuất hiện sớm không? (trước scene 4)
3. Objection lớn nhất đã được xử lý chưa?
4. CTA có rõ hành động không? Nhưng có tự nhiên không?
5. Mỗi scene có dựng được từ asset thật không?
6. Có overclaim, bịa review, claim y tế không?
7. Tổng thời lượng có đúng 20–30 giây không?
8. Voice line có quá 16 từ không? Overlay text có quá 7 từ không?
Nếu bất kỳ điều nào sai — SỬA TRƯỚC khi trả JSON.

Generate JSON with this EXACT schema:
{
  "script_text": "Full script as continuous text (Vietnamese)",
  "duration_sec": 25,
  "cta": "Direct CTA line",
  "template_id": "${template.id}",
  "pain_addressed": "The specific pain point addressed in the script",
  "objection_handled": "The objection that was handled and how",
  "proof_scene_no": 2,
  "hooks_generated": [
    { "hook_text": "string", "hook_style": "string", "score": 0, "selected": true|false }
  ],
  "scene_cards": [
    {
      "scene_no": 1,
      "duration_sec": 3,
      "visual_instruction": "What to show (use available assets only)",
      "overlay_text": "Short overlay text or empty string (max 7 words)",
      "voice_line": "What narrator says (max 16 words, spoken Vietnamese)"
    }
  ],
  "overlay_list": [
    {
      "start_sec": 0,
      "end_sec": 3,
      "text": "Overlay text",
      "style": "headline|price|badge|cta"
    }
  ],
  "subtitle_text": "Full subtitle/caption text for the video (Vietnamese)",
  "caption_tiktok": "TikTok post caption with emojis (Vietnamese, max 150 chars)",
  "caption_reels": "Instagram Reels caption (Vietnamese, max 200 chars)",
  "hashtags": ["hashtag1", "hashtag2", "...up to 10"],
  "thumbnail_text": "Short punchy text for video thumbnail (Vietnamese, max 6 words)"
}

IMPORTANT: Generate exactly 6–8 scene cards following the template scene flow: ${template.scene_flow.join(" → ")}. Total duration must be 20–30 giây. Use the WINNING HOOK as the first voice_line.`;
}

function validateConversionScript(obj: any): { valid: boolean; errors: string[] } {
  const base = validateScript(obj);
  const errors = [...base.errors];

  // Must have pain_addressed
  if (!obj?.pain_addressed || typeof obj.pain_addressed !== "string" || obj.pain_addressed.length < 5) {
    errors.push("Missing pain_addressed — conversion script must clearly state the pain point");
  }

  // Must have objection_handled
  if (!obj?.objection_handled || typeof obj.objection_handled !== "string" || obj.objection_handled.length < 5) {
    errors.push("Missing objection_handled — must handle at least one major objection");
  }

  // Proof must appear early (scene 1-3)
  if (typeof obj?.proof_scene_no === "number" && obj.proof_scene_no > 4) {
    errors.push("proof_scene_no too late — proof must appear by scene 3-4");
  }

  // Duration check: 20-30s
  if (typeof obj?.duration_sec === "number" && (obj.duration_sec < 18 || obj.duration_sec > 35)) {
    errors.push("duration_sec for conversion_video should be 20-30s");
  }

  // CTA must exist and be direct
  if (obj?.cta && typeof obj.cta === "string" && obj.cta.length < 3) {
    errors.push("CTA too short for conversion_video");
  }

  return { valid: errors.length === 0, errors };
}

async function runConversionVideoEngine(
  intel: any, concept: any, template: ConversionTemplate,
  assetSummary: string, traceId: string
): Promise<{ script: ScriptOutput | null; rawText: string; errors: string[]; meta: Record<string, any> }> {
  const systemPrompt = buildSystemPrompt("conversion_video");
  const meta: Record<string, any> = { template_id: template.id };

  // STEP 1: Generate 3 conversion hooks
  console.log(`[${traceId}] Conversion Step 1: Generating 3 hooks with template ${template.id}`);
  const hookPrompt = buildConversionHookPrompt(intel, concept, template);
  let hookRawText = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: hookPrompt },
  ]);

  let hookParsed = extractJSON(hookRawText);
  let hookValidation = hookParsed ? validateHooks(hookParsed) : { valid: false, errors: ["Failed to parse hook JSON"] };

  if (!hookValidation.valid) {
    console.log(`[${traceId}] Conversion hook attempt 1 failed: ${hookValidation.errors.join(", ")}. Retrying...`);
    hookRawText = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: hookPrompt },
      { role: "assistant", content: hookRawText },
      { role: "user", content: `Kết quả hooks không hợp lệ. Errors: ${hookValidation.errors.join(", ")}. Trả lại JSON đúng schema: hooks (3 items, mỗi cái có hook_text, hook_style, score, why) và best_hook_index (0-2). CHỈ JSON.` },
    ]);
    hookParsed = extractJSON(hookRawText);
    hookValidation = hookParsed ? validateHooks(hookParsed) : { valid: false, errors: ["Hook retry failed"] };
  }

  let bestHook = concept.hook || "Hook không xác định";
  let hooksForOutput: any[] = [];

  if (hookValidation.valid && hookParsed) {
    const bestIdx = hookParsed.best_hook_index ?? 0;
    bestHook = hookParsed.hooks[bestIdx]?.hook_text || bestHook;
    hooksForOutput = hookParsed.hooks.map((h: any, i: number) => ({
      hook_text: h.hook_text,
      hook_style: h.hook_style,
      score: h.score || 0,
      selected: i === bestIdx,
    }));
    console.log(`[${traceId}] Conversion best hook (index ${bestIdx}): "${bestHook}"`);
  } else {
    console.log(`[${traceId}] Conversion hook generation failed, using concept hook`);
  }

  // STEP 2: Generate full conversion script with self-critique
  console.log(`[${traceId}] Conversion Step 2: Generating full script with template ${template.id}`);
  const scriptPrompt = buildConversionScriptPrompt(intel, concept, template, bestHook, assetSummary);
  let rawText = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: scriptPrompt },
  ]);

  let parsed = extractJSON(rawText);
  let validation = parsed ? validateConversionScript(parsed) : { valid: false, errors: ["Failed to parse script JSON"] };

  // Repair attempt with conversion-specific feedback
  if (!validation.valid) {
    console.log(`[${traceId}] Conversion script attempt 1 failed: ${validation.errors.join(", ")}. Repairing...`);
    const convRepairPrompt = `Kết quả trước không hợp lệ. Lỗi: ${validation.errors.join(", ")}.
Trả về CHỈ JSON hợp lệ đúng schema. Nhớ:
- pain_addressed phải có (nỗi đau cụ thể)
- objection_handled phải có (objection đã xử lý + cách xử lý)
- proof_scene_no phải ≤ 4
- CTA phải trực tiếp nhưng tự nhiên
- duration 20-30 giây
Không có text ngoài JSON.`;
    rawText = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: scriptPrompt },
      { role: "assistant", content: rawText },
      { role: "user", content: convRepairPrompt },
    ]);
    parsed = extractJSON(rawText);
    validation = parsed ? validateConversionScript(parsed) : { valid: false, errors: ["Conversion script repair failed"] };
  }

  if (!validation.valid || !parsed) {
    return { script: null, rawText, errors: validation.errors, meta };
  }

  // Inject hooks and metadata
  if (hooksForOutput.length > 0) parsed.hooks_generated = hooksForOutput;
  parsed.template_id = template.id;
  meta.pain_addressed = parsed.pain_addressed || "none";
  meta.objection_handled = parsed.objection_handled || "none";
  meta.proof_scene_no = parsed.proof_scene_no || 0;

  const normalized = normalizeScript(parsed);
  return { script: normalized, rawText, errors: [], meta };
}

// ==================== QUICK ADS ENGINE ====================

async function runQuickAdsEngine(
  intel: any, concept: any, template: QuickAdsTemplate,
  assetSummary: string, traceId: string
): Promise<{ script: ScriptOutput | null; rawText: string; errors: string[] }> {
  const systemPrompt = buildSystemPrompt("quick_ads");

  // STEP 1: Generate 3 hooks
  console.log(`[${traceId}] Step 1: Generating 3 hooks with template ${template.id}`);
  const hookPrompt = buildQuickAdsHookPrompt(intel, concept, template);
  let hookRawText = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: hookPrompt },
  ]);

  let hookParsed = extractJSON(hookRawText);
  let hookValidation = hookParsed ? validateHooks(hookParsed) : { valid: false, errors: ["Failed to parse hook JSON"] };

  // Retry hooks once if failed
  if (!hookValidation.valid) {
    console.log(`[${traceId}] Hook attempt 1 failed: ${hookValidation.errors.join(", ")}. Retrying...`);
    hookRawText = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: hookPrompt },
      { role: "assistant", content: hookRawText },
      { role: "user", content: `Kết quả hooks không hợp lệ. Errors: ${hookValidation.errors.join(", ")}. Trả lại JSON đúng schema: hooks (3 items, mỗi cái có hook_text, hook_style, score, why) và best_hook_index (0-2). CHỈ JSON.` },
    ]);
    hookParsed = extractJSON(hookRawText);
    hookValidation = hookParsed ? validateHooks(hookParsed) : { valid: false, errors: ["Hook retry failed"] };
  }

  // Select best hook (fallback to concept hook)
  let bestHook = concept.hook || "Hook không xác định";
  let hooksForOutput: any[] = [];

  if (hookValidation.valid && hookParsed) {
    const bestIdx = hookParsed.best_hook_index ?? 0;
    bestHook = hookParsed.hooks[bestIdx]?.hook_text || bestHook;
    hooksForOutput = hookParsed.hooks.map((h: any, i: number) => ({
      hook_text: h.hook_text,
      hook_style: h.hook_style,
      score: h.score || 0,
      selected: i === bestIdx,
    }));
    console.log(`[${traceId}] Best hook selected (index ${bestIdx}): "${bestHook}"`);
  } else {
    console.log(`[${traceId}] Hook generation failed, using concept hook as fallback`);
  }

  // STEP 2: Generate full script with winning hook + self-critique
  console.log(`[${traceId}] Step 2: Generating full script with template ${template.id}`);
  const scriptPrompt = buildQuickAdsScriptPrompt(intel, concept, template, bestHook, assetSummary);
  let rawText = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: scriptPrompt },
  ]);

  let parsed = extractJSON(rawText);
  let validation = parsed ? validateScript(parsed) : { valid: false, errors: ["Failed to parse script JSON"] };

  // Repair attempt
  if (!validation.valid) {
    console.log(`[${traceId}] Script attempt 1 failed: ${validation.errors.join(", ")}. Repairing...`);
    rawText = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: scriptPrompt },
      { role: "assistant", content: rawText },
      { role: "user", content: `${REPAIR_PROMPT}\nErrors: ${validation.errors.join(", ")}` },
    ]);
    parsed = extractJSON(rawText);
    validation = parsed ? validateScript(parsed) : { valid: false, errors: ["Script repair failed"] };
  }

  if (!validation.valid || !parsed) {
    return { script: null, rawText, errors: validation.errors };
  }

  // Inject hooks metadata into the output
  if (hooksForOutput.length > 0) {
    parsed.hooks_generated = hooksForOutput;
  }
  parsed.template_id = template.id;

  const normalized = normalizeScript(parsed);
  return { script: normalized, rawText, errors: [] };
}

// ==================== VISUAL PACK BUILDER ====================

interface AssetRecord {
  id: string;
  file_url: string;
  file_name: string;
  asset_type: string;
  sort_order: number;
}

interface VisualPackOutput {
  render_mode: string;
  aspect_ratio: string;
  subtitle_text: string;
  overlay_list: Array<{ start_sec: number; end_sec: number; text: string; style: string }>;
  asset_plan: Array<{ asset_type: string; source_ref: string; scene_no: number; file_url: string }>;
  music_hint: string;
  cta_card: { text: string; style: string; start_sec: number; end_sec: number } | null;
}

const OVERLAY_PRIORITY: Record<string, number> = { cta: 4, headline: 3, price: 2, badge: 1 };
const MAX_CONCURRENT_OVERLAYS = 2;
const SAFE_AREA_TOP_PX = 120; // TikTok top UI
const SAFE_AREA_BOTTOM_PX = 180; // TikTok bottom UI + CTA zone
const MAX_OVERLAY_WORDS = 7;

/**
 * Map real uploaded assets to scene cards.
 * Rules:
 * - Only use assets from project_assets (real uploads)
 * - Prefer video assets for hook/demo scenes
 * - Round-robin images across remaining scenes
 * - If fewer assets than scenes, reuse cyclically
 */
function mapAssetsToScenes(
  sceneCards: Array<{ scene_no: number; visual_instruction: string }>,
  assets: AssetRecord[]
): Array<{ asset_type: string; source_ref: string; scene_no: number; file_url: string }> {
  if (!assets || assets.length === 0) {
    // Fallback: no real assets, use placeholder refs
    return sceneCards.map((s) => ({
      asset_type: "image",
      source_ref: "placeholder",
      scene_no: s.scene_no,
      file_url: "",
    }));
  }

  const images = assets.filter((a) => a.asset_type === "image").sort((a, b) => a.sort_order - b.sort_order);
  const videos = assets.filter((a) => a.asset_type === "video").sort((a, b) => a.sort_order - b.sort_order);

  const plan: Array<{ asset_type: string; source_ref: string; scene_no: number; file_url: string }> = [];
  let imgIdx = 0;

  for (const scene of sceneCards) {
    const vi = (scene.visual_instruction || "").toLowerCase();
    const isHookOrDemo = scene.scene_no <= 2 || vi.includes("demo") || vi.includes("sử dụng") || vi.includes("unbox");

    // Prefer video for hook/demo scenes if available
    if (isHookOrDemo && videos.length > 0) {
      const video = videos[0]; // Use first video for key scenes
      plan.push({
        asset_type: "video",
        source_ref: video.file_name,
        scene_no: scene.scene_no,
        file_url: video.file_url,
      });
    } else if (images.length > 0) {
      const img = images[imgIdx % images.length];
      plan.push({
        asset_type: "image",
        source_ref: img.file_name,
        scene_no: scene.scene_no,
        file_url: img.file_url,
      });
      imgIdx++;
    } else if (videos.length > 0) {
      // Only videos available
      plan.push({
        asset_type: "video",
        source_ref: videos[0].file_name,
        scene_no: scene.scene_no,
        file_url: videos[0].file_url,
      });
    } else {
      plan.push({ asset_type: "image", source_ref: "placeholder", scene_no: scene.scene_no, file_url: "" });
    }
  }

  return plan;
}

/**
 * Build overlay_list from scene_cards, enforcing:
 * - Max 7 words per overlay text
 * - Proper style assignment
 * - No overlaps in safe areas
 */
function buildOverlayList(
  sceneCards: Array<{ scene_no: number; duration_sec: number; overlay_text: string }>,
  ctaText: string,
  totalDuration: number
): Array<{ start_sec: number; end_sec: number; text: string; style: string }> {
  const overlays: Array<{ start_sec: number; end_sec: number; text: string; style: string }> = [];
  let currentSec = 0;

  for (const scene of sceneCards) {
    const text = (scene.overlay_text || "").trim();
    if (!text) {
      currentSec += scene.duration_sec;
      continue;
    }

    // Truncate to MAX_OVERLAY_WORDS
    const words = text.split(/\s+/);
    const truncated = words.length > MAX_OVERLAY_WORDS ? words.slice(0, MAX_OVERLAY_WORDS).join(" ") + "…" : text;

    // Determine style based on content heuristics
    let style = "headline";
    const lower = truncated.toLowerCase();
    if (lower.includes("₫") || lower.includes("k ") || lower.includes("giá") || lower.includes("đồng")) {
      style = "price";
    } else if (lower.includes("free") || lower.includes("sale") || lower.includes("giảm") || lower.includes("khuyến")) {
      style = "badge";
    } else if (scene.scene_no === sceneCards.length) {
      style = "cta";
    }

    overlays.push({
      start_sec: currentSec,
      end_sec: currentSec + scene.duration_sec,
      text: truncated,
      style,
    });

    currentSec += scene.duration_sec;
  }

  // Add CTA card overlay at the end
  if (ctaText && ctaText.trim()) {
    const ctaStart = Math.max(0, totalDuration - 4);
    overlays.push({
      start_sec: ctaStart,
      end_sec: totalDuration,
      text: ctaText.trim(),
      style: "cta",
    });
  }

  return overlays;
}

/**
 * Reduce overlay density to avoid readability issues.
 * Rules:
 * - Max MAX_CONCURRENT_OVERLAYS visible at any time
 * - When overlapping, keep higher-priority styles
 * - Preserve CTA overlay always
 */
function reduceOverlayDensity(
  overlays: Array<{ start_sec: number; end_sec: number; text: string; style: string }>
): Array<{ start_sec: number; end_sec: number; text: string; style: string }> {
  if (overlays.length <= MAX_CONCURRENT_OVERLAYS) return overlays;

  // Sort by priority (higher = keep)
  const sorted = [...overlays].sort((a, b) => {
    const pa = OVERLAY_PRIORITY[a.style] || 0;
    const pb = OVERLAY_PRIORITY[b.style] || 0;
    return pb - pa;
  });

  const kept: typeof overlays = [];

  for (const overlay of sorted) {
    // Count how many kept overlays are concurrent with this one
    const concurrent = kept.filter(
      (k) => k.start_sec < overlay.end_sec && k.end_sec > overlay.start_sec
    ).length;

    if (concurrent < MAX_CONCURRENT_OVERLAYS) {
      kept.push(overlay);
    }
    // else: drop this overlay to reduce density
  }

  // Re-sort by start_sec for output
  kept.sort((a, b) => a.start_sec - b.start_sec);
  return kept;
}

/**
 * Build subtitle_text from scene voice lines.
 */
function buildSubtitleText(sceneCards: Array<{ voice_line: string }>): string {
  return sceneCards
    .map((s) => (s.voice_line || "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Derive music hint from package type, category, and template intent.
 */
function buildMusicHint(packageType: string, category: string, templateIntent?: string): string {
  const hints: Record<string, Record<string, string>> = {
    quick_ads: {
      beauty: "Upbeat lo-fi pop, feminine energy, 100-110 BPM",
      fashion: "Trendy trap-pop beat, confident vibe, 105-115 BPM",
      home: "Clean acoustic pop, cozy feel, 95-105 BPM",
      other: "Energetic pop beat, positive mood, 100-110 BPM",
    },
    review_video: {
      beauty: "Soft acoustic guitar, warm and genuine, 85-95 BPM",
      fashion: "Chill lo-fi beat, casual conversation feel, 90-100 BPM",
      home: "Light piano + ambient, homey and calm, 80-90 BPM",
      other: "Gentle background beat, authentic feel, 85-95 BPM",
    },
    conversion_video: {
      beauty: "Building pop beat, starts soft then energetic, 105-115 BPM",
      fashion: "Dynamic beat with bass, urgency without aggression, 110-120 BPM",
      home: "Modern pop with subtle urgency, 100-110 BPM",
      other: "Driving beat, builds toward CTA moment, 105-115 BPM",
    },
  };

  const cat = (category || "other").toLowerCase();
  const pkgHints = hints[packageType] || hints.quick_ads;
  return pkgHints[cat] || pkgHints.other;
}

/**
 * Main Visual Pack Builder.
 * Converts script output + real assets into a complete VisualPack.
 */
function buildVisualPack(
  script: ScriptOutput,
  assets: AssetRecord[],
  packageType: string,
  category: string,
  templateIntent?: string
): VisualPackOutput {
  // 1. Map real assets to scenes
  const assetPlan = mapAssetsToScenes(script.scene_cards, assets);

  // 2. Build subtitle text from voice lines
  const subtitleText = script.subtitle_text || buildSubtitleText(script.scene_cards);

  // 3. Build overlay list from scene cards (replaces AI-generated one for consistency)
  let overlayList = buildOverlayList(script.scene_cards, script.cta, script.duration_sec);

  // 4. Reduce overlay density for readability
  overlayList = reduceOverlayDensity(overlayList);

  // 5. Build CTA card
  const ctaCard = script.cta
    ? {
        text: script.cta,
        style: "cta",
        start_sec: Math.max(0, script.duration_sec - 4),
        end_sec: script.duration_sec,
      }
    : null;

  // 6. Music hint
  const musicHint = buildMusicHint(packageType, category, templateIntent);

  return {
    render_mode: "draft_local",
    aspect_ratio: "9:16",
    subtitle_text: subtitleText,
    overlay_list: overlayList,
    asset_plan: assetPlan,
    music_hint: musicHint,
    cta_card: ctaCard,
  };
}

// ==================== MAIN ====================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("UNAUTHORIZED");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("UNAUTHORIZED");

    const { project_id, trace_id } = await req.json();
    if (!project_id) throw new Error("MISSING_PROJECT_ID");
    const traceId = trace_id || crypto.randomUUID();

    // Fetch project
    const { data: project, error: projErr } = await supabase
      .from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single();
    if (projErr || !project) throw new Error("PROJECT_NOT_FOUND");

    // Policy enforcement
    const { data: localOnlySetting } = await supabase.from("system_settings").select("value").eq("key", "LOCAL_ONLY_MODE").single();
    const { data: externalAiSetting } = await supabase.from("system_settings").select("value").eq("key", "ALLOW_EXTERNAL_AI_APIS").single();
    const localOnlyMode = localOnlySetting?.value === true || localOnlySetting?.value === "true";
    const allowExternalAi = externalAiSetting?.value === true || externalAiSetting?.value === "true";

    if (localOnlyMode || !allowExternalAi) {
      return new Response(
        JSON.stringify({ error: "AI_BLOCKED", message: "Chế độ local-only đang bật hoặc external AI chưa được cho phép." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch intel
    const { data: intel, error: intelErr } = await supabase
      .from("product_intelligence").select("*").eq("project_id", project_id).single();
    if (intelErr || !intel || !intel.product_name) throw new Error("INTEL_NOT_FOUND");

    // Fetch selected concept
    const { data: concept, error: conceptErr } = await supabase
      .from("concepts").select("*").eq("project_id", project_id).eq("is_selected", true).single();
    if (conceptErr || !concept) throw new Error("NO_CONCEPT_SELECTED");

    // Fetch assets (full records for Visual Pack Builder)
    const { data: assetsRaw } = await supabase
      .from("project_assets").select("id, file_url, file_name, asset_type, sort_order").eq("project_id", project_id).order("sort_order");
    const assetRecords: AssetRecord[] = (assetsRaw || []).map((a: any) => ({
      id: a.id, file_url: a.file_url, file_name: a.file_name, asset_type: a.asset_type, sort_order: a.sort_order,
    }));
    const assetSummary = assetRecords.length
      ? assetRecords.map((a) => `${a.asset_type}: ${a.file_name}`).join(", ")
      : "Product images";

    let normalized: ScriptOutput;
    let rawText: string;

    // ========== QUICK ADS ENGINE ==========
    if (project.package_type === "quick_ads") {
      const template = selectQuickAdsTemplate(intel, concept);
      console.log(`[${traceId}] Quick Ads engine: selected template ${template.id} (${template.name})`);

      const result = await runQuickAdsEngine(intel, concept, template, assetSummary, traceId);

      if (!result.script) {
        // Persist raw for debugging
        await supabase.from("scripts").delete().eq("project_id", project_id);
        await supabase.from("scripts").insert({
          project_id,
          package_type: project.package_type,
          duration_sec: 0,
          script_text: null,
          scene_cards: { raw_text: result.rawText, errors: result.errors, template_id: template.id },
          cta: null,
        });

        // Log usage even on failure
        await supabase.from("usage_logs").insert({
          user_id: user.id, project_id, step_name: "script_composer",
          trace_id: traceId, credits_used: 2,
          meta: { valid: false, package_type: "quick_ads", template_id: template.id },
        });

        return new Response(
          JSON.stringify({ error: "SCRIPT_VALIDATION_FAILED", details: result.errors, trace_id: traceId, retryable: true }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      normalized = result.script;
      rawText = result.rawText;

    // ========== REVIEW VIDEO ENGINE ==========
    } else if (project.package_type === "review_video") {
      const template = selectReviewTemplate(intel, concept);
      const persona = selectPersona(template, intel);
      console.log(`[${traceId}] Review Video engine: template ${template.id} (${template.name}), persona ${persona}`);

      const result = await runReviewVideoEngine(intel, concept, template, persona, assetSummary, traceId);

      if (!result.script) {
        await supabase.from("scripts").delete().eq("project_id", project_id);
        await supabase.from("scripts").insert({
          project_id,
          package_type: project.package_type,
          duration_sec: 0,
          script_text: null,
          scene_cards: { raw_text: result.rawText, errors: result.errors, template_id: template.id, persona },
          cta: null,
        });
        await supabase.from("usage_logs").insert({
          user_id: user.id, project_id, step_name: "script_composer",
          trace_id: traceId, credits_used: 2,
          meta: { valid: false, package_type: "review_video", ...result.meta },
        });

        return new Response(
          JSON.stringify({ error: "SCRIPT_VALIDATION_FAILED", details: result.errors, trace_id: traceId, retryable: true }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      normalized = result.script;
      rawText = result.rawText;

    // ========== CONVERSION VIDEO ENGINE ==========
    } else {
      const template = selectConversionTemplate(intel, concept);
      console.log(`[${traceId}] Conversion Video engine: template ${template.id} (${template.name})`);

      const result = await runConversionVideoEngine(intel, concept, template, assetSummary, traceId);

      if (!result.script) {
        await supabase.from("scripts").delete().eq("project_id", project_id);
        await supabase.from("scripts").insert({
          project_id,
          package_type: project.package_type,
          duration_sec: 0,
          script_text: null,
          scene_cards: { raw_text: result.rawText, errors: result.errors, template_id: template.id },
          cta: null,
        });
        await supabase.from("usage_logs").insert({
          user_id: user.id, project_id, step_name: "script_composer",
          trace_id: traceId, credits_used: 2,
          meta: { valid: false, package_type: "conversion_video", ...result.meta },
        });

        return new Response(
          JSON.stringify({ error: "SCRIPT_VALIDATION_FAILED", details: result.errors, trace_id: traceId, retryable: true }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      normalized = result.script;
      rawText = result.rawText;
    }

    // ========== PERSIST ==========
    // Log usage
    await supabase.from("usage_logs").insert({
      user_id: user.id, project_id, step_name: "script_composer",
      trace_id: traceId, credits_used: 2,
      meta: { valid: true, package_type: project.package_type, template_id: normalized.template_id },
    });

    // Persist script
    await supabase.from("scripts").delete().eq("project_id", project_id);
    const { error: scriptErr } = await supabase.from("scripts").insert({
      project_id,
      package_type: project.package_type,
      duration_sec: normalized.duration_sec,
      script_text: normalized.script_text,
      scene_cards: normalized.scene_cards,
      cta: normalized.cta,
    });
    if (scriptErr) {
      console.error("Script insert error:", scriptErr);
      throw new Error("PERSIST_FAILED");
    }

    // ========== VISUAL PACK BUILDER ==========
    console.log(`[${traceId}] Building visual pack with ${assetRecords.length} real assets`);
    const visualPack = buildVisualPack(
      normalized,
      assetRecords,
      project.package_type,
      intel.category || "other"
    );

    // Persist visual pack
    await supabase.from("visual_packs").delete().eq("project_id", project_id);
    const { error: vpErr } = await supabase.from("visual_packs").insert({
      project_id,
      render_mode: visualPack.render_mode,
      aspect_ratio: visualPack.aspect_ratio,
      subtitle_text: visualPack.subtitle_text,
      overlay_list: visualPack.overlay_list,
      asset_plan: visualPack.asset_plan,
      music_hint: visualPack.music_hint,
    });
    if (vpErr) console.error("Visual pack insert error:", vpErr);

    // Persist captions
    await supabase.from("caption_exports").delete().eq("project_id", project_id);
    await supabase.from("caption_exports").insert({
      project_id,
      caption_tiktok: normalized.caption_tiktok,
      caption_reels: normalized.caption_reels,
      hashtags: normalized.hashtags,
      thumbnail_text: normalized.thumbnail_text,
      short_description: normalized.script_text.slice(0, 200),
    });

    // Update project status
    await supabase.from("projects").update({ status: "script_ready" }).eq("id", project_id);

    console.log(`[${traceId}] Script + Visual Pack completed for project ${project_id} (${visualPack.asset_plan.length} scenes mapped, ${visualPack.overlay_list.length} overlays, music: "${visualPack.music_hint.slice(0, 40)}...")`);

    return new Response(
      JSON.stringify({ script: normalized, visual_pack: visualPack, trace_id: traceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("script-composer error:", e);
    const status = e.message === "UNAUTHORIZED" ? 401
      : e.message === "RATE_LIMITED" ? 429
      : e.message === "PAYMENT_REQUIRED" ? 402
      : e.message === "NO_CONCEPT_SELECTED" ? 400
      : e.message === "INTEL_NOT_FOUND" ? 400
      : 500;
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
