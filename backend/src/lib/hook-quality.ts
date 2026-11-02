/**
 * Viprosell — Đo độ cụ thể của câu hook
 *
 * ── Vì sao cần lớp này khi prompt đã dặn ──
 *
 * Bài học lặp lại của dự án: prompt dặn là một chuyện, model làm là chuyện khác.
 * `spreadAssets` ra đời vì model vẫn dồn ảnh dù prompt dặn đa dạng hoá; `qa-gate` ra
 * đời vì model vẫn viết khẳng định bị cấm. Đây là lớp tương tự cho câu hook.
 *
 * ── Thứ đang đo ──
 *
 * Một câu hook dở theo kiểu nguy hiểm nhất không phải câu nói quá — nói quá thì cổng
 * QA bắt được. Nó là câu **không nói gì cả**. Năm hook thật hệ thống đã sinh ra:
 *
 *     "Gặp vấn đề này mỗi ngày à?"
 *     "Đang tìm một thứ giải quyết việc này?"
 *     "Khó chịu lặp lại mỗi ngày?"
 *     "Vấn đề quen thuộc mỗi ngày"
 *     "Đang chọn đồng hồ hay laptop?"
 *
 * Không câu nào vi phạm một luật an toàn nào. Không câu nào nhắc tới sản phẩm nào.
 * Dán câu bất kỳ trong đó lên quảng cáo của bất kỳ mặt hàng nào cũng vừa — đó chính
 * là định nghĩa của hook vô dụng.
 *
 * ── Phép thử ──
 *
 * Hook phải dùng ít nhất một DANH TỪ CỤ THỂ lấy từ brief: tên sản phẩm, danh mục,
 * chất liệu, đặc điểm nhìn thấy trong ảnh, hoặc một con số brief nêu. Danh từ trừu
 * tượng ("vấn đề", "nhu cầu", "giải pháp") không tính.
 *
 * Phép thử này không đo được hook hay hay dở — không thuật toán nào đo được. Nó chỉ
 * bắt loại hỏng duy nhất mà máy nhận ra chắc chắn: hook không nói về sản phẩm này.
 */

/**
 * Từ trừu tượng không tính là nội dung.
 *
 * Đây là những từ xuất hiện trong hook rỗng. Chúng hợp lệ trong một câu có nội dung
 * khác đi kèm, nhưng một hook chỉ gồm toàn từ loại này thì không nói gì.
 */
const TU_TRU_TUONG = new Set([
  'vấn', 'đề', 'nhu', 'cầu', 'giải', 'pháp', 'thứ', 'việc', 'điều', 'cái',
  'sản', 'phẩm', 'hàng', 'đồ', 'món', 'loại', 'kiểu', 'thế', 'vậy',
  'chuyện', 'tình', 'trạng', 'khó', 'chịu', 'quen', 'thuộc', 'lặp', 'lại',
  'mỗi', 'ngày', 'này', 'kia', 'ấy', 'đó', 'nào', 'gì', 'ai', 'đâu',
  'bạn', 'mình', 'tôi', 'chúng', 'ta', 'họ',
  'đang', 'đã', 'sẽ', 'vẫn', 'còn', 'cũng', 'rất', 'quá', 'hơn', 'nhất',
  'có', 'không', 'chưa', 'được', 'bị', 'làm', 'cho', 'với', 'và', 'hay',
  'tìm', 'gặp', 'thấy', 'cần', 'muốn', 'nên', 'phải', 'à', 'ạ', 'nhé',
  'một', 'những', 'các', 'mọi', 'tất', 'cả',
]);

/**
 * Cụm cho biết brief KHÔNG có dữ kiện, dù trường vẫn có chữ.
 *
 * Tầng 1 được dặn ghi rõ khi nó không biết, và nó làm đúng — `product_title` trả về
 * `"Sản phẩm chưa xác định"` hoặc `"Sản phẩm công nghệ (đồng hồ/máy tính), chưa xác
 * định model"`. Nếu tách từ thẳng thì "xác", "định", "model" lọt vào vốn từ và brief
 * rỗng bị chấm là có dữ kiện. Phải đọc được lời thú nhận đó.
 */
const CUM_KHONG_CHAC = [
  'chưa xác định', 'không xác định', 'chưa rõ', 'không rõ', 'chưa biết',
  'chưa có thông tin', 'không đủ thông tin', 'unknown', 'n/a', 'không xác minh',
];

/** Trường này có phải lời thú nhận "tôi không biết" không. */
function laLoiThuNhan(s: string): boolean {
  const t = String(s ?? '').toLowerCase();
  return CUM_KHONG_CHAC.some((c) => t.includes(c));
}

/** Bỏ dấu câu, hạ chữ thường, tách từ. */
function tachTu(s: string): string[] {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[.,!?;:"'`()[\]{}…—–\-/\\|@#$%^&*+=<>~]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export interface NguonSuThat {
  product_title?: string | null;
  category?: string | null;
  core_offer?: string | null;
  key_benefits?: string[] | null;
  proof_points?: string[] | null;
  visual_inputs?: { notes?: string[] | null } | null;
}

/**
 * Tập từ cụ thể mà brief cung cấp — vốn từ hook được phép lấy.
 *
 * Gộp cả ghi chú ảnh: khi brief không có dữ kiện văn bản nào, thứ model nhìn thấy
 * trong ảnh vẫn là sự thật cụ thể và dùng được.
 */
export function tuCuTheTuBrief(brief: NguonSuThat | null | undefined): Set<string> {
  const b = brief ?? {};
  const nguon: string[] = [
    String(b.product_title ?? ''),
    String(b.category ?? ''),
    String(b.core_offer ?? ''),
    ...(Array.isArray(b.key_benefits) ? b.key_benefits : []),
    ...(Array.isArray(b.proof_points) ? b.proof_points : []),
    ...(Array.isArray(b.visual_inputs?.notes) ? b.visual_inputs!.notes! : []),
  ];

  const ra = new Set<string>();
  for (const truong of nguon) {
    // Bỏ cả trường khi nó là lời thú nhận không biết: lấy từ trong
    // "Sản phẩm chưa xác định" ra làm vốn từ là tự lừa mình.
    if (laLoiThuNhan(truong)) continue;
    for (const t of tachTu(truong)) {
      if (t.length >= 2 && !TU_TRU_TUONG.has(t)) ra.add(t);
    }
  }
  return ra;
}

export interface KetQuaHook {
  /** Hook có nhắc tới thứ gì cụ thể của sản phẩm không. */
  cuThe: boolean;
  /** Những từ cụ thể hook đã dùng, lấy từ brief. */
  tuTrungKhop: string[];
  /** Lý do trượt, để ghi log và để gửi lại cho model. */
  lyDo: string | null;
}

/** Chữ số trong hook cũng là dữ kiện cụ thể: "15 inch", "500ml", "8 giờ pin". */
const CO_SO = /\d/;

/**
 * Giá trị enum nội bộ không được lọt vào câu bán hàng.
 *
 * Đo thật ngày 29/10 trên sản phẩm áo HAVATA: brief có `price_positioning: "budget"`
 * và model chép thẳng vào hook — **"Áo trễ vai budget, 2 màu, đủ size S M L"**. Khách
 * Việt đọc "budget" là một từ tiếng Anh lạc lõng; nó là nhãn phân loại của hệ thống,
 * không phải lời quảng cáo.
 *
 * Đây là loại rò rỉ chỉ lộ khi đọc đầu ra thật, vì JSON vẫn hợp lệ và câu vẫn đúng
 * ngữ pháp.
 */
const ENUM_NOI_BO = [
  'budget', 'midrange', 'premium', 'unknown',
  'painfirst', 'reviewtrust', 'offerconversion',
  'hero_push', 'detail_macro', 'reveal_up', 'lifestyle_hold', 'endcard_lock',
  'simple_crop', 'smart_pan', 'relayout',
  'null', 'undefined', 'n/a',
];

/** Enum nội bộ nào đang nằm trong câu, nếu có. */
function enumBiLo(hook: string): string | null {
  const tu = new Set(tachTu(hook));
  for (const e of ENUM_NOI_BO) {
    if (tu.has(e)) return e;
  }
  return null;
}

/**
 * Hook bắt người xem chọn giữa hai loại hàng: "Đang chọn đồng hồ hay laptop?"
 *
 * Đây là hình dạng của câu "tôi không biết đây là gì". Nó khác bốn hook rỗng kia ở
 * chỗ nó CÓ nhắc tên hàng — nên phép thử độ cụ thể cho qua — nhưng nó nhắc tới HAI
 * thứ không liên quan, nghĩa là người viết đang phân vân chứ không đang bán.
 *
 * Một quảng cáo không hỏi khách mua cái gì. Nó cho khách thấy cái đang bán.
 *
 * Chỉ bắt dạng câu HỎI có "hay"/"hoặc" nối hai từ có nghĩa. "Nhẹ hay bền?" cũng bị
 * bắt, và đó là ý muốn: hook so sánh hai thuộc tính cũng là hook chưa quyết.
 *
 * Dấu hỏi KHÔNG cần đứng ngay sau cặp từ. Bản đầu của luật này đòi vậy, và nó để lọt
 * `"Chọn tai nghe, đồng hồ hay laptop mà vẫn rối?"` — đo thật ngày 29/10, đúng loại
 * câu nó sinh ra để bắt.
 */
const CHON_GIUA_HAI = /(?:^|[\s,])([^\s,]+)\s+(?:hay|hoặc)\s+([^\s,?!.]+)/iu;

function laCauPhanVan(hook: string, voTu: Set<string>): boolean {
  // Phải là câu hỏi: "Laptop ASUS hay thật" là khẳng định, không phải phân vân.
  if (!/[?？]/.test(hook)) return false;

  const m = CHON_GIUA_HAI.exec(hook);
  if (!m) return false;
  const [, a, b] = m;
  const coNghia = (t: string) => {
    const s = t.toLowerCase().replace(/[.,!?;:"'()]/g, '');
    return s.length >= 2 && !TU_TRU_TUONG.has(s);
  };
  if (!coNghia(a) || !coNghia(b)) return false;

  // Hai thứ đều nằm trong brief thì đó là so sánh có cơ sở, không phải phân vân.
  const trongBrief = (t: string) => voTu.has(t.toLowerCase().replace(/[.,!?;:"'()]/g, ''));
  return !(trongBrief(a) && trongBrief(b));
}

/**
 * Chấm một câu hook.
 *
 * Đạt khi hook dùng ít nhất một từ cụ thể của brief, HOẶC chứa một con số. Trượt khi
 * nó chỉ toàn từ trừu tượng — tức là câu dán lên sản phẩm nào cũng vừa.
 */
export function chamHook(
  hook: string | null | undefined,
  brief: NguonSuThat | null | undefined
): KetQuaHook {
  const chu = String(hook ?? '').trim();
  if (!chu) {
    return { cuThe: false, tuTrungKhop: [], lyDo: 'hook rỗng' };
  }

  const voTu = tuCuTheTuBrief(brief);
  const tuHook = tachTu(chu);
  const trungKhop = tuHook.filter((t) => voTu.has(t));

  // Enum nội bộ lọt ra là lỗi rõ ràng, kiểm trước mọi thứ khác.
  const roRi = enumBiLo(chu);
  if (roRi) {
    return {
      cuThe: false,
      tuTrungKhop: [],
      lyDo: `hook chứa nhãn nội bộ "${roRi}": "${chu}" — đó là giá trị phân loại của hệ thống, không phải tiếng Việt bán hàng`,
    };
  }

  // Kiểm trước phép thử độ cụ thể: câu phân vân CÓ nhắc tên hàng nên sẽ lọt qua đó.
  if (laCauPhanVan(chu, voTu)) {
    return {
      cuThe: false,
      tuTrungKhop: [],
      lyDo:
        `hook bắt khách chọn giữa hai thứ: "${chu}" — quảng cáo không hỏi khách mua gì, ` +
        `nó cho khách thấy thứ đang bán`,
    };
  }

  if (trungKhop.length > 0) {
    return { cuThe: true, tuTrungKhop: [...new Set(trungKhop)], lyDo: null };
  }

  if (CO_SO.test(chu)) {
    return { cuThe: true, tuTrungKhop: [], lyDo: null };
  }

  // Brief rỗng hoàn toàn thì không thể đòi hook cụ thể — lỗi nằm ở brief, không ở
  // hook. Nói rõ điều đó thay vì đổ cho tầng 2.
  if (voTu.size === 0) {
    return {
      cuThe: false,
      tuTrungKhop: [],
      lyDo: 'brief không có một dữ kiện cụ thể nào để viết hook — kiểm tra tầng 1 có nhìn được ảnh không',
    };
  }

  return {
    cuThe: false,
    tuTrungKhop: [],
    lyDo:
      `hook không nhắc tới sản phẩm: "${chu}" — dán lên mặt hàng nào cũng vừa. ` +
      `Brief có sẵn các từ dùng được: ${[...voTu].slice(0, 8).join(', ')}`,
  };
}
