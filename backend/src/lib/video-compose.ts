/**
 * Viprosell — Ráp lệnh ffmpeg cho luồng dựng lại clip
 *
 * Khác nhánh ảnh ở một điểm làm đơn giản đi nhiều thứ: **mọi đoạn đến từ CÙNG MỘT
 * clip**. Nhánh ảnh có N ảnh là N input; ở đây chỉ một input, và các đoạn là các lát
 * cắt khác nhau của nó. Nghĩa là không phải lo thứ tự `-i`, và `trim` lấy được đoạn
 * ở bất kỳ đâu — kể cả lấy đoạn giữa clip đưa lên làm hook.
 */
import { cropFilter, gradeFilter, stabilizeParams, AUDIO_EDGE_FADE_MS, type Segment, type Grade, type Stabilize } from './video-edit';

/**
 * Mức nhạc nền: 20%.
 *
 * Chốt 28/10. Ở mức này nhạc còn nghe được như một nền, nhưng không tranh với giọng
 * khách — mà giọng khách mới là thứ mang sức thuyết phục của luồng này.
 */
/**
 * `loudnorm` LUÔN phải đi kèm `aresample`.
 *
 * Nó xuất ra 192 kHz, mà AAC chỉ nhận tới 96 kHz — encoder trả -22 và ffmpeg báo
 * "Nothing was written into output file, because at least one of its streams received
 * no packets". Đo thật 28/10: chuỗi filter trông hoàn toàn đúng, chỉ lộ khi chạy.
 */
export const MUSIC_VOLUME = 0.20;

/**
 * Mức nhạc khi đang có lời: khoảng 10%, tức ≈ −20 dB so với giọng.
 *
 * Con số này KHÔNG đặt thẳng vào filter — `sidechaincompress` hạ nhạc theo dạng sóng
 * giọng thật rồi tự nâng lại ở quãng nghỉ, mượt hơn nhiều so với bật/tắt theo ranh
 * giới đoạn. Giữ hằng số ở đây làm mốc để đối chiếu khi chỉnh tham số nén.
 */
export const MUSIC_VOLUME_DUCKED = 0.10;

export interface ComposeOptions {
  clipPath: string;
  segments: Segment[];
  width: number;
  height: number;
  fps: number;
  grade: Grade;
  stabilize: Stabilize;
  outputPath: string;
  /** File .ass chứa chữ trên màn hình; để trống thì không burn chữ. */
  assPath?: string | null;
  /** Nhạc nền từ thư viện nội bộ. null = không thêm nhạc. */
  musicPath?: string | null;
  /** Clip gốc có tiếng không (ffprobe). Không có thì bỏ hẳn nhánh audio của nó. */
  hasOriginalAudio: boolean;
  /** Giữ tiếng gốc hay bỏ. Bỏ thì video chỉ còn nhạc. */
  keepOriginalAudio: boolean;
  /** File .trf do lượt vidstabdetect sinh ra. Thiếu thì bỏ qua chống rung. */
  stabilizeTrfPath?: string | null;
  codec?: string;
  /**
   * Clip gốc đã có nhạc lẫn trong tiếng nói, do worker ĐO chứ không do model đoán.
   *
   * Cờ của worker là nguồn đúng, kể cả khi Call 2 vẫn khai `music_bed` khác `none`:
   * QA lẽ ra đã chặn, nhưng hàm ghép không dựa vào việc QA có chạy hay không. Chồng
   * một bài hát thư viện lên một clip đã có nhạc là hai bài phát cùng lúc.
   */
  musicBedLikely?: boolean;
}

/**
 * Hai lượt chống rung, chạy TRƯỚC khi cắt đoạn, trên một bản đã hạ về khổ đích.
 *
 * Ba điều học được từ đo thật trên clip 8 giây 4K (28/10):
 *
 * 1. **Hạ khung trước rồi mới chống rung: 4,5s thay vì 26,1s — nhanh 5,8 lần.**
 *    Và nó còn ĐÚNG hơn: vector trong .trf tính theo pixel của độ phân giải lúc phân
 *    tích, nên phân tích ở 4K rồi áp lên bản 1080 là sai tỉ lệ dịch chuyển.
 *    So với không chống rung (4,0s) thì nay chỉ tốn thêm 0,5 giây.
 *
 * 2. **Phải chạy trên TOÀN clip, trước khi cắt.** `vidstabtransform` đọc .trf tuần tự
 *    theo số khung. Cắt trước rồi nắn thì số khung không còn khớp với file đo, và hình
 *    bị nắn theo chuyển động của một đoạn khác.
 *
 * 3. **Đường dẫn .trf phải là TÊN FILE TRẦN**, với `cwd` trỏ vào thư mục chứa nó.
 *    Đường dẫn đầy đủ làm ffmpeg trả -22 (`Invalid argument`), vì `:` trong `D:` là dấu
 *    phân cách tham số của filter — thoát dấu cũng không cứu được. Cùng cái bẫy đã xử ở
 *    đường dẫn model Whisper.
 *
 *    Đây là lỗi IM LẶNG: job bắt mã lỗi rồi bỏ qua chống rung, nên video vẫn ra mà
 *    không ai biết nó chưa từng được nắn.
 *
 * Trả về hai lệnh và tên file trung gian; người gọi chạy lần lượt với `cwd = tmpDir`.
 */
export function buildStabilizePassCommands(opts: {
  clipPath: string;
  level: Stabilize;
  width: number;
  height: number;
}): { detect: string[]; transform: string[]; trfName: string; outName: string } | null {
  const p = stabilizeParams(opts.level);
  if (!p) return null;

  const { clipPath, width, height } = opts;
  const trfName = 'stab.trf';
  const outName = 'stabilized.mp4';
  const veKho = `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`;

  return {
    trfName,
    outName,
    detect: [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', clipPath,
      '-vf', `${veKho},vidstabdetect=shakiness=${p.shakiness}:accuracy=15:result=${trfName}`,
      '-f', 'null', '-',
    ],
    transform: [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', clipPath,
      '-vf', `${veKho},vidstabtransform=input=${trfName}:smoothing=10,unsharp=5:5:0.8:3:3:0.4`,
      // Giữ tiếng nguyên vẹn: bản trung gian vẫn phải mang giọng khách sang bước cắt.
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
      '-c:a', 'copy',
      outName,
    ],
  };
}

/** Một đoạn có cần đổi tốc độ không. Ngoài khoảng này thì QA đã ép về 1 rồi. */
function coDoiToc(speed: number): boolean {
  return Number.isFinite(speed) && Math.abs(speed - 1) > 0.001;
}

/**
 * Độ dài thật của một đoạn sau khi tính tốc độ, tính bằng giây.
 *
 * Tua nhanh 1.15× thì 2 giây nguồn chỉ còn 1,74 giây trên thành phẩm. Không chia thì
 * mọi mốc phụ đề sau đó lệch dần, và lệch tích luỹ qua từng đoạn.
 */
export function segmentOutSec(s: Segment): number {
  const tho = Math.max(0, (s.out_ms - s.in_ms) / 1000);
  const toc = coDoiToc(s.speed) ? s.speed : 1;
  return tho / toc;
}

/**
 * Ráp lệnh ffmpeg hoàn chỉnh.
 *
 * Trả về cả `segmentStarts` — mốc bắt đầu của từng đoạn TRÊN THÀNH PHẨM, để người gọi
 * đặt chữ đúng chỗ. Tính ở đây vì chỉ ở đây mới biết tốc độ và xfade ăn mất bao nhiêu.
 */
export function buildEditCommand(opts: ComposeOptions): {
  args: string[];
  durationSec: number;
  segmentStarts: number[];
} {
  const {
    clipPath, segments, width, height, fps, grade, stabilize,
    outputPath, assPath, musicPath, hasOriginalAudio, keepOriginalAudio,
    stabilizeTrfPath, codec = 'libx264', musicBedLikely = false,
  } = opts;

  const args: string[] = ['-hide_banner', '-loglevel', 'error'];
  const filters: string[] = [];

  // Input 0 luôn là clip gốc. Nhạc nếu có là input 1.
  args.push('-i', clipPath);
  // Clip đã có nhạc thì KHÔNG thêm nhạc thư viện, bất kể người gọi truyền gì vào.
  const coNhac = Boolean(musicPath) && !musicBedLikely;
  if (musicPath && musicBedLikely) {
    console.warn('[Compose] Clip da co nhac san — bo nhac thu vien de khong chong hai bai len nhau.');
  }
  if (coNhac) args.push('-i', musicPath!);

  const mauSac = gradeFilter(grade);
  // Chống rung KHÔNG nằm trong chuỗi này nữa — nó đã chạy ở bước tiền xử lý trên toàn
  // clip (xem buildStabilizePassCommands). Chạy ở đây là sai: vidstabtransform đọc .trf
  // tuần tự theo số khung, mà ở đây clip đã bị cắt thành từng đoạn nên số khung không
  // còn khớp với file đo.
  void stabilize;
  void stabilizeTrfPath;

  const segmentStarts: number[] = [];
  let moc = 0;

  /* ─── Từng đoạn: cắt, nắn, đổi khổ ─── */
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const batDau = s.in_ms / 1000;
    const ketThuc = s.out_ms / 1000;
    const daiRa = segmentOutSec(s);

    segmentStarts.push(moc);
    moc += daiRa;

    const soKhung = Math.max(1, Math.round(daiRa * fps));
    const khung = cropFilter(s.crop, width, height, soKhung, fps);

    // `trim` rồi `setpts=PTS-STARTPTS`: thiếu setpts thì đoạn cắt ra vẫn mang mốc thời
    // gian gốc, và concat sẽ chèn khoảng trống đúng bằng đoạn đã bỏ đi.
    let v =
      `[0:v]trim=start=${batDau.toFixed(3)}:end=${ketThuc.toFixed(3)},setpts=PTS-STARTPTS,`;

    if (coDoiToc(s.speed)) v += `setpts=PTS/${s.speed.toFixed(3)},`;
    v += `fps=${fps},${khung}`;
    if (mauSac) v += `,${mauSac}`;
    v += `,setsar=1,format=yuv420p[v${i}]`;
    filters.push(v);

    if (hasOriginalAudio && keepOriginalAudio) {
      let a = `[0:a]atrim=start=${batDau.toFixed(3)}:end=${ketThuc.toFixed(3)},asetpts=PTS-STARTPTS`;
      // `atempo` giữ cao độ khi đổi tốc độ — thiếu nó thì giọng khách bị méo như hoạt
      // hình, và mất đúng cái tự nhiên mà luồng này tồn tại để giữ.
      if (coDoiToc(s.speed)) a += `,atempo=${s.speed.toFixed(3)}`;

      // Fade 12ms hai đầu để hết tiếng "click".
      //
      // Cắt giữa chu kỳ sóng tạo ra một bước nhảy biên độ, và tai nghe nó thành tiếng
      // tách. Chỉ 12ms: dài hơn là nghe thành tiếng phai, mà trên clip có nhạc thì mỗi
      // lần phai là bài hát mờ đi rồi rõ lại — lộ chỗ cắt rõ hơn là để nguyên.
      const fade = (AUDIO_EDGE_FADE_MS / 1000).toFixed(3);
      const raFade = Math.max(0, daiRa - AUDIO_EDGE_FADE_MS / 1000).toFixed(3);
      a += `,afade=t=in:st=0:d=${fade},afade=t=out:st=${raFade}:d=${fade}`;
      a += `[a${i}]`;
      filters.push(a);
    }
  }

  /* ─── Nối các đoạn ─── */
  const coTiengGoc = hasOriginalAudio && keepOriginalAudio;

  if (coTiengGoc) {
    // `concat` đòi nhãn XEN KẼ theo từng đoạn: [v0][a0][v1][a1]...
    //
    // Gom thành [v0][v1][v2][a0][a1][a2] thì ffmpeg nối pad hình của đoạn 2 vào pad
    // tiếng của concat và trả `Media type mismatch ... Error linking filters`, mã -22.
    // Lỗi này KHÔNG lộ ra ở test kiểm "nhãn có mặt" — chỉ lộ khi chạy ffmpeg thật.
    const xenKe = segments.map((_, i) => `[v${i}][a${i}]`).join('');
    filters.push(`${xenKe}concat=n=${segments.length}:v=1:a=1[vcat][acat]`);
  } else {
    const chiHinh = segments.map((_, i) => `[v${i}]`).join('');
    filters.push(`${chiHinh}concat=n=${segments.length}:v=1:a=0[vcat]`);
  }

  /* ─── Chữ trên màn hình ─── */
  let nhanVideo = '[vcat]';
  if (assPath) {
    // Đường dẫn Windows có dấu ':' của ổ đĩa, mà ':' lại là dấu phân cách tham số của
    // filter. Đổi sang '/' và thoát dấu hai chấm — cùng cái bẫy đã mất nhiều lần thử
    // ở nhánh phụ đề.
    const p = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filters.push(`[vcat]subtitles='${p}'[vout]`);
    nhanVideo = '[vout]';
  }

  /* ─── Âm thanh ─── */
  //
  // Chốt 28/10: GIỮ CẢ HAI — tiếng gốc (giọng khách, kể cả nhạc lẫn trong đó) và nhạc
  // nền thư viện ở 20%.
  //
  // Không tách được nhạc khỏi giọng trong một dạng sóng đã trộn, nên "bỏ nhạc gốc" là
  // việc không làm được. Người gọi phải tự quyết: clip đã có nhạc thì ĐỪNG truyền
  // musicPath — hai bài hát khác nhau phát cùng lúc tệ hơn cả hai phương án.
  let nhanAudio: string | null = null;

  if (coTiengGoc && coNhac) {
    // Nhạc thư viện bám ĐỒNG HỒ THÀNH PHẨM, không bám từng đoạn: nó không thuộc clip
    // gốc nên không có lý do gì phải đứt theo chỗ cắt. Một track duy nhất, bắt đầu
    // cùng khung 0 của file xuất, trải suốt `moc` giây.
    filters.push(`[1:a]aloop=loop=-1:size=2e9,atrim=duration=${moc.toFixed(3)},asetpts=PTS-STARTPTS,volume=${MUSIC_VOLUME}[mus]`);

    // `sidechaincompress` hạ nhạc mỗi khi có tiếng nói, rồi tự nâng lại ở quãng nghỉ —
    // đúng thứ "hạ thêm khi segment có tiếng nói" mô tả, và làm liên tục theo dạng
    // sóng thật chứ không theo ranh giới đoạn.
    filters.push(`[mus][acat]sidechaincompress=threshold=0.05:ratio=8:attack=50:release=400[musduck]`);
    filters.push(`[acat][musduck]amix=inputs=2:duration=first:dropout_transition=0[amix]`);
    filters.push(`[amix]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`);
    nhanAudio = '[aout]';
  } else if (coTiengGoc) {
    filters.push(`[acat]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`);
    nhanAudio = '[aout]';
  } else if (coNhac) {
    // Không có tiếng gốc: nhạc lên mức bình thường, không còn gì để nhường.
    filters.push(`[1:a]aloop=loop=-1:size=2e9,atrim=duration=${moc.toFixed(3)},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`);
    nhanAudio = '[aout]';
  }

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', nhanVideo);
  if (nhanAudio) args.push('-map', nhanAudio);

  args.push('-c:v', codec, '-preset', 'veryfast', '-b:v', '4M', '-pix_fmt', 'yuv420p');
  if (nhanAudio) args.push('-c:a', 'aac', '-b:a', '128k');
  else args.push('-an');

  args.push('-r', String(fps), '-movflags', '+faststart', '-y', outputPath);

  return { args, durationSec: moc, segmentStarts };
}
