/**
 * Viprosell — Soát video đen sau khi dựng xong
 *
 * ── Vì sao cần ──
 *
 * Ngày 28/10/2026 khách báo: *"Video thất bại, video hoàn thành thì trống đen"*.
 * Nguyên nhân hôm đó là hai worker cùng ghi một file đầu ra. Đã sửa bằng khoá PID,
 * nhưng cái đáng sợ hơn là **không gì phát hiện ra**: ffmpeg trả mã 0, file có dung
 * lượng, trạng thái ghi `completed`, credit bị trừ, và khách là người đầu tiên biết
 * video hỏng.
 *
 * Mọi cổng kiểm hiện có đều soát *kế hoạch* — chuỗi filter, đồ thị cảnh, lời thoại.
 * Không cái nào mở **file đã dựng** ra xem. Đây là cái đầu tiên làm việc đó.
 *
 * Ý tưởng lấy từ TECHNIQUE.md của `lemomo-ai/lemo-opuscar` (MIT): kiểm file cuối
 * bằng `blackdetect` trước khi coi là xong.
 *
 * ── Chỗ khó: video này CỐ Ý có đoạn đen ──
 *
 * Nó mở bằng `fade=t=in` 0,4 giây và đóng bằng `fade=t=out` 0,4 giây. Soát ngây thơ
 * sẽ báo đỏ ở mọi video đúng. Nên phải bỏ qua đoạn đen ở hai đầu và chỉ xét phần
 * giữa.
 */

/** Một quãng đen ffmpeg tìm thấy. */
export interface QuangDen {
  batDau: number;
  ketThuc: number;
}

/** Bỏ qua đoạn đen nằm trong khoảng này ở hai đầu — đó là fade cố ý. */
export const BO_QUA_HAI_DAU = 0.7;

/** Quãng đen giữa video dài hơn mức này là hỏng, dù tổng chưa nhiều. */
export const QUANG_DEN_TOI_DA = 2.0;

/** Tổng thời lượng đen ở giữa vượt tỉ lệ này so với cả video là hỏng. */
export const TI_LE_DEN_TOI_DA = 0.25;

/**
 * Đọc các quãng đen từ đầu ra stderr của ffmpeg.
 *
 * Dòng ffmpeg in ra có dạng:
 *   [blackdetect @ 0x...] black_start:0 black_end:0.4 black_duration:0.4
 */
export function docQuangDen(stderr: string): QuangDen[] {
  const ra: QuangDen[] = [];
  const re = /black_start:([0-9.]+)\s+black_end:([0-9.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(stderr ?? ''))) !== null) {
    const batDau = Number(m[1]);
    const ketThuc = Number(m[2]);
    if (Number.isFinite(batDau) && Number.isFinite(ketThuc) && ketThuc > batDau) {
      ra.push({ batDau, ketThuc });
    }
  }
  return ra;
}

export interface KetQuaSoat {
  /** Video dùng được không. */
  dat: boolean;
  /** Tổng thời lượng đen ở GIỮA video, sau khi bỏ hai đầu. */
  denOGiua: number;
  /** Quãng đen giữa dài nhất. */
  quangDaiNhat: number;
  /** Lý do trượt, để ghi vào `error_message` cho khách đọc. */
  lyDo: string | null;
}

/**
 * Chấm một video dựa trên các quãng đen và tổng thời lượng.
 *
 * Hàm thuần để test được mà không cần dựng video thật.
 *
 * Thiếu thời lượng (`<= 0`) thì coi như ĐẠT: không biết video dài bao nhiêu thì
 * không kết luận được, và chặn vì thiếu dữ liệu là biến một phép kiểm phụ thành
 * một nguồn hỏng mới.
 */
export function chamVideo(quang: QuangDen[], tongThoiLuong: number): KetQuaSoat {
  if (!(tongThoiLuong > 0)) {
    return { dat: true, denOGiua: 0, quangDaiNhat: 0, lyDo: null };
  }

  const cuoiVideo = tongThoiLuong - BO_QUA_HAI_DAU;
  let denOGiua = 0;
  let quangDaiNhat = 0;

  for (const q of quang ?? []) {
    // Cắt phần nằm trong vùng bỏ qua ở hai đầu, giữ phần còn lại ở giữa.
    const batDau = Math.max(q.batDau, BO_QUA_HAI_DAU);
    const ketThuc = Math.min(q.ketThuc, cuoiVideo);
    const dai = ketThuc - batDau;
    if (dai > 0) {
      denOGiua += dai;
      quangDaiNhat = Math.max(quangDaiNhat, dai);
    }
  }

  const tiLe = denOGiua / tongThoiLuong;

  if (quangDaiNhat > QUANG_DEN_TOI_DA) {
    return {
      dat: false,
      denOGiua,
      quangDaiNhat,
      lyDo: `Video có ${quangDaiNhat.toFixed(1)} giây màn hình đen liên tục ở giữa`,
    };
  }

  if (tiLe > TI_LE_DEN_TOI_DA) {
    return {
      dat: false,
      denOGiua,
      quangDaiNhat,
      lyDo: `Video đen ${Math.round(tiLe * 100)}% thời lượng`,
    };
  }

  return { dat: true, denOGiua, quangDaiNhat, lyDo: null };
}
