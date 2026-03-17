import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- validation ----------

interface SettingsPayload {
  [key: string]: any;
}

function validateSettingsContradictions(merged: SettingsPayload): string[] {
  const errors: string[] = [];

  // Core contradictions
  if (merged.LOCAL_ONLY_MODE === true && merged.ALLOW_EXTERNAL_AI_APIS === true) {
    errors.push("LOCAL_ONLY_MODE=true requires ALLOW_EXTERNAL_AI_APIS=false");
  }
  if (merged.LOCAL_ONLY_MODE === true && merged.PREMIUM_RENDER_ENABLED === true) {
    errors.push("LOCAL_ONLY_MODE=true requires PREMIUM_RENDER_ENABLED=false");
  }
  if (merged.LOCAL_ONLY_MODE === true && merged.CLOUD_FALLBACK_ENABLED === true) {
    errors.push("LOCAL_ONLY_MODE=true requires CLOUD_FALLBACK_ENABLED=false");
  }
  if (merged.CLOUD_FALLBACK_ENABLED === true && !merged.LOCAL_LLM_URL) {
    errors.push("CLOUD_FALLBACK_ENABLED=true requires LOCAL_LLM_URL to be set");
  }

  // Extended contradictions (Addendum §6.3)
  if (merged.AI_JSON_REPAIR_ENABLED === false) {
    errors.push("AI_JSON_REPAIR_ENABLED=false degrades AI pipeline resilience");
  }
  if (merged.PROMPT_VERSION_PINNING === false) {
    errors.push("PROMPT_VERSION_PINNING=false may cause prompt drift on rollout");
  }

  return errors;
}

// Auto-fix contradictions when enabling LOCAL_ONLY_MODE
function autoFixContradictions(updates: SettingsPayload): SettingsPayload {
  const fixed = { ...updates };
  if (fixed.LOCAL_ONLY_MODE === true) {
    fixed.ALLOW_EXTERNAL_AI_APIS = false;
    fixed.PREMIUM_RENDER_ENABLED = false;
    fixed.CLOUD_FALLBACK_ENABLED = false;
  }
  return fixed;
}

// ---------- structured logging ----------

function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), fn: "admin-settings", level, msg: message, ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ---------- main ----------

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

    // Verify admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();
    if (!roleData) throw new Error("FORBIDDEN");

    const body = await req.json();
    const action: string = body.action;

    // ===== ACTION: update_settings =====
    if (action === "update_settings") {
      const updates: SettingsPayload = body.updates;
      if (!updates || typeof updates !== "object") throw new Error("INVALID_PAYLOAD");

      // Read current settings
      const { data: currentRows } = await supabase
        .from("system_settings")
        .select("key, value");
      
      const current: SettingsPayload = {};
      for (const row of currentRows || []) {
        current[row.key] = row.value;
      }

      // Auto-fix and merge
      const fixedUpdates = autoFixContradictions(updates);
      const merged = { ...current, ...fixedUpdates };

      // Validate
      const validationErrors = validateSettingsContradictions(merged);
      if (validationErrors.length > 0) {
        return new Response(
          JSON.stringify({ error: "VALIDATION_FAILED", details: validationErrors }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert settings
      const upserts = Object.entries(fixedUpdates).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }));

      const { error: upsertErr } = await supabase
        .from("system_settings")
        .upsert(upserts, { onConflict: "key" });
      if (upsertErr) throw new Error("PERSIST_FAILED");

      // Create audit log for each changed setting
      const auditEntries = Object.entries(fixedUpdates)
        .filter(([key, value]) => current[key] !== value)
        .map(([key, value]) => ({
          actor_user_id: user.id,
          action: "setting_changed",
          target_type: "system_setting",
          target_key: key,
          old_value: { value: current[key] ?? null },
          new_value: { value },
        }));

      if (auditEntries.length > 0) {
        await supabase.from("admin_audit_logs").insert(auditEntries);
      }

      log("info", `Settings updated by ${user.id}`, { keys: Object.keys(fixedUpdates) });

      return new Response(
        JSON.stringify({ success: true, applied: fixedUpdates, auto_fixed: Object.keys(fixedUpdates).length > Object.keys(updates).length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== ACTION: health_check =====
    if (action === "health_check") {
      const serviceUrl: string = body.service_url;
      const serviceName: string = body.service_name;

      if (!serviceUrl || !serviceName) throw new Error("MISSING_PARAMS");

      let status = "unreachable";
      let responseTimeMs = 0;
      let meta: any = {};

      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(serviceUrl, { 
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        responseTimeMs = Date.now() - start;
        status = resp.ok ? "healthy" : `error_${resp.status}`;
        meta = { status_code: resp.status };
      } catch (e: any) {
        status = "unreachable";
        meta = { error: e.message };
      }

      // Log health check
      await supabase.from("service_health_logs").insert({
        service_name: serviceName,
        service_url: serviceUrl,
        status,
        response_time_ms: responseTimeMs,
        meta,
      });

      // Audit log
      await supabase.from("admin_audit_logs").insert({
        actor_user_id: user.id,
        action: "health_check",
        target_type: "service",
        target_key: serviceName,
        new_value: { status, response_time_ms: responseTimeMs },
      });

      return new Response(
        JSON.stringify({ status, response_time_ms: responseTimeMs, meta }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== ACTION: get_failed_jobs =====
    if (action === "get_failed_jobs") {
      const limit = body.limit || 50;

      const { data: failedRenders } = await supabase
        .from("renders")
        .select("*, projects(title, package_type)")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(limit);

      return new Response(
        JSON.stringify({ jobs: failedRenders ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== ACTION: get_usage_stats =====
    if (action === "get_usage_stats") {
      const { data: usageLogs } = await supabase
        .from("usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      // Aggregate by step_name with failures + avg latency
      const stepStats: Record<string, {
        count: number;
        credits: number;
        failures: number;
        total_latency_ms: number;
        latency_samples: number;
      }> = {};

      for (const entry of usageLogs || []) {
        const step = entry.step_name;
        if (!stepStats[step]) {
          stepStats[step] = { count: 0, credits: 0, failures: 0, total_latency_ms: 0, latency_samples: 0 };
        }
        stepStats[step].count++;
        stepStats[step].credits += entry.credits_used || 0;

        // Count failures
        if (step.endsWith("_failed") || step.endsWith("_error")) {
          stepStats[step].failures++;
        }

        // Aggregate latency from meta
        const meta = entry.meta as any;
        if (meta?.latency_ms && typeof meta.latency_ms === "number") {
          stepStats[step].total_latency_ms += meta.latency_ms;
          stepStats[step].latency_samples++;
        }
      }

      // Compute avg latency
      const stats: Record<string, {
        count: number;
        credits: number;
        failures: number;
        avg_latency_ms: number | null;
      }> = {};

      for (const [step, s] of Object.entries(stepStats)) {
        stats[step] = {
          count: s.count,
          credits: s.credits,
          failures: s.failures,
          avg_latency_ms: s.latency_samples > 0 ? Math.round(s.total_latency_ms / s.latency_samples) : null,
        };
      }

      // Also get render failure rate
      const { data: renderCounts } = await supabase
        .from("renders")
        .select("status");

      const renderSummary = {
        total: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        processing: 0,
        cancelled: 0,
      };
      for (const r of renderCounts || []) {
        renderSummary.total++;
        const s = r.status as keyof typeof renderSummary;
        if (s in renderSummary) renderSummary[s]++;
      }

      return new Response(
        JSON.stringify({ stats, render_summary: renderSummary, total_logs: (usageLogs || []).length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("UNKNOWN_ACTION");
  } catch (e: any) {
    log("error", "admin-settings unhandled error", { error: e.message });
    const status = e.message === "UNAUTHORIZED" ? 401
      : e.message === "FORBIDDEN" ? 403
      : 500;
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
