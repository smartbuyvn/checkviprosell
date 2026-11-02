/**
 * Viprosell — Phát hiện clip có nhạc lẫn trong tiếng nói
 *
 * Giọng và nhạc trong file khách nộp là MỘT dạng sóng. Không có source separation
 * trong pipeline này, nên không tách được. Hai việc làm được chỉ là giữ cả khối tiếng
 * hoặc bỏ cả khối — và bỏ cả khối là phá đúng việc "giữ tự nhiên", nên mặc định là giữ.
 *
 * Nhưng biết được clip CÓ nhạc hay không vẫn quan trọng, vì nó đổi cách dựng: đảo thứ
 * tự cảnh trên một clip có nhạc sẽ làm bài hát nhảy, nghe như video lỗi.
 *
 * Việc này KHÔNG hỏi model. Model nghe mô tả khung hình chứ không nghe tiếng, nên
 * `problems: ["music_bed"]` của Call 1 chỉ là phỏng đoán. Ở đây đo bằng số.
 */
import { spawn } from 'child_process';

/**
 * Khoảng lặng ngắn hơn mức này không đáng đo: chúng là chỗ ngắt hơi giữa câu, vẫn
 * còn đuôi vang của từ trước.
 */
const MIN_GAP_MS = 400;

/**
 * Chênh lệch tối thiểu giữa lúc nói và lúc im, tính bằng dB.
 *
 * Clip quay trong phòng yên: lúc im gần như không còn gì, chênh 20–40 dB. Clip có
 * nhạc: lúc im vẫn còn nhạc chạy, chênh chỉ vài dB. Lấy 8 dB làm ranh giới.
 */
const NGUONG_DB = 8;

export interface Gap {
  startMs: number;
  endMs: number;
}

/**
 * Tìm các khoảng Whisper coi là im: phần giữa hai mẩu lời liên tiếp.
 *
 * Dùng kết quả Whisper chứ không dò im lặng bằng ffmpeg, vì ffmpeg không phân biệt
 * được "im" với "có nhạc nhưng không ai nói" — mà đó đúng là thứ cần phân biệt.
 */
export function findSilentGaps(
  cues: Array<{ startSec: number; endSec: number }>,
  clipDurationSec: number
): Gap[] {
  const gaps: Gap[] = [];
  const sapXep = [...(cues ?? [])].sort((a, b) => a.startSec - b.startSec);

  let moc = 0;
  for (const c of sapXep) {
    const dai = (c.startSec - moc) * 1000;
    if (dai >= MIN_GAP_MS) gaps.push({ startMs: Math.round(moc * 1000), endMs: Math.round(c.startSec * 1000) });
    moc = Math.max(moc, c.endSec);
  }

  const cuoi = (clipDurationSec - moc) * 1000;
  if (cuoi >= MIN_GAP_MS) gaps.push({ startMs: Math.round(moc * 1000), endMs: Math.round(clipDurationSec * 1000) });

  return gaps;
}

/** Khoảng nào CÓ lời: dùng để đo mức tham chiếu. */
export function speechWindows(cues: Array<{ startSec: number; endSec: number }>): Gap[] {
  return (cues ?? [])
    .filter((c) => c.endSec > c.startSec)
    .map((c) => ({ startMs: Math.round(c.startSec * 1000), endMs: Math.round(c.endSec * 1000) }));
}

/**
 * Đo mức âm trung bình (RMS) của một khoảng, tính bằng dBFS.
 *
 * Trả về null khi không đo được — người gọi phải coi đó là "không biết", không phải
 * "im lặng". Coi nhầm thành im lặng sẽ kết luận clip không có nhạc và cho phép đảo
 * cảnh, đúng cái cần tránh.
 */
export function measureRms(filePath: string, startMs: number, endMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const dai = (endMs - startMs) / 1000;
    if (!(dai > 0)) return resolve(null);

    const p = spawn('ffmpeg', [
      '-hide_banner',
      '-ss', (startMs / 1000).toFixed(3),
      '-t', dai.toFixed(3),
      '-i', filePath,
      '-map', '0:a:0',
      '-af', 'volumedetect',
      '-f', 'null', '-',
    ]);

    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', () => resolve(null));
    p.on('close', () => {
      const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(err);
      resolve(m ? Number(m[1]) : null);
    });
  });
}

export interface MusicVerdict {
  likely: boolean;
  /** Vì sao kết luận vậy — để ghi log và để hiện câu giải thích cho khách. */
  reason: 'nguoi_dung_khai' | 'do_duoc' | 'khong_do_duoc' | 'khong_co_tieng';
  speechDb?: number;
  silenceDb?: number;
}

/**
 * Quyết định clip có nhạc nền hay không.
 *
 * Thứ tự nguồn, không đảo được:
 *   1. Khách tự khai. Khách tick là ĐÚNG — phép đo không được phủ định lời khách.
 *   2. Không khai thì đo.
 *
 * Đo không ra thì trả `likely = true`, tức nghiêng về phía an toàn: coi như có nhạc
 * nên không đảo cảnh, không thêm nhạc. Đoán sai về phía này thì video hơi kém linh
 * hoạt; đoán sai về phía kia thì bài hát nhảy giữa video và khách nghe ra ngay.
 */
export async function detectMusicBed(opts: {
  filePath: string;
  hasAudio: boolean;
  userDeclared?: boolean;
  cues: Array<{ startSec: number; endSec: number }>;
  clipDurationSec: number;
}): Promise<MusicVerdict> {
  const { filePath, hasAudio, userDeclared, cues, clipDurationSec } = opts;

  if (userDeclared) return { likely: true, reason: 'nguoi_dung_khai' };
  if (!hasAudio) return { likely: false, reason: 'khong_co_tieng' };

  const gaps = findSilentGaps(cues, clipDurationSec);
  const noi = speechWindows(cues);

  // Không có lời nào, hoặc không có khoảng im nào đủ dài: không đo được bằng cách này.
  if (gaps.length === 0 || noi.length === 0) {
    return { likely: true, reason: 'khong_do_duoc' };
  }

  const dbIm = await measureRms(filePath, gaps[0].startMs, gaps[0].endMs);
  const dbNoi = await measureRms(filePath, noi[0].startMs, noi[0].endMs);

  if (dbIm === null || dbNoi === null) {
    return { likely: true, reason: 'khong_do_duoc' };
  }

  return {
    likely: compareDb(dbNoi, dbIm),
    reason: 'do_duoc',
    speechDb: dbNoi,
    silenceDb: dbIm,
  };
}

/**
 * Lúc im có còn to gần bằng lúc nói không.
 *
 * Chênh dưới 8 dB nghĩa là khoảng "im" vẫn đầy âm thanh — gần như chắc chắn là nhạc.
 */
export function compareDb(speechDb: number, silenceDb: number): boolean {
  if (!Number.isFinite(speechDb) || !Number.isFinite(silenceDb)) return true;
  return speechDb - silenceDb < NGUONG_DB;
}

export { MIN_GAP_MS, NGUONG_DB };
