/**
 * Thử nhà cung cấp lồng tiếng bằng MỘT câu, không cần render cả video.
 *
 * Chạy:  npx tsx src/scripts/test-tts.ts
 *        npx tsx src/scripts/test-tts.ts "Câu muốn đọc thử"
 *
 * Dò lỗi cấu hình ở đây rẻ hơn nhiều so với chờ một lần render 14 giây rồi mới
 * biết khoá sai. In ra đường dẫn file để nghe thử, và độ dài thật đo bằng ffprobe.
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { synthesize, ttsEnabled, TtsError } from '../services/tts.provider';

const CAU_MAU = 'Kem chống nắng nâng tông, kiềm dầu suốt mười hai tiếng, không gây bí da.';

/** Đo độ dài file âm thanh. Trả null nếu không có ffprobe. */
function doThoiLuong(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ]);
    let out = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('close', () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : null);
    });
    p.on('error', () => resolve(null));
  });
}

async function main() {
  const text = process.argv[2] || CAU_MAU;
  const provider = process.env.TTS_PROVIDER || 'vieneu';

  console.log('');
  console.log('  Nha cung cap : ' + provider);
  console.log('  Da bat       : ' + (ttsEnabled() ? 'co' : 'KHONG — kiem TTS_ENABLED trong .env'));
  if (provider === 'fpt') {
    console.log('  Kieu xac thuc: ' + (process.env.FPT_TTS_AUTH_STYLE || 'api_key'));
    console.log('  Endpoint     : ' + (process.env.FPT_TTS_ENDPOINT || 'https://api.fpt.ai/hmi/tts/v5'));
    console.log('  Co khoa      : ' + (process.env.FPT_TTS_API_KEY ? 'co' : 'KHONG — dat FPT_TTS_API_KEY'));
  } else {
    console.log('  Endpoint     : ' + (process.env.VIENEU_BASE_URL || 'http://localhost:8080'));
  }
  console.log('  Cau thu      : "' + text + '"');
  console.log('');

  if (!ttsEnabled()) {
    console.log('  Long tieng dang TAT. Dat TTS_ENABLED=true roi chay lai.');
    process.exit(1);
  }

  const batDau = Date.now();
  try {
    const r = await synthesize({ text, traceId: 'test-tts' });
    const bytes = fs.statSync(r.filePath).size;
    const giay = await doThoiLuong(r.filePath);

    console.log('  THANH CONG');
    console.log('    file      : ' + r.filePath);
    console.log('    kich thuoc: ' + (bytes / 1024).toFixed(0) + ' KB');
    console.log('    do dai    : ' + (giay !== null ? giay.toFixed(1) + ' giay' : 'khong do duoc (thieu ffprobe)'));
    console.log('    nguon     : ' + (r.cached ? 'cache' : 'sinh moi ' + r.latencyMs + 'ms'));

    // Mot file qua ngan gan nhu chac chan la hong, du da qua duoc kiem byte dau.
    if (giay !== null && giay < 0.5) {
      console.log('');
      console.log('    CANH BAO: file ngan bat thuong — nhieu kha nang khong co tieng that.');
    }
    console.log('');
    console.log('  Mo file de nghe thu, roi chay lai de kiem cache (lan hai phai nhanh han han).');
  } catch (err: any) {
    const ma = err instanceof TtsError ? err.code : 'KHONG_RO';
    console.log('  THAT BAI sau ' + (Date.now() - batDau) + 'ms');
    console.log('    ma loi : ' + ma);
    console.log('    chi tiet: ' + err.message);
    console.log('');
    const goiY: Record<string, string> = {
      TTS_NO_KEY: 'Dat FPT_TTS_API_KEY trong backend/.env',
      TTS_UNREACHABLE: 'Server VieNeu chua chay, hoac sai VIENEU_BASE_URL',
      TTS_HTTP_ERROR: 'Khoa sai, het so du, hoac khoa khong co quyen TTS',
      TTS_BAD_RESPONSE: 'Sai endpoint hoac sai kieu xac thuc — thu doi FPT_TTS_AUTH_STYLE',
      TTS_PROVIDER_REJECTED: 'FPT nhan duoc nhung tu choi — xem thong bao tren',
      TTS_TIMEOUT: 'Qua gio cho. Cau qua dai, hoac server qua tai',
      TTS_NOT_AUDIO: 'Server tra ve khong phai am thanh — xem dau file tren',
    };
    if (goiY[ma]) console.log('    goi y  : ' + goiY[ma]);
    console.log('');
    process.exit(1);
  }
}

void main();
