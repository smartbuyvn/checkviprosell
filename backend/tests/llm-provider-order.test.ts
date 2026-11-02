import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Chan loi cau hinh im lang: dat sai bien moi truong thi he thong van chay nhung
 * goi nham model, va hoa don moi noi ra sau.
 *
 * Quyet dinh #6 cua spec: Haiku 5.5 chinh, Gemini du phong. Haiku re hon Gemini
 * 4,4 lan o dau ra (0,50 so voi 2,50 USD moi 1M token), va dau ra la phan ton nhat
 * vi moi tang deu sinh JSON dai.
 */

const ENV_KEYS = [
  'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_EFFORT',
  'GEMINI_API_KEY', 'OLLAMA_ENABLED', 'ALLOW_EXTERNAL_AI_APIS', 'LOCAL_ONLY_MODE',
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    if (!(k in saved)) saved[k] = process.env[k];
    delete process.env[k];
  }
});

/** Doc lai cau hinh sau khi doi env — getConfig() doc process.env moi lan goi. */
async function freshConfig() {
  const mod = await import('../src/services/llm.provider');
  return mod;
}

test('model mac dinh la Haiku 5.5, khong phai Gemini', async () => {
  const { } = await freshConfig();
  // getConfig khong export, nen kiem qua gia tri mac dinh trong ma nguon.
  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'llm.provider.ts'), 'utf8'
  );
  assert.match(
    src,
    /getEnv\('ANTHROPIC_MODEL', 'claude-haiku-5-5'\)/,
    'model mac dinh phai la claude-haiku-5-5 theo quyet dinh #6'
  );
});

test('Anthropic duoc thu TRUOC Gemini', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'llm.provider.ts'), 'utf8'
  );
  const iAnthropic = src.indexOf("name: 'anthropic'");
  const iGemini = src.indexOf("name: 'gemini'");
  assert.ok(iAnthropic > 0 && iGemini > 0, 'khong tim thay hai nha cung cap trong danh sach');
  assert.ok(
    iAnthropic < iGemini,
    'Anthropic phai dung truoc Gemini: dat nguoc lai la moi video dat them ~190d'
  );
});

test('Ollama mac dinh TAT', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'llm.provider.ts'), 'utf8'
  );
  // Bat mac dinh thi tren VPS moi lan goi la mot lan fetch that bai vo ich.
  assert.match(src, /getEnv\('OLLAMA_ENABLED', 'false'\)/, "Ollama phai mac dinh tat");
});

test("effort mac dinh la 'low'", async () => {
  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'llm.provider.ts'), 'utf8'
  );
  // Haiku 5.5 bat suy nghi mac dinh va token suy nghi tinh tien nhu dau ra.
  // Mac dinh cua model la 'medium'; de nguyen la tra tien cho suy luan khong dung toi.
  assert.match(src, /getEnv\('ANTHROPIC_EFFORT', 'low'\)/, "effort phai mac dinh 'low'");
});

test('khong co nha cung cap nao thi bao loi ro rang, khong im lang', async () => {
  const { llmChat } = await freshConfig();
  await assert.rejects(
    () => llmChat({ tier: 'brief', system: 's', user: 'u', traceId: 'test' }),
    (err: any) => /NO_LLM_PROVIDER|LOCAL_LLM_ONLY|ALL_LLM_PROVIDERS_FAILED/.test(err.message),
    'thieu khoa thi phai noi ro, khong duoc hong im lang'
  );
});

test('gop moi khoi van ban cua Anthropic, bo khoi suy nghi', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'llm.provider.ts'), 'utf8'
  );
  // Lay moi khoi dau (content[0]) la loi da lam vo pipeline voi Gemini ngay 27/10:
  // model co buoc suy nghi tra nhieu khoi, khoi dau co the la phan suy nghi hoac mau cut.
  assert.match(src, /filter\(\(b\): b is Anthropic\.TextBlock => b\.type === 'text'\)/);
  assert.match(src, /\.join\(''\)/);
});
