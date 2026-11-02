/**
 * Viprosell — Cổng kiểm kế hoạch dựng, trước khi chạm ffmpeg
 *
 * Cổng này tồn tại được là nhờ một điều nhánh ảnh không có: **một sự thật để đối chiếu**.
 * Ở nhánh ảnh, model sáng tác kịch bản từ con số không nên không có gì để so sánh ngoài
 * các mẫu chữ cấm. Ở đây có một đoạn phim thật dài đúng bao nhiêu mili giây, và một
 * transcript ghi đúng những gì khách đã nói. Mọi thứ model trả về phải quy chiếu về được.
 *
 * Nên cổng này KHÔNG gọi LLM, và cũng không nên gọi: nó là phép so sánh số học và đối
 * chiếu chuỗi, hai việc mà code làm chính xác hơn model.
 */
import {
  MIN_SPEED, MAX_SPEED, MAX_OVERLAY_WORDS, minTotalFor, maxTotalFor,
  type Segment,
  MAX_XFADE_GAP_MS,
} from './video-edit';

export type BlockReason =
  | 'out_of_range'
  | 'invented_claim'
  | 'speed'
  | 'crop'
  | 'overlay_too_long'
  | 'overlay_percent'
  | 'bad_range'
  | 'total_out_of_bounds'
  | 'no_hook'
  | 'reorder_with_music'
  | 'speed_with_music'
  | 'music_with_music'
  | 'xfade_not_adjacent';

export interface Block {
  segmentId: string;
  reason: BlockReason;
  detail: string;
}

export interface QaResult {
  pass: boolean;
  blocks: Block[];
  /** Kế hoạch đã sửa những gì sửa được. Dùng cái này, không dùng bản gốc. */
  segments: Segment[];
}

const CROP_HOP_LE = new Set(['hold', 'punch_in', 'punch_out']);

/** Bỏ dấu và ký tự đặc biệt để đối chiếu hai câu có cùng nội dung không. */
function chuanHoa(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chữ trên màn hình có neo vào thứ khách THẬT SỰ nói không.
 *
 * Đây là phần mạnh hơn hẳn bộ lọc mẫu cấm ở `qa-gate.ts`. Bộ lọc kia chặn những câu
 * sai đã biết trước ("số 1", "tốt nhất"); cái này chặn MỌI câu khách không nói, kể cả
 * câu nghe rất hợp lý mà model tự thêm vào.
 *
 * Cách kiểm: mỗi từ có nghĩa trong overlay phải xuất hiện ở đâu đó trong transcript
 * hoặc trong tên sản phẩm. Từ chức năng ngắn thì bỏ qua — chặn theo từng từ một sẽ
 * chặn oan những câu ghép lại hoàn toàn hợp lệ.
 */
export function overlayCoNeo(overlay: string, spokenClaims: string[], productName: string): boolean {
  const chu = chuanHoa(overlay);
  if (!chu) return true;

  const nguon = chuanHoa([...spokenClaims, productName].join(' '));
  if (!nguon) {
    // Khách không nói gì: chỉ cho phép câu CTA chung, không mang thông tin sản phẩm.
    const CTA_CHUNG = ['xem chi tiet', 'xem ngay', 'dat hang', 'lien he', 'nhan tin'];
    return CTA_CHUNG.some((c) => chu.includes(c));
  }

  const tu = chu.split(' ').filter((t) => t.length > 3);
  if (tu.length === 0) return true;

  return tu.every((t) => nguon.includes(t));
}

/**
 * Soát kế hoạch dựng. Thuần, không I/O.
 *
 * Nguyên tắc: sửa được thì sửa và chạy tiếp; không sửa được thì chặn. Chặn cả lần
 * render vì một dòng chữ thừa là lãng phí — nhưng cho qua một đoạn nằm ngoài clip thì
 * ffmpeg sẽ cho ra khung đen, và khách nhận video hỏng mà hệ thống báo thành công.
 */
export function qaEditPlan(opts: {
  segments: Segment[];
  clipDurationMs: number;
  spokenClaims: string[];
  productName?: string;
  totalMs?: number;
  /**
   * Clip gốc đã có nhạc lẫn trong tiếng nói (do worker đo, không do model đoán).
   *
   * Cờ này đổi hẳn cách được phép dựng. Lý do rất vật lý: nhạc nằm chung dạng sóng với
   * giọng, nên mỗi lần cắt là bài hát đứt. Đứt đúng chỗ cắt theo thứ tự thì tai còn
   * chấp nhận được; ĐẢO thứ tự thì bài hát nhảy ngược, nghe ra ngay là video lỗi.
   */
  musicBedLikely?: boolean;
}): QaResult {
  const { segments, clipDurationMs, spokenClaims, productName = '', totalMs, musicBedLikely = false } = opts;
  const blocks: Block[] = [];
  const daSua: Segment[] = [];

  for (const s of segments ?? []) {
    const id = s?.id || '?';
    const moi: Segment = { ...s };

    // ── Mốc thời gian phải nằm trong clip ──
    //
    // Đây là lỗi nặng nhất và không sửa được bằng cách đoán: ffmpeg nhận `trim` ngoài
    // phạm vi sẽ cho ra đoạn rỗng, các đoạn sau dồn lên, và video ra ngắn hơn hoặc có
    // khung đen — mà mã thoát vẫn là 0.
    const vao = Number(moi.in_ms);
    const ra = Number(moi.out_ms);

    if (!Number.isFinite(vao) || !Number.isFinite(ra) || ra <= vao) {
      blocks.push({ segmentId: id, reason: 'bad_range', detail: `in_ms=${moi.in_ms}, out_ms=${moi.out_ms}` });
      continue;
    }

    if (vao < 0 || ra > clipDurationMs) {
      blocks.push({
        segmentId: id,
        reason: 'out_of_range',
        detail: `đoạn ${vao}–${ra}ms nằm ngoài clip dài ${clipDurationMs}ms`,
      });
      continue;
    }

    // ── Tua: ép về khoảng cho phép ──
    //
    // Sửa được nên sửa, nhưng vẫn ghi nhận: model đề xuất tua 2× nghĩa là nó hiểu sai
    // việc, và lần sau có thể sai chỗ khác.
    const tua = Number(moi.speed);
    if (!Number.isFinite(tua) || tua < MIN_SPEED || tua > MAX_SPEED) {
      blocks.push({ segmentId: id, reason: 'speed', detail: `speed=${moi.speed}, đã ép về 1.0` });
      moi.speed = 1;
    }

    // ── Crop phải trong enum ──
    if (!CROP_HOP_LE.has(String(moi.crop))) {
      blocks.push({ segmentId: id, reason: 'crop', detail: `crop="${moi.crop}", đã đổi về hold` });
      moi.crop = 'hold';
    }

    // ── Chữ trên màn hình ──
    const chu = String(moi.overlay ?? '').trim();
    if (chu) {
      if (chu.includes('%')) {
        blocks.push({ segmentId: id, reason: 'overlay_percent', detail: `"${chu}"` });
        moi.overlay = chu.replace(/%/g, '').replace(/\s+/g, ' ').trim();
      }

      const soTu = String(moi.overlay).trim().split(/\s+/).filter(Boolean).length;
      if (soTu > MAX_OVERLAY_WORDS) {
        blocks.push({ segmentId: id, reason: 'overlay_too_long', detail: `${soTu} từ, đã cắt còn ${MAX_OVERLAY_WORDS}` });
        moi.overlay = String(moi.overlay).trim().split(/\s+/).slice(0, MAX_OVERLAY_WORDS).join(' ');
      }

      if (!overlayCoNeo(String(moi.overlay), spokenClaims ?? [], productName)) {
        // Bỏ chữ chứ không chặn cả video: cảnh không có chữ vẫn là cảnh dùng được,
        // còn một khẳng định khách chưa từng nói là rủi ro pháp lý thật.
        blocks.push({
          segmentId: id,
          reason: 'invented_claim',
          detail: `"${moi.overlay}" không có trong lời khách nói — đã bỏ chữ`,
        });
        moi.overlay = '';
      }
    }

    daSua.push(moi);
  }

  /* ── Clip có nhạc sẵn: code ÉP, không để model xin ngoại lệ ── */
  if (musicBedLikely && daSua.length > 0) {
    // Tua nhanh/chậm trên nền nhạc làm cao độ bài hát trôi đi. `atempo` giữ được cao
    // độ giọng nói, nhưng trên một bản phối thì tai vẫn nghe ra.
    for (const s of daSua) {
      if (Math.abs(s.speed - 1) > 0.001) {
        blocks.push({ segmentId: s.id, reason: 'speed_with_music', detail: `speed=${s.speed}, đã ép về 1.0 vì clip có nhạc` });
        s.speed = 1;
      }
    }

    // Thứ tự phải TĂNG DẦN theo clip gốc. Đây là ràng buộc nặng nhất của cờ này: nó
    // bỏ mất kỹ thuật "kéo câu mạnh nhất ở giữa clip lên làm hook". Đổi lại, bài nhạc
    // không nhảy. Hook vẫn tồn tại — chỉ là nó phải là đoạn mạnh nhất TRONG SỐ các
    // đoạn còn lại theo thứ tự thời gian, không phải mạnh nhất của cả clip.
    const daoThuTu = daSua.some((s, i) => i > 0 && s.in_ms < daSua[i - 1].in_ms);
    if (daoThuTu) {
      blocks.push({ segmentId: '-', reason: 'reorder_with_music', detail: 'clip có nhạc — đã xếp lại các đoạn theo thứ tự thời gian' });
      daSua.sort((a, b) => a.in_ms - b.in_ms);
    }
  }

  /* ── xfade chỉ hợp lệ khi hai đoạn LIỀN NHAU trên clip gốc ── */
  //
  // Hai đoạn cách nhau mà hoà vào nhau thì tiếng của hai thời điểm khác nhau chồng lên,
  // nghe như hai bản thu đè lên nhau. Chỗ đó phải cắt cứng cả hình lẫn tiếng.
  for (let i = 0; i < daSua.length - 1; i++) {
    if (daSua[i].transition_out !== 'xfade_160') continue;
    const ho = Math.abs(daSua[i + 1].in_ms - daSua[i].out_ms);
    if (ho > MAX_XFADE_GAP_MS) {
      blocks.push({
        segmentId: daSua[i].id,
        reason: 'xfade_not_adjacent',
        detail: `hai đoạn cách nhau ${Math.round(ho)}ms trên clip gốc — đã ép về cut`,
      });
      daSua[i].transition_out = 'cut';
    }
  }
  // Đoạn cuối không có gì để hoà vào.
  if (daSua.length > 0) daSua[daSua.length - 1].transition_out = 'cut';

  // ── Phải có hook, và hook phải đứng đầu ──
  if (!musicBedLikely && daSua.length > 0 && daSua[0].role !== 'hook') {
    const i = daSua.findIndex((s) => s.role === 'hook');
    if (i > 0) {
      // Đưa lên đầu thay vì chặn: model chọn đúng đoạn hook nhưng xếp sai chỗ là lỗi
      // sắp xếp, không phải lỗi nội dung.
      daSua.unshift(daSua.splice(i, 1)[0]);
    } else {
      blocks.push({ segmentId: '-', reason: 'no_hook', detail: 'không có đoạn nào đóng vai hook' });
    }
  }

  // ── Tổng thời lượng ──
  //
  // Tính lại từ các đoạn chứ không tin `total_ms` model khai: hai số lệch nhau nghĩa
  // là model cộng sai, và nếu nó cộng sai ở đây thì rất có thể nó cũng chọn mốc theo
  // một phép tính sai khác. Con số dùng để render luôn là con số tính lại.
  const tong = daSua.reduce((n, s) => n + (s.out_ms - s.in_ms) / (s.speed || 1), 0);

  // Ngưỡng theo CLIP THẬT, không phải hằng số cứng: không đòi được 15 giây thành phẩm
  // từ một clip 8 giây nếu không lặp lại hình.
  const nguongDuoi = minTotalFor(clipDurationMs);
  const nguongTren = maxTotalFor(clipDurationMs);

  if (daSua.length > 0 && (tong < nguongDuoi || tong > nguongTren)) {
    blocks.push({
      segmentId: '-',
      reason: 'total_out_of_bounds',
      detail: `thành phẩm ${Math.round(tong)}ms, ngoài khoảng ${nguongDuoi}–${nguongTren}ms (clip nguồn ${clipDurationMs}ms)`,
    });
  }

  // Lệch quá 1 giây là model tự khai sai, đáng ghi lại dù không ảnh hưởng bản render.
  if (Number.isFinite(totalMs) && Math.abs(Number(totalMs) - tong) > 1000) {
    blocks.push({
      segmentId: '-',
      reason: 'total_out_of_bounds',
      detail: `model khai total_ms=${totalMs} nhưng các đoạn cộng lại là ${Math.round(tong)}ms`,
    });
  }

  // `pass` chỉ nói "có render được không", không phải "có hoàn hảo không".
  //
  // Các lỗi đã sửa được (tua, crop, chữ) không làm hỏng video, nên vẫn cho chạy — và
  // vẫn ghi vào blocks để đọc log biết model đang sai ở đâu. Chỉ những lỗi không còn
  // đoạn nào dùng được mới thật sự chặn.
  const chanThat = blocks.some((b) => b.reason === 'out_of_range' || b.reason === 'bad_range');
  const pass = daSua.length > 0 && !(chanThat && daSua.length < 3);

  return { pass, blocks, segments: daSua };
}

/** Một dòng log cho mỗi phát hiện. */
export function formatBlocks(blocks: Block[]): string[] {
  return blocks.map((b) => `[VideoQA] ${b.segmentId}.${b.reason}: ${b.detail}`);
}
