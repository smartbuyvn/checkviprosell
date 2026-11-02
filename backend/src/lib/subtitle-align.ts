/**
 * Viprosell — Căn phụ đề khớp giọng đọc
 *
 * Trước đây phụ đề bám theo mốc CẢNH: cảnh dài 4 giây thì chữ hiện suốt 4 giây,
 * dù người đọc chỉ nói 2,3 giây. Chữ chạy trước hoặc đọng lại sau tiếng nói —
 * nhìn là thấy nghiệp dư ngay, và đó là thứ phân biệt video quảng cáo thật với
 * slideshow có chữ.
 *
 * Hai đường, tự chọn theo thứ có sẵn:
 *   1. Whisper (ffmpeg filter `whisper`, cần file model ggml) → mốc thời gian thật
 *   2. Không có model → chia theo tỉ lệ ký tự trên ĐỘ DÀI GIỌNG ĐỌC THẬT
 *
 * Đường 2 không hoàn hảo nhưng vẫn hơn hẳn bám mốc cảnh, vì nó dùng thời lượng
 * đo được của file tiếng chứ không phải thời lượng cảnh do AI đặt ra.
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TimedCue {
  /** Giây, tính từ đầu đoạn âm thanh này (chưa cộng mốc cảnh). */
  startSec: number;
  endSec: number;
  text: string;
}

/** Đo độ dài file âm thanh. Trả null khi không đo được. */
export function probeDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ]);
    let out = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('close', () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) && n > 0 ? n : null);
    });
    p.on('error', () => resolve(null));
  });
}

/**
 * Cắt câu thành từng mẩu vừa đọc, không cắt giữa từ.
 *
 * Cắt giữa từ làm người xem phải ghép lại trong đầu — mất đúng một nhịp, mà
 * video quảng cáo chỉ có vài giây để giữ người xem.
 */
export function chunkText(text: string, maxChars = 42): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Thời gian đọc một đoạn tiếng Việt, tính bằng giây.
 *
 * ── Đo thật, không mượn công thức tiếng khác ──
 *
 * Ngày 29/10/2026 tôi tổng hợp 12 câu quảng cáo tiếng Việt dài từ 10 tới 119 ký tự,
 * cho chính nhà cung cấp TTS đang dùng đọc, rồi đo thời lượng file bằng ffprobe.
 * Hồi quy tuyến tính cho:
 *
 *     giây = ký_tự / 28,3 + 0,93        (R² = 0,916, lệch lớn nhất 0,78 giây)
 *
 * So với các công thức sẵn có: tiếng Anh `ký_tự/15 + 1,5`, tiếng Trung
 * `ký_tự/4,5 + 1,5`. Tiếng Việt nhanh hơn tiếng Anh gần gấp đôi trên mỗi ký tự —
 * âm tiết ngắn, nhiều từ một âm, và dấu thanh nằm trên cùng một ký tự chứ không
 * thêm ký tự mới. Dùng công thức tiếng Anh ở đây là giữ phụ đề lâu gần gấp đôi
 * mức cần, và với video 20 giây thì không còn chỗ cho câu tiếp theo.
 *
 * Câu lệch nhiều nhất chứa tên thương hiệu viết hoa (HAVATA) — TTS đánh vần từng
 * chữ cái nên lâu hơn hẳn. Đó là giới hạn đã biết của công thức, không phải lỗi đo.
 */
export const GIAY_MOI_KY_TU = 1 / 28.3;
export const PHU_TROI_GIAY = 0.93;

/**
 * Không mẩu phụ đề nào được hiện ngắn hơn mức này.
 *
 * `splitByChars` chia thời lượng THEO TỈ LỆ ký tự, nên một mẩu ngắn nằm cạnh mẩu
 * dài có thể chỉ hiện 0,3 giây — đủ để mắt thấy có chữ nhấp nháy, không đủ để đọc.
 */
export const GIU_TOI_THIEU_GIAY = 1.2;

/** Thời gian cần để đọc/nói đoạn này. */
export function thoiGianDoc(text: string): number {
  const n = String(text ?? '').trim().length;
  if (n === 0) return 0;
  return n * GIAY_MOI_KY_TU + PHU_TROI_GIAY;
}

/**
 * Gộp các mẩu sẽ hiện quá ngắn vào mẩu kế bên.
 *
 * GỘP chứ không KÉO DÀI: phụ đề bám theo tiếng nói, kéo dài một mẩu là đẩy lệch
 * mọi mẩu sau và chữ sẽ chạy sau giọng. Gộp thì tổng thời lượng không đổi, chỉ ít
 * mẩu hơn và mỗi mẩu hiện đủ lâu.
 *
 * Không gộp khi kết quả vượt quá hai lần `maxChars`: một dòng dài quá thì tràn khỏi
 * vùng an toàn và cũng không đọc kịp. Lúc đó đành chịu mẩu ngắn.
 */
export function gopMauNgan(chunks: string[], totalSec: number, maxChars = 42): string[] {
  if (chunks.length <= 1 || !(totalSec > 0)) return chunks;

  const tranGop = maxChars * 2;
  let hienTai = [...chunks];

  // Lặp tới khi không gộp thêm được: một lần gộp làm đổi tỉ lệ của mọi mẩu còn lại.
  for (let vong = 0; vong < chunks.length; vong++) {
    const tong = hienTai.reduce((t, c) => t + Math.max(1, c.length), 0);
    const i = hienTai.findIndex(
      (c) => (Math.max(1, c.length) / tong) * totalSec < GIU_TOI_THIEU_GIAY
    );
    if (i < 0) break;

    // Gộp với hàng xóm NGẮN HƠN để không dồn thành một dòng quá dài.
    const truoc = i > 0 ? hienTai[i - 1] : null;
    const sau = i < hienTai.length - 1 ? hienTai[i + 1] : null;
    let j = -1;
    if (truoc !== null && sau !== null) j = truoc.length <= sau.length ? i - 1 : i + 1;
    else if (truoc !== null) j = i - 1;
    else if (sau !== null) j = i + 1;
    if (j < 0) break;

    const gop = j < i ? `${hienTai[j]} ${hienTai[i]}` : `${hienTai[i]} ${hienTai[j]}`;
    if (gop.length > tranGop) break;

    hienTai = [
      ...hienTai.slice(0, Math.min(i, j)),
      gop,
      ...hienTai.slice(Math.max(i, j) + 1),
    ];
    if (hienTai.length <= 1) break;
  }

  return hienTai;
}

/**
 * Chia thời gian theo tỉ lệ SỐ KÝ TỰ của từng mẩu.
 *
 * Tỉ lệ ký tự gần đúng hơn tỉ lệ số mẩu: "Giảm 50%" và "Kem chống nắng nâng tông
 * kiềm dầu suốt mười hai tiếng" không thể chiếm thời lượng bằng nhau.
 */
export function splitByChars(text: string, totalSec: number, maxChars = 42): TimedCue[] {
  // Gộp trước khi chia: mẩu quá ngắn thì nhập vào hàng xóm chứ không để nhấp nháy.
  const chunks = gopMauNgan(chunkText(text, maxChars), totalSec, maxChars);
  if (chunks.length === 0 || !(totalSec > 0)) return [];

  const lens = chunks.map((c) => Math.max(1, c.length));
  const sum = lens.reduce((a, b) => a + b, 0);

  const cues: TimedCue[] = [];
  let cursor = 0;
  for (let i = 0; i < chunks.length; i++) {
    const dur = (lens[i] / sum) * totalSec;
    const start = cursor;
    // Mẩu cuối kết thúc đúng tại totalSec, tránh sai số cộng dồn làm hụt vài phần
    // trăm giây rồi chữ biến mất trước khi tiếng nói dứt.
    const end = i === chunks.length - 1 ? totalSec : cursor + dur;
    cues.push({ startSec: round2(start), endSec: round2(end), text: chunks[i] });
    cursor = end;
  }
  return cues;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "00:00:03,480" -> 3.48 giây. */
export function srtTimeToSec(t: string): number | null {
  const m = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(t.trim());
  if (!m) return null;
  return (
    parseInt(m[1], 10) * 3600 +
    parseInt(m[2], 10) * 60 +
    parseInt(m[3], 10) +
    parseInt(m[4].padEnd(3, '0'), 10) / 1000
  );
}

/**
 * Đọc SRT do Whisper sinh ra.
 *
 * Bỏ qua mẩu hỏng thay vì vứt cả file: Whisper thỉnh thoảng cho ra một khối
 * không có dòng thời gian, mà mất một mẩu vẫn hơn mất toàn bộ phụ đề.
 */
export function parseSrt(srt: string): TimedCue[] {
  const cues: TimedCue[] = [];
  const blocks = srt.replace(/\r/g, '').split(/\n\s*\n/);

  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const tl = lines.find((l) => l.includes('-->'));
    if (!tl) continue;

    const [a, z] = tl.split('-->').map((x) => x.trim());
    const start = srtTimeToSec(a);
    const end = srtTimeToSec(z);
    if (start === null || end === null || end <= start) continue;

    const text = lines.slice(lines.indexOf(tl) + 1).join(' ').trim();
    if (!text) continue;

    cues.push({ startSec: round2(start), endSec: round2(end), text });
  }
  return cues;
}

/** Chạy Whisper qua ffmpeg, trả nội dung SRT. Null khi không chạy được. */
/**
 * Chay Whisper tren mot file tieng, tra ve noi dung SRT.
 *
 * Xuat ra de luong dung clip dung lai: no can CA transcript (cho Call 1) lan moc thoi
 * gian cua tung mau loi (de do xem clip co nhac nen khong).
 */
export async function runWhisper(audioPath: string, modelPath: string, lang: string): Promise<string | null> {
  // Chạy ffmpeg TỪ thư mục chứa model, rồi chỉ truyền tên file trần.
  //
  // Lý do: ffmpeg dùng ':' làm ký tự phân cách tham số filter, nên đường dẫn
  // Windows "D:/..." cắt câu lệnh làm đôi. Cú pháp thoát của ffmpeg có nhiều
  // tầng (dấu gạch chéo, nháy đơn, mức filtergraph) và rất dễ sai theo cách
  // chỉ lộ ra lúc chạy thật. Đổi thư mục làm việc thì không còn dấu ':' nào
  // trong chuỗi filter — hết hẳn vấn đề thay vì vá từng tầng thoát.
  const modelDir = path.dirname(path.resolve(modelPath));
  const modelFile = path.basename(modelPath);
  const outFile = `vipro-whisper-${Date.now()}.srt`;
  const outPath = path.join(modelDir, outFile);

  const ok = await new Promise<boolean>((resolve) => {
    const p = spawn('ffmpeg', [
      '-v', 'error',
      '-i', path.resolve(audioPath),
      '-af', [
        'whisper=model=' + modelFile,
        'language=' + lang,
        'format=srt',
        'destination=' + outFile,
        // Mẩu ngắn thì chữ đổi kịp nhịp nói; để 0 Whisper gộp cả câu dài.
        'max_len=42',
      ].join(':'),
      '-f', 'null', '-',
    ], { cwd: modelDir });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => {
      if (code !== 0) {
        console.warn(`[Subtitle] Whisper that bai (ma ${code}): ${err.trim().slice(0, 200)}`);
      }
      resolve(code === 0);
    });
    p.on('error', (e) => {
      console.warn(`[Subtitle] Khong chay duoc ffmpeg cho Whisper: ${e.message}`);
      resolve(false);
    });
  });

  if (!ok || !fs.existsSync(outPath)) return null;
  const srt = fs.readFileSync(outPath, 'utf8');
  try { fs.unlinkSync(outPath); } catch { /* file tam, khong quan trong */ }
  return srt.trim() || null;
}

/**
 * Đặt chữ GỐC của ta lên mốc thời gian Whisper đo được.
 *
 * KHÔNG dùng chữ Whisper nhận ra. Model small nghe tiếng Việt vẫn sai nhiều:
 * "Kem chống nắng" thành "Kêm trồng nắng", "không gây bí da" thành "Hôm nay bị ra".
 * Hiện chữ sai trên video quảng cáo còn tệ hơn phụ đề lệch vài phần mười giây.
 *
 * Ta đã có câu gốc vì chính ta đưa nó cho TTS đọc. Việc Whisper làm tốt là đo
 * NGƯỜI ĐỌC dừng ở đâu — lấy đúng phần đó, bỏ phần đoán chữ.
 */
export function mapTextToTiming(text: string, timing: TimedCue[], maxChars = 42): TimedCue[] {
  const cleanTiming = timing.filter((t) => t.endSec > t.startSec);
  if (cleanTiming.length === 0) return [];

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Mỗi khoảng thời gian nhận số từ tỉ lệ với độ dài của nó.
  const total = cleanTiming.reduce((s, t) => s + (t.endSec - t.startSec), 0);
  if (!(total > 0)) return [];

  const out: TimedCue[] = [];
  let wi = 0;

  for (let i = 0; i < cleanTiming.length; i++) {
    const t = cleanTiming[i];
    const share = (t.endSec - t.startSec) / total;
    // Khoảng cuối lấy hết số từ còn lại: làm tròn từng khoảng có thể bỏ sót
    // một hai từ ở cuối, và mất chữ thì khách thấy ngay.
    const take = i === cleanTiming.length - 1
      ? words.length - wi
      : Math.max(1, Math.round(words.length * share));

    const chunk = words.slice(wi, wi + take).join(' ');
    wi += take;

    if (chunk) out.push({ startSec: t.startSec, endSec: t.endSec, text: chunk });
    if (wi >= words.length) break;
  }

  // Còn từ thừa (do làm tròn) thì nối vào mẩu cuối, không vứt đi.
  if (wi < words.length && out.length > 0) {
    out[out.length - 1].text += ' ' + words.slice(wi).join(' ');
  }

  return out;
}

export interface AlignOptions {
  /** Đường dẫn model ggml của whisper.cpp. Để trống thì bỏ qua Whisper. */
  modelPath?: string;
  language?: string;
  maxChars?: number;
  /** Độ dài đã biết, đỡ phải gọi ffprobe lại. */
  durationSec?: number;
}

/**
 * Căn phụ đề cho MỘT câu nói.
 *
 * Luôn trả về được cái gì đó: Whisper hỏng thì lui về chia theo tỉ lệ, không
 * ném lỗi. Phụ đề lệch vài phần mười giây vẫn hơn video không có phụ đề.
 */
export async function alignSubtitles(
  audioPath: string,
  text: string,
  opts: AlignOptions = {}
): Promise<{ cues: TimedCue[]; method: 'whisper' | 'tile-le' }> {
  const maxChars = opts.maxChars ?? 42;

  if (opts.modelPath && fs.existsSync(opts.modelPath)) {
    const srt = await runWhisper(audioPath, opts.modelPath, opts.language ?? 'vi');
    if (srt) {
      const heard = parseSrt(srt);
      if (heard.length > 0) {
        // Chỉ lấy MỐC THỜI GIAN của Whisper, chữ dùng bản gốc của ta.
        const cues = mapTextToTiming(text, heard, maxChars);
        if (cues.length > 0) return { cues, method: 'whisper' };
      }
      console.warn('[Subtitle] Whisper chay xong nhung khong dung duoc — lui ve chia ti le.');
    }
  }

  const dur = opts.durationSec ?? (await probeDuration(audioPath));
  if (!dur) return { cues: [], method: 'tile-le' };

  return { cues: splitByChars(text, dur, maxChars), method: 'tile-le' };
}
