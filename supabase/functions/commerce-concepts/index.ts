import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- types ----------

interface ConceptOutput {
  angle_type: "pain_first" | "review_trust" | "offer_conversion";
  title: string;
  big_idea: string;
  hook: string;
  cta: string;
  why_it_works: string;
  score: number;
}

const VALID_ANGLES = ["pain_first", "review_trust", "offer_conversion"] as const;

const PACKAGE_STYLE: Record<string, string> = {
  quick_ads: `Package: Quick Ads (15–20s). Style: punchy, fast-paced, 1–2 USPs max, strong visual hook, direct CTA. Think TikTok test-ad energy.`,
  review_video: `Package: Review Video (20–30s). Style: authentic, conversational, bestie/KOC tone, personal experience focus, soft CTA. Think "I tried this and..." storytelling.`,
  conversion_video: `Package: Conversion Video (20–30s). Style: structured persuasion, clear pain→proof→offer→urgency arc, strong CTA with scarcity/social proof. Think infomercial meets TikTok.`,
};

// ---------- prompts (Addendum §12.2) ----------

function buildSystemPrompt(packageType: string) {
  const style = PACKAGE_STYLE[packageType] || PACKAGE_STYLE.quick_ads;
  return `Bạn là Commerce Angle Agent chuyên tạo góc bán cho social commerce Việt Nam.
Dựa vào Product Intelligence, hãy tạo 3 góc bán có khả năng chuyển đổi cao nhất trên short video tại Việt Nam.
Ưu tiên pain rõ, dễ hiểu, dễ quay, dễ chốt đơn.
Mỗi góc phải khác nhau, không trùng ý.

${style}

ANGLE TYPES (must generate exactly these 3):
1. pain_first — Dẫn dắt bằng vấn đề/nỗi đau khách hàng. Cho họ thấy bạn hiểu, rồi đưa sản phẩm làm giải pháp.
2. review_trust — Dẫn dắt bằng trải nghiệm/trust. Xây niềm tin qua chia sẻ thật, rồi gợi mua.
3. offer_conversion — Dẫn dắt bằng offer hấp dẫn. Tạo urgency bằng giá, combo, hoặc số lượng có hạn.

RULES:
- Output ONLY valid JSON array. No markdown, no backticks, no explanation.
- Mỗi hook phải khác nhau cả về từ ngữ VÀ cảm xúc (không chỉ đổi từ).
- Tất cả text bằng tiếng Việt spoken.
- Score 0-100 theo khả năng chuyển đổi cho thị trường Việt Nam.
- CTA phải match tone cảm xúc của angle.
- Ideas phải thực tế cho quy trình sản xuất video từ asset (ảnh + overlay + voice tùy chọn).`;
}

function buildUserPrompt(intel: any, packageType: string) {
  return `Product: ${intel.product_name || "Unknown"}
Category: ${intel.category || "other"}
Target buyer: ${intel.target_buyer || "General"}
Price band: ${intel.price_band || "mid"}
USPs: ${JSON.stringify(intel.usp_list || [])}
Pain points: ${JSON.stringify(intel.pain_points || [])}
Trust signals: ${JSON.stringify(intel.trust_signals || [])}
Objections: ${JSON.stringify(intel.objections || [])}
Package: ${packageType}

Generate 3 concepts as a JSON array:
[
  {
    "angle_type": "pain_first",
    "title": "short Vietnamese title",
    "big_idea": "core strategy in 1 sentence",
    "hook": "opening 3-second hook line",
    "cta": "call to action line",
    "why_it_works": "1 sentence rationale",
    "score": 0-100
  },
  { "angle_type": "review_trust", ... },
  { "angle_type": "offer_conversion", ... }
]`;
}

const REPAIR_PROMPT = `The previous response was invalid. Return ONLY a valid JSON array of exactly 3 objects with angle_type, title, big_idea, hook, cta, why_it_works, score. No text outside the array.`;

// ---------- validation ----------

function validateConcepts(arr: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(arr)) return { valid: false, errors: ["Not an array"] };
  if (arr.length !== 3) errors.push(`Expected 3 concepts, got ${arr.length}`);

  const seenAngles = new Set<string>();
  const hooks = new Set<string>();

  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    if (!c || typeof c !== "object") { errors.push(`Item ${i} not an object`); continue; }
    if (!VALID_ANGLES.includes(c.angle_type)) errors.push(`Item ${i}: invalid angle_type "${c.angle_type}"`);
    if (seenAngles.has(c.angle_type)) errors.push(`Duplicate angle_type: ${c.angle_type}`);
    seenAngles.add(c.angle_type);

    for (const f of ["title", "big_idea", "hook", "cta", "why_it_works"]) {
      if (typeof c[f] !== "string" || !c[f].trim()) errors.push(`Item ${i}: missing ${f}`);
    }
    if (typeof c.score !== "number" || c.score < 0 || c.score > 100) errors.push(`Item ${i}: score must be 0-100`);

    // Duplicate hook check (normalized)
    const normHook = (c.hook || "").toLowerCase().replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ0-9\s]/g, "").trim();
    if (hooks.has(normHook) && normHook.length > 10) errors.push(`Item ${i}: hook too similar to another`);
    hooks.add(normHook);
  }

  // Ensure all 3 angles present
  for (const a of VALID_ANGLES) {
    if (!seenAngles.has(a)) errors.push(`Missing angle: ${a}`);
  }

  return { valid: errors.length === 0, errors };
}

function normalizeConcept(raw: any): ConceptOutput {
  return {
    angle_type: VALID_ANGLES.includes(raw.angle_type) ? raw.angle_type : "pain_first",
    title: String(raw.title || "").slice(0, 200),
    big_idea: String(raw.big_idea || "").slice(0, 500),
    hook: String(raw.hook || "").slice(0, 300),
    cta: String(raw.cta || "").slice(0, 300),
    why_it_works: String(raw.why_it_works || "").slice(0, 500),
    score: typeof raw.score === "number" ? Math.min(100, Math.max(0, Math.round(raw.score))) : 50,
  };
}

// ---------- AI call ----------

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
        temperature: 0.7,
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
  // Find array
  const startBracket = text.indexOf("[");
  const endBracket = text.lastIndexOf("]");
  if (startBracket !== -1 && endBracket > startBracket) {
    try { return JSON.parse(text.slice(startBracket, endBracket + 1)); } catch {}
  }
  // Find object
  const startBrace = text.indexOf("{");
  const endBrace = text.lastIndexOf("}");
  if (startBrace !== -1 && endBrace > startBrace) {
    try { return JSON.parse(text.slice(startBrace, endBrace + 1)); } catch {}
  }
  return null;
}

// ---------- main ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();
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

    // --- Policy enforcement ---
    const { data: localOnlySetting } = await supabase.from("system_settings").select("value").eq("key", "LOCAL_ONLY_MODE").single();
    const { data: externalAiSetting } = await supabase.from("system_settings").select("value").eq("key", "ALLOW_EXTERNAL_AI_APIS").single();
    const localOnlyMode = localOnlySetting?.value === true || localOnlySetting?.value === "true";
    const allowExternalAi = externalAiSetting?.value === true || externalAiSetting?.value === "true";

    if (localOnlyMode || !allowExternalAi) {
      return new Response(
        JSON.stringify({ error: "AI_BLOCKED", message: "Chế độ local-only đang bật hoặc external AI chưa được cho phép. Vui lòng cấu hình LOCAL_LLM_URL và bật ALLOW_EXTERNAL_AI_APIS." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch intel
    const { data: intel, error: intelErr } = await supabase
      .from("product_intelligence").select("*").eq("project_id", project_id).single();
    if (intelErr || !intel || !intel.product_name) throw new Error("INTEL_NOT_FOUND");

    // Build messages
    const messages = [
      { role: "system", content: buildSystemPrompt(project.package_type) },
      { role: "user", content: buildUserPrompt(intel, project.package_type) },
    ];

    // Attempt 1
    console.log(`[${traceId}] Concepts attempt 1 for project ${project_id}`);
    let rawText = await callAI(messages);
    let parsed = extractJSON(rawText);
    // Unwrap if AI returned array inside a wrapper object (e.g. {angles:[...]}, {concepts:[...]})
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      const keys = Object.keys(parsed);
      for (const k of keys) {
        if (Array.isArray(parsed[k])) { parsed = parsed[k]; break; }
      }
    }
    let validation = Array.isArray(parsed) ? validateConcepts(parsed) : { valid: false, errors: ["Not an array"] };

    // Attempt 2
    if (!validation.valid) {
      console.log(`[${traceId}] Attempt 1 failed: ${validation.errors.join(", ")}. Retrying...`);
      const retryMessages = [
        ...messages,
        { role: "assistant", content: rawText },
        { role: "user", content: `${REPAIR_PROMPT}\nErrors: ${validation.errors.join(", ")}` },
      ];
      rawText = await callAI(retryMessages);
      parsed = extractJSON(rawText);
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
        const keys = Object.keys(parsed);
        for (const k of keys) {
          if (Array.isArray(parsed[k])) { parsed = parsed[k]; break; }
        }
      }
      validation = Array.isArray(parsed) ? validateConcepts(parsed) : { valid: false, errors: ["Not an array on retry"] };
    }

    // Log usage (observability only — AI steps don't charge credits)
    await supabase.from("usage_logs").insert({
      user_id: user.id,
      project_id,
      step_name: "commerce_concepts",
      trace_id: traceId,
      credits_used: 0,
      meta: { valid: validation.valid, latency_ms: Date.now() - startMs },
    });

    if (!validation.valid || !Array.isArray(parsed)) {
      // Persist raw_response for debugging (Addendum §7 — observability)
      await supabase.from("concepts").delete().eq("project_id", project_id);
      // Store failed raw output in product_intelligence raw_response for tracing
      await supabase.from("product_intelligence").update({
        raw_response: { concept_attempt_raw: rawText, concept_errors: validation.errors },
      }).eq("project_id", project_id);

      return new Response(
        JSON.stringify({ error: "CONCEPT_VALIDATION_FAILED", details: validation.errors, trace_id: traceId, retryable: true }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize
    const normalized = parsed.map(normalizeConcept);

    // Delete old concepts for this project, then insert new
    await supabase.from("concepts").delete().eq("project_id", project_id);

    const rows = normalized.map((c) => ({
      project_id,
      angle_type: c.angle_type,
      title: c.title,
      big_idea: c.big_idea,
      hook: c.hook,
      cta: c.cta,
      why_it_works: c.why_it_works,
      score: c.score,
      is_selected: false,
    }));

    const { error: insertErr } = await supabase.from("concepts").insert(rows);
    if (insertErr) {
      console.error("Insert concepts error:", insertErr);
      throw new Error("PERSIST_FAILED");
    }

    console.log(`[${traceId}] Concepts generated for project ${project_id}`);

    return new Response(
      JSON.stringify({ concepts: normalized, trace_id: traceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("commerce-concepts error:", e);
    const status = e.message === "UNAUTHORIZED" ? 401
      : e.message === "RATE_LIMITED" ? 429
      : e.message === "PAYMENT_REQUIRED" ? 402
      : e.message === "INTEL_NOT_FOUND" ? 400
      : 500;
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
