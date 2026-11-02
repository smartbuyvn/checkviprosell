/**
 * Viprosell — Khớp độ dài cảnh với độ dài lời đọc
 *
 * ── Lỗi thật, đo ngày 30/10/2026 trên video đã giao khách ──
 *
 * Worker tổng hợp giọng cho từng cảnh rồi đẩy tới mốc cảnh bằng `adelay` và trộn
 * bằng `amix`. **Không gì kiểm tra câu có dài hơn cảnh không.** Đo trên render
 * `ea39bbcb`:
 *
 *   cảnh 0:  cảnh 2,00s — tiếng 2,93s   tràn +0,93s
 *   cảnh 1:  cảnh 3,50s — tiếng 3,69s   tràn +0,19s
 *   cảnh 2:  cảnh 3,00s — tiếng 4,32s   tràn +1,32s
 *   cảnh 5:  cảnh 3,50s — tiếng 5,23s   tràn +1,73s
 *
 * Tổng **4,17 giây chồng tiếng** trên một video 20 giây: hơn một phần năm thời lượng
 * có hai giọng nói đè lên nhau. Và cảnh cuối tràn 1,73 giây nghĩa là câu kết bị cắt
 * ngang — video "hết" trước khi người đọc nói xong.
 *
 * ── Cách giải ──
 *
 * Kéo dài cảnh cho vừa câu nói, chứ không cắt câu nói cho vừa cảnh. Cắt giữa từ thì
 * nghe như hỏng; kéo dài cảnh thì chỉ là ảnh đứng lâu hơn một chút, và người xem
 * không nhận ra.
 *
 * Không tăng tốc độ đọc: ép 5,23 giây vào 3,50 giây cần 1,5× — nghe hớt hải, và một
 * quảng cáo nói vội thì mất tin.
 *
 * ── Về giá ──
 *
 * Kéo dài làm video dài hơn kế hoạch, nhưng KHÔNG làm đổi số credit: `specFromRequest`
 * tính tiền theo thời lượng KHÁCH ĐẶT, không theo thời lượng ra. Đó chính là lý do
 * cách tính đó đúng.
 */

export interface MucCanh {
  start_sec?: number;
  end_sec?: number;
  [k: string]: unknown;
}

/**
 * Khoảng lặng chèn sau mỗi câu, tính bằng giây.
 *
 * 0,25: đủ để tai nhận ra câu đã dứt trước khi câu sau bắt đầu. Bằng 0 thì hai câu
 * dính nhau nghe như một câu dài lê thê; lớn hơn 0,4 thì video có cảm giác rời rạc.
 */
export const KHOANG_LANG = 0.25;

export interface KetQuaKhop {
  /** Timeline đã chỉnh, mốc thời gian liên tục từ 0. */
  timeline: MucCanh[];
  /** Tổng số giây đã kéo dài thêm. 0 nghĩa là không phải sửa gì. */
  keoThem: number;
  /** Mô tả từng cảnh bị kéo, để ghi log. */
  chiTiet: string[];
}

/**
 * Kéo dài những cảnh ngắn hơn lời đọc của chính nó, rồi dồn lại mốc thời gian.
 *
 * `thoiLuongTieng[i]` là độ dài file giọng của cảnh `i`, hoặc 0/null khi cảnh đó
 * không có tiếng.
 *
 * Luôn trả về timeline có mốc LIÊN TỤC bắt đầu từ 0 — `adelay` ở worker cộng dồn độ
 * dài từng cảnh để tính mốc, nên một khoảng hở trong timeline là tiếng lệch khỏi
 * hình.
 */
export function khopCanhVoiTieng(
  timeline: MucCanh[] | null | undefined,
  thoiLuongTieng: Array<number | null | undefined>,
  khoangLang: number = KHOANG_LANG
): KetQuaKhop {
  const tl = Array.isArray(timeline) ? timeline : [];
  if (tl.length === 0) return { timeline: [], keoThem: 0, chiTiet: [] };

  const chiTiet: string[] = [];
  let keoThem = 0;
  let moc = 0;
  const ra: MucCanh[] = [];

  for (let i = 0; i < tl.length; i++) {
    const c = tl[i];
    const goc = Number(c?.end_sec) - Number(c?.start_sec);
    const daiGoc = Number.isFinite(goc) && goc > 0 ? goc : 0.5;

    const tieng = Number(thoiLuongTieng?.[i]);
    // Cộng khoảng lặng vào yêu cầu: câu dứt rồi mới sang cảnh sau.
    const can = Number.isFinite(tieng) && tieng > 0 ? tieng + khoangLang : 0;

    const daiMoi = Math.max(daiGoc, can);
    if (daiMoi > daiGoc + 1e-6) {
      keoThem += daiMoi - daiGoc;
      chiTiet.push(
        `canh ${i}: ${daiGoc.toFixed(2)}s -> ${daiMoi.toFixed(2)}s (tieng ${tieng.toFixed(2)}s)`
      );
    }

    ra.push({ ...c, start_sec: round2(moc), end_sec: round2(moc + daiMoi) });
    moc += daiMoi;
  }

  return { timeline: ra, keoThem: round2(keoThem), chiTiet };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Số ký tự tối đa một cảnh nên chứa, để lời đọc vừa đúng thời lượng.
 *
 * Dùng công thức tốc độ tiếng Việt đo được ngày 29/10: `giây = ký_tự / 28,3 + 0,93`.
 * Giải ngược ra: `ký_tự = (giây - 0,93) × 28,3`.
 *
 * Đây là thứ tầng 3 cần biết khi viết lời thoại — nó đang viết những câu 88 ký tự cho
 * ô 3 giây, trong khi 3 giây chỉ chứa được khoảng 58 ký tự.
 */
export function kyTuToiDa(giay: number, khoangLang: number = KHOANG_LANG): number {
  const coDe = giay - khoangLang - 0.93;
  if (!(coDe > 0)) return 0;
  return Math.floor(coDe * 28.3);
}

/**
 * Hệ số tăng nhịp đọc tối đa vẫn còn nghe tự nhiên.
 *
 * `atempo` tới 1,15 trên tiếng nói thì tai thường không nhận ra; từ 1,25 trở lên bắt
 * đầu nghe gấp gáp, và với giọng bán hàng thì gấp gáp đọc ra là thiếu tin cậy.
 *
 * Dùng nó như bước ĐẦU TIÊN để cứu một câu hơi dài: tăng nhịp giữ được trọn chữ, còn
 * cắt chữ thì mất nghĩa.
 */
export const TEMPO_TOI_DA = 1.15;

/**
 * Cắt một lời thoại cho vừa thời lượng cảnh, cắt ở RANH GIỚI TỪ.
 *
 * ── Vì sao cần ──
 *
 * Tầng 3 viết dài hơn sức chứa. Đo trên render `57c684ca` ngày 31/10: tám trên mười
 * câu vượt ngân sách 20–40%, nên mọi cảnh đều bị kéo ra và một video đặt 30 giây xuất
 * xưởng ở **35,1 giây**.
 *
 * Các nền tảng xếp video theo mốc thời lượng, nên "đặt 30 thì phải ra 30".
 *
 * ── Thứ tự ưu tiên ──
 *
 * 1. Vừa sẵn thì giữ nguyên.
 * 2. Hơi dài thì tăng nhịp đọc tới `TEMPO_TOI_DA` — giữ trọn chữ.
 * 3. Vẫn dài thì mới cắt, và cắt ở ranh giới từ chứ không giữa chữ.
 *
 * Ưu tiên cắt ở dấu câu gần cuối: một câu bị cụt giữa mệnh đề nghe hụt hơn hẳn một
 * câu ngắn nhưng trọn ý.
 */
export function catLoiChoVua(
  loi: string,
  giayCanh: number,
  tempoToiDa: number = TEMPO_TOI_DA
): string {
  const chu = String(loi ?? '').trim();
  if (!chu) return '';

  const tran = kyTuToiDa(giayCanh) * Math.max(1, tempoToiDa);
  if (chu.length <= tran) return chu;

  const cat = chu.slice(0, Math.floor(tran));

  // Dấu câu gần cuối — cắt ở đó thì câu vẫn trọn ý.
  const dauCau = Math.max(cat.lastIndexOf('. '), cat.lastIndexOf(', '), cat.lastIndexOf('! '), cat.lastIndexOf('? '));
  if (dauCau > tran * 0.55) return cat.slice(0, dauCau + 1).trim();

  const khoangTrang = cat.lastIndexOf(' ');
  const ra = khoangTrang > tran * 0.5 ? cat.slice(0, khoangTrang) : cat;
  return ra.trim().replace(/[,;:]$/, '') + '.';
}

/**
 * Hệ số `atempo` cần dùng để một đoạn tiếng vừa đúng thời lượng cảnh.
 *
 * Trả 1 khi đã vừa hoặc khi không đo được — không bao giờ làm CHẬM lại, vì kéo dãn
 * tiếng nói nghe còn lộ hơn nén.
 */
export function tempoChoVua(
  giayTieng: number | null | undefined,
  giayCanh: number,
  tempoToiDa: number = TEMPO_TOI_DA
): number {
  const t = Number(giayTieng);
  const choPhep = Math.max(0.1, giayCanh - KHOANG_LANG);
  if (!Number.isFinite(t) || t <= 0 || t <= choPhep) return 1;

  // Làm tròn LÊN, không làm tròn thường.
  //
  // Hệ số tròn xuống cho ra đoạn tiếng dài hơn chỗ trống vài phần trăm giây, và thế
  // là cảnh vẫn bị kéo — đúng thứ bước này sinh ra để tránh. Đo được 0,01 giây dư
  // trên một video 10 cảnh; nhỏ, nhưng đủ để lệch mốc thời lượng.
  return Math.min(tempoToiDa, Math.ceil((t / choPhep) * 1000) / 1000);
}
