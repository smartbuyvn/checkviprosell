import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- prompts ----------

const SYSTEM_PROMPT = `Bạn là Product Intelligence Agent cho social commerce Việt Nam.
Phân tích sản phẩm đầu vào để phục vụ video bán hàng.
Trả về JSON ngắn gọn, thực dụng, không hoa mỹ, không suy diễn quá mức.
Ưu tiên ngôn ngữ người mua Việt Nam.

RULES:
- Output CHỈ valid JSON. Không markdown, không backticks, không giải thích.
- Nếu không chắc, hạ confidence_score.
- Mỗi array phải có ít nhất 1 và tối đa 5 items.
- confidence_score là số 0-100.
- category phải là: beauty, fashion, home, other
- price_band phải là: low, mid, high
- recommended_package_fit items phải từ: quick_ads, review_video, conversion_video`;

function buildUserPrompt(input: {
  source_url?: string;
  manual_notes?: string;
  asset_summary?: string;
  category_hint?: string;
  package_type?: string;
}) {
  const parts: string[] = [];
  parts.push("Analyze this product and return structured JSON.");

  if (input.source_url) parts.push(`Product URL: ${input.source_url}`);
  if (input.manual_notes) parts.push(`Seller notes: ${input.manual_notes}`);
  if (input.asset_summary) parts.push(`Uploaded assets: ${input.asset_summary}`);
  if (input.category_hint) parts.push(`Category hint: ${input.category_hint}`);
  if (input.package_type) parts.push(`Selected package: ${input.package_type}`);

  parts.push(`
Return EXACTLY this JSON schema:
{
  "product_name": "string",
  "category": "beauty|fashion|home|other",
  "target_buyer": "string",
  "price_band": "low|mid|high",
  "usp_list": ["string"],
  "pain_points": ["string"],
  "objections": ["string"],
  "trust_signals": ["string"],
  "use_context": ["string"],
  "recommended_package_fit": ["quick_ads|review_video|conversion_video"],
  "confidence_score": 0-100
}`);

  return parts.join("\n");
}

const REPAIR_PROMPT = `Kết quả trước không đúng JSON schema hoặc thiếu trường bắt buộc. Sửa và trả về CHỈ valid JSON đúng schema. Không thêm text ngoài JSON object.`;

// ---------- validation ----------

const VALID_CATEGORIES = ["beauty", "fashion", "home", "other"];
const VALID_PRICE_BANDS = ["low", "mid", "high"];
const VALID_PACKAGES = ["quick_ads", "review_video", "conversion_video"];

interface IntelResult {
  product_name: string;
  category: string;
  target_buyer: string;
  price_band: string;
  usp_list: string[];
  pain_points: string[];
  objections: string[];
  trust_signals: string[];
  use_context: string[];
  recommended_package_fit: string[];
  confidence_score: number;
}

function validateIntel(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Not an object"] };

  const strFields = ["product_name", "category", "target_buyer", "price_band"];
  for (const f of strFields) {
    if (typeof obj[f] !== "string" || !obj[f]) errors.push(`Missing or invalid: ${f}`);
  }

  if (!VALID_CATEGORIES.includes(obj.category)) errors.push(`Invalid category: ${obj.category}`);
  if (!VALID_PRICE_BANDS.includes(obj.price_band)) errors.push(`Invalid price_band: ${obj.price_band}`);

  const arrFields = ["usp_list", "pain_points", "objections", "trust_signals", "use_context", "recommended_package_fit"];
  for (const f of arrFields) {
    if (!Array.isArray(obj[f]) || obj[f].length === 0) errors.push(`${f} must be non-empty array`);
  }

  if (Array.isArray(obj.recommended_package_fit)) {
    for (const p of obj.recommended_package_fit) {
      if (!VALID_PACKAGES.includes(p)) errors.push(`Invalid package: ${p}`);
    }
  }

  if (typeof obj.confidence_score !== "number" || obj.confidence_score < 0 || obj.confidence_score > 100) {
    errors.push("confidence_score must be 0-100");
  }

  return { valid: errors.length === 0, errors };
}

function normalizeIntel(raw: any): IntelResult {
  return {
    product_name: String(raw.product_name || "Unknown"),
    category: VALID_CATEGORIES.includes(raw.category) ? raw.category : "other",
    target_buyer: String(raw.target_buyer || "General consumer"),
    price_band: VALID_PRICE_BANDS.includes(raw.price_band) ? raw.price_band : "mid",
    usp_list: Array.isArray(raw.usp_list) ? raw.usp_list.map(String).slice(0, 5) : [],
    pain_points: Array.isArray(raw.pain_points) ? raw.pain_points.map(String).slice(0, 5) : [],
    objections: Array.isArray(raw.objections) ? raw.objections.map(String).slice(0, 5) : [],
    trust_signals: Array.isArray(raw.trust_signals) ? raw.trust_signals.map(String).slice(0, 5) : [],
    use_context: Array.isArray(raw.use_context) ? raw.use_context.map(String).slice(0, 5) : [],
    recommended_package_fit: Array.isArray(raw.recommended_package_fit)
      ? raw.recommended_package_fit.filter((p: string) => VALID_PACKAGES.includes(p))
      : ["quick_ads"],
    confidence_score: typeof raw.confidence_score === "number"
      ? Math.min(100, Math.max(0, Math.round(raw.confidence_score)))
      : 50,
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
        temperature: 0.3,
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
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Try extracting from code blocks
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) try { return JSON.parse(match[1].trim()); } catch {}
  // Try finding first { to last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

// ---------- main handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("UNAUTHORIZED");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("UNAUTHORIZED");

    const { project_id, trace_id } = await req.json();
    if (!project_id) throw new Error("MISSING_PROJECT_ID");

    const traceId = trace_id || crypto.randomUUID();

    // Fetch project
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();
    if (projErr || !project) throw new Error("PROJECT_NOT_FOUND");

    // Fetch assets summary
    const { data: assets } = await supabase
      .from("project_assets")
      .select("file_name, asset_type")
      .eq("project_id", project_id);
    const assetSummary = assets?.length
      ? assets.map((a: any) => `${a.asset_type}: ${a.file_name}`).join(", ")
      : undefined;

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

    // Update project status
    await supabase.from("projects").update({ status: "analyzing" }).eq("id", project_id);

    // Build prompts
    const userPrompt = buildUserPrompt({
      source_url: project.source_url,
      manual_notes: project.manual_notes,
      asset_summary: assetSummary,
      category_hint: project.category,
      package_type: project.package_type,
    });

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    // --- Attempt 1 ---
    console.log(`[${traceId}] Intel attempt 1 for project ${project_id}`);
    let rawText = await callAI(messages);
    let parsed = extractJSON(rawText);
    let validation = parsed ? validateIntel(parsed) : { valid: false, errors: ["Failed to parse JSON"] };

    // --- Attempt 2 (retry with repair prompt) ---
    if (!validation.valid) {
      console.log(`[${traceId}] Attempt 1 failed: ${validation.errors.join(", ")}. Retrying...`);
      const retryMessages = [
        ...messages,
        { role: "assistant", content: rawText },
        { role: "user", content: `${REPAIR_PROMPT}\nErrors found: ${validation.errors.join(", ")}` },
      ];
      rawText = await callAI(retryMessages);
      parsed = extractJSON(rawText);
      validation = parsed ? validateIntel(parsed) : { valid: false, errors: ["Failed to parse JSON on retry"] };
    }

    // Log usage (observability only — AI steps don't charge credits)
    await supabase.from("usage_logs").insert({
      user_id: user.id,
      project_id,
      step_name: "product_intel",
      trace_id: traceId,
      credits_used: 0,
      meta: { attempts: validation.valid ? (parsed ? 1 : 2) : 2, valid: validation.valid, latency_ms: Date.now() - startMs },
    });

    // If still invalid after retry → mark failed
    if (!validation.valid || !parsed) {
      await supabase.from("projects").update({ status: "failed" }).eq("id", project_id);

      // Still save raw response for debugging
      await supabase.from("product_intelligence").upsert({
        project_id,
        raw_response: { text: rawText, errors: validation.errors },
        confidence_score: 0,
      }, { onConflict: "project_id" });

      return new Response(
        JSON.stringify({ error: "INTEL_VALIDATION_FAILED", details: validation.errors, trace_id: traceId, retryable: true }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize and persist
    const normalized = normalizeIntel(parsed);

    await supabase.from("product_intelligence").upsert({
      project_id,
      product_name: normalized.product_name,
      category: normalized.category,
      target_buyer: normalized.target_buyer,
      price_band: normalized.price_band,
      usp_list: normalized.usp_list,
      pain_points: normalized.pain_points,
      objections: normalized.objections,
      trust_signals: normalized.trust_signals,
      use_context: normalized.use_context,
      recommended_package_fit: normalized.recommended_package_fit,
      confidence_score: normalized.confidence_score,
      raw_response: { text: rawText, parsed },
    }, { onConflict: "project_id" });

    // Update project status
    await supabase.from("projects").update({ status: "concept_ready" }).eq("id", project_id);

    console.log(`[${traceId}] Intel completed for project ${project_id}, confidence: ${normalized.confidence_score}`);

    return new Response(
      JSON.stringify({ intel: normalized, trace_id: traceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("product-intel error:", e);
    const status = e.message === "UNAUTHORIZED" ? 401
      : e.message === "RATE_LIMITED" ? 429
      : e.message === "PAYMENT_REQUIRED" ? 402
      : 500;
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
