/**
 * Viprosell — Ollama Provider Adapter
 * OpenAI-compatible interface for local LLM inference via Ollama.
 * This is the ONLY permitted AI provider in local-first mode.
 * No cloud fallback is implemented here.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

function getConfig(): OllamaConfig {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10),
  };
}

export const OllamaProvider = {
  /**
   * Call Ollama via OpenAI-compatible /v1/chat/completions endpoint.
   * Returns the assistant message content string.
   * Throws with a descriptive error if Ollama is unreachable or returns error.
   */
  async chat(messages: ChatMessage[], overrideModel?: string): Promise<string> {
    const { baseUrl, model, timeoutMs } = getConfig();
    const url = `${baseUrl}/v1/chat/completions`;
    const usedModel = overrideModel || model;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: usedModel,
          messages,
          temperature: 0.3,
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`OLLAMA_TIMEOUT: Request exceeded ${timeoutMs}ms. Is Ollama running at ${baseUrl}?`);
      }
      throw new Error(`OLLAMA_UNREACHABLE: ${err.message}. Ensure Ollama is running at ${baseUrl}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '(no body)');
      throw new Error(`OLLAMA_ERROR: HTTP ${response.status} from ${url}: ${body}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error(`OLLAMA_BAD_RESPONSE: No content in response: ${JSON.stringify(json)}`);
    }
    return content;
  },

  /**
   * Health check: verify Ollama is reachable and model is available.
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; model?: string; error?: string }> {
    const { baseUrl, model } = getConfig();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return { status: 'down', error: `HTTP ${res.status}` };
      const data = await res.json();
      const models: string[] = (data.models || []).map((m: any) => m.name);
      const modelAvailable = models.some((m) => m.startsWith(model.split(':')[0]));
      return { status: 'up', model: modelAvailable ? model : `${model} (not pulled — run: ollama pull ${model})` };
    } catch (err: any) {
      return { status: 'down', error: err.message };
    }
  },
};
