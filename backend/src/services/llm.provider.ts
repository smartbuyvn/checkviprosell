/**
 * Viprosell — Unified LLM Provider (hybrid local-first)
 *
 * Policy (env is the HARD CEILING — admin settings may only restrict further):
 *   - LOCAL_ONLY_MODE=true            → local only, never call external AI
 *   - ALLOW_EXTERNAL_AI_APIS=false    → local only, never call external AI
 *   - Otherwise: Ollama first; on timeout/error → Gemini fallback (if allowed).
 *
 * GPU allocation:
 *   - Ollama runs on a dedicated instance pinned to GPU 1 (RTX 3060 Ti 8GB),
 *     see ops/ollama-gpu1.ps1 (OLLAMA_BASE_URL, default http://localhost:11435).
 *   - FFmpeg NVENC render stays on GPU 0 (see render.worker.ts).
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

export type LlmTier = 'brief' | 'strategy' | 'scene_graph' | 'render_plan';

/** Mot anh gui kem cho model nhin duoc (vision). */
export interface LlmImage {
  /** Vi du 'image/jpeg', 'image/png', 'image/webp'. */
  mimeType: string;
  /** Noi dung anh da ma hoa base64, KHONG kem tien to data: */
  base64: string;
}

export interface LlmChatOptions {
  tier: LlmTier;
  system: string;
  user: string;
  /**
   * Anh san pham gui kem. Spec V2 muc 4.2 yeu cau "Director call #1 (co nhin anh)":
   * khong co anh thi model doan noi dung tu ten file, nen kich ban khong bam sat san pham
   * va viec gan anh cho tung canh chi la phong doan.
   */
  images?: LlmImage[];
  temperature?: number;
  timeoutMs?: number;
  traceId?: string;
}

export interface LlmChatResult {
  text: string;
  provider: 'ollama' | 'gemini';
  latencyMs: number;
  fallbackUsed: boolean;
}

const TIER_TEMPERATURES: Record<LlmTier, number> = {
  brief: 0.2,
  strategy: 0.5,
  scene_graph: 0.4,
  render_plan: 0.1,
};

function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function getConfig() {
  return {
    ollamaBaseUrl: getEnv('OLLAMA_BASE_URL', 'http://localhost:11435'),
    ollamaModel: getEnv('OLLAMA_MODEL', 'qwen2.5:7b'),
    ollamaTimeoutMs: parseInt(getEnv('OLLAMA_TIMEOUT_MS', '90000'), 10),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: getEnv('GEMINI_MODEL', 'gemini-2.5-flash'),
    localOnlyMode: getEnv('LOCAL_ONLY_MODE', 'false') === 'true',
    allowExternal: getEnv('ALLOW_EXTERNAL_AI_APIS', 'true') !== 'false',
    geminiTimeoutMs: parseInt(getEnv('GEMINI_TIMEOUT_MS', '45000'), 10),
  };
}

async function readDbPolicy(): Promise<{ localOnly: boolean; allowExternal: boolean } | null> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('system_settings').select('key, value');
    if (error || !data) return null;
    const map: Record<string, string> = {};
    for (const row of data) map[row.key] = String(row.value);
    // Trang admin ghi key kieu LOCALONLYMODE (khong gach duoi, theo interface SystemSettings),
    // con cho nay truoc day chi doc LOCAL_ONLY_MODE -> cong tac trong admin khong co tac dung.
    // Nhan ca hai cach viet. allowExternal giu nguyen fail-open: thieu key thi van cho goi ngoai.
    const localOnly = ['LOCAL_ONLY_MODE', 'LOCALONLYMODE', 'local_only_mode']
      .some((k) => map[k] === 'true');
    const allowExternal = !['ALLOW_EXTERNAL_AI_APIS', 'ALLOWEXTERNALAIAPIS', 'allow_external_ai_apis']
      .some((k) => map[k] === 'false');
    return { localOnly, allowExternal };
  } catch {
    return null;
  }
}

/**
 * Resolve effective policy. Env is the ceiling; DB settings can only restrict further.
 */
async function resolvePolicy(): Promise<{ externalAllowed: boolean; localOnly: boolean }> {
  const cfg = getConfig();
  const db = await readDbPolicy();
  const localOnly = cfg.localOnlyMode || (db?.localOnly ?? false);
  const externalAllowed = !localOnly && cfg.allowExternal && (db?.allowExternal ?? true);
  return { externalAllowed, localOnly };
}

async function callOllama(
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
  traceId: string
): Promise<{ text: string; latencyMs: number }> {
  const cfg = getConfig();
  const url = `${cfg.ollamaBaseUrl}/v1/chat/completions`;
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.ollamaModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        top_p: 0.9,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OLLAMA_ERROR: HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('OLLAMA_BAD_RESPONSE: no content');
    return { text, latencyMs: Date.now() - start };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`OLLAMA_TIMEOUT: exceeded ${timeoutMs}ms at ${cfg.ollamaBaseUrl} [${traceId}]`);
    }
    throw new Error(`OLLAMA_UNREACHABLE: ${err.message} [${traceId}]`);
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
  traceId: string,
  images: LlmImage[] = []
): Promise<{ text: string; latencyMs: number }> {
  const cfg = getConfig();
  if (!cfg.geminiApiKey) throw new Error('GEMINI_FALLBACK_DISABLED: GEMINI_API_KEY not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiApiKey}`;
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        // Chu truoc, anh sau: model doc yeu cau roi moi soi anh theo yeu cau do.
        contents: [{
          role: 'user',
          parts: [
            { text: user },
            ...images.map((img) => ({
              inline_data: { mime_type: img.mimeType, data: img.base64 },
            })),
          ],
        }],
        generationConfig: { temperature, topP: 0.9 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
    return { text, latencyMs: Date.now() - start };
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error(`GEMINI_TIMEOUT: exceeded ${timeoutMs}ms [${traceId}]`);
    throw new Error(`GEMINI_ERROR: ${err.message} [${traceId}]`);
  } finally {
    clearTimeout(timer);
  }
}

export function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) try { return JSON.parse(match[1].trim()); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

export async function llmChat(options: LlmChatOptions): Promise<LlmChatResult> {
  const cfg = getConfig();
  const { externalAllowed } = await resolvePolicy();
  const temperature = options.temperature ?? TIER_TEMPERATURES[options.tier];
  const timeoutMs = options.timeoutMs ?? cfg.ollamaTimeoutMs;
  const traceId = options.traceId || 'no-trace';

  const startedAt = Date.now();

  try {
    const local = await callOllama(options.system, options.user, temperature, timeoutMs, traceId);
    return { text: local.text, provider: 'ollama', latencyMs: local.latencyMs, fallbackUsed: false };
  } catch (err: any) {
    console.warn(`[LLM] Ollama failed (tier=${options.tier}): ${err.message}`);
    if (!externalAllowed) {
      const elapsed = Date.now() - startedAt;
      throw new Error(`LOCAL_LLM_ONLY: ${err.message} (external AI disabled by policy)`);
    }
// Ollama o nhanh tren chay model van ban nen anh bi bo qua; chi Gemini nhin duoc.
const gemini = await callGemini(
  options.system, options.user, temperature, cfg.geminiTimeoutMs, traceId, options.images ?? []
);
    return { text: gemini.text, provider: 'gemini', latencyMs: gemini.latencyMs, fallbackUsed: true };
  }
}

export async function ollamaHealth(): Promise<{ status: 'up' | 'down'; model?: string; error?: string }> {
  const cfg = getConfig();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${cfg.ollamaBaseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { status: 'down', error: `HTTP ${res.status}` };
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);
    const available = models.some((m) => m.startsWith(cfg.ollamaModel.split(':')[0]));
    return { status: 'up', model: available ? cfg.ollamaModel : `${cfg.ollamaModel} (not pulled — run: ollama pull ${cfg.ollamaModel})` };
  } catch (err: any) {
    return { status: 'down', error: err.message };
  }
}