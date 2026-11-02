/**
 * Viprosell — Tìm dấu bản quyền trên ảnh nguồn
 *
 * ── Vì sao không chỉ dùng OCR ──
 *
 * Đo ngày 31/10 trên 80 ảnh khách đã tải lên: Tesseract đọc được dấu "HAVATA" trên
 * đúng 6/6 ảnh có dấu, tin cậy 83–91. Nhưng nó cũng đọc ra:
 *
 *     "LIU GEMOLOGICAL RESEARCH"   ← giấy chứng nhận đá quý, LÀ sản phẩm
 *     "Hung Dao Street,"           ← địa chỉ trên giấy đó
 *     "ninhle.com"                 ← in trên vỏ hộp, LÀ sản phẩm
 *     "softy", "clors"             ← đọc sai chính tả
 *
 * Về mặt pixel, dấu của sàn và chữ in trên hộp giống hệt nhau. Xoá tự động theo OCR
 * là phá sản phẩm của khách.
 *
 * ── Hai tín hiệu OCR không có, nhưng mình thì có ──
 *
 * 1. **Lặp vị trí giữa các ảnh cùng dự án.** Dấu HAVATA nằm cùng một chỗ trên cả 6
 *    ảnh. Chữ in trên sản phẩm thì đổi vị trí theo góc chụp. Đây là bộ lọc mạnh nhất
 *    và hoàn toàn miễn phí.
 *
 * 2. **Khách xác nhận.** Hiện ra đúng cái tìm được rồi để khách tích. Biến một bộ dò
 *    đúng 80% thành một tính năng đúng 100%.
 *
 * ── Vì sao khớp theo VỊ TRÍ chứ không theo CHỮ ──
 *
 * Cùng một dấu được đọc thành "HAVATA" ở ảnh này và "HAVAIA" ở ảnh kia — font serif
 * làm chữ T thành I. Khớp theo chữ thì trượt, khớp theo vị trí thì trúng. Chữ chỉ để
 * hiện cho khách đọc.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Một khung chữ tìm được. Toạ độ là TỈ LỆ 0..1 để so được giữa ảnh khác khổ. */
export interface KhungChu {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chữ đọc được — chỉ để hiện cho khách, không dùng để khớp. */
  text: string;
  /** Độ tin cậy của Tesseract, 0..100. */
  tin: number;
}

/**
 * Vùng viền được quét.
 *
 * Quét DẢI NGANG toàn bề rộng, không quét bốn ô góc: đo ngày 31/10 cho thấy dấu
 * "HAVATA Basic Fashion" nằm ở GIỮA ĐỈNH ảnh, lọt đúng khe giữa các ô góc. Đổi sang
 * dải ngang thì bắt được cả hai kiểu đặt dấu.
 *
 * Không quét phần giữa khung: đó là chỗ của sản phẩm, và mọi chữ ở đó gần như chắc
 * chắn thuộc về sản phẩm.
 */
export const VUNG_VIEN: Array<{ ten: string; bieuThuc: string; x: number; y: number; w: number; h: number }> = [
  { ten: 'tren', bieuThuc: 'crop=iw:ih*0.18:0:0', x: 0, y: 0, w: 1, h: 0.18 },
  { ten: 'duoi', bieuThuc: 'crop=iw:ih*0.18:0:ih*0.82', x: 0, y: 0.82, w: 1, h: 0.18 },
  { ten: 'trai', bieuThuc: 'crop=iw*0.16:ih*0.64:0:ih*0.18', x: 0, y: 0.18, w: 0.16, h: 0.64 },
  { ten: 'phai', bieuThuc: 'crop=iw*0.16:ih*0.64:iw*0.84:ih*0.18', x: 0.84, y: 0.18, w: 0.16, h: 0.64 },
];

/** Đường dẫn Tesseract; để trống thì tính năng tắt hẳn. */
export function duongDocChu(): string {
  return String(process.env.DOC_CHU_BIN ?? '').trim();
}

function thuMucTessdata(): string {
  const tuBien = String(process.env.DOC_CHU_TESSDATA ?? '').trim();
  return tuBien || path.join(path.dirname(duongDocChu()), 'tessdata');
}

/** Độ tin cậy tối thiểu. Dưới mức này Tesseract hay trả về rác như "\" hay "©". */
export const TIN_TOI_THIEU = 65;

/**
 * Đọc chữ ở viền một tấm ảnh.
 *
 * Không bao giờ ném lỗi: dò hỏng thì trả mảng rỗng và lần dựng chạy tiếp bình thường.
 */
export function docChuVienAnh(duongAnh: string): KhungChu[] {
  const bin = duongDocChu();
  if (!bin || !fs.existsSync(duongAnh)) return [];

  const kt = doKichThuoc(duongAnh);
  if (!kt) return [];

  let thuMuc: string | null = null;
  try {
    thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'vipro-ocr-'));
    const ra: KhungChu[] = [];

    for (const v of VUNG_VIEN) {
      const cat = path.join(thuMuc, `${v.ten}.png`);

      /**
       * Phóng 3× và tăng tương phản TRƯỚC khi đọc.
       *
       * Không tiền xử lý thì Tesseract bỏ sót hoàn toàn — đo thật: 6/10 ảnh đầu tiên
       * trả về số không, kể cả ảnh có dấu rõ ràng. Dấu thường mảnh và nhạt, mà
       * Tesseract cần nét chữ dày vài chục pixel mới nhận ra.
       */
      const ok = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', duongAnh, '-vf',
        `${v.bieuThuc},scale=iw*3:ih*3:flags=lanczos,format=gray,eq=contrast=1.5,unsharp=5:5:1.0`,
        '-frames:v', '1', cat], { encoding: 'utf8', timeout: 60_000 });
      if (ok.status !== 0 || !fs.existsSync(cat)) continue;

      // `--psm 11` = tìm chữ rải rác, không giả định có dòng hay đoạn văn.
      const r = spawnSync(bin, [cat, 'stdout', '--psm', '11', 'tsv'], {
        encoding: 'utf8',
        env: { ...process.env, TESSDATA_PREFIX: thuMucTessdata() },
        timeout: 60_000,
      });

      const rongCat = kt.w * v.w * 3;
      const caoCat = kt.h * v.h * 3;

      for (const dong of String(r.stdout ?? '').split('\n').slice(1)) {
        const c = dong.split('\t');
        if (c.length < 12) continue;
        const tin = Number(c[10]);
        const text = String(c[11] ?? '').trim();
        if (text.length < 3 || !Number.isFinite(tin) || tin < TIN_TOI_THIEU) continue;
        // Bỏ rác: phải có ít nhất ba chữ cái liền nhau.
        if (!/[A-Za-zÀ-ỹ]{3}/.test(text)) continue;

        const bx = Number(c[6]), by = Number(c[7]), bw = Number(c[8]), bh = Number(c[9]);
        if (!Number.isFinite(bx) || !Number.isFinite(bw) || bw <= 0) continue;

        // Đổi từ toạ độ trong ô đã cắt-và-phóng về tỉ lệ của ẢNH GỐC.
        ra.push({
          x: v.x + (bx / rongCat) * v.w,
          y: v.y + (by / caoCat) * v.h,
          w: (bw / rongCat) * v.w,
          h: (bh / caoCat) * v.h,
          text,
          tin,
        });
      }
    }
    return ra;
  } catch {
    return [];
  } finally {
    if (thuMuc) { try { fs.rmSync(thuMuc, { recursive: true, force: true }); } catch { /* don hong khong sao */ } }
  }
}

function doKichThuoc(f: string): { w: number; h: number } | null {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', f], { encoding: 'utf8' });
  const m = String(r.stdout ?? '').trim().split('x').map(Number);
  return m.length === 2 && m[0] > 0 ? { w: m[0], h: m[1] } : null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Lọc theo lặp vị trí
 * ──────────────────────────────────────────────────────────────────────────── */

export interface DauUngVien {
  /** Khung bao gộp của mọi lần thấy, theo tỉ lệ 0..1. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chữ đọc được rõ nhất, để hiện cho khách. */
  text: string;
  /** Số ảnh thấy dấu này. */
  soAnh: number;
  /** Chỉ số những ảnh có dấu. */
  anh: number[];
}

/**
 * Sai lệch vị trí tối đa vẫn coi là CÙNG một dấu, tính theo tỉ lệ khung.
 *
 * 6% là đủ rộng cho khác biệt khi ảnh khác tỉ lệ khung hình, và đủ hẹp để không gộp
 * nhầm hai dấu nằm ở hai góc khác nhau.
 */
export const LECH_TOI_DA = 0.06;

/** Số ảnh tối thiểu phải cùng thấy thì mới coi là dấu, không phải chữ của sản phẩm. */
export const SO_ANH_TOI_THIEU = 2;

/**
 * Gộp các khung chữ tìm được trên nhiều ảnh thành danh sách dấu ứng viên.
 *
 * Chữ chỉ xuất hiện trên MỘT ảnh thì bị loại — đó gần như chắc chắn là chữ của chính
 * sản phẩm, như "LIU GEMOLOGICAL RESEARCH" trên tờ giấy chứng nhận.
 *
 * Hàm thuần, không gọi tiến trình nào — phần nguy hiểm nhất của tính năng này được
 * kiểm bằng dữ liệu giả, không cần ảnh thật.
 */
export function gomDauLap(
  theoAnh: KhungChu[][],
  opts: { lech?: number; toiThieu?: number } = {}
): DauUngVien[] {
  const lech = opts.lech ?? LECH_TOI_DA;
  const toiThieu = opts.toiThieu ?? SO_ANH_TOI_THIEU;

  interface Nhom { khung: KhungChu[]; anh: Set<number>; }
  const nhom: Nhom[] = [];

  for (const [chiSo, ds] of theoAnh.entries()) {
    for (const k of ds ?? []) {
      const tamX = k.x + k.w / 2;
      const tamY = k.y + k.h / 2;

      const vua = nhom.find((n) => {
        const d = n.khung[0];
        return Math.abs((d.x + d.w / 2) - tamX) <= lech
            && Math.abs((d.y + d.h / 2) - tamY) <= lech;
      });

      if (vua) { vua.khung.push(k); vua.anh.add(chiSo); }
      else nhom.push({ khung: [k], anh: new Set([chiSo]) });
    }
  }

  return nhom
    .filter((n) => n.anh.size >= toiThieu)
    .map((n) => {
      // Khung bao GỘP: cắt tránh phải né được mọi lần xuất hiện, không chỉ lần đầu.
      const x = Math.min(...n.khung.map((k) => k.x));
      const y = Math.min(...n.khung.map((k) => k.y));
      const x2 = Math.max(...n.khung.map((k) => k.x + k.w));
      const y2 = Math.max(...n.khung.map((k) => k.y + k.h));
      // Chữ của lần đọc tin cậy nhất — các lần khác có thể sai chính tả.
      const roNhat = n.khung.reduce((a, b) => (b.tin > a.tin ? b : a));
      return { x, y, w: x2 - x, h: y2 - y, text: roNhat.text, soAnh: n.anh.size, anh: [...n.anh].sort((a, b) => a - b) };
    })
    .sort((a, b) => b.soAnh - a.soAnh);
}
