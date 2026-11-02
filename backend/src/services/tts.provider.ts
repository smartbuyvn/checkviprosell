/**
 * Viprosell — Lồng tiếng (TTS)
 *
 * Một interface, nhiều nhà cung cấp. Hiện có FPT.AI; VieNeu-TTS cắm vào sau mà
 * không phải sửa worker, chỉ đổi biến môi trường TTS_PROVIDER.
 *
 * Điểm kiến trúc quan trọng: hàm trả Promise và có cơ chế CHỜ, vì FPT.AI chạy
 * bất đồng bộ — nó không trả file mp3 mà trả một đường link sẽ có file sau, chờ
 * từ 5 giây tới 2 phút tuỳ độ dài. Thiết kế theo kiểu gọi-phát-ra-ngay (như VieNeu)
 * rồi cắm FPT vào sau sẽ phải viết lại; làm ngược lại thì không.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface TtsRequest {
  /** Câu cần đọc. FPT giới hạn 5.000 ký tự mỗi lần gọi. */
  text: string;
  /** Mã giọng của nhà cung cấp. Để trống thì dùng mặc định. */
  voice?: string;
  traceId?: string;
}

export interface TtsResult {
  /** Đường dẫn file âm thanh trên đĩa. */
  filePath: string;
  provider: string;
  /** True khi lấy lại từ cache, không gọi API. */
  cached: boolean;
  latencyMs: number;
}

export class TtsError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'TtsError';
  }
}

function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

/** FPT giới hạn 5.000 ký tự mỗi lần gọi. */
const FPT_MAX_CHARS = 5000;

const CACHE_DIR = getEnv('TTS_CACHE_DIR', path.join(process.cwd(), 'tts-cache'));

/**
 * Khoá cache gồm (văn bản, giọng, nhà cung cấp, phiên bản).
 *
 * Khách sửa một chữ rồi render lại là việc thường xuyên; không cache thì mỗi lần
 * sửa là trả tiền lại cho toàn bộ câu không đổi. Đưa cả nhà cung cấp và phiên bản
 * vào khoá để khi đổi FPT sang VieNeu, file cũ không bị dùng nhầm.
 */
export function cacheKey(text: string, voice: string, provider: string, version: string): string {
  return crypto
    .createHash('sha256')
    .update([provider, version, voice, text.trim()].join('\u0000'))
    .digest('hex')
    .slice(0, 32);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Nhận dạng MP3 qua byte đầu: ID3 hoặc frame sync 0xFF 0xFB/0xF3/0xF2. */
export function looksLikeMp3(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf.subarray(0, 3).toString('ascii') === 'ID3') return true;
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
}

/** Nhận dạng WAV: "RIFF....WAVE". VieNeu chạy cục bộ thường trả WAV cho nhanh. */
export function looksLikeWav(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  return buf.subarray(0, 4).toString('ascii') === 'RIFF'
    && buf.subarray(8, 12).toString('ascii') === 'WAVE';
}

/**
 * Chấp nhận cả MP3 lẫn WAV. ffmpeg đọc được cả hai nên không cần ép một định dạng;
 * điều quan trọng là KHÔNG nhận nhầm một trang lỗi HTML hay JSON là âm thanh —
 * nhận nhầm thì video mất tiếng mà không báo gì.
 */
export function looksLikeAudio(buf: Buffer): boolean {
  return looksLikeMp3(buf) || looksLikeWav(buf);
}

/**
 * FPT.AI Text to Speech v5.
 *
 * Luồng hai nhịp: POST văn bản → nhận link trong trường `async` → tải link đó.
 * File chưa có ngay nên phải hỏi lại nhiều lần; đó là lý do interface phải bất đồng bộ.
 */
async function synthesizeFpt(req: TtsRequest, outPath: string): Promise<void> {
  const apiKey = process.env.FPT_TTS_API_KEY || '';
  if (!apiKey) throw new TtsError('Chua dat FPT_TTS_API_KEY', 'TTS_NO_KEY');

  const voice = req.voice || getEnv('FPT_TTS_VOICE', 'banmai');
  const endpoint = getEnv('FPT_TTS_ENDPOINT', 'https://api.fpt.ai/hmi/tts/v5');
  const traceId = req.traceId || 'no-trace';

  if (req.text.length > FPT_MAX_CHARS) {
    throw new TtsError(
      `Cau dai ${req.text.length} ky tu, vuot gioi han ${FPT_MAX_CHARS} cua FPT`,
      'TTS_TEXT_TOO_LONG'
    );
  }

  // Tai lieu FPT ghi toi thieu 3 ky tu. Gui ngan hon thi API tu choi bang mot loi
  // kho doc; chan o day de thong bao noi dung van de that.
  if (req.text.trim().length < 3) {
    throw new TtsError(
      `Cau chi co ${req.text.trim().length} ky tu, FPT doi toi thieu 3`,
      'TTS_TEXT_TOO_SHORT'
    );
  }

  // FPT co hai cong khac nhau va chung KHONG giong nhau:
  //   - console Speech co dien: header `api_key`, than request la van ban tho
  //   - AI Marketplace:         header `Authorization: Bearer`, than request la JSON
  // Dat FPT_TTS_AUTH_STYLE=bearer khi dung khoa tao tu Marketplace.
  const style = getEnv('FPT_TTS_AUTH_STYLE', 'api_key');
  const bearer = style === 'bearer';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: bearer
      ? { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      : {
          api_key: apiKey,
          voice,
          // Tai lieu chinh thuc: speed tu -3 den +3 (0 la binh thuong), format mp3 hoac wav.
          // Khong dat thi FPT dung mac dinh, nhung dat ro thi ket qua khong doi khi FPT
          // doi mac dinh cua ho.
          speed: getEnv('FPT_TTS_SPEED', '0'),
          format: getEnv('FPT_TTS_FORMAT', 'mp3'),
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/plain; charset=utf-8',
        },
    body: bearer
      ? JSON.stringify({ text: req.text, voice, model: getEnv('FPT_TTS_MODEL', 'FPT.TTS-pro') })
      : req.text,
  });

  if (!res.ok) {
    throw new TtsError(`FPT tra HTTP ${res.status} [${traceId}]`, 'TTS_HTTP_ERROR');
  }

  // Doc byte tho truoc, roi moi quyet dinh. Cong Marketplace co the tra THANG am thanh,
  // trong khi console co dien tra JSON kem mot duong link se co file sau. Goi .json()
  // ngay se nem loi o truong hop dau — va loi do doc len nhu "JSON hong", khong lan ra
  // duoc rang that ra server da tra ve dung thu minh can.
  const raw = Buffer.from(await res.arrayBuffer());

  if (looksLikeAudio(raw)) {
    fs.writeFileSync(outPath, raw);
    return;
  }

  let body: { async?: string; error?: number; message?: string };
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    const head = raw.subarray(0, 80).toString('utf8').replace(/\s+/g, ' ').trim();
    throw new TtsError(
      `FPT tra ${raw.byteLength} byte khong phai am thanh cung khong phai JSON. Dau: "${head}" [${traceId}]`,
      'TTS_BAD_RESPONSE'
    );
  }

  // FPT dung error=0 la thanh cong; moi gia tri khac la that bai.
  if (body.error !== 0 || !body.async) {
    throw new TtsError(
      `FPT tu choi: error=${body.error} ${body.message ?? ''} [${traceId}]`,
      'TTS_PROVIDER_REJECTED'
    );
  }

  // File chua san khi phan hoi ve. Hoi lai cho toi khi co, trong gioi han thoi gian.
  const maxWaitMs = parseInt(getEnv('FPT_TTS_MAX_WAIT_MS', '120000'), 10);
  const stepMs = parseInt(getEnv('FPT_TTS_POLL_MS', '2000'), 10);
  const deadline = Date.now() + maxWaitMs;
  let lastStatus = 0;

  while (Date.now() < deadline) {
    const audio = await fetch(body.async);
    lastStatus = audio.status;

    if (audio.ok) {
      const buf = Buffer.from(await audio.arrayBuffer());
      // Kiem noi dung that: mot trang loi tra 200 cung se duoc ghi thanh .mp3 neu
      // khong kiem, roi ffmpeg nhan rac va video mat tieng ma khong bao gi.
      if (looksLikeAudio(buf)) {
        fs.writeFileSync(outPath, buf);
        return;
      }
    }

    await sleep(stepMs);
  }

  throw new TtsError(
    `Cho qua ${maxWaitMs}ms ma FPT chua tra file (HTTP cuoi ${lastStatus}) [${traceId}]`,
    'TTS_TIMEOUT'
  );
}

/**
 * VieNeu-TTS qua endpoint tương thích OpenAI `POST /v1/audio/speech`.
 *
 * Khác FPT ở chỗ căn bản: VieNeu chạy cục bộ trên worker và trả thẳng byte âm thanh
 * trong một lượt, không có bước chờ link. Nhờ interface đã thiết kế bất đồng bộ từ
 * đầu nên cắm vào đây không phải sửa gì ở worker.
 *
 * Đây là lý do lớp provider tồn tại: đổi nhà cung cấp chỉ là đổi TTS_PROVIDER.
 */
async function synthesizeVieNeu(req: TtsRequest, outPath: string): Promise<void> {
  const base = getEnv('VIENEU_BASE_URL', 'http://localhost:8080');
  const model = getEnv('VIENEU_MODEL', 'vieneu-tts-v3-turbo');
  const voice = req.voice || getEnv('VIENEU_VOICE', 'default');
  const format = getEnv('VIENEU_FORMAT', 'wav');
  const timeoutMs = parseInt(getEnv('VIENEU_TIMEOUT_MS', '120000'), 10);
  const traceId = req.traceId || 'no-trace';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Endpoint cục bộ thường không cần khoá; gửi khi có để dùng được cả bản có xác thực.
        ...(process.env.VIENEU_API_KEY ? { Authorization: `Bearer ${process.env.VIENEU_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model,
        input: req.text,
        voice,
        response_format: format,
        // Hai truong ngoai chuan OpenAI, FPT Token Factory co dung:
        // speed (1 la binh thuong) va return_type.
        speed: parseFloat(getEnv('TTS_SPEED', '1')),
        return_type: getEnv('TTS_RETURN_TYPE', 'direct'),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 200);
      throw new TtsError(`VieNeu tra HTTP ${res.status}: ${body} [${traceId}]`, 'TTS_HTTP_ERROR');
    }

    const buf = Buffer.from(await res.arrayBuffer());

    // Duong thuan: tra thang byte am thanh.
    if (looksLikeAudio(buf)) {
      fs.writeFileSync(outPath, buf);
      return;
    }

    // Duong thu hai: tra JSON kem mot duong link (FPT Token Factory dung khi
    // return_type='link'). Tai link do ve thay vi bao loi.
    let json: any = null;
    try { json = JSON.parse(buf.toString('utf8')); } catch { /* khong phai JSON */ }

    const link: string | undefined =
      json?.url ?? json?.async ?? json?.data?.url ?? json?.audio_url ?? json?.link;

    if (link) {
      const a = await fetch(link);
      if (a.ok) {
        const audio = Buffer.from(await a.arrayBuffer());
        if (looksLikeAudio(audio)) {
          fs.writeFileSync(outPath, audio);
          return;
        }
      }
      throw new TtsError(`Tai link am thanh that bai: ${link} [${traceId}]`, 'TTS_LINK_FAILED');
    }

    // Khong phai am thanh, khong phai link: mot endpoint chet co the tra trang loi
    // kem 200; ghi thanh file am thanh thi ffmpeg nhan rac va video mat tieng.
    const head = buf.subarray(0, 80).toString('utf8').replace(/\s+/g, ' ').trim();
    throw new TtsError(
      `Tra ve ${buf.byteLength} byte khong phai am thanh, khong co link. Dau: "${head}"`,
      'TTS_NOT_AUDIO'
    );
  } catch (err: any) {
    if (err instanceof TtsError) throw err;
    if (err.name === 'AbortError') {
      throw new TtsError(`VieNeu khong tra loi trong ${timeoutMs}ms [${traceId}]`, 'TTS_TIMEOUT');
    }
    // Endpoint chua bat la truong hop thuong gap nhat, noi ro de khoi phai doan.
    throw new TtsError(
      `Khong goi duoc VieNeu tai ${base}: ${err.message}. Da bat server TTS chua? [${traceId}]`,
      'TTS_UNREACHABLE'
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sinh giọng đọc cho một câu, có cache.
 *
 * Ném TtsError khi hỏng. Bên gọi phải bắt và render tiếp bản không lời — giọng hỏng
 * không được làm hỏng cả video.
 */
export async function synthesize(req: TtsRequest): Promise<TtsResult> {
  const provider = getEnv('TTS_PROVIDER', 'vieneu');
  const voice = req.voice
    || (provider === 'vieneu' ? getEnv('VIENEU_VOICE', 'default') : getEnv('FPT_TTS_VOICE', 'banmai'));
  const version = getEnv('TTS_CACHE_VERSION', 'v1');
  const started = Date.now();

  const text = (req.text ?? '').trim();
  if (!text) throw new TtsError('Cau rong, khong co gi de doc', 'TTS_EMPTY_TEXT');

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const key = cacheKey(text, voice, provider, version);
  const ext = provider === 'vieneu' ? getEnv('VIENEU_FORMAT', 'wav') : 'mp3';
  const outPath = path.join(CACHE_DIR, `${key}.${ext}`);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    return { filePath: outPath, provider, cached: true, latencyMs: Date.now() - started };
  }

  if (provider === 'vieneu') {
    await synthesizeVieNeu({ ...req, text, voice }, outPath);
  } else if (provider === 'fpt') {
    await synthesizeFpt({ ...req, text, voice }, outPath);
  } else {
    throw new TtsError(`Chua ho tro nha cung cap TTS: ${provider}`, 'TTS_UNKNOWN_PROVIDER');
  }

  return { filePath: outPath, provider, cached: false, latencyMs: Date.now() - started };
}

/** True khi lồng tiếng được bật. Tắt thì worker render bản không lời như cũ. */
export function ttsEnabled(): boolean {
  if (getEnv('TTS_ENABLED', 'false') !== 'true') return false;
  // VieNeu chay cuc bo nen khong can khoa API; FPT thi bat buoc phai co.
  const provider = getEnv('TTS_PROVIDER', 'vieneu');
  if (provider === 'vieneu') return true;
  if (provider === 'fpt') return !!process.env.FPT_TTS_API_KEY;
  return false;
}
