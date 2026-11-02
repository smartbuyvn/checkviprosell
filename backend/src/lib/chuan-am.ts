/**
 * Viprosell — Chuẩn âm lượng bằng gain CỐ ĐỊNH
 *
 * ── Vì sao bỏ `loudnorm` một lượt ──
 *
 * `loudnorm` gọi một lượt, không truyền giá trị đo trước, thì chạy ở chế độ **động**:
 * nó liên tục rà lại gain theo thời gian. Đo thật trên render `5a7419c9` ngày 30/10:
 *
 *     "input_lra" : "1.10"
 *     "normalization_type" : "dynamic"
 *
 * LRA 1,10 nghĩa là toàn bộ dải động bị ép thành một đường gần như thẳng. Nội dung
 * lời nói kèm nhạc bình thường có LRA 5–15.
 *
 * Hậu quả nghe được: giữa hai câu nói, bộ chuẩn hoá kéo gain lên hết cỡ, nhạc nền và
 * tiếng nền của TTS dâng lên thành tiếng **hú**, rồi thụt xuống khi câu sau bắt đầu.
 * Chế độ động đúng cho sóng phát trực tiếp, sai cho một video 20 giây đã dựng xong.
 *
 * ── Vì sao không dùng hai lượt ──
 *
 * `loudnorm` hai lượt (đo trước, áp sau với `linear=true`) cho gain cố định và đúng
 * chuẩn. Nhưng nó đòi thêm một lần chạy ffmpeg trên TOÀN BỘ dải tiếng đã trộn, mà
 * mình vốn đã biết rõ từng thành phần — nên đo từng mẩu rồi tính gain là vừa rẻ hơn
 * vừa đoán trước được.
 *
 * ── Số đo thật ngày 30/10 ──
 *
 * Giọng đọc FPT, ba câu khác nhau:
 *
 *     -17,0 LUFS   -20,2 LUFS   -17,4 LUFS      → chênh nhau 3,2 dB
 *
 * Chênh 3,2 dB giữa các câu là lý do phải chuẩn TỪNG MẨU chứ không chuẩn cả dải: để
 * nguyên thì câu nọ to hơn câu kia nghe rõ, mà chuẩn cả dải thì lại quay về chế độ
 * động đang gây hú.
 *
 * Nhạc nền trong thư viện:
 *
 *     upbeat_01   -3,8 LUFS, đỉnh **+1,2 dB**   ← đã vỡ sẵn trong file gốc
 *     chill_01   -10,0 LUFS, đỉnh  +0,4 dB      ← cũng vỡ
 *     urgent_01  -15,4 LUFS, đỉnh  -2,9 dB
 *
 * Hai file đầu vượt 0 dBFS ngay trong bản gốc. Hạ theo tỉ lệ `music_volume` thì phần
 * vỡ cũng nhỏ đi theo, nhưng `alimiter` ở cuối là chốt chặn cuối cùng.
 */

import { spawnSync } from 'node:child_process';

/** Mức đích cho mỗi mẩu giọng đọc, tính bằng LUFS. */
export const MUC_GIONG = -16;

/**
 * Trần đỉnh thật của bản xuất, tính bằng dBFS.
 *
 * -1,5 dB là khoảng an toàn tiêu chuẩn: mã hoá AAC có thể đẩy đỉnh lên vài phần mười
 * dB so với dạng sóng gốc, nên để sát 0 là nghe rè sau khi nén.
 */
export const TRAN_DINH_DB = -1.5;

/** Gain tối đa được phép cộng, tính bằng dB. */
export const GAIN_TOI_DA_DB = 12;

export interface MucDo {
  /** Độ to tích hợp (LUFS). */
  i: number;
  /** Đỉnh thật (dBFS). */
  tp: number;
  /** Dải động (LU). */
  lra: number;
}

/**
 * Đo độ to của một file bằng chính bộ phân tích của `loudnorm`.
 *
 * Trả `null` khi không đo được — bên gọi phải chạy tiếp với gain 0 chứ không được
 * bỏ cả lần dựng vì một phép đo hỏng.
 */
export function doMucFile(duongDan: string): MucDo | null {
  try {
    const r = spawnSync('ffmpeg', [
      '-v', 'info', '-hide_banner', '-i', duongDan,
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
      '-f', 'null', '-',
    ], { encoding: 'utf8', timeout: 30_000 });

    const khoi = String(r.stderr ?? '').match(/\{[\s\S]*?\}/);
    if (!khoi) return null;
    const o = JSON.parse(khoi[0]);
    const i = Number(o.input_i);
    if (!Number.isFinite(i)) return null;
    return { i, tp: Number(o.input_tp), lra: Number(o.input_lra) };
  } catch {
    return null;
  }
}

/**
 * Gain cố định cần cộng để một mẩu đạt mức đích.
 *
 * Kẹp ở `GAIN_TOI_DA_DB`: một mẩu gần như im lặng (đo ra -70 LUFS vì TTS trả file
 * rỗng) mà cộng 54 dB thì chỉ khuếch đại tiếng nền thành tiếng rít.
 */
export function gainToiMuc(doTo: number | null | undefined, muc: number = MUC_GIONG): number {
  const i = Number(doTo);
  if (!Number.isFinite(i)) return 0;
  const g = muc - i;
  return Math.max(-GAIN_TOI_DA_DB, Math.min(GAIN_TOI_DA_DB, Math.round(g * 10) / 10));
}

/**
 * Khâu cuối của dải tiếng: chặn đỉnh, KHÔNG rà gain theo thời gian.
 *
 * `alimiter` chỉ can thiệp khi dạng sóng thật sự chạm trần, nên những đoạn yên lặng
 * giữa các câu được giữ nguyên là yên lặng — đó chính là chỗ `loudnorm` động đã bơm
 * lên thành tiếng hú.
 *
 * `level=disabled` rất quan trọng: bật lên thì `alimiter` tự chuẩn hoá mức ra và ta
 * lại có một bộ rà gain thứ hai, đúng thứ vừa gỡ bỏ.
 */
export function chuoiChanDinh(tranDb: number = TRAN_DINH_DB): string {
  const tran = Math.pow(10, tranDb / 20);
  return `alimiter=limit=${tran.toFixed(4)}:attack=5:release=50:level=disabled`;
}

/** Khâu `volume` cho một gain dB; trả chuỗi rỗng khi gain không đáng kể. */
export function chuoiGain(gainDb: number): string {
  const g = Number(gainDb);
  if (!Number.isFinite(g) || Math.abs(g) < 0.1) return '';
  return `volume=${g.toFixed(1)}dB`;
}
