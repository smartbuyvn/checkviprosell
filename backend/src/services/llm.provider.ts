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
import Anthropic from '@anthropic-ai/sdk';
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
  provider: 'ollama' | 'anthropic' | 'gemini';
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

    // Haiku 5.5 la model chinh theo quyet dinh #6 cua spec: 0,10/0,50 USD moi 1M token,
    // so voi 0,30/2,50 cua Gemini 2.5 Flash — re hon 4,4 lan o dau ra, va dau ra la
    // phan ton nhat vi moi tang deu sinh JSON dai.
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: getEnv('ANTHROPIC_MODEL', 'claude-haiku-5-5'),
    anthropicTimeoutMs: parseInt(getEnv('ANTHROPIC_TIMEOUT_MS', '60000'), 10),
    // Haiku 5.5 BAT suy nghi mac dinh va token suy nghi tinh tien nhu dau ra.
    // Cac tang nay chi dien JSON theo ban mau co san nen 'low' la du; de mac dinh
    // 'medium' la tra tien cho phan suy luan khong dung toi.
    anthropicEffort: getEnv('ANTHROPIC_EFFORT', 'low'),

    // Ollama mac dinh TAT. Worker chay o may ca nhan thi bat duoc, nhung tren VPS
    // localhost:11435 khong co gi — moi lan goi la mot lan fetch that bai vo ich.
    ollamaEnabled: getEnv('OLLAMA_ENABLED', 'false') === 'true',
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

/**
 * Ma trang thai dang "thu lai thi duoc": qua tai, nghen, loi tam thoi phia server.
 *
 * 503 cua Gemini ghi han "Spikes in demand are usually temporary. Please try again
 * later" - bo cuoc ngay lan dau la vut di mot lan sinh noi dung dang le thanh cong.
 * 400/401/403/404 khong co trong danh sach: thu lai bao nhieu lan cung the.
 */
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUS.has(status);
}

/**
 * Thoi gian cho truoc lan thu ke tiep: tang gap doi moi lan, cong them nhieu ngau nhien.
 *
 * Nhieu ngau nhien de nhieu yeu cau cung bi tu choi mot luc khong dong loat quay lai
 * dung cung mot thoi diem va lam nghen tiep.
 */
export function nextBackoffMs(attempt: number, baseMs: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  return Math.round(exponential + Math.random() * baseMs);
}

/** Loi HTTP co kem ma trang thai, de ben goi quyet dinh co thu lai khong. */
class HttpStatusError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number | null) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Doc header Retry-After (so giay, hoac mot moc thoi gian). Tra null neu khong doc duoc. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

/**
 * Goi Claude Haiku 5.5 — model chinh theo quyet dinh #6 cua spec.
 *
 * Khac Gemini o ba cho dang chu y:
 * - Suy nghi LUON BAT tren Haiku 5.5; khong tat duoc bang tham so, chi ha duoc do sau
 *   qua output_config.effort. Dat 'low' vi cac tang chi dien JSON theo ban mau.
 * - Anh gui kem dung khoi { type: 'image', source: { type: 'base64' } }, khac inline_data.
 * - SDK tu thu lai 408/409/429/5xx, nen o day khong tu viet vong lap thu lai nua.
 */
async function callAnthropic(
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
  traceId: string,
  images: LlmImage[] = []
): Promise<{ text: string; latencyMs: number }> {
  const cfg = getConfig();
  if (!cfg.anthropicApiKey) throw new Error('ANTHROPIC_DISABLED: ANTHROPIC_API_KEY not set');

  const client = new Anthropic({
    apiKey: cfg.anthropicApiKey,
    timeout: timeoutMs,
    maxRetries: parseInt(getEnv('ANTHROPIC_MAX_RETRIES', '2'), 10),
  });

  const start = Date.now();

  try {
    // Chu truoc, anh sau: model doc yeu cau roi moi soi anh theo yeu cau do.
    const content: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: user },
      ...images.map((img) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: img.base64,
        },
      })),
    ];

    const res = await client.messages.create({
      model: cfg.anthropicModel,
      max_tokens: parseInt(getEnv('ANTHROPIC_MAX_TOKENS', '8192'), 10),
      system,
      output_config: { effort: cfg.anthropicEffort as 'low' | 'medium' | 'high' },
      messages: [{ role: 'user', content }],
    });

    // Bo khoi suy nghi, chi gop van ban that. Gop MOI khoi text chu khong lay khoi dau:
    // lay khoi dau la loi da lam vo pipeline voi Gemini ngay 27/10.
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    if (res.stop_reason === 'max_tokens') {
      console.warn(`[LLM] Haiku bi cat vi het max_tokens — JSON co the thieu khoa [${traceId}]`);
    }
    if (res.stop_reason === 'refusal') {
      throw new Error(`ANTHROPIC_REFUSAL: ${res.stop_details?.explanation ?? 'khong ro ly do'}`);
    }
    if (!text) throw new Error(`ANTHROPIC_EMPTY_RESPONSE (stop_reason=${res.stop_reason})`);

    return { text, latencyMs: Date.now() - start };
  } catch (err: any) {
    if (err?.message?.startsWith('ANTHROPIC_')) throw err;
    throw new Error(`ANTHROPIC_ERROR: ${err.message} [${traceId}]`);
  }
}

async function callGeminiOnce(
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
        // Phai dat tran token dau ra: scene graph 4-10 canh, moi canh hon chuc truong,
        // de mac dinh thi cau tra loi bi cat giua chung va JSON thieu han khoa "scenes".
        generationConfig: {
          temperature,
          topP: 0.9,
          maxOutputTokens: parseInt(getEnv('GEMINI_MAX_OUTPUT_TOKENS', '8192'), 10),
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      throw new HttpStatusError(
        `HTTP ${res.status}: ${body}`,
        res.status,
        parseRetryAfter(res.headers.get('retry-after'))
      );
    }
    const data = await res.json() as any;
    const candidate = data?.candidates?.[0];

    // Gop MOI phan van ban, bo phan suy nghi. Truoc day chi lay parts[0].text:
    // gemini-2.5-flash tra nhieu part nen cach cu co the vo phai phan suy nghi hoac
    // mot mau cut, lam JSON thieu khoa va bao "expected array, received undefined".
    const text = (candidate?.content?.parts ?? [])
      .filter((p: any) => p?.thought !== true && typeof p?.text === 'string')
      .map((p: any) => p.text)
      .join('');

    // Bi cat vi het tran token thi phai noi ra, dung de lap im lang roi bao JSON hong.
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`[LLM] Gemini ket thuc bat thuong: ${candidate.finishReason} [${traceId}]`);
    }

    if (!text) throw new Error(`GEMINI_EMPTY_RESPONSE (finishReason=${candidate?.finishReason ?? 'khong ro'})`);
    return { text, latencyMs: Date.now() - start };
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error(`GEMINI_TIMEOUT: exceeded ${timeoutMs}ms [${traceId}]`);
    // Giu nguyen HttpStatusError de vong thu lai con doc duoc ma trang thai.
    if (err instanceof HttpStatusError) throw err;
    throw new Error(`GEMINI_ERROR: ${err.message} [${traceId}]`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Goi Gemini, thu lai khi gap loi tam thoi (503 qua tai, 429 nghen, 5xx).
 *
 * Khong thu lai loi cau hinh (thieu khoa, 400, 403): thu lai chi lam khach cho lau
 * hon roi van hong. Het so lan thu thi nem loi kem so lan da thu de doc log biet ngay
 * la da co gang bao nhieu.
 */
async function callGemini(
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
  traceId: string,
  images: LlmImage[] = []
): Promise<{ text: string; latencyMs: number }> {
  const maxRetries = parseInt(getEnv('GEMINI_MAX_RETRIES', '2'), 10);
  const baseMs = parseInt(getEnv('GEMINI_RETRY_BASE_MS', '800'), 10);

  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callGeminiOnce(system, user, temperature, timeoutMs, traceId, images);
      if (attempt > 0) {
        console.log(`[LLM] Gemini thanh cong o lan thu ${attempt + 1}/${maxRetries + 1} [${traceId}]`);
      }
      return result;
    } catch (err: any) {
      lastErr = err;

      const retryable = err instanceof HttpStatusError && isRetryableStatus(err.status);
      if (!retryable || attempt === maxRetries) break;

      const waitMs = err.retryAfterMs ?? nextBackoffMs(attempt, baseMs);
      console.warn(
        `[LLM] Gemini ${err.status} (tam thoi), cho ${waitMs}ms roi thu lai ` +
        `lan ${attempt + 2}/${maxRetries + 1} [${traceId}]`
      );
      await sleep(waitMs);
    }
  }

  const tried = `da thu ${maxRetries + 1} lan`;
  if (lastErr instanceof HttpStatusError) {
    throw new Error(`GEMINI_ERROR: ${lastErr.message} (${tried}) [${traceId}]`);
  }
  throw lastErr;
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

/**
 * Thu tu nha cung cap, theo quyet dinh #6 cua spec: Haiku 5.5 chinh, Gemini du phong.
 *
 * Ollama chi dung khi bat tuong minh (OLLAMA_ENABLED=true). Truoc day no luon duoc goi
 * dau tien, nhung tren VPS localhost:11435 khong co gi nen moi lan goi la mot lan fetch
 * that bai vo ich — log ngay 27/10 day dac dong OLLAMA_UNREACHABLE.
 *
 * Nha cung cap nao thieu khoa thi bo qua, khong tinh la that bai.
 */
export async function llmChat(options: LlmChatOptions): Promise<LlmChatResult> {
  const cfg = getConfig();
  const { externalAllowed } = await resolvePolicy();
  const temperature = options.temperature ?? TIER_TEMPERATURES[options.tier];
  const traceId = options.traceId || 'no-trace';
  const images = options.images ?? [];

  type Attempt = {
    name: LlmChatResult['provider'];
    usable: boolean;
    run: () => Promise<{ text: string; latencyMs: number }>;
  };

  const attempts: Attempt[] = [
    {
      name: 'ollama',
      usable: cfg.ollamaEnabled,
      // Ollama chay model van ban nen anh bi bo qua o day.
      run: () => callOllama(options.system, options.user, temperature,
        options.timeoutMs ?? cfg.ollamaTimeoutMs, traceId),
    },
    {
      name: 'anthropic',
      usable: externalAllowed && !!cfg.anthropicApiKey,
      run: () => callAnthropic(options.system, options.user, temperature,
        cfg.anthropicTimeoutMs, traceId, images),
    },
    {
      name: 'gemini',
      usable: externalAllowed && !!cfg.geminiApiKey,
      run: () => callGemini(options.system, options.user, temperature,
        cfg.geminiTimeoutMs, traceId, images),
    },
  ];

  const usable = attempts.filter((a) => a.usable);

  if (usable.length === 0) {
    throw new Error(
      externalAllowed
        ? 'NO_LLM_PROVIDER: chua dat ANTHROPIC_API_KEY lan GEMINI_API_KEY'
        : 'LOCAL_LLM_ONLY: chinh sach cam goi AI ben ngoai va Ollama dang tat'
    );
  }

  const errors: string[] = [];

  for (let i = 0; i < usable.length; i++) {
    const a = usable[i];
    try {
      const r = await a.run();
      if (i > 0) console.log(`[LLM] ${a.name} nhan viec sau khi ${usable[i - 1].name} hong [${traceId}]`);
      return { text: r.text, provider: a.name, latencyMs: r.latencyMs, fallbackUsed: i > 0 };
    } catch (err: any) {
      errors.push(`${a.name}: ${err.message}`);
      const last = i === usable.length - 1;
      console.warn(`[LLM] ${a.name} hong (tier=${options.tier}): ${err.message}`);
      if (last) throw new Error(`ALL_LLM_PROVIDERS_FAILED — ${errors.join(' | ')}`);
    }
  }

  // Khong toi day duoc: vong lap o tren hoac tra ve hoac nem loi.
  throw new Error(`ALL_LLM_PROVIDERS_FAILED — ${errors.join(' | ')}`);
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