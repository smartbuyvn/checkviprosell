/**
 * Viprosell — Cổng kiểm trước khi render
 *
 * Bản thiết kế gợi ý đặt đây một lần gọi LLM thứ năm để tự soát lại kịch bản. Tôi
 * không làm vậy, vì ba lý do:
 *
 *   1. Mỗi lần gọi là thêm ~25% chi phí token mỗi video, cho một việc mà biểu thức
 *      chính quy làm được chính xác hơn.
 *   2. Một model soát chính nó thì bỏ sót đúng những thứ nó vừa viết ra.
 *   3. Thêm một lần gọi là thêm một chỗ hỏng: timeout, JSON sai, 503. Cổng kiểm phải
 *      chạy được MỌI LẦN, không thì nó vô dụng.
 *
 * Cổng này chạy sau tầng 3, trước khi dựng kế hoạch render. Nó không chấm điểm hay
 * nhận xét — chỉ bắt những lỗi đã thật sự lọt ra video khách nhận.
 */
import type { Tier3SceneGraph } from '../prompts/tiers/tier3-scene-graph';

export type Severity = 'block' | 'fix' | 'warn';

export interface Finding {
  sceneId: string;
  field: 'overlay_text' | 'voice_line' | 'timing' | 'camera';
  severity: Severity;
  /** Lý do, viết cho người đọc log lúc 2 giờ sáng. */
  reason: string;
  /** Đoạn chữ gây lỗi, để tìm lại được trong kịch bản. */
  excerpt?: string;
}

/**
 * Những khẳng định không được nói ra, dù model có viết hay đến đâu.
 *
 * Đây là rủi ro pháp lý, không phải vấn đề thẩm mỹ: Viprosell bán cho người mua
 * thật bằng tiền thật, và quảng cáo nói sai thì người bán chịu, không phải chúng ta.
 *
 * Mẫu viết cho tiếng Việt CÓ VÀ KHÔNG DẤU: model đôi khi trả về không dấu, và
 * `tốt nhất` với `tot nhat` phải cùng bị bắt.
 */
const MAU_CAM: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(s[ốo]\s*1|s[ốo]\s*m[ộo]t|number\s*one)\b/i,
    reason: 'khẳng định xếp hạng — không ai kiểm chứng được "số 1"',
  },
  {
    re: /\b(t[ốo]t\s*nh[ấa]t|[đd][ẹe]p\s*nh[ấa]t|r[ẻe]\s*nh[ấa]t|h[àa]ng\s*[đd][ầa]u|best\s+in)\b/i,
    reason: 'khẳng định xếp hạng tuyệt đối',
  },
  {
    re: /\b(duy\s*nh[ấa]t\s+(tr[êe]n|t[ạa]i)|[đd][ộo]c\s*quy[ềe]n\s+duy\s*nh[ấa]t)\b/i,
    reason: 'khẳng định độc quyền thị trường',
  },
  {
    re: /\b(gi[ảa]m\s*\d+\s*(kg|c[mạa]|k[íi]l[ôo])|h[ếe]t\s+\w+\s+(sau|trong)\s*\d+\s*(ng[àa]y|tu[ầa]n))\b/i,
    reason: 'hứa kết quả cụ thể — đây là khẳng định y tế/hiệu quả',
  },
  {
    re: /\b(ch[ữu]a\s+(kh[ỏo]i|tr[ịi])|[đd]i[ềe]u\s*tr[ịi]\s+(d[ứu]t|t[ậa]n\s*g[ốo]c)|kh[ỏo]ng\s*t[áa]c\s*d[ụu]ng\s*ph[ụu])\b/i,
    reason: 'khẳng định y tế — cần giấy phép mới được nói',
  },
  {
    re: /\b(ch[ỉi]\s*c[òo]n\s*\d+\s*(su[ấa]t|s[ảa]n\s*ph[ẩa]m|c[áa]i)|s[ắa]p\s*h[ếe]t\s*h[àa]ng)\b/i,
    reason: 'khan hiếm giả — số lượng tồn kho không lấy từ đâu cả',
  },
  {
    re: /\b(\d{3,}(\.\d{3})*\s*(ng[ưu][ờo]i|kh[áa]ch|l[ưu][ợo]t)\s*([đd][ãa]\s*)?(mua|d[ùu]ng|tin))\b/i,
    reason: 'bằng chứng xã hội bịa — con số người mua không có trong brief',
  },
  {
    re: /\b(cam\s*k[ếe]t\s*\d+\s*%|b[ảa]o\s*h[àa]nh\s*(v[ĩi]nh\s*vi[ễe]n|tr[ọo]n\s*[đd][ờo]i)\b)/i,
    reason: 'cam kết bảo hành/hoàn tiền không có trong brief',
  },
  {
    re: /\b([đd][ạa]t\s*chu[ẩa]n\s*(qu[ốo]c\s*t[ếe]|FDA|CE)|[đd][ưu][ợo]c\s*ch[ứu]ng\s*nh[ậa]n)\b/i,
    reason: 'khẳng định chứng nhận — phải có giấy mới được nói',
  },
];

/** Bỏ dấu để so sánh, giữ nguyên chữ gốc để báo lỗi. */
function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

/** Chuẩn hoá để đối chiếu hai câu có trùng nhau không. */
function chuanHoa(s: string): string {
  return boDau(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Xoá đoạn vi phạm khỏi một câu, giữ phần còn lại.
 *
 * Cắt cả câu thì cảnh đó mất tiếng; chỉ cắt mệnh đề chứa khẳng định sai thì câu
 * thường vẫn đứng được. "Sản phẩm tốt nhất thị trường, dùng cả ngày không mỏi" bỏ
 * mệnh đề đầu vẫn còn "dùng cả ngày không mỏi" — vẫn bán được, mà không nói sai.
 */
export function scrub(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  // Tách theo dấu câu, không theo khoảng trắng: mất một mệnh đề thì câu còn đọc
  // được, mất mấy từ giữa câu thì thành vô nghĩa.
  const menhDe = String(text ?? '').split(/([,;.!?]+\s*)/);
  const giuLai: string[] = [];

  for (let i = 0; i < menhDe.length; i += 2) {
    const phan = menhDe[i] ?? '';
    const dauCau = menhDe[i + 1] ?? '';
    if (!phan.trim()) continue;

    const khongDau = boDau(phan);
    const viPham = MAU_CAM.find((m) => m.re.test(phan) || m.re.test(khongDau));
    if (viPham) {
      removed.push(phan.trim());
      continue;
    }
    giuLai.push(phan.trim() + (dauCau.trim() ? dauCau.trimEnd() : ''));
  }

  const ketQua = giuLai.join(' ').replace(/\s+/g, ' ').replace(/\s*([,;.!?])/g, '$1').trim();
  return { text: ketQua.replace(/^[,;.!?\s]+/, ''), removed };
}

export interface QaResult {
  findings: Finding[];
  /** Kịch bản đã gột các khẳng định sai. Dùng cái này để render, không dùng bản gốc. */
  sceneGraph: Tier3SceneGraph;
  /** True khi phải dừng lại chứ không nên render. */
  shouldBlock: boolean;
}

/**
 * Soát và gột kịch bản. Thuần, không I/O.
 *
 * Gột rồi vẫn render, không chặn — trừ khi QUÁ NỬA số cảnh vi phạm. Lý do: một câu
 * sai thì bỏ câu đó là xong, nhưng quá nửa kịch bản dựng trên khẳng định bịa thì
 * video còn lại chỉ là vỏ rỗng, thà chạy lại.
 */
export function qaCheck(sceneGraph: Tier3SceneGraph, requestedDurationSec?: number): QaResult {
  const findings: Finding[] = [];
  const scenes = sceneGraph?.scenes ?? [];
  const canhDaGot = new Set<string>();

  const scenesMoi = scenes.map((s: any, i: number) => {
    const id = String(s?.scene_id || `s${i + 1}`);
    const moi = { ...s };

    // ── Khẳng định bị cấm ──
    for (const field of ['overlay_text', 'voice_line', 'subtitle'] as const) {
      const goc = String(s?.[field] ?? '');
      if (!goc.trim()) continue;

      const { text, removed } = scrub(goc);
      if (removed.length === 0) continue;

      canhDaGot.add(id);
      for (const doan of removed) {
        const khop = MAU_CAM.find((m) => m.re.test(doan) || m.re.test(boDau(doan)));
        findings.push({
          sceneId: id,
          field: field === 'subtitle' ? 'voice_line' : field,
          severity: 'fix',
          reason: khop?.reason ?? 'khẳng định không có trong brief',
          excerpt: doan,
        });
      }

      // Gột hết mà rỗng: cảnh này không còn gì nói. Với chữ trên màn hình thì bỏ
      // là xong, nhưng lời đọc rỗng làm cảnh im lặng giữa video — nghe như video lỗi.
      if (!text.trim() && field === 'voice_line') {
        findings.push({
          sceneId: id,
          field: 'voice_line',
          severity: 'block',
          reason: 'lời đọc chỉ gồm khẳng định bịa, gột xong không còn gì để nói',
          excerpt: goc,
        });
      }
      moi[field] = text;
    }

    // ── Chữ trên màn hình trùng lời đọc ──
    //
    // Đọc một câu rồi in đúng câu đó lên màn hình là lãng phí cả hai: mắt và tai
    // nhận cùng một thông tin, trong khi overlay đáng ra phải mang con số hoặc lợi
    // ích mà tai không kịp bắt.
    const chu = chuanHoa(String(moi.overlay_text ?? ''));
    const loi = chuanHoa(String(moi.voice_line ?? ''));
    if (chu && loi && (chu === loi || (chu.length > 10 && loi.includes(chu)))) {
      findings.push({
        sceneId: id,
        field: 'overlay_text',
        severity: 'warn',
        reason: 'chữ trên màn hình lặp đúng lời đọc — mắt và tai nhận cùng một thứ',
        excerpt: String(moi.overlay_text ?? ''),
      });
    }

    return moi;
  });

  // ── Mốc thời gian liền mạch ──
  //
  // Khe hở giữa hai cảnh thành khung đen; chồng lấn làm ffmpeg cắt mất phần cuối
  // cảnh trước. Cả hai đều lọt được qua schema vì schema chỉ kiểm từng số một.
  for (let i = 1; i < scenesMoi.length; i++) {
    const truoc = Number(scenesMoi[i - 1]?.end_sec ?? 0);
    const sau = Number(scenesMoi[i]?.start_sec ?? 0);
    const lech = Math.abs(sau - truoc);
    if (lech > 0.05) {
      findings.push({
        sceneId: String(scenesMoi[i]?.scene_id || `s${i + 1}`),
        field: 'timing',
        severity: 'fix',
        reason: sau > truoc
          ? `khe hở ${lech.toFixed(2)}s so với cảnh trước — sẽ ra khung đen`
          : `chồng lấn ${lech.toFixed(2)}s lên cảnh trước`,
      });
    }
  }

  // ── Độ dài so với thứ khách đặt ──
  const thucTe = Number(scenesMoi[scenesMoi.length - 1]?.end_sec ?? 0);
  if (requestedDurationSec && thucTe > 0) {
    const lech = Math.abs(thucTe - requestedDurationSec);
    // Quá 20% là khách thấy ngay: đặt 20 giây mà nhận 26 giây.
    if (lech / requestedDurationSec > 0.2) {
      findings.push({
        sceneId: '-',
        field: 'timing',
        severity: 'warn',
        reason: `video dài ${thucTe}s trong khi khách đặt ${requestedDurationSec}s`,
      });
    }
  }

  // ── Góc máy đơn điệu ──
  //
  // diversify() trong camera-moves.ts đã sửa chuyện này khi dựng kế hoạch, nhưng
  // ghi nhận lại ở đây để biết tầng 3 có đang làm đúng việc của nó hay không — nếu
  // log đầy cảnh báo này thì prompt tầng 3 chưa thấm, chứ không phải code sai.
  const gocMay = scenesMoi.map((s: any) => String(s?.camera_motion?.type ?? ''));
  const soGoc = new Set(gocMay.filter(Boolean)).size;
  if (scenesMoi.length >= 4 && soGoc < 3) {
    findings.push({
      sceneId: '-',
      field: 'camera',
      severity: 'warn',
      reason: `cả video chỉ có ${soGoc} góc máy khác nhau — tầng 3 chưa đa dạng hoá`,
    });
  }

  const coBlock = findings.some((f) => f.severity === 'block');
  const quaNua = scenes.length > 0 && canhDaGot.size > scenes.length / 2;

  return {
    findings,
    sceneGraph: { ...sceneGraph, scenes: scenesMoi } as Tier3SceneGraph,
    shouldBlock: coBlock || quaNua,
  };
}

/** Một dòng log cho mỗi phát hiện, xếp nặng trước. */
export function formatFindings(findings: Finding[]): string[] {
  const thuTu: Record<Severity, number> = { block: 0, fix: 1, warn: 2 };
  return [...findings]
    .sort((a, b) => thuTu[a.severity] - thuTu[b.severity])
    .map((f) => {
      const nhan = f.severity === 'block' ? 'CHẶN' : f.severity === 'fix' ? 'đã gột' : 'lưu ý';
      const doan = f.excerpt ? ` — "${f.excerpt.slice(0, 60)}"` : '';
      return `[QA ${nhan}] ${f.sceneId}.${f.field}: ${f.reason}${doan}`;
    });
}

/**
 * Gột chữ trên màn hình của một kế hoạch render đã dựng sẵn.
 *
 * Dùng cho nhánh "kế hoạch có sẵn" trong worker: ở đó chữ overlay nằm trong kế hoạch
 * chứ không lấy lại từ đồ thị cảnh, nên gột đồ thị cảnh thôi là không đủ — khẳng định
 * sai vẫn hiện lên màn hình. Trả về số dòng đã sửa để worker ghi log.
 */
export function scrubPlanOverlays(plan: { timeline?: Array<{ overlay?: { text?: string } }> }): number {
  let daSua = 0;
  for (const item of plan?.timeline ?? []) {
    const goc = item?.overlay?.text;
    if (!goc) continue;
    const { text, removed } = scrub(goc);
    if (removed.length === 0) continue;
    item.overlay!.text = text;
    daSua++;
  }
  return daSua;
}
