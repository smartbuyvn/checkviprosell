import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { getVerifiedUserId } from '../lib/auth';
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey); // Admin privileges

export async function adminRoutes(fastify: FastifyInstance) {

  // Role Enforcement Middleware
  fastify.addHook('preHandler', async (request, reply) => {
    // Token phải được Supabase Auth xác minh chữ ký; không tự giải mã payload
    const userId = await getVerifiedUserId(request.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'Unauthorized. Invalid or expired token.' });

    const { data: adminRows, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .limit(1);
    if (error) {
       fastify.log.error(`[Admin] Role lookup failed for ${userId}: ${error.message}`);
       return reply.code(500).send({ error: 'Role lookup failed' });
    }
    if (!adminRows || adminRows.length === 0) {
       return reply.code(403).send({ error: 'Forbidden. Admin role required.' });
    }
    (request as any).user = { id: userId, role: 'admin' };
  });

  // 1. Health Checks (DB, LLM, Render Worker)
  fastify.get('/health', async (request, reply) => {
    try {
      const { data, error } = await supabase.from('system_settings').select('id').limit(1);
      const dbStatus = error ? 'down' : 'up';
      
      const { data: llmSetting } = await supabase.from('system_settings').select('value').eq('key', 'LOCALLLMURL').single();
      let llmStatus = 'unknown';
      if (llmSetting?.value) {
         try {
           const c1 = new AbortController();
           setTimeout(() => c1.abort(), 2000);
           const llmResp = await fetch(`${llmSetting.value}/models`, { method: 'GET', signal: c1.signal }).catch(() => null);
           llmStatus = llmResp?.ok ? 'up' : 'down';
         } catch {
           llmStatus = 'down';
         }
      }

      const { data: workerSetting } = await supabase.from('system_settings').select('value').eq('key', 'LOCALRENDERWORKERURL').single();
      let workerStatus = 'unknown';
      if (workerSetting?.value) {
         try {
           const c2 = new AbortController();
           setTimeout(() => c2.abort(), 2000);
           const workerResp = await fetch(`${workerSetting.value}/api/v1/health`, { method: 'GET', signal: c2.signal }).catch(() => null);
           workerStatus = workerResp?.ok ? 'up' : 'down';
         } catch {
           workerStatus = 'down';
         }
      }

      return reply.send({
        status: dbStatus === 'up' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus,
          local_llm: llmStatus,
          local_worker: workerStatus,
        },
      });
    } catch (e: any) {
      return reply.code(500).send({ status: 'down', error: e.message });
    }
  });

  // 2. Failed Jobs Log (Render Worker truth)
  fastify.get('/failed-jobs', async (request, reply) => {
    try {
       const { data: failedJobs } = await supabase
         .from('renders')
         .select('id, project_id, render_mode, status, error_code, error_message, duration_ms, updated_at')
         .in('status', ['failed', 'retryable_failed'])
         .order('updated_at', { ascending: false })
         .limit(50);
       
       return reply.send({ failed_jobs: failedJobs || [] });
    } catch (e: any) {
       return reply.code(500).send({ error: e.message });
    }
  });

  // 3. Admin Usage Summary (Counts, Failures, Average Latency)
  fastify.get('/usage-summary', async (request, reply) => {
    try {
       const { count: totalCompletions } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'completed');
       const { count: totalFailures } = await supabase.from('renders').select('*', { count: 'exact', head: true }).in('status', ['failed', 'retryable_failed']);
       const { data: latencies } = await supabase.from('usage_logs').select('meta').not('meta->>latency_ms', 'is', null).limit(100);
       let avgLatency = 0;
       if (latencies && latencies.length > 0) {
          const sum = latencies.reduce((acc, curr) => acc + (curr.meta?.latency_ms || 0), 0);
          avgLatency = Math.round(sum / latencies.length);
       }

       // Credits granted vs deducted for period visibility
       const { data: credits } = await supabase.from('credit_ledger').select('delta').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
       const totalGranted = (credits || []).filter(r => r.delta > 0).reduce((s, r) => s + r.delta, 0);
       const totalDeducted = (credits || []).filter(r => r.delta < 0).reduce((s, r) => s + Math.abs(r.delta), 0);
       
       return reply.send({
          usage_summary: {
             total_completions: totalCompletions || 0,
             total_render_failures: totalFailures || 0,
             average_step_latency_ms: avgLatency,
             credits_7d: { granted: totalGranted, deducted: totalDeducted },
          }
       });
    } catch (e: any) {
       return reply.code(500).send({ error: e.message });
    }
  });

  // 4. Prompt Registry Management
  fastify.get('/prompts', async (request, reply) => {
     const { data, error } = await supabase.from('prompts').select('*').order('name');
     if (error) return reply.code(500).send({ error: error.message });
     return reply.send({ prompts: data });
  });

  fastify.put('/prompts/:id', async (request, reply) => {
     const { id } = request.params as any;
     const { system_prompt, user_prompt_template } = request.body as any;
     const { error } = await supabase.from('prompts')
        .update({ system_prompt, user_prompt_template, updated_at: new Date().toISOString() })
        .eq('id', id);
     if (error) return reply.code(500).send({ error: error.message });
     return reply.send({ success: true });
  });

  // 4. Admin Audit Logs
  fastify.get('/audit-logs', async (request, reply) => {
     try {
       const { data: logs } = await supabase
         .from('usage_logs')
         .select('*')
         .like('step_name', 'admin_%')
         .order('created_at', { ascending: false })
         .limit(100);
       return reply.send({ audit_logs: logs || [] });
     } catch (e: any) {
       return reply.code(500).send({ error: e.message });
     }
  });

  // 5. Settings Validation & Enforcements
  fastify.get('/settings', async (request, reply) => {
     const { data, error } = await supabase.from('system_settings').select('key, value');
     if (error) return reply.code(500).send({ error: error.message });
     return reply.send({ settings: data });
  });

  fastify.put('/settings', async (request, reply) => {
     const updates = request.body as Record<string, string | boolean>;
     
     const { data: current } = await supabase.from('system_settings').select('key, value');
     const currentMap = (current || []).reduce((acc: any, row: any) => {
        acc[row.key] = row.value === 'true' ? true : (row.value === 'false' ? false : row.value);
        return acc;
     }, {});

     const merged = { ...currentMap, ...updates };

     // --- CONTRADICTION VALIDATION ---
     if (String(merged.LOCALONLYMODE) === 'true' && String(merged.PREMIUMRENDERENABLED) === 'true') {
        return reply.code(400).send({ error: 'POLICY_CONTRADICTION', message: 'Không thể bật Premium Render (đòi hỏi Cloud pipeline) khi đang ở chế độ Local Only Mode.' });
     }

     if (String(merged.LOCALONLYMODE) === 'true' && String(merged.ALLOWEXTERNALAIAPIS) === 'true') {
        return reply.code(400).send({ error: 'POLICY_CONTRADICTION', message: 'Không thể cho phép External AI API (OAI/Gemini) khi ở chế độ Local Only Mode.' });
     }

     if (String(merged.LOCALONLYMODE) === 'true' && !merged.LOCALLLMURL) {
        return reply.code(400).send({ error: 'POLICY_CONTRADICTION', message: 'Phải cấu hình LOCALLLMURL (vd: cổng 1234) nếu muốn chạy Local AI. Không được để trống.' });
     }

     for (const [k, v] of Object.entries(updates)) {
        await supabase.from('system_settings').update({ value: String(v), updated_at: new Date().toISOString() }).eq('key', k);
     }

     // Insert Audit Log Trace
     const adminId = (request as any).user?.id || 'system';
     await supabase.from('usage_logs').insert({
        user_id: adminId,
        project_id: 'admin_panel',
        step_name: 'admin_settings_change',
        credits_used: 0,
        error_message: `Updated keys: ${Object.keys(updates).join(', ')}`
     });

     return reply.send({ success: true, updatedKeys: Object.keys(updates) });
  });
}
