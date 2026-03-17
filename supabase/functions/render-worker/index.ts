import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- types ----------

type RenderMode = "draft_local" | "draft_local_tts" | "premium_cloud";
type RenderAction = "create" | "update_status" | "complete" | "fail";

const RENDER_CREDIT_COST: Record<string, number> = {
  draft_local: 1,
  draft_local_tts: 2,
  premium_cloud: 5,
};

// ---------- structured logging ----------

function log(traceId: string, level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    trace_id: traceId,
    fn: "render-worker",
    level,
    msg: message,
    ...meta,
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ---------- settings helpers ----------

async function getSetting(supabase: any, key: string): Promise<any> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value;
}

async function getUserBalance(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from("credit_ledger")
    .select("balance_after")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.balance_after ?? 0;
}

/**
 * Idempotent credit deduction — checks if credits were already deducted
 * for this specific render_id to prevent double-charging.
 */
async function deductCreditsIdempotent(
  supabase: any,
  userId: string,
  projectId: string,
  renderId: string,
  cost: number,
  traceId: string,
): Promise<{ alreadyDeducted: boolean; error: string | null }> {
  // Check if credits were already deducted for this render
  const { data: existing } = await supabase
    .from("credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", `render_${renderId}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    log(traceId, "warn", "Credits already deducted for this render", { render_id: renderId });
    return { alreadyDeducted: true, error: null };
  }

  const currentBalance = await getUserBalance(supabase, userId);
  if (currentBalance < cost) {
    log(traceId, "error", "Insufficient credits at deduction time", {
      render_id: renderId, balance: currentBalance, cost,
    });
    return { alreadyDeducted: false, error: `Không đủ credit. Cần ${cost}, còn ${currentBalance}.` };
  }

  const { error } = await supabase.from("credit_ledger").insert({
    user_id: userId,
    project_id: projectId,
    delta: -cost,
    balance_after: currentBalance - cost,
    reason: `render_${renderId}`,
  });

  if (error) {
    log(traceId, "error", "Credit deduction insert failed", { render_id: renderId, error: error.message });
    return { alreadyDeducted: false, error: error.message };
  }

  log(traceId, "info", "Credits deducted", { render_id: renderId, cost, new_balance: currentBalance - cost });
  return { alreadyDeducted: false, error: null };
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

    const body = await req.json();
    const action: RenderAction = body.action;
    const projectId: string = body.project_id;
    const traceId: string = body.trace_id || crypto.randomUUID();

    if (!projectId) throw new Error("MISSING_PROJECT_ID");
    if (!action) throw new Error("MISSING_ACTION");

    // ===== ACTION: create =====
    if (action === "create") {
      const renderMode: RenderMode = body.render_mode || "draft_local";
      const creditCost = RENDER_CREDIT_COST[renderMode] ?? 1;

      // --- Policy enforcement ---
      const localOnlyMode = await getSetting(supabase, "LOCAL_ONLY_MODE");
      const premiumEnabled = await getSetting(supabase, "PREMIUM_RENDER_ENABLED");

      if (renderMode === "premium_cloud") {
        if (localOnlyMode === true || localOnlyMode === "true") {
          log(traceId, "warn", "Cloud render blocked by LOCAL_ONLY_MODE", { user_id: user.id });
          return new Response(
            JSON.stringify({ error: "CLOUD_BLOCKED", message: "Chế độ local-only đang bật. Không thể dùng premium cloud." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (premiumEnabled === false || premiumEnabled === "false") {
          log(traceId, "warn", "Premium render disabled", { user_id: user.id });
          return new Response(
            JSON.stringify({ error: "PREMIUM_DISABLED", message: "Premium render chưa được bật bởi admin." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // --- Credit balance check ---
      const balance = await getUserBalance(supabase, user.id);
      if (balance < creditCost) {
        log(traceId, "warn", "Insufficient credits for render", { user_id: user.id, balance, cost: creditCost });
        return new Response(
          JSON.stringify({ error: "INSUFFICIENT_CREDITS", message: `Cần ${creditCost} credit, bạn còn ${balance}.` }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify project belongs to user and has script_ready status
      const { data: project, error: projErr } = await supabase
        .from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single();
      if (projErr || !project) throw new Error("PROJECT_NOT_FOUND");

      if (!["script_ready", "completed", "failed"].includes(project.status)) {
        return new Response(
          JSON.stringify({ error: "INVALID_STATUS", message: `Dự án đang ở trạng thái '${project.status}', cần 'script_ready' để render.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify script exists
      const { data: script } = await supabase
        .from("scripts").select("id").eq("project_id", projectId).single();
      if (!script) throw new Error("SCRIPT_NOT_FOUND");

      // Verify visual pack exists
      const { data: vp } = await supabase
        .from("visual_packs").select("id").eq("project_id", projectId).single();
      if (!vp) throw new Error("VISUAL_PACK_NOT_FOUND");

      // Cancel any existing queued/processing renders for this project
      await supabase
        .from("renders")
        .update({ status: "cancelled", error_message: "Superseded by new render request" })
        .eq("project_id", projectId)
        .in("status", ["queued", "processing"]);

      // Create render job
      const { data: render, error: renderErr } = await supabase
        .from("renders")
        .insert({
          project_id: projectId,
          render_mode: renderMode,
          status: "queued",
          provider: renderMode === "premium_cloud" ? "cloud" : "local_browser",
        })
        .select()
        .single();

      if (renderErr) {
        log(traceId, "error", "Render insert failed", { error: renderErr.message });
        throw new Error("PERSIST_FAILED");
      }

      // Update project status
      await supabase.from("projects").update({ status: "render_queued" }).eq("id", projectId);

      // Log usage (observability only — no credit deduction here)
      const latencyMs = Date.now() - startMs;
      await supabase.from("usage_logs").insert({
        user_id: user.id,
        project_id: projectId,
        step_name: "render_create",
        trace_id: traceId,
        credits_used: 0, // Credits deducted only on completion
        meta: { render_id: render.id, render_mode: renderMode, expected_cost: creditCost, latency_ms: latencyMs },
      });

      log(traceId, "info", "Render job created", { render_id: render.id, mode: renderMode, cost: creditCost, latency_ms: latencyMs });

      return new Response(
        JSON.stringify({ render, trace_id: traceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== ACTION: update_status =====
    if (action === "update_status") {
      const renderId: string = body.render_id;
      const newStatus: string = body.status;

      if (!renderId || !newStatus) throw new Error("MISSING_PARAMS");

      const validTransitions: Record<string, string[]> = {
        queued: ["processing", "cancelled", "failed"],
        processing: ["completed", "failed", "cancelled"],
      };

      // Fetch current render
      const { data: render, error: fetchErr } = await supabase
        .from("renders").select("*").eq("id", renderId).single();
      if (fetchErr || !render) throw new Error("RENDER_NOT_FOUND");

      // Verify project ownership
      const { data: project } = await supabase
        .from("projects").select("user_id").eq("id", render.project_id).single();
      if (!project || project.user_id !== user.id) throw new Error("UNAUTHORIZED");

      const allowed = validTransitions[render.status] || [];
      if (!allowed.includes(newStatus)) {
        log(traceId, "warn", "Invalid status transition", { render_id: renderId, from: render.status, to: newStatus });
        return new Response(
          JSON.stringify({ error: "INVALID_TRANSITION", message: `Cannot go from '${render.status}' to '${newStatus}'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatePayload: any = { status: newStatus };
      if (newStatus === "failed") {
        updatePayload.error_code = body.error_code || "RENDER_FAILED";
        updatePayload.error_message = body.error_message || "Render thất bại";
        updatePayload.last_fail_reason = body.last_fail_reason || null;
      }
      if (newStatus === "completed") {
        updatePayload.output_url = body.output_url || null;
        updatePayload.duration_ms = body.duration_ms || null;
      }

      await supabase.from("renders").update(updatePayload).eq("id", renderId);

      // Update project status based on render outcome
      if (newStatus === "processing") {
        await supabase.from("projects").update({ status: "rendering" }).eq("id", render.project_id);
      } else if (newStatus === "completed") {
        await supabase.from("projects").update({ status: "completed" }).eq("id", render.project_id);

        // --- IDEMPOTENT credit deduction on successful completion ---
        const creditCost = RENDER_CREDIT_COST[render.render_mode] ?? 1;
        const { alreadyDeducted, error: deductError } = await deductCreditsIdempotent(
          supabase, user.id, render.project_id, renderId, creditCost, traceId,
        );

        if (deductError) {
          log(traceId, "error", "Credit deduction failed after render completed", { render_id: renderId, error: deductError });
        }

        // Log completion with latency
        const latencyMs = Date.now() - startMs;
        await supabase.from("usage_logs").insert({
          user_id: user.id,
          project_id: render.project_id,
          step_name: "render_complete",
          trace_id: traceId,
          credits_used: alreadyDeducted ? 0 : creditCost,
          meta: {
            render_id: renderId,
            render_mode: render.render_mode,
            duration_ms: body.duration_ms,
            latency_ms: latencyMs,
            already_deducted: alreadyDeducted,
          },
        });
      } else if (newStatus === "failed") {
        // Check CLOUD_FALLBACK_ENABLED
        const fallbackEnabled = await getSetting(supabase, "CLOUD_FALLBACK_ENABLED");
        const localOnly = await getSetting(supabase, "LOCAL_ONLY_MODE");

        if (render.render_mode === "draft_local" && fallbackEnabled === true && localOnly !== true) {
          log(traceId, "info", "Local render failed. Cloud fallback available but not implemented yet.", { render_id: renderId });
        }
        // Keep project at script_ready so user can retry
        await supabase.from("projects").update({ status: "script_ready" }).eq("id", render.project_id);

        // Log failure with details
        await supabase.from("usage_logs").insert({
          user_id: user.id,
          project_id: render.project_id,
          step_name: "render_failed",
          trace_id: traceId,
          credits_used: 0,
          meta: {
            render_id: renderId,
            render_mode: render.render_mode,
            error_code: body.error_code,
            error_message: body.error_message,
            latency_ms: Date.now() - startMs,
          },
        });
      }

      log(traceId, "info", `Render status updated`, { render_id: renderId, from: render.status, to: newStatus });

      return new Response(
        JSON.stringify({ success: true, trace_id: traceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("UNKNOWN_ACTION");
  } catch (e: any) {
    const traceId = "unknown";
    log(traceId, "error", "render-worker unhandled error", { error: e.message });
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
