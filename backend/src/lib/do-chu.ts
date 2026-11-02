/**
 * Viprosell — Đo số dòng phụ đề THẬT, bằng chính libass
 *
 * ── Vì sao không ước bằng số liệu font ──
 *
 * Bản trước ước số dòng từ bề ngang trung bình một ký tự (đo được 0,420 lần cỡ chữ).
 * Cách đó hỏng đúng ở chỗ thường gặp nhất — ranh giới.
 *
 * Đo thật ngày 30/10: câu "của bạn, không cần thay đổi cách vận hành." dài 42 ký tự,
 * khung 1080 với lề 13% mỗi bên còn 800px dùng được. Lấy hệ số an toàn 0,44 thì ra
 * 40 ký tự mỗi dòng → ước 2 dòng. libass dựng ra **1 dòng**.
 *
 * Hậu quả: chừa thừa một dòng, và dòng thừa đó hiện ra thành khoảng trống 56px giữa
 * tiêu đề và phụ đề — đúng thứ người bán kêu suốt ba lượt sửa.
 *
 * Hạ hệ số xuống 0,420 thì câu này đúng, nhưng câu khác cùng 42 ký tự mà nhiều chữ
 * rộng ('m', 'ư', 'ô') lại tràn hai dòng, và lần này ước THIẾU — phụ đề neo mép dưới
 * nên nó mọc lên đè vào tiêu đề. Sai kiểu đó tệ hơn hẳn.
 *
 * ── Cách làm ở đây ──
 *
 * Hỏi thẳng libass. Dựng một khung đen đúng khổ thật, đốt câu dài nhất lên, rồi lấy
 * khung bao bằng `cropdetect`. Chiều cao khung bao chia cho chiều cao một dòng ra số
 * dòng — không phải phỏng đoán nào cả.
 *
 * Một lần gọi ffmpeg không ghi file (`-f null -`), đo được trong khoảng 0,3 giây, so
 * với 60 giây của cả lần dựng.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildAssFile, escapeFilterPath, type AssCue } from './ass-subtitle';

/**
 * Chiều cao NÉT CHỮ của một dòng, theo cỡ chữ.
 *
 * Không phải 1,25 — đó là chiều cao HỘP dòng, gồm cả khoảng trống trên dưới mà
 * `cropdetect` không nhìn thấy. Nó chỉ thấy pixel sáng.
 *
 * Đo thật ngày 30/10, Montserrat cỡ 45 trên khung 1080 lề 140:
 *
 *      28 ký tự → nét cao 30px        1 dòng
 *      42 ký tự → nét cao 32px        1 dòng
 *      80 ký tự → nét cao 78px        2 dòng
 *
 * Một dòng ra 30–32px, tức ≈ 0,70 lần cỡ chữ. Hai dòng ra 78px, nên bước giữa hai
 * dòng là 78 − 31 = 47px ≈ 1,05 lần cỡ chữ.
 */
const CAO_NET_MOT_DONG = 0.70;

/** Bước giữa hai dòng liên tiếp, theo cỡ chữ. Xem phép đo ở trên. */
const BUOC_DONG = 1.05;

export interface ThamSoDo {
  width: number;
  height: number;
  fontName: string;
  subFontSize: number;
  marginH: number;
}

/**
 * Số dòng câu phụ đề dài nhất sẽ chiếm, đo bằng libass.
 *
 * Trả `null` khi không đo được — người gọi phải lùi về cách chừa an toàn (hai dòng)
 * chứ không được coi như một dòng: thiếu chỗ thì chữ đè nhau, thừa chỗ chỉ là một
 * khoảng trống.
 */
export function doSoDongPhuDe(cauDaiNhat: string, ts: ThamSoDo): number | null {
  const chu = String(cauDaiNhat ?? '').trim();
  if (!chu) return 1;

  let thuMuc: string | null = null;
  try {
    thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'vipro-dochu-'));
    const duongAss = path.join(thuMuc, 'do.ass');

    // Lề dưới đặt giữa khung: cropdetect chỉ cần khung bao, không cần đúng vị trí
    // cuối cùng. Đặt sát mép thì chữ có thể bị cắt và đo ra thiếu dòng.
    const cue: AssCue = { startSec: 0, endSec: 5, text: chu, style: 'Sub' };
    fs.writeFileSync(duongAss, buildAssFile([cue], {
      width: ts.width,
      height: ts.height,
      fontName: ts.fontName,
      overlayFontSize: ts.subFontSize,
      subFontSize: ts.subFontSize,
      overlayMarginV: Math.round(ts.height / 2),
      subMarginV: Math.round(ts.height / 2),
      marginH: ts.marginH,
    }), 'utf8');

    /**
     * Phải MÃ HOÁ ra file trước rồi mới đo, không chạy `cropdetect` thẳng trên nguồn
     * `lavfi`.
     *
     * Chạy thẳng thì cropdetect trả khung bao hỏng — đo thật ngày 30/10:
     *
     *     x1:1079 x2:0 ... crop=-1078:24:1080:508
     *
     * Bề ngang ÂM, và chiều cao 24px trong khi chữ cao 56px. Khuôn mẫu đòi chữ số nên
     * không khớp, hàm trả null, và cả phép đo im lặng rơi về đường lui.
     */
    const duongVideo = path.join(thuMuc, 'do.mp4');
    const ma = spawnSync('ffmpeg', [
      '-y', '-v', 'error', '-hide_banner',
      '-f', 'lavfi', '-i', `color=c=black:s=${Math.round(ts.width)}x${Math.round(ts.height)}:r=10`,
      // Bỏ qua khung đầu: chữ có `\fad` nên khung ở giây 0 hoàn toàn trong suốt.
      '-ss', '1', '-t', '0.5',
      '-vf', `subtitles='${escapeFilterPath(duongAss)}'`,
      '-c:v', 'libx264', '-preset', 'ultrafast', duongVideo,
    ], { encoding: 'utf8', timeout: 30_000 });
    if (ma.status !== 0 || !fs.existsSync(duongVideo)) return null;

    const r = spawnSync('ffmpeg', [
      '-v', 'info', '-hide_banner', '-i', duongVideo,
      // limit thấp hơn để bắt cả mép chữ đã làm mịn, không chỉ lõi chữ.
      '-vf', 'cropdetect=limit=16:round=2:reset=0',
      '-f', 'null', '-',
    ], { encoding: 'utf8', timeout: 30_000 });

    const dong = String(r.stderr ?? '').split('\n').filter((l) => l.includes('crop=')).pop();
    const m = dong?.match(/crop=(-?\d+):(-?\d+):/);
    if (!m) return null;

    const cao = Number(m[2]);
    if (!Number.isFinite(cao) || cao <= 0) return null;

    // Dòng đầu chiếm `CAO_NET_MOT_DONG`, mỗi dòng sau cộng thêm `BUOC_DONG`.
    //
    // Làm tròn thường chứ không làm tròn lên: dấu tiếng Việt (dấu mũ, dấu nặng) đội
    // chiều cao nét lên vài pixel tuỳ câu, nên một dòng có thể đo ra 30 hoặc 32px.
    // Làm tròn thường cho dải dung sai rộng về cả hai phía.
    const duDay = (cao - ts.subFontSize * CAO_NET_MOT_DONG) / (ts.subFontSize * BUOC_DONG);
    return Math.max(1, Math.min(3, Math.round(duDay) + 1));
  } catch {
    return null;
  } finally {
    if (thuMuc) { try { fs.rmSync(thuMuc, { recursive: true, force: true }); } catch { /* dọn hỏng không sao */ } }
  }
}

/**
 * Đo số dòng cho NHIỀU câu một lượt, có nhớ đệm theo nội dung.
 *
 * Một video thường có 5–8 câu phụ đề khác nhau, mỗi phép đo khoảng 0,2 giây — tổng
 * hơn một giây, so với 60 giây của cả lần dựng. Câu trùng nhau chỉ đo một lần.
 *
 * Câu nào đo hỏng thì vắng mặt trong bảng trả về; người gọi phải tự lùi về cách chừa
 * an toàn cho riêng câu đó.
 */
export function doSoDongNhieu(cacCau: string[], ts: ThamSoDo): Map<string, number> {
  const ra = new Map<string, number>();

  /**
   * Chỉ đo những câu NẰM GẦN RANH GIỚI ngắt dòng.
   *
   * Mỗi phép đo là hai tiến trình ffmpeg. Đo cả bảy câu của một video là mười bốn
   * tiến trình, và ffmpeg trên Windows đổ `3221225477` (truy cập bộ nhớ sai) khi
   * nhiều tiến trình chạy chồng nhau — gặp đúng một lần ngày 30/10 trong lúc thử.
   *
   * Câu dài 20 ký tự trên dòng chứa được 42 thì chắc chắn một dòng; câu 80 ký tự thì
   * chắc chắn hai. Chỉ khoảng ±18% quanh bội số của sức chứa mỗi dòng mới cần hỏi
   * libass — đúng chỗ phép ước sai, và là thiểu số.
   */
  const sucChuaMoiDong = Math.max(8, ts.marginH >= 0
    ? Math.floor((ts.width - ts.marginH * 2) / (ts.subFontSize * 0.42))
    : 40);

  for (const c of cacCau) {
    const chu = String(c ?? '').trim();
    if (!chu || ra.has(chu)) continue;

    const tiLe = chu.length / sucChuaMoiDong;
    const khoangCachToiMoc = Math.abs(tiLe - Math.round(tiLe));
    if (khoangCachToiMoc > 0.18) continue; // xa ranh giới — để người gọi tự ước

    const n = doSoDongPhuDe(chu, ts);
    if (n !== null) ra.set(chu, n);
  }
  return ra;
}
