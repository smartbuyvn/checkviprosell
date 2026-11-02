/**
 * Viprosell — Physical Local Render Worker (Realtime, unified path)
 * Subscribes to Supabase Realtime for new `renders` rows (status=pending).
 *
 * Job resolution order:
 *   1. row.render_plan_json (pre-validated)  → render directly
 *   2. row.scene_graph_json (wizard scene cards / tier3 graph) → Tier 4 (render plan) → render
 *   3. row.raw_input (quick-ads internal)    → full 4-tier Local AI pipeline → render
 *
 * Render: FFmpeg NVENC on GPU 0 (RTX 3060 12GB). LLM runs on GPU 1 via dedicated Ollama.
 * On completion: upload to Supabase Storage + POST render callback (credits deducted by API).
 */
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { SceneGraphService } from './services/scene-graph.service';
import type { Tier3SceneGraph, Tier4RenderPlan } from './services/pipeline.service';
import { safeDownload } from './lib/fetch-guard';
import { buildAssFile, escapeFilterPath, type AssCue } from './lib/ass-subtitle';
import { synthesize, ttsEnabled } from './services/tts.provider';
import { alignSubtitles, probeDuration, splitByChars, type TimedCue } from './lib/subtitle-align';
import { purgeExpiredProjects, purgeSourceClips, donThuMucTamCu, GIU_CLIP_GOC_GIO } from './lib/storage-purge';
import { overlayFontSize, buildRenderPlan, inferRole } from './lib/render-plan';
import { qaCheck, formatFindings, scrubPlanOverlays } from './lib/qa-gate';
import { lapKeHoachChuyen, dungChuoiXfade, soKhungCanh, tDauVaoCanh } from './lib/transitions';
import { boCucChu, uocSoDong, FONT_CHU } from './lib/bo-cuc-chu';
import { doSoDongNhieu } from './lib/do-chu';
import { nangAnh, canNang, duongBoNang, PX_TRAN, PX_CAN_CO } from './lib/nang-anh';
import { tinhKhungTranh, bieuThucCrop, type Khung } from './lib/cat-tranh';
import { doMucFile, gainToiMuc, chuoiGain, chuoiChanDinh, MUC_GIONG } from './lib/chuan-am';
import { docQuangDen, chamVideo, type KetQuaSoat } from './lib/soat-video-den';
import { khopCanhVoiTieng, catLoiChoVua, tempoChoVua, TEMPO_TOI_DA } from './lib/khop-tieng';
import { chonGiong } from './lib/giong-doc';
import { runVideoEditJob } from './video-edit.job';
import { isVideoAsset, buildVideoSceneFilter, pickSegment, probeVideo, MAX_CLIP_BYTES, type VideoMeta } from './lib/video-asset';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || path.join(process.cwd(), '..', 'renders_output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const ASSETS_TMP_DIR = path.join(process.cwd(), 'assets', 'tmp');
fs.mkdirSync(ASSETS_TMP_DIR, { recursive: true });

const AUDIO_ASSETS_DIR = path.join(process.cwd(), 'audio-assets');
fs.mkdirSync(AUDIO_ASSETS_DIR, { recursive: true });

// Spec V2 chot FFmpeg CPU libx264: do duoc 13,8 giay CPU cho video 25s, khong can GPU,
// nho vay worker chay duoc tren VPS. Muon dung NVENC thi dat FFMPEG_VIDEO_ENCODER=h264_nvenc
// va FFMPEG_HWACCEL=cuda; de trong thi khong truyen -hwaccel.
const HWACCEL_MODE = process.env.FFMPEG_HWACCEL || '';
const VIDEO_ENCODER = process.env.FFMPEG_VIDEO_ENCODER || 'libx264';
const NVENC_PRESET = process.env.FFMPEG_NVENC_PRESET || 'p4';
const FFMPEG_GPU_INDEX = parseInt(process.env.FFMPEG_GPU_INDEX || '0', 10); // GPU 0 = RTX 3060 12GB

/**
 * Chat luong nen, CHON BANG DO chu khong theo mac dinh.
 *
 * Do ngay 29/10/2026: dung cung mot anh san pham that qua dung chuoi loc that, so
 * SSIM voi ban khong nen (qp=0):
 *
 *   veryfast + bitrate 4M (ban cu)   SSIM 0.99196    722 KB / 3 giay
 *   slow + CRF 18                    SSIM 0.99493    851 KB
 *   slow + CRF 16                    SSIM 0.99577  1.118 KB   <- chon
 *   slow + CRF 14                    SSIM 0.99628  1.329 KB
 *   slow + CRF 12                    SSIM 0.99665  1.574 KB
 *
 * Tu 16 tro xuong, moi nac chi them ~0.0005 SSIM ma dung luong tang ~19%. 16 la cho
 * loi ich bat dau khong con dang gia.
 *
 * Vi sao bitrate co dinh thua kem: anh tinh zoom cham rat de nen luc dung yen va kho
 * nen luc dang phong. Bitrate co dinh chia deu byte nen bo doi dung luc nguoi xem
 * nhin ky nhat. CRF chi tieu byte o cho can.
 */
const CRF_MUC_TIEU = parseInt(process.env.FFMPEG_CRF || '16', 10);

/**
 * Preset x264. `faster` — KHONG duoc dat cao hon.
 *
 * ── Vi sao co tran tren ──
 *
 * Do that ngay 30/10/2026 tren dung chuoi filter cua worker (6 canh, sieu lay mau
 * 2160x3840, fade hai dau, chuan hoa mau):
 *
 *   ultrafast   ma thoat 0    23 MB
 *   veryfast    ma thoat 0   5,5 MB
 *   faster      ma thoat 0   6,7 MB
 *   medium      ma thoat 139 (SIGSEGV)   48 byte
 *   slow        ma thoat 139 (SIGSEGV)   48 byte
 *
 * Tu `medium` tro len, bo ma hoa SAP tren may nay. Tren Windows ma do hien ra thanh
 * 3221225477 (0xC0000005 ACCESS_VIOLATION) — dung ma loi khach gap ngay 29/10.
 *
 * Toi tung dat `slow` sau khi do SSIM tren MOT anh duy nhat, khong chay thu chuoi
 * filter day du. Bai hoc: do chat luong va do do on dinh la hai phep do khac nhau.
 *
 * ── Chat luong ──
 *
 * SSIM so voi ban khong nen, cung nguon, cung chuoi:
 *
 *   veryfast + bitrate 4M (ban goc)  0,99425   660 KB
 *   veryfast + CRF 16                0,99575   648 KB
 *   faster   + CRF 16                0,99663   777 KB   <- chon
 *
 * `faster` + CRF 16 net hon ban goc ro ret, va nam duoi tran an toan.
 */
const PRESET_X264 = process.env.FFMPEG_X264_PRESET || 'faster';

/**
 * Giới hạn số luồng ffmpeg dùng.
 *
 * ── Vì sao phải giới hạn ──
 *
 * x264 mặc định lấy 1,5 lần số nhân: máy 32 nhân thành **48 luồng**. Đó là thừa
 * nhận, và mỗi luồng giữ riêng một bộ đệm khung hình — với đồ thị filter hiện nay
 * (10 cảnh, chuỗi xfade, phụ đề, ảnh nguồn 2400px sau khi nâng) thì bộ nhớ dồn lại
 * rất nhanh.
 *
 * Ngày 31/10 ffmpeg sập giữa chừng ở render `57c684ca`; worker dựng lại được nhờ có
 * đường lui preset veryfast, nhưng lần dựng đó mất **188 giây** thay vì ~60.
 *
 * ── Vì sao 24 ──
 *
 * Đo thật, ba lần mỗi mức, trên chính kế hoạch đó:
 *
 *     mặc định (48) .. 23,2 / 23,0 / 23,0 giây
 *     24 luồng ....... 23,3 / 23,0 / 22,8   ← KHÔNG tốn thêm giây nào
 *     16 luồng ....... 24,2 / 24,2 / 24,5   (+5%)
 *     8 luồng ........ 28,1 / 28,0 / 27,6   (+22%)
 *
 * 24 là 0,75 lần số nhân: bớt được một nửa số luồng mà không mất tốc độ.
 *
 * Không chứng minh được rằng nó xoá hẳn cú sập — cú sập vốn thưa thớt nên phải chạy
 * hàng trăm lần mới đo được. Chỉ chắc một điều: nó bớt áp lực bộ nhớ, và miễn phí.
 */
const SO_LUONG_FFMPEG = parseInt(process.env.FFMPEG_THREADS || '24', 10);

/** Preset lui ve khi ffmpeg sap. Thap nhat, chac chan chay duoc. */
const PRESET_LUI = 'veryfast';

/**
 * Ma thoat nay co phai ffmpeg SAP khong (khac voi tham so sai).
 *
 * Windows: 3221225477 = 0xC0000005 ACCESS_VIOLATION.
 * POSIX: shell tra 128 + so hieu tin hieu, nen 139 = SIGSEGV.
 */
function laSapDo(ma: number | null): boolean {
  return ma === 3221225477 || ma === 139 || ma === 134 || ma === -11;
}

/**
 * Dai mau va khong gian mau phai noi ro, khong de ffmpeg doan.
 *
 * Anh JPEG mang dai DAY DU (0-255). Khong ep ve yuv420p dai hep thi ffmpeg xuat
 * `yuvj420p`, va do thuc te tren video a7d667cc ngay 29/10 dung la vay. Moi nen tang
 * giai ma lai theo dai hep: den bi nang len, trang bi ep xuong — video trong BAC MAU
 * so voi anh goc, dung thu nguoi ban de ý nhat.
 *
 * `bt709` la chuan cua moi video HD; khong gan nhan thi trinh phat tu doan, va may
 * trinh phat doan khac nhau thi cung mot video ra hai mau khac nhau.
 */
const MAU_ARGS = ['-pix_fmt', 'yuv420p'];

/**
 * Buoc chuan hoa mau, dat o CUOI chuoi loc.
 *
 * Phai nam trong chuoi loc chu khong chi la tham so dong lenh: do ngay 29/10, dat
 * `-colorspace/-color_primaries/-color_trc` sau `-c:v` thi ffprobe doc ra
 * `color_primaries=unknown, color_transfer=unknown` — chi `colorspace` va `color_range`
 * duoc ghi. Them `setparams` vao chuoi loc thi ca bon nhan deu dung.
 *
 * `scale=out_range=tv:out_color_matrix=bt709` lam phan viec THAT: doi pixel tu dai day
 * du cua JPEG sang dai hep cua video. `setparams` chi gan nhan — gan nhan ma khong doi
 * pixel thi cang sai hon la de nguyen.
 */
const LOC_CHUAN_MAU =
  'scale=out_range=tv:out_color_matrix=bt709,' +
  'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';

const CALLBACK_URL = process.env.RENDER_CALLBACK_URL || 'http://localhost:3001/api/v1/render/callback';
const CALLBACK_SECRET = process.env.INTERNAL_CALLBACK_SECRET || '';

const IS_WINDOWS = process.platform === 'win32';
const FONT_FILE = IS_WINDOWS ? (process.env.FFMPEG_FONT_FILE || 'C:/Windows/Fonts/arial.ttf') : (process.env.FFMPEG_FONT_FILE || '');

/**
 * Font cho libass. Mac dinh khac nhau theo he dieu hanh vi hai may co bo font khac han:
 *  - Windows (may chay worker): Montserrat - spec uu tien, da kiem chung hien dung dau tieng Viet.
 *    Neu may khong co, dat ASS_FONT_NAME='Arial' (Windows nao cung co va du dau tieng Viet).
 *  - Linux (VPS): DejaVu Sans - font DUY NHAT tren VPS ho tro tieng Viet (fc-list :lang=vi).
 * Font khong ton tai thi libass tu thay the, va ban thay the co the mat dau -> luon kiem tra
 * khung hinh dau tien sau khi doi font.
 */
/**
 * Dat `WORKER_CHI_NAP=1` de NAP module ma khong khoi dong worker.
 *
 * Can cho cac script chan doan muon dung lai dung lenh ffmpeg worker da chay: import
 * file nay truoc day lam no gianh khoa roi thoat ("DA CO worker khac dang chay"), nen
 * khong tai hien duoc loi trong khi worker that van dang chay.
 */
const CHI_NAP = process.env.WORKER_CHI_NAP === '1';

const ASS_FONT_NAME = FONT_CHU;

// In ra ngay khi khoi dong: hai thu hay sai nhat la encoder va font phu de,
// va ca hai chi lo ra khi video da render xong moi phat hien hong.
if (!CHI_NAP) console.log(
  `[Worker] Cau hinh: encoder=${VIDEO_ENCODER}` +
    `, font phu de="${ASS_FONT_NAME}"` +
    `, output=${OUTPUT_DIR}`
);

/** Giu lai cho cac loi goi cu; phu de chinh da chuyen sang ASS (spec S3-2). */
/**
 * Chuỗi `zoompan` cho một cảnh ảnh tĩnh.
 *
 * Nhận CẢ HAI bộ tên góc máy. Bộ mới (`hero_push`…) là thứ `buildRenderPlan` phát ra
 * hôm nay; bộ cũ (`zoom_in`…) còn nằm trong các bản ghi từ lần chạy trước và phải giữ
 * ĐÚNG hành vi của nó — map `zoom_out` sang nhóm phóng to là đảo ngược chuyển động
 * của một video đã dựng xong.
 *
 * Trước đây hàm này chỉ biết bộ cũ, nên mọi tên mới rơi vào `default` = đứng yên:
 * toàn bộ công đa dạng hoá góc máy bị bỏ im lặng, video vẫn ra nhưng phẳng lì.
 */
function getZoompanFilter(motionType: string, zoomStart: number, zoomEnd: number, width: number, height: number, durationFrames: number, fps: number): string {
  // `d=1`, KHÔNG phải `d=durationFrames`.
  //
  // `d` là số khung XUẤT RA TRÊN MỖI KHUNG VÀO. Ảnh được nạp bằng `-loop 1 -t X` nên
  // ffmpeg đã đưa vào X×fps khung rồi; đặt `d=durationFrames` nhân thêm một lần nữa.
  //
  // Đo thật ngày 29/10: một cảnh 2 giây cho ra video **100 giây**, 3000 khung thay vì
  // 60 — gấp 50 lần. Và vì mỗi cảnh phình ra như vậy, chuỗi filter đầy đủ 6 cảnh làm
  // ffmpeg trả -22 (Invalid argument).
  //
  // Cùng cái bẫy đã sửa ở luồng clip; lần đó tôi chỉ sửa một nửa hệ thống.
  //
  // Biên độ zoom vẫn chia cho `durationFrames`, không chia cho `d`: `on` đếm khung
  // XUẤT RA, nên muốn đi hết biên độ trong đúng cảnh thì mẫu số phải là số khung của
  // cảnh. Chia cho `d=1` sẽ phóng hết biên độ ngay khung đầu tiên.
  const n = Math.max(1, durationFrames);
  const s = `${width}x${height}`;
  const zs = Math.max(1, zoomStart || 1);
  const ze = Math.max(1, zoomEnd || 1.08);

  /**
   * Duong cong vao-ra mem (smoothstep) thay cho tuyen tinh.
   *
   * `t = on/n` chay tu 0 toi 1. Tuyen tinh `zs + (ze-zs)*t` nghia la may quay dat
   * toc do day du ngay khung dau va dung phut o khung cuoi — mat doc ra la "anh bi
   * keo", khong phai "may quay di chuyen".
   *
   * Smoothstep `3t^2 - 2t^3` co dao ham bang 0 o ca hai dau: chuyen dong chom nhe,
   * nhanh dan o giua, roi cham lai truoc khi dung. Do la cach moi cu lia may that
   * bat dau va ket thuc.
   *
   * Khong doi bien do, chi doi CACH di tu dau toi cuoi — nen gioi han buoc moi khung
   * o `camera-moves.ts` van dung: buoc lon nhat (giua chang) bang 1,5 lan buoc trung
   * binh, van duoi nguong giat.
   */
  const t = `(on/${n})`;
  const mem = `(3*${t}*${t}-2*${t}*${t}*${t})`;
  const phongTo = `zoompan=z='${zs}+(${ze}-${zs})*${mem}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
  const dungYen = `zoompan=z='1':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;

  switch (motionType) {
    /* ── Bộ tên mới ── */
    case 'hero_push':
    case 'detail_macro':
    case 'lifestyle_hold':
      return phongTo;
    case 'reveal_up':
      // Bắt đầu thấp hơn rồi đi lên, đúng ý `reveal_up` trong bảng góc máy.
      // Lia doc cung dung duong cong mem, khong chi rieng phep phong to.
      return `zoompan=z='${zs}':d=1:x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-${mem})':s=${s}:fps=${fps}`;
    case 'endcard_lock':
      return dungYen;

    /* ── Bộ tên cũ: giữ nguyên hành vi cho bản ghi từ lần chạy trước ── */
    case 'zoom_in':
    case 'push_in':
      return phongTo;
    case 'zoom_out':
      return `zoompan=z='${ze}+(${zs}-${ze})*on/${n}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
    case 'pan_left':
      return `zoompan=z='1.3':d=1:x='(iw-iw/zoom)*(1-on/${n})':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
    case 'pan_right':
      return `zoompan=z='1.3':d=1:x='(iw-iw/zoom)*on/${n}':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;

    default:
      return dungYen;
  }
}

async function setStatus(renderId: string, status: string, extra: Record<string, any> = {}) {
  await supabase.from('renders').update({ status, updated_at: new Date().toISOString(), ...extra }).eq('id', renderId);
}

/**
 * Trich mot khung hinh lam anh dai dien cho video. Tra ve true neu tao duoc.
 *
 * Khong bao gio nem loi: toi day video da dung xong, thieu anh chi lam giao dien
 * xau chu khong mat ket qua. Nem loi se bien mot ban render thanh cong thanh that bai.
 */
/**
 * Soat video vua dung xong co bi den khong.
 *
 * Moi cong kiem khac cua he thong soat KE HOACH — chuoi filter, do thi canh, loi
 * thoai. Khong cai nao mo FILE DA DUNG ra xem. Ngay 28/10 khach bao "video hoan
 * thanh thi trong den": ffmpeg tra ma 0, file co dung luong, trang thai ghi
 * 'completed', credit bi tru, va khach la nguoi dau tien biet video hong.
 *
 * Y lay tu TECHNIQUE.md cua lemomo-ai/lemo-opuscar (MIT): kiem file cuoi bang
 * `blackdetect` truoc khi coi la xong.
 *
 * Hong phep kiem thi coi nhu DAT: mot phep kiem phu khong duoc tro thanh nguon
 * hong moi.
 */
function soatDen(videoPath: string, tongThoiLuong: number): Promise<KetQuaSoat> {
  return new Promise((resolve) => {
    const dat: KetQuaSoat = { dat: true, denOGiua: 0, quangDaiNhat: 0, lyDo: null };
    const p = spawn('ffmpeg', [
      '-v', 'info', '-i', videoPath,
      '-vf', 'blackdetect=d=0.1:pic_th=0.98:pix_th=0.10',
      '-f', 'null', '-',
    ]);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => resolve(dat));
    p.on('close', () => {
      try {
        resolve(chamVideo(docQuangDen(err), tongThoiLuong));
      } catch {
        resolve(dat);
      }
    });
  });
}

function makeThumbnail(videoPath: string, outPath: string, atSec = 1): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', [
      '-v', 'error',
      '-ss', String(atSec),
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', 'scale=540:-2',
      '-y', outPath,
    ]);

    let stderrOut = '';
    proc.stderr.on('data', (d) => { stderrOut += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) return resolve(true);
      console.warn(`[Worker] Khong tao duoc anh dai dien (ffmpeg thoat ${code}): ${stderrOut.trim().slice(0, 300)}`);
      resolve(false);
    });

    proc.on('error', (err) => {
      console.warn(`[Worker] Khong chay duoc ffmpeg de lay anh dai dien: ${err.message}`);
      resolve(false);
    });
  });
}

function execFfmpegWithProgress(args: string[], totalDurationSec: number, renderId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let lastProgressTime = 0;
    let stderrOut = '';

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      stderrOut += output;
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
      if (timeMatch && totalDurationSec > 0) {
        const currentTime = parseFloat(timeMatch[1]) * 3600 + parseFloat(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
        const progress = Math.min(99, Math.round((currentTime / totalDurationSec) * 100));
        const now = Date.now();
        if (now - lastProgressTime > 2000) {
          lastProgressTime = now;
          supabase.from('renders').update({ progress }).eq('id', renderId).then();
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else {
        console.error(`[FFmpeg Error]`, stderrOut.slice(-2000));
        // Nhet phan duoi stderr VAO CHINH LOI, de no di tiep xuong CSDL.
        //
        // Ban cu chi luu ma thoat: giao dien hien "FFmpeg exited with code 3221225477"
        // va khong ai biet them gi — ly do that nam trong cua so console cua worker,
        // tren may khac. Do la ly do moi lan ffmpeg hong deu mat nhieu luot doan.
        const loi = new Error(`FFmpeg exited with code ${code}`);
        (loi as any).chiTiet = stderrOut.slice(-1200);
        // Danh dau rieng truong hop SAP, de nguoi goi biet co the thu lai bang
        // preset nhe hon. Tham so sai thi thu lai bao nhieu lan cung vo ich.
        (loi as any).sapDo = laSapDo(code);
        reject(loi);
      }
    });
    proc.on('error', reject);
  });
}

/** Download a user-supplied image through the SSRF guard (allowlist, no redirects, size cap). */
/**
 * Nhan dang anh that qua chu ky byte dau file, khong tin duoi file hay Content-Type.
 *
 * safeDownload chi kiem ma HTTP va kich thuoc. Mot URL tra 200 kem HTML hoac JSON loi
 * van duoc ghi thanh .jpg, roi ffmpeg nhan rac va cho ra video rong ma khong bao gi.
 * Day dung la thu nginx vua lam: moi duong dan thieu deu tra index.html kem 200.
 */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'gif';
  if (buf.subarray(4, 12).toString('ascii').includes('ftyp')) return 'heif';
  return null;
}

/**
 * Chuan hoa anh ve JPEG sach truoc khi dua vao lenh dung video.
 *
 * ── Day KHONG phai ban va cho loi sap ──
 *
 * Toi viet buoc nay vi nghi WebP lam ffmpeg sap. Do lai thi khong phai: chuoi 6 canh
 * chay duoc voi CA anh WebP goc lan anh da doi. Nguyen nhan that la preset x264
 * `medium` tro len — xem chu thich o `PRESET_X264`.
 *
 * ── Nhung van giu, vi ba ly do do duoc ──
 *
 * 1. Anh nguoi ban tai len tu san thuong mai dien tu thuong la WebP (duoi file van la
 *    .jpg). Bo giai ma WebP cua ffmpeg ban loi o MOI KHUNG HINH:
 *      [webp] invalid TIFF header in EXIF data / unable to attach EXIF buffer
 *    Luong spam nay lon toi muc lam VO GIOI HAN CHUOI cua Node khi doc stderr
 *    ("RangeError: Invalid string length") — tuc la no that su gay hai, chi khong
 *    phai theo cach toi doan.
 * 2. Cung mot buoc xu ly luon: xoay anh theo EXIF, bo profile mau la, ha anh 16-bit
 *    ve 8-bit, lam phang WebP/GIF dong ve mot khung.
 * 3. Giai ma mot lan o day re hon giai ma lai o moi khung trong chuoi filter.
 *
 * Doi khong duoc thi GIU NGUYEN anh goc: mot buoc toi uu khong duoc tro thanh mot
 * nguon hong moi.
 */
async function chuanHoaAnh(duongDan: string): Promise<string> {
  const sach = duongDan.replace(/\.[^.]+$/, '') + '_sach.jpg';

  const xong = await new Promise<boolean>((resolve) => {
    const p = spawn('ffmpeg', [
      '-v', 'error',
      '-i', duongDan,
      // Mot khung duy nhat: anh dong (WebP/GIF) lam phang ve khung dau.
      '-frames:v', '1',
      // `-q:v 2` gan nhu khong mat chat luong ma file nho hon han PNG.
      '-q:v', '2',
      '-pix_fmt', 'yuvj420p',
      '-y', sach,
    ]);
    p.on('error', () => resolve(false));
    p.on('close', (ma) => resolve(ma === 0));
  });

  if (!xong || !fs.existsSync(sach) || fs.statSync(sach).size === 0) {
    console.warn(`[Worker] Khong chuan hoa duoc ${path.basename(duongDan)} — dung anh goc`);
    return duongDan;
  }

  const kieu = sniffImageType(fs.readFileSync(duongDan).subarray(0, 32));
  if (kieu && kieu !== 'jpeg') {
    console.log(`[Worker] Doi ${kieu} -> jpeg: ${path.basename(duongDan)}`);
  }
  return sach;
}

async function downloadImage(url: string, destPath: string) {
  const body = await safeDownload(url);

  const kind = sniffImageType(body);
  if (!kind) {
    // In ra dau file de biet ngay nhan duoc cai gi: '<!doctype' la trang web,
    // '{' la JSON loi. Doan nay tung lam video rong ma khong co dau vet nao.
    const head = body.subarray(0, 60).toString('utf8').replace(/\s+/g, ' ').trim();
    throw new Error(
      `NOT_AN_IMAGE: ${url} tra ve ${body.byteLength} byte khong phai anh. Dau file: "${head}"`
    );
  }

  fs.writeFileSync(destPath, body);
  console.log(`[Worker] Tai anh ${kind} ${(body.byteLength / 1024).toFixed(0)}KB`);
}

function resolveMusicFile(renderPlan: Tier4RenderPlan, packageType: string): string {
  const musicAsset = (renderPlan.assets || []).find((a) => a.type === 'music' && a.asset_id === renderPlan.audio_plan?.music_asset_id);
  if (musicAsset?.source) {
    const rel = path.join(AUDIO_ASSETS_DIR, path.basename(musicAsset.source));
    if (fs.existsSync(rel)) return rel;
    if (fs.existsSync(musicAsset.source)) return musicAsset.source;
  }
  const fallback = packageType === 'review_video' ? 'chill_01.mp3' : packageType === 'conversion_video' ? 'urgent_01.mp3' : 'upbeat_01.mp3';
  const p = path.join(AUDIO_ASSETS_DIR, fallback);
  return fs.existsSync(p) ? p : '';
}

function sceneCardsToSceneGraph(sceneCards: any[]): Tier3SceneGraph {
  let cursor = 0;
  const tongSo = (sceneCards || []).length;
  const scenes = (sceneCards || []).map((c: any, i: number) => {
    const duration = Math.max(1, Number(c.duration_sec) || 3);
    const scene = {
      scene_id: `s${i + 1}`,
      start_sec: cursor,
      end_sec: cursor + duration,
      purpose: c.visual_instruction || '',
      asset_ref: `image_${i + 1}`,
      visual_type: 'product_closeup' as const,
      camera_motion: { type: 'zoom_in' as const, direction: 'center', speed: 'slow' as const },
      overlay_text: c.overlay_text || '',
      // Thẻ cảnh cũ không mang vai trò câu chữ, nên suy từ vị trí trong video: cảnh
      // đầu là hook, cảnh cuối là CTA. Thiếu trường này thì mọi dòng chữ dùng chung
      // một cỡ, đúng như bản cũ đã làm.
      overlay_role: inferRole(c.visual_instruction || '', 'product_closeup', i, tongSo),
      voice_line: c.voice_line || '',
      subtitle: c.voice_line || '',
      music_intensity: 'medium' as const,
      safe_region: { title_y: 0.18, subtitle_y: 0.82, cta_y: 0.9 },
    };
    cursor += duration;
    return scene;
  });
  return {
    video_meta: { aspect_ratio: '9:16', duration_sec: cursor, style: '', target_platform: 'tiktok' },
    scenes,
  };
}

/**
 * Độ phân giải theo TỈ LỆ KHÁCH CHỌN, không theo thứ AI sinh ra.
 *
 * Trước đây lấy từ renderPlan.export.resolution — tức để model quyết khung hình.
 * Khách chọn 9:16 mà model trả "1080x1080" thì video ra vuông, trên điện thoại
 * dọc bị thu nhỏ và trông như độ phân giải thấp. Đã xảy ra thật ngày 28/10.
 *
 * Tỉ lệ là lựa chọn của khách, không phải việc của AI.
 */
function resolutionFromAspect(aspect: string | null | undefined): { width: number; height: number } | null {
  switch (String(aspect || '').trim()) {
    case '9:16': return { width: 1080, height: 1920 };
    case '16:9': return { width: 1920, height: 1080 };
    case '1:1':  return { width: 1080, height: 1080 };
    case '4:5':  return { width: 1080, height: 1350 };
    default:     return null;
  }
}

function resolveResolution(resolution: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(resolution || '1080x1920');
  return m ? { width: parseInt(m[1], 10), height: parseInt(m[2], 10) } : { width: 1080, height: 1920 };
}

/** Xuat ra de script chan doan dung lai duoc dung lenh worker da chay. */
export function buildFfmpegCommandFromPlan(
  renderPlan: Tier4RenderPlan,
  sceneGraph: Tier3SceneGraph,
  inputImages: string[],
  /**
   * Anh theo `asset_id` ma ke hoach dung chi dinh cho tung canh.
   *
   * Khong co tham so nay thi ham chi biet lay anh theo CHI SO CANH roi kep tran —
   * va do la mot loi that: do ngay 29/10, video 6 canh voi 3 anh cho ra
   * `image_1 image_2 image_3 image_3 image_3 image_3`, tuc 14 giay lien mot tam anh.
   * Trong khi `spreadAssets` o tang ke hoach da rai san thanh 2/2/2 va ghi vao
   * `asset_id` — ket qua do bi nem di vi khong ai doc.
   */
  assetById: Record<string, string>,
  musicPath: string,
  outputPath: string,
  /** Noi ghi file .ass cho lan render nay. */
  assPath: string,
  /**
   * Giong doc theo tung canh: voiceFiles[i] ung voi timeline[i], null khi canh do
   * khong co tieng. De trong ca mang thi render ban khong loi nhu truoc.
   */
  voiceFiles: (string | null)[] = [],
  /**
   * Phu de da can khop giong doc, theo tung canh. subtitleCues[i] ung voi
   * timeline[i]; moc thoi gian tinh tu dau doan tieng cua canh do, chua cong moc canh.
   * De trong thi quay ve cach cu: ca cau trai suot canh.
   */
  subtitleCues: TimedCue[][] = [],
  /** Ti le khach chon (renders.aspect_ratio). Co gia tri thi NO quyet dinh khung hinh. */
  aspectRatio?: string | null,
  /**
   * Thong so that cua cac clip quay tay, tra theo duong dan file.
   *
   * Can do dai THAT de biet cat doan nao: `pickSegment` bo nua giay dau (luc tay con
   * cham may) va lay tu giua clip. Khong co thong so thi dung do dai canh lam uoc
   * luong — van chay duoc, chi la cat tu dau clip.
   */
  videoMeta: Map<string, VideoMeta> = new Map(),
  /**
   * Tuỳ chọn người bán tick ở bước Cấu hình.
   *
   * `khongChu`: không chèn chữ nào lên video — không overlay, không phụ đề. Nhiều
   * người bán muốn video sạch để tự gõ caption trong TikTok, vì caption gõ trong ứng
   * dụng được nền tảng đọc và phân phối tốt hơn chữ cháy sẵn.
   *
   * `catVien`: cắt bớt viền ảnh nguồn theo tỉ lệ, để bỏ logo/watermark nằm ở góc —
   * chỗ gần như mọi sàn thương mại điện tử đóng dấu.
   */
  tuyChon: {
    khongChu?: boolean;
    catVien?: number;
    /**
     * Khung dau khach DA XAC NHAN, theo ti le 0..1 cua anh.
     *
     * Chi nhan khung khach da tich, khong nhan thang ket qua do. Do that ngay 31/10
     * tren 10 du an: bo do tim dung dau tren 2 du an, loai sach chu san pham tren 6,
     * nhung van cho duong tinh gia tren 2 — "ninhle.com" in tren vo hop, va rac OCR.
     * Xoa tu dong nhung thu do la cat mat san pham cua khach.
     */
    dauDaXacNhan?: Khung[];
  } = {},
  /**
   * He so `atempo` cho tung canh; 1 hoac bo trong nghia la doc nguyen nhip.
   *
   * Tang nhip de loi thoai vua dung thoi luong canh, thay vi keo canh ra. Cac nen
   * tang xep video theo moc thoi luong, nen mot video dat 30 giay ra 35 giay la lech
   * moc — xem `lib/khop-tieng.ts`.
   */
  tempoTieng: number[] = []
): { args: string[]; duration: number } {
  const fps = renderPlan.render_meta?.fps || 30;
  // Ti le khach chon thang moi lan: model khong duoc quyet khung hinh.
  const { width, height } = resolutionFromAspect(aspectRatio)
    ?? resolveResolution(renderPlan.export?.resolution);
  const timeline = renderPlan.timeline || [];
  const scenes = sceneGraph?.scenes || [];
  const encoder = renderPlan.export?.codec === 'libx264' ? 'libx264' : VIDEO_ENCODER;
  const encoderArgs = encoder.includes('nvenc')
    ? ['-c:v', encoder, '-preset', NVENC_PRESET, '-gpu', String(FFMPEG_GPU_INDEX),
       '-rc', 'vbr', '-cq', String(CRF_MUC_TIEU), '-b:v', '0', '-maxrate', '12M', '-bufsize', '16M']
    // CRF chu khong phai bitrate co dinh. Anh tinh cho zoompan la noi dung rat de nen o
    // canh dung yen va rat kho nen luc dang phong — bitrate co dinh 4M nem byte vao doan
    // de va bo doi doan kho, dung cho ra mo o dung luc nguoi xem dang nhin ky.
    //
    // `slow` chu khong phai `veryfast`: do that ngay 29/10, mot video 19,5 giay dung het
    // 15,5 giay may. Doi sang `slow` dat them vai giay — re chan so voi mot video net hon
    // ro ret. Day la may rieng, khong phai ham doi tinh tien theo giay.
    : ['-c:v', 'libx264', '-preset', PRESET_X264, '-crf', String(CRF_MUC_TIEU),
       '-maxrate', '12M', '-bufsize', '16M'];

  const ffmpegArgs: string[] = [];
  if (encoder.includes('nvenc')) ffmpegArgs.push('-hwaccel', HWACCEL_MODE, '-hwaccel_device', String(FFMPEG_GPU_INDEX));

  const filterParts: string[] = [];
  const inputArgs: string[] = [];
  let totalDuration = 0;
  const cues: AssCue[] = [];

  // Chuyen canh: ke hoach dung NOI RO tung canh muon vao bang gi (`transition_in`),
  // ban cu bo qua het va cat cung qua `concat`. Moi canh phai dung dai them dung
  // bang phan se bi hoa nuot, neu khong tong thoi luong ngan lai va phu de lech dan.
  const keHoachChuyen = lapKeHoachChuyen(timeline);

  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const durationKeHoach = Math.max(0.5, (item.end_sec || 0) - (item.start_sec || 0));
    const sceneStart = totalDuration; // moc tuyet doi, lay truoc khi cong don
    totalDuration += durationKeHoach;

    /**
     * Dung dai them phan se bi `xfade` nuot, LAM TRON LEN toi khung hinh.
     *
     * `sceneStart` va `totalDuration` o tren KHONG cong phan nay vao — phu de van
     * dung moc cua ke hoach.
     *
     * ── Vi sao phai lam tron LEN, va du ra vai khung ──
     *
     * `xfade` doi dau vao thu nhat DAI HON `offset + duration`; bang nhau khong du.
     * Ban cu keo dai dung bang phan bi nuot, roi ghi `-t` bang `toFixed(2)` — lam
     * tron XUONG, nen canh that luon ngan hon vai phan tram giay va dieu kien vo.
     *
     * Khi vo, `xfade` KHONG bao loi: no tra ve mot luong cut ngun va ffmpeg thoat 0.
     * Do that ngay 30/10 tren render f1f588fa: ke hoach 21,12s, file ra 4,83s, exit 0.
     * Rieng canh 0 con te hon — phan keo dai la 0,034s, NHO HON mot khung (0,0333s),
     * nen `toFixed(2)` xoa sach no truoc khi ffmpeg kip nhin thay.
     *
     * Phan du ra bi `xfade` nuot het, khong moc thoi gian nao doi.
     */
    const nuoiChuyenCanh = (keHoachChuyen.keoDai[i] ?? 0) > 0;
    const durationFrames = soKhungCanh(durationKeHoach, keHoachChuyen.keoDai[i] ?? 0, fps);
    const durationSec = durationFrames / fps;

    // Theo dung anh ke hoach chi dinh; chi roi ve chi so canh khi khong tra duoc id
    // (ke hoach cu, hoac asset_id khong khop anh nao tai duoc).
    const imgIdx = Math.min(i, Math.max(0, inputImages.length - 1));
    const nguonCanh = (item.asset_id && assetById[item.asset_id]) || inputImages[imgIdx];
    const laVideo = isVideoAsset(nguonCanh);

    // Ảnh phải `-loop 1` để một khung hình kéo dài ra; video thì KHÔNG — nó đã có
    // sẵn các khung của chính nó, loop vào sẽ lặp lại clip chứ không kéo dài.
    if (laVideo) {
      inputArgs.push('-i', nguonCanh);
    } else {
      // `-framerate ${fps}` là bắt buộc, không phải tuỳ chọn.
      //
      // Thiếu nó, ffmpeg nạp ảnh lặp ở 25fps mặc định; với `zoompan d=1` thì số khung
      // ra bằng số khung vào, nên cảnh 2 giây chỉ ra 50 khung = 1,67 giây ở 30fps.
      // Mọi cảnh ngắn lại 17%, và phụ đề lệch dần theo từng cảnh.
      inputArgs.push('-loop', '1', '-framerate', String(fps), '-t', tDauVaoCanh(durationFrames, fps).toFixed(3), '-i', nguonCanh);
    }

    let chain = `[${i}:v]`;
    // Phóng ảnh lên gấp đôi TRƯỚC khi zoompan, rồi zoompan trả về đúng khổ đầu ra.
    //
    // zoompan dịch khung cắt theo bước NGUYÊN pixel. Chạy thẳng ở 1080x1920 thì
    // mỗi bước nhảy là một pixel đầy đủ — mắt thấy giật. Làm việc trên ảnh gấp đôi
    // thì mỗi bước chỉ còn nửa pixel ở khổ cuối, chuyển động mượt hẳn.
    //
    // Gấp đôi là mức đổi chác hợp lý: gấp bốn mượt hơn chút nhưng mỗi khung hình
    // thành 33 triệu điểm ảnh, render chậm gấp mấy lần mà mắt thường khó phân biệt.
    const wUp = width * 2;
    const hUp = height * 2;

    /**
     * Nền mờ thay cho viền đen.
     *
     * `pad` phủ phần thừa bằng MÀU ĐEN. Với ảnh sản phẩm ngang nhồi vào khung dọc 9:16,
     * phần đen chiếm quá nửa khung hình — video trông trống rỗng, và đó chính là lý do
     * người bán kêu "đơn điệu" ngày 29/10.
     *
     * Cách làm chuẩn của video dọc: lấy chính ảnh đó phóng to phủ kín làm nền, làm mờ
     * và hạ sáng, rồi đặt ảnh vừa khung lên trên. Khung hình đầy, không cắt mất sản
     * phẩm, và màu nền luôn ăn với ảnh vì nó LÀ ảnh.
     *
     * Làm mờ ở 136×240 rồi mới phóng lên: mờ ở 2160×3840 đắt gấp nhiều lần mà mắt
     * không phân biệt được — nó vốn đã mờ. Đo thật: 705ms cho cảnh 3 giây, so với
     * 458ms của bản viền đen.
     */
    const nenMo =
      `[bg]scale=136:240:force_original_aspect_ratio=increase,crop=136:240,` +
      `boxblur=10:1,scale=${wUp}:${hUp},eq=brightness=-0.14:saturation=0.7[bgb];`;
    const anhChinh =
      `[fg]scale=${wUp}:${hUp}:force_original_aspect_ratio=decrease:flags=lanczos[fgs];`;
    /**
     * Cắt viền để bỏ logo/watermark ở góc.
     *
     * Không có nhận dạng nào ở đây, và đó là chủ ý: dò logo tự động sai thì nó xoá mất
     * sản phẩm. Cắt một tỉ lệ cố định quanh mép thì đoán trước được, và nó đúng với
     * trường hợp phổ biến nhất — sàn thương mại điện tử đóng dấu ở góc.
     *
     * Trần 15%: cắt sâu hơn là bắt đầu ăn vào sản phẩm.
     */
    /**
     * Cat TRANH dau khach da xac nhan, uu tien hon cat vien deu.
     *
     * Do that ngay 31/10 tren dau HAVATA that (goc tren phai, 34x7% khung):
     *
     *     cat vien 8% deu ...... giu 71% dien tich, dau VAN SOT
     *     cat tranh dai dau .... giu **87%**, doc lai bang OCR: khong anh nao con dau
     *
     * Cat vien deu khong biet dau nam dau nen phai cat ca bon phia; cat tranh chi bo
     * dung dai chua dau. Giu lai cat vien deu lam duong lui cho khach khong dung buoc
     * do dau.
     */
    const dauDa = Array.isArray(tuyChon.dauDaXacNhan) ? tuyChon.dauDaXacNhan : [];
    const tiLeCat = Math.min(0.15, Math.max(0, tuyChon.catVien ?? 0));

    let catVien = '';
    if (dauDa.length > 0) {
      const bt = bieuThucCrop(tinhKhungTranh(dauDa).khung);
      if (bt) catVien = `${bt},`;
    } else if (tiLeCat > 0) {
      catVien = `crop=iw*${(1 - 2 * tiLeCat).toFixed(3)}:ih*${(1 - 2 * tiLeCat).toFixed(3)},`;
    }

    const scaleFilter = `${catVien}split=2[bg][fg];${nenMo}${anhChinh}[bgb][fgs]overlay=(W-w)/2:(H-h)/2`;
    const zoompanFilter = getZoompanFilter(
      item.motion?.type || 'zoom_in',
      item.motion?.zoom_start || 1,
      item.motion?.zoom_end || 1.08,
      width,
      height,
      durationFrames,
      fps
    );
    // `setsar=1` là BẮT BUỘC trước `concat`, không phải tuỳ chọn thẩm mỹ.
    //
    // `concat` đòi mọi đầu vào cùng kích thước VÀ cùng SAR (tỉ lệ điểm ảnh). Ảnh nguồn
    // khác tỉ lệ đi qua `scale`+`pad` cho ra SAR lẻ khác nhau — đo thật ngày 29/10:
    // cảnh này 1:1, cảnh kia 8065:8064. ffmpeg từ chối ghép và trả:
    //
    //   Input link in0:v0 parameters (size 1080x1920, SAR 1:1) do not match
    //   the corresponding output link (1080x1920, SAR 8065:8064)
    //   Failed to configure output pad on Parsed_concat → -22
    //
    // Mã -22 hiện lên giao diện thành 4294967274 — chính lỗi đã làm hỏng mọi bản render
    // từ ảnh. Nó CHỈ nổ khi các ảnh khác tỉ lệ nhau, nên lô ảnh đồng đều vẫn chạy được
    // và lỗi nằm im cho tới khi khách tải lên ảnh thật với đủ kích cỡ.
    //
    // Nhánh clip (`video-compose.ts`) vốn đã có dòng này; nhánh ảnh thì không.
    chain = `${chain}${scaleFilter},${zoompanFilter},setsar=1,format=yuv420p`;

    // Video quay tay đi đường KHÁC HẲN: trim + scale + crop, KHÔNG zoompan.
    //
    // Spec V3 §3 nói thẳng điều này, và lý do rất cụ thể: video đã mang chuyển động
    // thật của chính nó. Chồng thêm Ken Burns lên là hai chuyển động đánh nhau trên
    // cùng khung hình — ra cảm giác chóng mặt, và lộ ngay là máy ghép.
    //
    // Chính cái tự nhiên đó là lý do luồng clip tự quay tồn tại; zoom thêm lên nó là
    // phá đúng thứ mình đang muốn giữ.
    if (laVideo) {
      const thongSo = videoMeta.get(nguonCanh);
      const doanLay = pickSegment(thongSo?.durationSec ?? durationSec, durationSec);
      chain = buildVideoSceneFilter({
        inputIndex: i,
        startSec: doanLay.startSec,
        durationSec: doanLay.durationSec,
        width,
        height,
        fps,
        outLabel: `v${i}`,
      }).replace(`[v${i}]`, '');
    }

    // Chốt chặn chữ vô nghĩa.
    //
    // Ngày 28/10 video ra mang dòng chữ "Conversion Video — Upload 28/10/2026" —
    // đó là TÊN DỰ ÁN tự sinh, lọt lên màn hình vì tầng 4 không có nội dung thật
    // để điền. Chữ trên video quảng cáo phải là câu hook hoặc slogan, không bao giờ
    // là tên gói hay ngày tải lên.
    const chuVoNghia = (t: string): boolean => {
      const s = t.trim();
      if (!s) return true;
      if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return true;             // có ngày tháng
      if (/^upload\b/i.test(s) || /\bupload\s+\d/i.test(s)) return true;
      // Tên gói đứng một mình, không kèm nội dung nào khác
      if (/^(quick\s*ads|review\s*video|conversion\s*video)$/i.test(s)) return true;
      return false;
    };

    // Người bán tick "không chèn chữ": bỏ qua CẢ overlay lẫn phụ đề.
    //
    // Chặn ở chỗ đẩy cue chứ không chặn ở chỗ ráp filter: nhánh `cues.length > 0`
    // phía dưới vốn đã biết bỏ bước burn-in khi không có cue nào, nên chuỗi filter
    // không phải đổi một chữ.
    if (tuyChon.khongChu) {
      // không đẩy cue nào
    } else if (item.overlay?.text && chuVoNghia(item.overlay.text)) {
      console.warn(`[Worker] Bo chu overlay vo nghia o canh ${i + 1}: "${item.overlay.text}"`);
    } else if (item.overlay?.text) {
      cues.push({
        startSec: sceneStart,
        // `durationKeHoach`, KHÔNG phải `durationSec`.
        //
        // `durationSec` đã cộng phần kéo dài để `xfade` nuốt, nên dùng nó thì chữ
        // tiêu đề thò sang cảnh sau khoảng 0,35 giây. Mốc của phụ đề thì tính theo
        // kế hoạch, nên hai bên lệch nhau.
        //
        // Hậu quả đo được ngày 30/10: tiêu đề chồng thời gian với phụ đề của cảnh
        // SAU, nên phép tính lề riêng lấy nhầm số dòng của câu đó — mọi tiêu đề đều
        // bị đẩy lên như thể phụ đề luôn có hai dòng.
        endSec: sceneStart + durationKeHoach,
        text: item.overlay.text,
        style: 'Overlay',
        // Co chu theo VAI TRO va theo CHIEU CAO KHUNG, khong phai so pixel viet cung.
        //
        // Ban cu dat 52px cho moi khung hinh. ASS tinh co chu trong khong gian
        // PlayResY = chieu cao that, nen 52px o 720p (cao 1280) chiem 4,1% chieu cao
        // con o 1080p (cao 1920) chi con 2,7%: cung mot video ma ban nhap chu to hon
        // ban xuat gan mot nua.
        fontSize: overlayFontSize(item.overlay.font_style, height),
      });
    }

    const scene = scenes[i];

    /**
     * Mốc kết thúc của cảnh theo KẾ HOẠCH — trần cho mọi cue của cảnh này.
     *
     * Phụ đề tràn sang cảnh sau thì nó chồng thời gian với TIÊU ĐỀ của cảnh sau, và
     * phép tính lề riêng lấy nhầm số dòng của câu không thuộc về mình. Đo ngày 30/10:
     * câu hai dòng của cảnh 1 thò 0,17 giây sang cảnh 2, đẩy tiêu đề cảnh 2 lên cao
     * như thể phụ đề của nó cũng hai dòng.
     *
     * `khopCanhVoiTieng` vốn đã kéo cảnh cho vừa lời đọc nên chuyện này hiếm, nhưng
     * kẹp lại ở đây rẻ hơn nhiều so với đi tìm lại nguyên nhân lần sau.
     */
    const hetCanh = sceneStart + durationKeHoach;

    if (!tuyChon.khongChu && renderPlan.subtitle_plan?.burn_in && scene?.voice_line) {
      const aligned = subtitleCues[i];

      if (aligned && aligned.length > 0) {
        // Phụ đề khớp giọng đọc: mỗi mẩu hiện đúng lúc câu đó được nói.
        // Mốc trong `aligned` tính từ đầu đoạn tiếng, phải cộng mốc cảnh vào.
        for (const c of aligned) {
          cues.push({
            startSec: sceneStart + c.startSec,
            endSec: Math.min(hetCanh, sceneStart + c.endSec),
            text: c.text,
            style: 'Sub',
          });
        }
      } else {
        // Chưa có giọng đọc — chế độ Draft, hoặc câu đó tổng hợp hỏng.
        //
        // Bản cũ đẩy CẢ CÂU thành một cue trải suốt cảnh. Với câu 88 ký tự trong ô
        // 3 giây thì đó là một bức tường chữ đứng im — đọc không kịp, và che mất
        // sản phẩm suốt cả cảnh.
        //
        // `splitByChars` chia theo tốc độ đọc tiếng Việt đã đo (`ký_tự/28,3 + 0,93`)
        // và gộp những mẩu quá ngắn, nên Draft có phụ đề chạy theo nhịp đọc y như
        // bản có lồng tiếng — chỉ là không có tiếng.
        for (const c of splitByChars(scene.voice_line, durationKeHoach)) {
          cues.push({
            startSec: sceneStart + c.startSec,
            endSec: Math.min(hetCanh, sceneStart + c.endSec),
            text: c.text,
            style: 'Sub',
          });
        }
      }
    }

    /**
     * KHONG fade tu den o dau video.
     *
     * Do that ngay 31/10 tren ba ban render: khung dau co do sang Y=29, trong khi
     * giay 0,4 tro di la Y=128. Tuc 0,4 giay dau gan nhu den.
     *
     * Trong mot dong tin TikTok/Reels/Shorts, 0,4 giay dau LA cho nguoi xem quyet
     * dinh dung lai hay luot tiep. Dot no vao mot cu mo tu den la dem thu quy nhat
     * di doi lay mot quy uoc cua dien anh — thu khong ai cho doi trong dong tin.
     *
     * Video bat dau NGAY tren hinh. Muon doi y thi dat `FADE_VAO_GIAY`.
     */
    const fadeVaoGiay = parseFloat(process.env.FADE_VAO_GIAY || '0');
    if (i === 0 && fadeVaoGiay > 0) {
      chain = `${chain},fade=t=in:st=0:d=${fadeVaoGiay.toFixed(2)}`;
    }
    if (i === timeline.length - 1) {
      // `st` tinh theo luong cua CHINH canh nay, khong theo ca video.
      //
      // Ban cu dung `totalDuration - 0.4`, tuc 19,1 giay, ap len mot luong chi dai
      // 3,5 giay — fade khong bao gio chay. Do that tren render a7d667cc: khung dau
      // YAVG=16 (den, fade vao chay dung), khung cuoi YAVG=22 (sang nguyen). Video
      // cat phut giua chung.
      /**
       * Fade ket NGAN lai: 0,4 giay xuong 0,25.
       *
       * Video ngan tren cac nen tang nay LAP LAI. Mo het ve den roi nhay nguoc ve
       * khung dau sang truong thanh mot cu nhay nhin thay ro moi vong lap. Ngan lai
       * thi cu nhay nho di, ma van giu duoc cam giac ket thuc chu dong.
       */
      const fadeRaGiay = parseFloat(process.env.FADE_RA_GIAY || '0.25');
      const mocFadeRa = Math.max(0, durationSec - fadeRaGiay);
      chain = `${chain},fade=t=out:st=${mocFadeRa.toFixed(2)}:d=${fadeRaGiay.toFixed(2)}`;
    }

    /**
     * Luoi bao hiem do dai cho canh nuoi chuyen canh.
     *
     * Phep tinh khung o tren da du cho anh tinh. Nhanh clip quay tay thi khong:
     * `pickSegment` kep theo do dai THAT cua clip, nen mot clip ngan hon o canh cho
     * ra luong ngan hon ke hoach, va chuoi xfade lai sup y nhu cu.
     *
     * `tpad` nhan ban khung cuoi them 0,15 giay. Voi canh da du dai thi phan nay nam
     * duoi `offset` va bi nuot sach — no chi ton tai de cuu truong hop thieu.
     */
    if (nuoiChuyenCanh) chain = `${chain},tpad=stop_mode=clone:stop_duration=0.15`;

    filterParts.push(`${chain}[scene${i}]`);
  }

  const concatInputs = timeline.map((_: any, i: number) => `[scene${i}]`).join('');

  /**
   * Noi cac canh lai, bang `xfade` neu ke hoach co chuyen mem, khong thi `concat`.
   *
   * Van giu `concat` cho truong hop toan cat cung: no nhanh hon va it cho hong hon,
   * ma ket qua giong het.
   */
  function noiCacCanh(nhanRa: string): string[] {
    const buoc = dungChuoiXfade(keHoachChuyen, (i) => `scene${i}`, nhanRa);
    if (buoc) {
      const soMem = keHoachChuyen.ranhGioi.filter((r) => r.mem).length;
      console.log(`[Worker] Chuyen canh: ${soMem} cho hoa mem / ${keHoachChuyen.ranhGioi.length} ranh gioi`);
      return buoc;
    }
    return [`${concatInputs}concat=n=${timeline.length}:v=1:a=0[${nhanRa}]`];
  }
  // Mot file ASS duy nhat cho ca video: cac canh da concat nen moc thoi gian la tuyet doi,
  // chi phai giai ma phu de mot lan. libass tu xuong dong trong pham vi le va giu nguyen
  // '%' lan dau nhay don — hai thu drawtext lam hong.
  if (cues.length > 0) {
    // Bo cuc chu dung CHUNG voi luong clip tu quay (`video-edit.job.ts`).
    //
    // Truoc day moi luong tu tinh co chu va le cua rieng no, nen cung mot khach bam
    // hai nut khac nhau thi duoc hai bo cuc khac nhau, va moi lan chinh bo cuc chi
    // sua duoc mot nua he thong. Ly do cho tung con so nam o `lib/bo-cuc-chu.ts`.
    /**
     * Chua cho dung so dong phu de SE CO, khong chua cung hai dong.
     *
     * Chua hai dong khi chi co mot thi dong thua bien thanh mot khoang trong nhin
     * thay duoc giua tieu de va phu de — do tren khung 1080x1080 la 56px, dung bang
     * mot dong. Do la thu nguoi ban keu ngay 30/10: "khoang cach dong thu hep hon nua".
     */
    const leNgang = Math.round(0.13 * width);
    const beRongDung = width - leNgang * 2;
    const coChuPhuDe = Math.round(width * 0.042);
    const cauPhuDe = cues.filter((c) => c.style === 'Sub').map((c) => String(c.text ?? ''));
    const cauDaiNhat = cauPhuDe.reduce((a, b) => (b.length > a.length ? b : a), '');

    /**
     * Hoi THANG libass thay vi uoc bang so lieu font.
     *
     * Uoc bang be ngang trung binh mot ky tu hong dung o ranh gioi — do that 30/10:
     * cau 42 ky tu tren khung 1080 duoc uoc la 2 dong, libass dung ra 1 dong, va dong
     * chua thua bien thanh khoang trong 56px giua tieu de va phu de.
     *
     * Do hong thi `uocSoDong` lam duong lui: chua thua chi la mot khoang trong, chua
     * thieu la chu de len nhau.
     */
    const thamSoDo = {
      width, height, fontName: ASS_FONT_NAME, subFontSize: coChuPhuDe, marginH: leNgang,
    };
    const bangDo = doSoDongNhieu(cauPhuDe, thamSoDo);

    /** Số dòng của một câu: ưu tiên số đo thật, hỏng thì ước theo bề ngang ký tự. */
    const soDongCua = (t: string): number =>
      bangDo.get(String(t ?? '').trim()) ?? uocSoDong(t, coChuPhuDe, beRongDung);

    // Trường hợp xấu nhất, dùng cho lề mặc định của style.
    const soDongPhuDe = cauPhuDe.reduce((n, t) => Math.max(n, soDongCua(t)), 1);
    const bc = boCucChu(width, height, { soDongPhuDe });
    // Chỉ những câu nằm gần ranh giới ngắt dòng mới được đo; số còn lại ước là đủ.
    // In ra để sau này còn đối chiếu khi chữ lại nằm sai chỗ.
    if (bangDo.size > 0) {
      console.log(`[Worker] Chu: do ${bangDo.size}/${new Set(cauPhuDe).size} cau sat ranh gioi ngat dong, toi da ${soDongPhuDe} dong.`);
    }

    /**
     * Lề RIÊNG cho từng tiêu đề, theo đúng phụ đề đang hiện cùng lúc với nó.
     *
     * `MarginV` trong phần style là một giá trị chung cho cả file. Chỉ cần MỘT câu
     * phụ đề trong video tràn hai dòng là mọi tiêu đề đều bị đẩy lên cao bằng đó, kể
     * cả những lúc phụ đề chỉ có một dòng — và chỗ chừa thừa ấy hiện ra thành khoảng
     * trống. Đo trên khung 1080×1080 ngày 30/10: 57px, đúng bằng một dòng.
     *
     * Đặt lề ngay trên dòng thoại thì mỗi tiêu đề nằm sát đúng phụ đề của nó.
     *
     * Tiêu đề không có phụ đề nào hiện cùng thì tụt hẳn xuống sát đáy — không có gì
     * bên dưới để phải nhường chỗ.
     */
    const phuDe = cues.filter((c) => c.style === 'Sub');
    const khoangTho = Math.round(coChuPhuDe * 0.15);
    for (const tieuDe of cues) {
      if (tieuDe.style !== 'Overlay') continue;

      const dongToiDa = phuDe
        .filter((s) => s.startSec < tieuDe.endSec && s.endSec > tieuDe.startSec)
        .reduce((n, s) => Math.max(n, soDongCua(s.text)), 0);

      tieuDe.marginV = dongToiDa === 0
        ? bc.subMarginV
        : bc.subMarginV + Math.round(coChuPhuDe * 1.25 * dongToiDa) + khoangTho;
    }

    const assContent = buildAssFile(cues, {
      width,
      height,
      fontName: ASS_FONT_NAME,
      ...bc,
    });
    fs.writeFileSync(assPath, assContent, 'utf8');
    filterParts.push(...noiCacCanh('vcat'));
    // Chuan hoa mau SAU khi dot phu de: libass ve bang mau dai day du, nen doi dai
    // truoc roi ve chu len thi chu bi lech mau so voi nen.
    filterParts.push(`[vcat]subtitles='${escapeFilterPath(assPath)}',${LOC_CHUAN_MAU}[vout]`);
  } else {
    filterParts.push(...noiCacCanh('vnoi'));
    filterParts.push(`[vnoi]${LOC_CHUAN_MAU}[vout]`);
  }

  ffmpegArgs.push(...inputArgs);

  // ─── Âm thanh: nhạc nền + giọng đọc từng cảnh ───
  //
  // Mỗi câu nói là một file riêng, phải đẩy tới đúng mốc giây của cảnh bằng adelay,
  // rồi trộn lại. Nhạc nền hạ xuống khi có tiếng nói, nếu không giọng bị lấp.
  //
  // Moi nhanh deu ket bang `apad`, vi dau ra dung `-shortest`.
  //
  // `-shortest` cat theo luong NGAN NHAT. Ban nhap co loi doc nhung khong nhac thi dai
  // tieng het o cau cuoi, va video bi cat dung o do — mat luon doan fade ket. Do that
  // ngay 30/10: hinh dai 21,20s, tieng dai 20,87s, file ra 20,90s.
  //
  // `apad` keo im lang ra vo han, nen `-shortest` quay ve cat theo HINH, dung y do.
  let inputIndex = timeline.length;
  const voiceLabels: string[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const vf = voiceFiles[i];
    if (!vf) continue;

    // Mốc bắt đầu tuyệt đối của cảnh, tính bằng mili giây cho adelay.
    let startMs = 0;
    for (let k = 0; k < i; k++) {
      startMs += Math.max(0.5, (timeline[k].end_sec || 0) - (timeline[k].start_sec || 0)) * 1000;
    }

    ffmpegArgs.push('-i', vf);

    /**
     * Chuan TUNG MAU giong ve cung mot muc, bang gain CO DINH.
     *
     * Do that ngay 30/10 tren ba cau FPT doc: -17,0 / -20,2 / -17,4 LUFS — chenh nhau
     * 3,2 dB. De nguyen thi cau no to hon cau kia nghe ro.
     *
     * Ban cu giai quyet bang `loudnorm` tren CA dai da tron, va `loudnorm` goi mot
     * luot thi chay o che do DONG: giua hai cau no keo gain len het co, nhac nen va
     * tieng nen dang len thanh tieng hu. Do that tren render 5a7419c9: LRA 1,10,
     * `normalization_type: dynamic`.
     *
     * Do tung mau roi cong mot con so co dinh thi khong co gi ra theo thoi gian, nen
     * khong the hu. Do hong thi gain 0 — mot phep do hong khong duoc giet ca lan dung.
     */
    const gain = chuoiGain(gainToiMuc(doMucFile(vf)?.i, MUC_GIONG));

    /**
     * Tang nhip doc cho vua canh, truoc khi day toi moc thoi gian.
     *
     * Phai dat TRUOC `adelay`: `atempo` doi do dai cua doan tieng, nen chay sau
     * adelay thi no keo ca khoang im lang o dau va moc bi xe dich.
     *
     * `atempo` chi nhan he so trong khoang 0,5-100, va he so cua ta luon <= 1,15 nen
     * khong phai noi chuoi nhieu khau.
     */
    const t = Number(tempoTieng[i]);
    const nhip = Number.isFinite(t) && t > 1.001 ? `atempo=${t.toFixed(3)},` : '';

    // adelay cần một giá trị cho mỗi kênh; "all=1" áp cho mọi kênh dù mono hay stereo.
    filterParts.push(`[${inputIndex}:a]${gain ? gain + ',' : ''}${nhip}adelay=${Math.round(startMs)}:all=1[voice${i}]`);
    voiceLabels.push(`[voice${i}]`);
    inputIndex++;
  }

  const hasVoice = voiceLabels.length > 0;
  const musicIndex = inputIndex;

  if (musicPath) ffmpegArgs.push('-i', musicPath);

  if (hasVoice) {
    // Gộp các câu thành một dải tiếng nói. normalize=0 để câu đơn lẻ không bị hạ âm
    // lượng chỉ vì có ít đầu vào — đó là hành vi mặc định của amix và nó làm giọng nhỏ dần.
    if (voiceLabels.length === 1) {
      filterParts.push(`${voiceLabels[0]}anull[vo]`);
    } else {
      filterParts.push(`${voiceLabels.join('')}amix=inputs=${voiceLabels.length}:normalize=0[vo]`);
    }

    if (musicPath) {
      // Hạ nhạc nền khi có giọng. Đây là hạ cố định, chưa phải ducking động theo
      // biên độ; đơn giản nhưng đoán trước được và không làm hỏng render.
      const base = renderPlan.audio_plan?.music_volume ?? 0.18;
      const duck = base * parseFloat(process.env.MUSIC_DUCK_RATIO || '0.35');

      /**
       * Nhạc nền phải LẶP rồi cắt đúng độ dài video.
       *
       * ── Lỗi lần này ──
       *
       * `duration=first` bám theo `[bg]` — tức NHẠC, không phải lời đọc, dù chú thích
       * cũ viết ngược lại. Mọi file nhạc trong thư viện dài đúng 30 giây.
       *
       * Video ngắn hơn 30 giây thì không ai thấy. Nhưng ngày 31/10 khách đặt 30 giây,
       * tầng 3 viết lời dài hơn sức chứa nên các cảnh bị kéo ra, video thành **35,10
       * giây** — và cả dải tiếng dừng ở giây 30, rồi `apad` lấp im lặng 5,1 giây
       * cuối. Đo thật: mức âm từ -19 dB tụt thẳng xuống -91 dB ngay tại giây 30.
       *
       * Khách nghe ra thành "lời thoại bị thiếu ở đoạn cuối".
       *
       * `aloop` lặp vô hạn rồi `atrim` cắt đúng `totalDuration`, nên `[bg]` luôn dài
       * bằng hình và `duration=first` lại có nghĩa. Nhánh clip (`video-compose.ts`)
       * vốn đã làm đúng cách này từ đầu.
       */
      const daiHinh = Math.max(1, totalDuration).toFixed(3);
      filterParts.push(
        `[${musicIndex}:a]volume=${Math.min(1, Math.max(0, duck)).toFixed(3)},` +
        `aloop=loop=-1:size=2e9,atrim=duration=${daiHinh},asetpts=PTS-STARTPTS[bg]`
      );
      // duration=first: dừng theo `[bg]`, nay đã dài đúng bằng hình.
      filterParts.push(`[bg][vo]amix=inputs=2:normalize=0:duration=first,${chuoiChanDinh()},aresample=48000,apad[aout]`);
    } else {
      filterParts.push(`[vo]${chuoiChanDinh()},aresample=48000,apad[aout]`);
    }

    ffmpegArgs.push('-filter_complex', filterParts.join(';'), '-map', '[vout]', '-map', '[aout]',
      '-c:a', 'aac', '-b:a', '128k', '-shortest');
  } else if (musicPath) {
    // Nhánh chỉ có nhạc: cũng phải lặp, vì mọi file trong thư viện dài đúng 30 giây
    // còn video thì có thể dài hơn. `apad` ở cuối chỉ lấp im lặng, không lấp nhạc.
    const volume = renderPlan.audio_plan?.music_volume ?? 0.18;
    const daiHinhNhac = Math.max(1, totalDuration).toFixed(3);
    filterParts.push(
      `[${musicIndex}:a]volume=${Math.min(1, Math.max(0, volume))},` +
      `aloop=loop=-1:size=2e9,atrim=duration=${daiHinhNhac},asetpts=PTS-STARTPTS,` +
      `${chuoiChanDinh()},apad[aout]`
    );
    ffmpegArgs.push('-filter_complex', filterParts.join(';'), '-map', '[vout]', '-map', '[aout]',
      '-c:a', 'aac', '-b:a', '128k', '-shortest');
  } else {
    ffmpegArgs.push('-filter_complex', filterParts.join(';'), '-map', '[vout]');
  }

  // Đặt TRƯỚC đường dẫn đầu ra: `-threads` là tuỳ chọn của luồng xuất, không phải
  // của file. Đặt sau đường dẫn thì ffmpeg bỏ qua im lặng.
  if (SO_LUONG_FFMPEG > 0) {
    ffmpegArgs.push('-threads', String(SO_LUONG_FFMPEG),
      '-filter_complex_threads', String(Math.max(2, Math.floor(SO_LUONG_FFMPEG / 2))));
  }

  ffmpegArgs.push(...encoderArgs, ...MAU_ARGS, '-movflags', '+faststart', '-y', outputPath);

  return { args: ffmpegArgs, duration: totalDuration };
}

/**
 * Báo kết quả về backend. Trả về phần thân phản hồi để người gọi xử lý.
 *
 * Phải trả về chứ không nuốt: route callback là chỗ DUY NHẤT trừ credit, và nó có thể
 * từ chối với `INSUFFICIENT_CREDITS`. Nuốt phản hồi thì worker vẫn đánh dấu hoàn thành
 * và khách nhận video dù không đủ xu.
 */
async function sendCallback(renderId: string, status: string, extra: Record<string, any> = {}): Promise<{ success?: boolean; error?: string } | null> {
  if (!CALLBACK_SECRET || CALLBACK_SECRET === 'CHANGE_ME_IN_PRODUCTION') {
    console.warn(`[Worker] INTERNAL_CALLBACK_SECRET not set — skipping render callback for ${renderId}`);
    return null;
  }
  try {
    const res = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-callback-secret': CALLBACK_SECRET },
      body: JSON.stringify({ renderId, status, ...extra }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[Worker] Callback HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    console.log(`[Worker] Callback sent: ${renderId} → ${status}`);
    return (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  } catch (err: any) {
    console.warn(`[Worker] Callback failed for ${renderId}: ${err.message}`);
    return null;
  }
}

async function resolveRealImageUrls(payload: any, renderPlan: Tier4RenderPlan): Promise<string[]> {
  const urls = [...(payload.raw_input?.image_urls || [])];
  if (urls.length === 0 && payload.project_id) {
    const { data: assets, error } = await supabase
      .from('project_assets')
      .select('file_url')
      .eq('project_id', payload.project_id)
      .eq('asset_type', 'image')
      .order('sort_order', { ascending: true });
    if (error) console.warn(`[Worker] project_assets query failed: ${error.message}`);
    for (const a of assets || []) if (a.file_url) urls.push(a.file_url);
  }
  if (urls.length > 0) {
    let idx = 0;
    for (const asset of renderPlan.assets || []) {
      if (asset.type === 'image') {
        asset.source = urls[idx % urls.length];
        idx++;
      }
    }
  }
  return urls;
}

/** Job dang chay o tien trinh nay. Sweep luc khoi dong va realtime co the cham cung mot job. */
const inFlight = new Set<string>();

async function processRenderJob(payload: any) {
  const renderId = payload.id;
  const startMs = Date.now();

  if (inFlight.has(renderId)) {
    console.log(`[Worker] Bo qua ${renderId}: dang xu ly roi`);
    return;
  }
  inFlight.add(renderId);

  console.log(`[Worker] Started job ${renderId}`);
  await setStatus(renderId, 'processing', { progress: 5 });

  const jobTmpDir = path.join(ASSETS_TMP_DIR, renderId);
  fs.mkdirSync(jobTmpDir, { recursive: true });

  const outputFileName = `render_final_${renderId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);
  // File phu de dat canh file video, cung ten khac duoi; don o cuoi ham.
  const assPath = outputPath.endsWith('.mp4') ? outputPath.slice(0, -4) + '.ass' : outputPath + '.ass';

  try {
    /**
     * Hai luong hoan toan khac nhau, chi chung nhau buoc tai len o cuoi.
     *
     * `video_edit` — khach tu quay clip, viec la DUNG LAI: hai lan goi LLM, cat theo
     * moc thoi gian co that trong clip. KHONG di qua chuoi 4 tang, vi 4 tang ton tai
     * de SANG TAC kich ban tu con so khong; ep clip qua do thi model nghi ra mot kich
     * ban roi co be footage cho vua, tuc pha dung thu luong nay sinh ra de giu.
     *
     * Nguon luu trong raw_input chu khong phai mot cot moi: `render_mode` la enum ve
     * chat luong (draft/tts/premium), khong phai ve nguon lieu. Nhet them gia tri vao
     * do se lam hai khai niem khac nhau dung chung mot cot.
     */
    const laLuongDungClip = String(payload.raw_input?.source_mode ?? '') === 'video_edit';

    if (laLuongDungClip) {
      await runVideoEditJob({
        payload,
        renderId,
        jobTmpDir,
        outputPath,
        assPath,
        onProgress: (p) => setStatus(renderId, 'processing', { progress: p }),
      });
    } else {
    let sceneGraph: Tier3SceneGraph;
    let renderPlan: Tier4RenderPlan;
    let productBrief: any = null;
    let strategy: any = null;

    // Chỉ lồng tiếng cho chế độ KHÁCH ĐÃ CHỌN giọng đọc.
    //
    // Trước đây chỉ kiểm ttsEnabled(), nên bật TTS là MỌI video đều có giọng —
    // kể cả gói "Draft Local (Free)" mà khách không chọn và không trả tiền cho
    // phần đó. Hai chế độ render thành một, và bản miễn phí lại tiêu tiền TTS.
    const modeCoGiongDoc = ['draft_local_tts', 'premium_cloud'].includes(
      String(payload.render_mode || '')
    );
    const coGiongDoc = ttsEnabled() && modeCoGiongDoc;

    // Tùy chọn cho tầng 4. Tỉ lệ khung hình lấy từ LỰA CHỌN CỦA KHÁCH; `hasVoice`
    // quyết định mức nhạc nền — có lời đọc thì nhạc phải lùi xuống 0.10, không thì
    // hai thứ tranh nhau và không nghe rõ lời.
    /**
     * Hai tuỳ chọn người bán tick ở bước Cấu hình.
     *
     * Đọc từ `raw_input` chứ không thêm cột: chúng là lựa chọn của một lần render, và
     * `raw_input` vốn đã mang mọi lựa chọn khác của lần đó.
     */
    /**
     * Giong doc khach chon.
     *
     * `raw_input.voice` nhan ca ma day du (`std_banmai`) lan gioi tinh (`nu`/`nam`).
     * Thieu thi lay tu `.env`. Ma la thi lui ve mac dinh chu khong nem loi: nha cung
     * cap tra HTTP 400 cho ma sai, va loi do xay ra SAU khi da tieu tien LLM.
     */
    const giongDung = chonGiong(payload.raw_input?.voice);
    console.log(`[Worker] Giong doc: ${giongDung}`);

    /**
     * Khung dấu khách đã xác nhận ở bước Cấu hình.
     *
     * Chỉ nhận khung hợp lệ: toạ độ trong [0,1] và có diện tích thật. Một con số hỏng
     * lọt vào đây thành một biểu thức `crop` vô nghĩa, và ffmpeg từ chối cả lần dựng.
     */
    const dauDaXacNhan = (Array.isArray(payload.raw_input?.watermark_boxes)
      ? payload.raw_input.watermark_boxes
      : [])
      .map((d: any) => ({ x: Number(d?.x), y: Number(d?.y), w: Number(d?.w), h: Number(d?.h) }))
      .filter((d: any) =>
        [d.x, d.y, d.w, d.h].every(Number.isFinite) &&
        d.w > 0 && d.h > 0 && d.x >= 0 && d.y >= 0 && d.x + d.w <= 1.001 && d.y + d.h <= 1.001);

    if (dauDaXacNhan.length > 0) {
      console.log(`[Worker] Cat tranh ${dauDaXacNhan.length} dau khach da xac nhan.`);
    }

    const tuyChonChu = {
      khongChu: Boolean(payload.raw_input?.no_text_overlay),
      catVien: Number(payload.raw_input?.crop_edges) || 0,
      dauDaXacNhan,
    };

    const planOpts = {
      aspect: payload.aspect_ratio || '9:16',
      hasVoice: coGiongDoc,
      quality: (payload.render_mode === 'premium_cloud' ? 1080 : 720) as 720 | 1080,
    };

    if (payload.render_plan_json) {
      console.log(`[Worker] Using pre-validated render plan.`);
      renderPlan = payload.render_plan_json;
      sceneGraph = payload.scene_graph_json || sceneCardsToSceneGraph([]);
    } else if (payload.scene_graph_json) {
      console.log(`[Worker] Generating render plan from existing scene graph...`);
      const raw = payload.scene_graph_json;
      sceneGraph = Array.isArray(raw.scene_cards) ? sceneCardsToSceneGraph(raw.scene_cards) : raw as Tier3SceneGraph;
      renderPlan = await SceneGraphService.generateRenderPlanOnly(sceneGraph, planOpts);
    } else if (payload.raw_input) {
      console.log(`[Worker] Running full 4-tier Local AI pipeline...`);
      const pipeline = await SceneGraphService.generatePipeline(payload.raw_input, planOpts);
      productBrief = pipeline.productBrief;
      strategy = pipeline.strategy;
      sceneGraph = pipeline.sceneGraph;
      renderPlan = pipeline.renderPlan;
    } else {
      throw new Error('NO_RENDER_INPUT: renders row has no render_plan_json, scene_graph_json or raw_input');
    }

    // ─── Cong kiem truoc khi render ───
    //
    // Chay o day chu khong o trong tung tang, vi ca ba nhanh tren deu phai di qua:
    // kich ban tu AI, kich ban luu san trong CSDL, va ban chay lai. Mot cong kiem bo
    // sot mot nhanh thi khong phai cong kiem.
    //
    // Viec cua no la got cac khang dinh bia (xem lib/qa-gate.ts) TRUOC khi chung kip
    // di vao hai cho: chu tren man hinh, va loi doc TTS. Got sau khi da tong hop
    // tieng la vo ich — tien TTS da tieu, va file tieng van noi cau sai.
    const qa = qaCheck(sceneGraph, Number(payload.raw_input?.duration_seconds) || undefined);
    for (const dong of formatFindings(qa.findings)) console.warn(`[Worker] ${dong}`);

    if (qa.shouldBlock) {
      throw new Error(
        'QA_BLOCKED: kich ban dung tren khang dinh khong co trong thong tin san pham. ' +
        qa.findings.filter((f) => f.severity === 'block').map((f) => f.reason).join('; ')
      );
    }
    sceneGraph = qa.sceneGraph;

    if (payload.render_plan_json) {
      // Nhanh ke hoach co san: chu overlay nam trong ke hoach, khong lay lai tu do thi
      // canh, nen phai got rieng.
      const daSua = scrubPlanOverlays(renderPlan as any);
      if (daSua > 0) console.warn(`[Worker] QA: da got chu overlay o ${daSua} canh trong ke hoach co san.`);
    } else if ((sceneGraph?.scenes?.length ?? 0) > 0) {
      // Hai nhanh con lai: dung lai ke hoach tu do thi canh DA GOT. buildRenderPlan la
      // ham thuan, dung lai khong ton gi — con re hon viec sua tay tung muc timeline.
      renderPlan = buildRenderPlan(sceneGraph, planOpts);
    }

    // Ke hoach khong co canh nao thi DUNG LAI o day.
    //
    // buildFfmpegCommandFromPlan duyet theo renderPlan.timeline. Timeline rong nghia la
    // khong input, khong filter — ffmpeg van chay xong va van tra ma 0, nhung cho ra mot
    // file rong. Truoc day khong cho nao kiem, nen khach nhan duoc "video" khong co gi
    // ma he thong bao thanh cong.
    //
    // Nhanh render_plan_json ghi chu la "pre-validated" nhung thuc te doc thang tu CSDL,
    // khong qua schema nao — mot ban ghi hong tu lan chay cu se di thang toi day.
    const sceneCount = renderPlan?.timeline?.length ?? 0;
    if (sceneCount === 0) {
      throw new Error(
        'EMPTY_RENDER_PLAN: ke hoach dung video khong co canh nao (timeline rong). ' +
        'Khong the dung video — can tao lai kich ban.'
      );
    }
    console.log(`[Worker] Ke hoach co ${sceneCount} canh.`);

    await supabase.from('renders').update({
      product_brief_json: productBrief,
      strategy_json: strategy,
      scene_graph_json: sceneGraph,
      render_plan_json: renderPlan,
    }).eq('id', renderId);

    await setStatus(renderId, 'processing', { progress: 15 });

    console.log(`[Worker] Preparing assets...`);
    const realImageUrls = await resolveRealImageUrls(payload, renderPlan);

    // Du an khong co anh thi DUNG LAI o day.
    //
    // resolveRealImageUrls chi thay URL khi co anh that. Khong co anh thi URL do
    // model bia ra (vi du example.com) van nam nguyen trong renderPlan.assets va
    // se bi dem di tai. Khong duoc di tai dia chi do mot LLM nghi ra: allowlist
    // chan duoc that, nhung dung de no den duoc buoc do.
    //
    // Loi cu "Host khong nam trong allowlist: example.com" cung khong noi cho
    // nguoi dung biet van de that la ho chua tai anh nao len.
    if (realImageUrls.length === 0) {
      throw new Error(
        'NO_PRODUCT_IMAGES: du an khong co anh nao de dung video. ' +
        'Tai len it nhat 1 anh san pham roi render lai.'
      );
    }

    const assetById: Record<string, string> = {};
    const inputImages: string[] = [];

    /**
     * Thong so that cua cac clip quay tay. `buildFfmpegCommandFromPlan` can do dai
     * THAT de biet cat doan nao — khong doc duoc thi no cat tu dau clip.
     */
    const videoMeta = new Map<string, VideoMeta>();

    /**
     * Tai mot lieu dau vao, khong quan tam anh hay video.
     *
     * Duoi file quyet dinh cach ffmpeg doc, nen phai dat dung: `.mp4` cho clip,
     * `.jpg` cho anh. Dat nham duoi thi ffmpeg van co doan nhung khong phai luc nao
     * cung doan dung.
     */
    const taiLieu = async (url: string, chiSo: number): Promise<string> => {
      if (isVideoAsset(url)) {
        const dich = path.join(jobTmpDir, `asset_${chiSo}.mp4`);

        // Phai noi ro han muc: mac dinh cua safeDownload la 25MB / 20 giay, dung cho
        // anh nhung chan dung mot clip 200MB ma spec cho phep. De mac dinh thi moi
        // video that deu bi cat giua chung roi bao loi tai ve.
        const bytes = await safeDownload(url, {
          maxBytes: MAX_CLIP_BYTES,
          timeoutMs: 180_000,
        });
        fs.writeFileSync(dich, bytes);

        // Do bang ffprobe chu khong tin duoi file: duoi do nguoi dung dat. Cung bai
        // hoc da sinh ra `sniffImageType` — mot file JSON loi ten .jpg tung lot vao
        // va cho ra video rong khong dau vet.
        const ts = await probeVideo(dich);
        if (ts) {
          videoMeta.set(dich, ts);
          console.log(`[Worker] Clip ${chiSo}: ${ts.width}x${ts.height}, ${ts.durationSec.toFixed(1)}s, ${ts.codec}`);
        } else {
          console.warn(`[Worker] Khong doc duoc thong so clip ${chiSo} — se cat tu dau clip.`);
        }
        return dich;
      }

      const dich = path.join(jobTmpDir, `asset_${chiSo}.jpg`);
      await downloadImage(url, dich);
      // Chuan hoa NGAY sau khi tai: lenh dung video khong duoc nhin thay WebP.
      const sach = await chuanHoaAnh(dich);

      /**
       * Nang do phan giai TRUOC khi dung, cho nhung tam chua du net de cat can.
       *
       * Do ngay 30/10 tren 40 anh khach da tai len: trung vi chieu ngan 1024px, va
       * chi 16/40 du pixel de cat can 1,28x ma van net o khung 1080. Mat net do duoc
       * bang SSIM: 0,9677 o 1024px so voi 0,9909 o 2000px — gap muoi lan khoang cach
       * giua hai bo ma hoa ma toi da can nhac ngay 29/10.
       *
       * Loi ich kep: vuot 1382px thi cat can dung duoc, moi anh ganh 3 canh thay vi 2
       * — ba tam anh mo duoc moc 30 giay thay vi 20.
       *
       * Nang hong hoac chua cai bo nang thi dung anh goc; mot tam anh hoi mem van
       * dung duoc video.
       */
      const ts = await probeVideo(sach);
      const canhNgan = ts ? Math.min(ts.width, ts.height) : null;
      const kq = await nangAnh(sach, canhNgan, jobTmpDir);
      if (kq.daNang) {
        console.log(`[Worker] Nang anh ${chiSo}: ${canhNgan}px -> du net de cat can.`);
        // Ha ve tran roi chuan hoa lai: bo nang tra PNG 4x, nang hon khung dung nhieu.
        const haXuong = path.join(jobTmpDir, `asset_${chiSo}_nang.jpg`);
        const ok = await new Promise<boolean>((resolve) => {
          const p = spawn('ffmpeg', ['-v', 'error', '-i', kq.duongDan,
            '-vf', `scale='min(${PX_TRAN},iw)':'min(${PX_TRAN},ih)':force_original_aspect_ratio=decrease:flags=lanczos`,
            '-frames:v', '1', '-q:v', '2', '-pix_fmt', 'yuvj420p', '-y', haXuong]);
          p.on('error', () => resolve(false));
          p.on('close', (ma) => resolve(ma === 0));
        });
        if (ok && fs.existsSync(haXuong)) return haXuong;
        return kq.duongDan;
      }
      if (canhNgan && canNang(canhNgan).nen) {
        console.log(`[Worker] Anh ${chiSo} (${canhNgan}px) dang le nen nang nhung ${kq.lyDo}.`);
      }
      return sach;
    };

    let imgIndex = 0;
    for (const asset of renderPlan.assets || []) {
      if (asset.type === 'image' && asset.source) {
        const destPath = await taiLieu(asset.source, imgIndex);
        assetById[asset.asset_id] = destPath;
        inputImages.push(destPath);
        imgIndex++;
      }
    }

    if (inputImages.length === 0 && realImageUrls.length > 0) {
      for (let i = 0; i < realImageUrls.length; i++) {
        inputImages.push(await taiLieu(realImageUrls[i], i));
      }
    }

    if (inputImages.length === 0) throw new Error('NO_IMAGES: no image assets available for composition');

    const { data: project } = await supabase.from('projects').select('package_type').eq('id', payload.project_id).single();
    const packageType = project?.package_type || 'quick_ads';
    const musicPath = resolveMusicFile(renderPlan, packageType);

    await setStatus(renderId, 'processing', { progress: 25 });

    // ─── Giọng đọc ───
    //
    // Quy tắc của spec: giọng hỏng KHÔNG làm hỏng cả video. Mỗi câu được bắt lỗi
    // riêng, câu nào hỏng thì cảnh đó im lặng, các cảnh còn lại vẫn có tiếng.
    // Tắt TTS hoặc thiếu khoá API thì bỏ qua cả khối, render bản không lời như trước.
    const voiceFiles: (string | null)[] = [];
    /** Phu de da can khop giong doc, theo tung canh. */
    const subtitleCues: TimedCue[][] = [];

    /** He so `atempo` cho tung canh; 1 nghia la doc nguyen nhip. */
    const tempoTieng: number[] = [];

    if (coGiongDoc) {
      /**
       * Cat loi thoai cho VUA canh truoc khi tong hop.
       *
       * Tang 3 viet dai hon suc chua du prompt da noi ro ngan sach ky tu. Do tren
       * render 57c684ca ngay 31/10: tam tren muoi cau vuot 20-40%, nen moi canh deu
       * bi keo ra va mot video dat 30 giay xuat xuong o 35,1 giay.
       *
       * Cac nen tang xep video theo moc thoi luong, nen "dat 30 thi phai ra 30".
       *
       * Cat o day chu khong cat sau khi tong hop: tra tien TTS cho nhung chu se bi
       * bo di la tra tien cho rac.
       */
      let soCat = 0;
      const lines = (renderPlan.timeline || []).map((item: any) => {
        const scene = (sceneGraph?.scenes || []).find((s: any) => s.scene_id === item.scene_id);
        const goc = (scene?.voice_line || '').trim();
        if (!goc) return '';
        const giayCanh = Math.max(0.5, Number(item.end_sec) - Number(item.start_sec));
        const vua = catLoiChoVua(goc, giayCanh);
        if (vua.length < goc.length) soCat++;
        return vua;
      });
      if (soCat > 0) {
        console.log(`[Worker] Cat ${soCat}/${lines.length} loi thoai cho vua thoi luong canh.`);
      }

      const spoken = lines.filter(Boolean).length;
      console.log(`[Worker] Long tieng: ${spoken}/${lines.length} canh co loi doc.`);

      let failed = 0;
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]) { voiceFiles.push(null); continue; }
        try {
          const r = await synthesize({ text: lines[i], voice: giongDung, traceId: renderId });
          voiceFiles.push(r.filePath);
          console.log(`[Worker]   canh ${i + 1}: ${r.cached ? 'lay tu cache' : `sinh moi ${r.latencyMs}ms`}`);
        } catch (err: any) {
          failed++;
          voiceFiles.push(null);
          console.warn(`[Worker]   canh ${i + 1} khong co tieng (${err.code ?? 'loi'}): ${err.message}`);
        }
      }

      if (failed > 0) {
        console.warn(`[Worker] ${failed}/${spoken} cau that bai — video van duoc dung, cac canh do im lang.`);
      }

      // ─── Khớp độ dài cảnh với lời đọc ───
      //
      // PHẢI làm trước khi căn phụ đề và trước khi dựng lệnh: cả hai đều đọc mốc
      // thời gian của timeline.
      //
      // Đo trên render `ea39bbcb` đã giao khách ngày 30/10: bốn trong sáu câu dài
      // hơn cảnh của nó, tổng 4,17 giây chồng tiếng trên video 20 giây — hơn một
      // phần năm thời lượng có hai giọng đè lên nhau. Cảnh cuối tràn 1,73 giây nên
      // câu kết bị cắt ngang.
      //
      // Kéo cảnh cho vừa câu, không cắt câu cho vừa cảnh. Không đổi số credit:
      // `specFromRequest` tính tiền theo thời lượng KHÁCH ĐẶT.
      const daiTieng: Array<number | null> = [];
      for (const vf of voiceFiles) {
        daiTieng.push(vf ? await probeDuration(vf) : null);
      }

      /**
       * Tang nhip doc cho phan con du, truoc khi nghi toi chuyen keo canh.
       *
       * Cat chu da lam o tren, nhung toc do doc that khong bao gio khop cong thuc
       * tuyet doi — con du vai phan muoi giay la chuyen thuong. `atempo` toi 1,15
       * tren tieng noi thi tai thuong khong nhan ra, va no giu TRON chu.
       *
       * Thu tu: cat chu -> tang nhip -> (chi khi van du) keo canh. Keo canh la lua
       * chon cuoi cung vi no lam video dai hon thu khach dat, ma cac nen tang xep
       * video theo moc thoi luong.
       */
      tempoTieng.length = 0;
      for (const [i, item] of (renderPlan.timeline as any[]).entries()) {
        const giayCanh = Math.max(0.5, Number(item.end_sec) - Number(item.start_sec));
        tempoTieng.push(tempoChoVua(daiTieng[i], giayCanh));
      }
      const soTang = tempoTieng.filter((t) => t > 1.001).length;
      if (soTang > 0) {
        const caoNhat = Math.max(...tempoTieng);
        console.log(`[Worker] Tang nhip doc ${soTang}/${tempoTieng.length} canh (toi da ${caoNhat.toFixed(2)}x) de giu dung thoi luong.`);
        // Do dai SAU khi tang nhip — day moi la con so de quyet dinh co phai keo canh.
        for (let i = 0; i < daiTieng.length; i++) {
          const d = daiTieng[i];
          if (d && tempoTieng[i] > 1) daiTieng[i] = d / tempoTieng[i];
        }
      }

      const khop = khopCanhVoiTieng(renderPlan.timeline as any, daiTieng);
      if (khop.keoThem > 0) {
        console.log(
          `[Worker] Van phai keo dai ${khop.chiTiet.length} canh cho vua loi doc ` +
          `(+${khop.keoThem.toFixed(2)}s): ${khop.chiTiet.join(' | ')}`
        );
        renderPlan.timeline = khop.timeline as any;
      }

      // ─── Căn phụ đề khớp giọng đọc ───
      //
      // Giờ đã có file tiếng, đo được câu nói kéo dài bao lâu thật sự. Phụ đề bám
      // theo đó thay vì bám mốc cảnh do AI đặt — cảnh 4 giây mà chỉ nói 2,3 giây
      // thì chữ không còn đọng lại sau khi tiếng đã dứt.
      const whisperModel = process.env.WHISPER_MODEL_PATH || '';
      let dungWhisper = 0;
      let dungTiLe = 0;

      for (let i = 0; i < voiceFiles.length; i++) {
        const vf = voiceFiles[i];
        if (!vf || !lines[i]) { subtitleCues.push([]); continue; }

        try {
          const r = await alignSubtitles(vf, lines[i], {
            modelPath: whisperModel || undefined,
            language: process.env.WHISPER_LANGUAGE || 'vi',
            durationSec: (await probeDuration(vf)) ?? undefined,
          });
          subtitleCues.push(r.cues);
          if (r.method === 'whisper') dungWhisper++; else dungTiLe++;
        } catch (err: any) {
          // Căn hỏng thì để trống, cảnh đó quay về phụ đề cả câu. Không được
          // làm hỏng bản render chỉ vì phụ đề lệch.
          console.warn(`[Worker]   canh ${i + 1} khong can duoc phu de: ${err.message}`);
          subtitleCues.push([]);
        }
      }

      if (dungWhisper + dungTiLe > 0) {
        console.log(
          `[Worker] Can phu de: ${dungWhisper} canh bang Whisper, ${dungTiLe} canh chia theo ti le` +
          (whisperModel ? '' : ' (chua dat WHISPER_MODEL_PATH nen khong dung Whisper)')
        );
      }

      await setStatus(renderId, 'processing', { progress: 35 });
    } else if (ttsEnabled()) {
      // Noi ro ly do bo qua, de khong phai doan khi video ra khong co tieng.
      console.log(`[Worker] Che do "${payload.render_mode}" khong co giong doc — render ban khong loi.`);
    }

    console.log(`[Worker] FFmpeg bat dau: encoder=${VIDEO_ENCODER}` + (VIDEO_ENCODER.includes('nvenc') ? ` (GPU ${FFMPEG_GPU_INDEX})` : ' (CPU)') + '...');
    const { args: ffmpegArgs, duration } = buildFfmpegCommandFromPlan(renderPlan, sceneGraph, inputImages, assetById, musicPath, outputPath, assPath, voiceFiles, subtitleCues, payload.aspect_ratio, videoMeta, tuyChonChu, tempoTieng);

    try {
      await execFfmpegWithProgress(ffmpegArgs, duration, renderId);
    } catch (ffmpegErr: any) {
      if (ffmpegErr?.sapDo) {
        // ffmpeg SAP, khong phai tham so sai.
        //
        // Do ngay 30/10: tren may nay, preset `medium` tro len lam bo ma hoa segfault
        // voi chuoi filter day du — tren Windows hien ra thanh 3221225477. Mac dinh
        // da ha ve `faster`, nhung may khac co the co tran khac. Thu lai mot lan bang
        // preset nhe nhat thay vi bo ca lan dung: video hoi kem chat van hon khong co.
        console.warn(`[Worker] ffmpeg SAP — thu lai bang preset ${PRESET_LUI}...`);
        const argsLui = ffmpegArgs.map((a, i) =>
          ffmpegArgs[i - 1] === '-preset' ? PRESET_LUI : a
        );
        await execFfmpegWithProgress(argsLui, duration, renderId);
      } else {
        console.warn(`[Worker] NVENC failed, falling back to CPU (libx264)...`);
        const cpuPlan = { ...renderPlan, export: { ...renderPlan.export, codec: 'libx264' as const } };
        const { args: cpuArgs } = buildFfmpegCommandFromPlan(cpuPlan, sceneGraph, inputImages, assetById, musicPath, outputPath, assPath, voiceFiles, subtitleCues, payload.aspect_ratio, videoMeta, tuyChonChu, tempoTieng);
        await execFfmpegWithProgress(cpuArgs, duration, renderId);
      }
    }
    } // het nhanh luong anh

    console.log(`[Worker] Uploading ${outputFileName} to Supabase Storage...`);
    const fileBuffer = fs.readFileSync(outputPath);
    const { error: uploadErr } = await supabase.storage
      .from('renders')
      .upload(outputFileName, fileBuffer, { contentType: 'video/mp4', upsert: true });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: publicUrlData } = supabase.storage.from('renders').getPublicUrl(outputFileName);
    const outputUrl = publicUrlData.publicUrl;

    // Anh dai dien: Dashboard va trang du an can mot anh tinh de hien truoc khi
    // khach bam phat. Ca khoi nay khong duoc lam hong ban render da thanh cong.
    let thumbnailUrl: string | null = null;
    const ext = path.extname(outputFileName);
    const thumbFileName = `${outputFileName.slice(0, outputFileName.length - ext.length)}.jpg`;
    const thumbPath = path.join(OUTPUT_DIR, thumbFileName);

    if (await makeThumbnail(outputPath, thumbPath)) {
      const { error: thumbErr } = await supabase.storage
        .from('renders')
        .upload(thumbFileName, fs.readFileSync(thumbPath), { contentType: 'image/jpeg', upsert: true });

      if (thumbErr) {
        console.warn(`[Worker] Tao duoc anh dai dien nhung tai len that bai: ${thumbErr.message}`);
      } else {
        thumbnailUrl = supabase.storage.from('renders').getPublicUrl(thumbFileName).data.publicUrl;
      }
    }

    const renderTimeMs = Date.now() - startMs;

    // Mo file da dung ra xem truoc khi noi la xong.
    //
    // Tru credit chi chay o trang thai 'completed', nen bao that bai o day la khach
    // KHONG MAT GI — tot hon han viec giao mot video den roi tinh tien.
    // Do THOI LUONG THAT cua file dau ra, khong lay con so trong ke hoach: `duration`
    // chi ton tai trong nhanh luong anh, con nhanh luong clip khong co. Va do file
    // that thi dung hon — neu ffmpeg cat ngan video thi phep kiem van tinh dung ti le.
    const thoiLuongThat = (await probeDuration(outputPath)) ?? 0;
    const soat = await soatDen(outputPath, thoiLuongThat);
    if (!soat.dat) {
      console.error(`[Worker] Video dung xong nhung HONG: ${soat.lyDo} (render ${renderId})`);
      await sendCallback(renderId, 'failed', {
        error_code: 'VIDEO_DEN',
        error_message: `${soat.lyDo}. Không trừ credit — thử dựng lại.`,
      });
      await setStatus(renderId, 'failed', {
        error_code: 'VIDEO_DEN',
        error_message: `${soat.lyDo}. Không trừ credit — thử dựng lại.`,
      });
      return;
    }

    console.log(`[Worker] Success. Time: ${renderTimeMs}ms. URL: ${outputUrl}`);

    // Gọi callback TRƯỚC khi ghi 'completed', không phải sau.
    //
    // Route callback chỉ trừ credit khi trạng thái CŨ chưa phải trạng thái cuối —
    // chốt đó dựng ra để tránh trừ hai lần. Nhưng worker ghi 'completed' trước rồi
    // mới gọi, nên route đọc lại thấy đã 'completed' và bỏ qua phần trừ.
    //
    // Hậu quả đo được ngày 29/10: 3 video hoàn thành, **0 bút toán `render_completed`**
    // trong `credit_ledger`. Mọi video đang được render miễn phí.
    const ketQua = await sendCallback(renderId, 'completed', {
      output_url: outputUrl,
      duration_ms: renderTimeMs,
    });

    // Backend từ chối vì không đủ xu: KHÔNG đánh dấu hoàn thành.
    //
    // Route đã tự đặt trạng thái 'failed'; ghi đè thành 'completed' ở đây là trao
    // video cho khách không trả tiền, và che mất lý do thật.
    if (ketQua && ketQua.success === false) {
      console.warn(`[Worker] Backend tu choi ${renderId}: ${ketQua.error}`);
      return;
    }

    await setStatus(renderId, 'completed', {
      output_url: outputUrl,
      thumbnail_url: thumbnailUrl,
      progress: 100,
      duration_ms: renderTimeMs,
      error_code: null,
      error_message: null,
    });


  } catch (err: any) {
    console.error(`[Worker] Error:`, err.message);
    // `last_fail_reason` mang PHAN DUOI stderr cua ffmpeg khi co. Khong co no thi
    // chi con mot ma so vo nghia, va moi lan hong lai phai di hoi console cua worker
    // tren mot may khac.
    const chiTiet = (err as any).chiTiet ? String((err as any).chiTiet) : '';
    await setStatus(renderId, 'failed', {
      error_code: err.message.includes(':') ? err.message.split(':')[0].trim() : 'RENDER_FAILED',
      error_message: err.message.slice(0, 500),
      last_fail_reason: (chiTiet || err.message).slice(0, 2000),
      progress: 0,
    });
    await sendCallback(renderId, 'failed', { error_code: 'RENDER_FAILED', error_message: err.message.slice(0, 500) });
  } finally {
    inFlight.delete(renderId);
    if (fs.existsSync(jobTmpDir)) fs.rmSync(jobTmpDir, { recursive: true, force: true });
  }
}

/** Toi da bao nhieu job ton dong xu ly trong mot lan quet. */
const SWEEP_LIMIT = parseInt(process.env.RENDER_SWEEP_LIMIT || '20', 10);

/**
 * Quet cac job con 'pending' luc khoi dong.
 * Realtime chi gui su kien INSERT khi worker DANG ket noi. Job tao ra trong luc worker tat
 * se nam mai o 'pending' vi khong con su kien nao de nghe — day la lo hong van hanh lon nhat
 * cua mo hinh nghe realtime thuan. Quet mot lan luc khoi dong la chot chan re nhat.
 */
/**
 * Thu hồi job kẹt ở trạng thái 'processing'.
 *
 * Worker chết giữa chừng (mất điện, Ctrl+C, hết RAM) để lại dòng ở 'processing'
 * vĩnh viễn: vòng quét chỉ tìm 'pending' nên không ai nhặt lại, và khách chờ mãi
 * không có gì. Quá thời hạn thì trả về 'pending' để được xử lý lại.
 */
async function reclaimStuckJobs() {
  const phutToiDa = parseInt(process.env.RENDER_STUCK_MINUTES || '20', 10);
  const moc = new Date(Date.now() - phutToiDa * 60_000).toISOString();

  const { data, error } = await supabase
    .from('renders')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'processing')
    .lt('updated_at', moc)
    .select('id');

  if (error) {
    console.warn(`[Worker] Khong thu hoi duoc job ket: ${error.message}`);
    return;
  }
  if (data && data.length > 0) {
    console.log(`[Worker] Thu hoi ${data.length} job ket qua ${phutToiDa} phut — dua lai vao hang doi.`);
  }
}

async function sweepPendingJobs(imLang = false) {
  await reclaimStuckJobs();

  const { data, error } = await supabase
    .from('renders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(SWEEP_LIMIT);

  if (error) {
    console.error(`[Worker] Khong quet duoc job ton dong: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    // Vòng quét định kỳ chạy liên tục, in mỗi lần thì log ngập mà không nói gì thêm.
    if (!imLang) console.log('[Worker] Khong co job ton dong.');
    return;
  }

  console.log(`[Worker] Tim thay ${data.length} job ton dong — xu ly lan luot.`);
  // Tuan tu chu khong song song: may ca nhan chi co bay nhieu CPU, chay cung luc
  // lam cham tat ca va de het RAM giua chung.
  for (const job of data) {
    await processRenderJob(job).catch((e) =>
      console.error(`[Worker] Job ${job.id} that bai khi quet:`, e)
    );
  }
}

if (!CHI_NAP) console.log(`[Worker] Starting Viprosell Render Worker (Supabase Realtime, unified path)...`);

const channel = supabase.channel('public:renders')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'renders', filter: 'status=eq.pending' },
    (payload) => {
      console.log(`[Realtime] Received new pending job:`, payload.new.id);
      processRenderJob(payload.new).catch(console.error);
    }
  )
  .subscribe((status) => {
    if (CHI_NAP) return;
    if (status === 'SUBSCRIBED') {
      console.log(`[Realtime] Listening for new jobs on 'renders' table...`);
      // Quet SAU khi da dang ky nghe: job moi phat sinh trong luc quet van duoc nhan,
      // va inFlight chan viec xu ly trung.
      void sweepPendingJobs();
    } else {
      console.log(`[Realtime] Status changed:`, status);
    }
  });

// ─── Quét định kỳ, KHÔNG chỉ một lần lúc khởi động ───
//
// Realtime là kênh thông báo, không phải nguồn trạng thái: nó chỉ hoạt động khi
// bảng `renders` nằm trong publication của Supabase, và im lặng khi không.
// Trước đây quét đúng một lần lúc khởi động rồi phó mặc cho Realtime — job tạo
// sau thời điểm đó nằm im vĩnh viễn, khách nhìn 0% suốt 45 phút.
//
// Đây là lần thứ ba Realtime gây lỗi trong dự án này: worker bỏ sót job, frontend
// treo 0%, và lần này. Quét định kỳ làm đường lui, Realtime giữ làm đường nhanh.
//
// Đặt ngoài callback subscribe để vẫn chạy kể cả khi Realtime không kết nối được.
const SWEEP_INTERVAL_MS = parseInt(process.env.RENDER_SWEEP_INTERVAL_MS || '20000', 10);
setInterval(() => {
  // Đang render thì để yên: máy cá nhân chỉ có bấy nhiêu CPU.
  if (inFlight.size > 0) return;
  void sweepPendingJobs(true);
}, SWEEP_INTERVAL_MS);
console.log(`[Worker] Quet hang doi moi ${Math.round(SWEEP_INTERVAL_MS / 1000)} giay.`);

// ─── Dọn file đã quá hạn thùng rác ───
//
// Trước đây xoá dự án chỉ xoá dòng trong CSDL, file video vẫn nằm trong bucket
// vĩnh viễn. Hai hậu quả: trả tiền lưu trữ cho rác, và file vẫn tải được qua
// đường dẫn công khai dù khách tưởng đã xoá.
//
// Chỉ dọn thứ ĐÃ quá 30 ngày trong thùng rác, nên khách bấm nhầm vẫn kịp lấy lại.
// Đặt trong worker vì nó đã chạy thường trực — không cần dựng thêm dịch vụ.
const PURGE_INTERVAL_MS = parseInt(process.env.STORAGE_PURGE_INTERVAL_MS || '3600000', 10);

async function chayDonDinhKy() {
  if (inFlight.size > 0) return; // render quan trọng hơn dọn
  try {
    const r = await purgeExpiredProjects(supabase, {
      limit: parseInt(process.env.STORAGE_PURGE_LIMIT || '20', 10),
      dryRun: process.env.STORAGE_PURGE_DRY_RUN === 'true',
    });
    if (r.duAnDaDon > 0) {
      console.log(`[Don] Da don ${r.duAnDaDon} du an, xoa ${r.fileDaXoa} file.`);
    }
    for (const e of r.loi) console.warn(`[Don] ${e}`);

    /**
     * Clip goc cua nhung du an da render xong qua han giu.
     *
     * Rieng ra khoi `purgeExpiredProjects` vi hai thu khac han nhau: ham kia don du
     * an DA VAO THUNG RAC qua 30 ngay, ham nay don clip goc cua du an VAN DANG DUNG.
     * Gop lam mot thi khong con cach nao dat hai thoi han khac nhau.
     */
    const rc = await purgeSourceClips(supabase, {
      limit: parseInt(process.env.STORAGE_PURGE_LIMIT || '20', 10),
      dryRun: process.env.STORAGE_PURGE_DRY_RUN === 'true',
    });
    if (rc.clipDaXoa > 0) {
      console.log(`[Don] Xoa ${rc.clipDaXoa} clip goc cua ${rc.duAnDaCham} du an (giu ${GIU_CLIP_GOC_GIO}h sau render).`);
    }
    for (const e of rc.loi) console.warn(`[Don] ${e}`);

    /**
     * Thu muc tam con sot lai tren o dia may nay.
     *
     * `finally` cua moi job da xoa thu muc cua no, nhung `finally` khong chay khi
     * tien trinh bi giet giua chung — va worker nay bi khoi dong lai thuong xuyen.
     * Moi lan nhu vay de lai vai tram MB nam vinh vien.
     */
    const rt = donThuMucTamCu(fs, path, ASSETS_TMP_DIR, {
      dangChay: inFlight,
      dryRun: process.env.STORAGE_PURGE_DRY_RUN === 'true',
    });
    if (rt.daXoa > 0) console.log(`[Don] Xoa ${rt.daXoa} thu muc tam cu tren o dia.`);
    for (const e of rt.loi) console.warn(`[Don] thu muc tam ${e}`);
  } catch (err: any) {
    console.warn(`[Don] Vong don that bai: ${err.message}`);
  }
}

setInterval(() => void chayDonDinhKy(), PURGE_INTERVAL_MS);
// Chạy một lần sau 2 phút: khởi động xong đã dọn ngay thì tranh CPU với job tồn đọng.
setTimeout(() => void chayDonDinhKy(), 120_000);
console.log(
  duongBoNang()
    ? `[Worker] Nang anh: BAT (${duongBoNang()}), anh duoi ${PX_CAN_CO}px se duoc nang truoc khi dung.`
    : `[Worker] Nang anh: TAT (chua dat NANG_ANH_BIN) — anh duoi ${PX_CAN_CO}px se mem khi cat can.`
);

console.log(
  `[Worker] Don thung rac moi ${Math.round(PURGE_INTERVAL_MS / 60000)} phut` +
  `, clip goc giu ${GIU_CLIP_GOC_GIO}h sau render.`
);

/**
 * Khoá một-tiến-trình: chỉ cho phép MỘT worker chạy tại một thời điểm.
 *
 * Ngày 28/10 trên máy thật có BỐN tiến trình worker — hai lần khởi động cách nhau sáu
 * phút mà lần cũ không được tắt. Hai worker cùng quét hàng đợi thì:
 *
 *   - `inFlight` chỉ chặn trùng TRONG một tiến trình, không chặn được giữa hai tiến
 *     trình, nên cùng một render bị dựng hai lần.
 *   - Cả hai cùng ghi tiến độ vào một hàng, số nhảy qua lại.
 *   - Cả hai cùng gọi `reclaimStuckJobs`, và cái này có thể cướp job khỏi cái kia
 *     đang chạy dở.
 *
 * Khoá bằng FILE chứ không bằng cổng mạng: worker không mở cổng nào, và file nằm
 * cạnh thư mục tạm nên thấy được khi cần gỡ tay.
 *
 * Ghi PID vào khoá để phân biệt "còn sống" với "chết để lại rác": tiến trình chết đột
 * ngột không kịp xoá file, và một khoá mồ côi sẽ chặn mọi lần khởi động sau đó.
 */
const LOCK_PATH = path.join(ASSETS_TMP_DIR, 'worker.lock');

function conSong(pid: number): boolean {
  try {
    // Tín hiệu 0 không giết gì, chỉ hỏi tiến trình có tồn tại không.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function giuKhoa(): boolean {
  try {
    fs.mkdirSync(ASSETS_TMP_DIR, { recursive: true });
    if (fs.existsSync(LOCK_PATH)) {
      const pidCu = parseInt(fs.readFileSync(LOCK_PATH, 'utf-8').trim(), 10);
      if (Number.isFinite(pidCu) && pidCu !== process.pid && conSong(pidCu)) {
        console.error(
          `[Worker] DA CO worker khac dang chay (PID ${pidCu}). Thoat.
` +
          `         Hai worker cung quet hang doi se dung trung mot render.
` +
          `         Tat cai cu truoc, hoac xoa ${LOCK_PATH} neu chac no da chet.`
        );
        return false;
      }
      console.warn(`[Worker] Don khoa mo coi cua PID ${pidCu} da chet.`);
    }
    fs.writeFileSync(LOCK_PATH, String(process.pid), 'utf-8');
    return true;
  } catch (err: any) {
    // Không giữ được khoá thì vẫn chạy: thà chấp nhận rủi ro trùng còn hơn không
    // render được gì vì một lỗi hệ thống tệp.
    console.warn(`[Worker] Khong tao duoc khoa (${err.message}) — van chay tiep.`);
    return true;
  }
}

if (!CHI_NAP && !giuKhoa()) process.exit(1);

function nhaKhoa() {
  try {
    if (fs.existsSync(LOCK_PATH) && fs.readFileSync(LOCK_PATH, 'utf-8').trim() === String(process.pid)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch { /* thoat roi thi khong con gi de cuu */ }
}

process.on('exit', nhaKhoa);
process.on('SIGTERM', () => { nhaKhoa(); process.exit(); });

process.on('SIGINT', () => {
  nhaKhoa();
  supabase.removeChannel(channel);
  process.exit();
});