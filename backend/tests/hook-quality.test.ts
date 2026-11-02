/**
 * Phép thử độ cụ thể của hook, kiểm bằng chính dữ liệu thật đã hỏng.
 *
 * Năm câu dưới đây là hook THẬT hệ thống đã sinh và đã giao cho khách trong các ngày
 * 27–29/10/2026. Không câu nào vi phạm một luật an toàn nào, nên mọi cổng kiểm hiện
 * có đều cho qua. Và không câu nào nhắc tới sản phẩm nào.
 *
 * Nếu phép thử này không bắt được cả năm câu thì nó vô dụng.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chamHook, tuCuTheTuBrief } from '../src/lib/hook-quality';

/** Brief có dữ kiện thật — trường hợp bình thường. */
const BRIEF_DU = {
  product_title: 'Laptop ASUS FX505GE',
  category: 'máy tính xách tay',
  core_offer: 'Máy chơi game 15 inch card rời GTX 1050Ti',
  key_benefits: ['Card đồ hoạ rời GTX 1050Ti', 'Ổ SSD 128GB khởi động nhanh'],
  proof_points: ['CPU i7-8750H 6 nhân'],
  visual_inputs: { notes: ['Ảnh chụp bàn phím đèn nền đỏ'] },
};

/** Brief rỗng — đúng thứ render a7d667cc nhận được. */
const BRIEF_RONG = {
  product_title: 'Sản phẩm chưa xác định',
  category: null,
  core_offer: null,
  key_benefits: [],
  proof_points: [],
  visual_inputs: { notes: [] },
};

/** Hook thật đã giao cho khách. Mọi câu đều phải trượt. */
const HOOK_THAT_DA_HONG = [
  'Gặp vấn đề này mỗi ngày à?',
  'Đang tìm một thứ giải quyết việc này?',
  'Khó chịu lặp lại mỗi ngày?',
  'Vấn đề quen thuộc mỗi ngày',
  'Đang chọn đồng hồ hay laptop?',
];

test('bat duoc ca 5 hook that da giao cho khach', () => {
  for (const h of HOOK_THAT_DA_HONG) {
    const kq = chamHook(h, BRIEF_DU);
    assert.equal(kq.cuThe, false, `Phai truot nhung lai dat: "${h}"`);
    assert.ok(kq.lyDo, `Truot thi phai noi ly do: "${h}"`);
  }
});

test('hook co nhac san pham thi dat', () => {
  const tot = [
    'Laptop ASUS 15 inch, card rời',
    'GTX 1050Ti trong tầm giá này?',
    'Bàn phím đèn nền đỏ, SSD 128GB',
    'i7-8750H 6 nhân — máy này',
  ];
  for (const h of tot) {
    const kq = chamHook(h, BRIEF_DU);
    assert.equal(kq.cuThe, true, `Phai dat nhung lai truot: "${h}" (${kq.lyDo})`);
  }
});

test('con so cung la du kien cu the', () => {
  // "15 inch", "500ml", "8 gio pin" — con so la su that kiem chung duoc, du tu
  // quanh no khong trung voi brief.
  const kq = chamHook('Pin 8 tiếng liên tục', BRIEF_RONG);
  assert.equal(kq.cuThe, true, 'Hook co con so phai dat');
});

test('brief rong thi noi ro loi o tang 1, khong do cho tang 2', () => {
  const kq = chamHook('Gặp vấn đề này mỗi ngày à?', BRIEF_RONG);
  assert.equal(kq.cuThe, false);
  assert.match(
    kq.lyDo!,
    /tầng 1|ảnh/,
    'Brief rong thi ly do phai chi ve tang 1, vi tang 2 khong the viet hook tu hu khong'
  );
});

test('ly do truot neu duoc tu dung duoc, de con sua', () => {
  const kq = chamHook('Khó chịu lặp lại mỗi ngày?', BRIEF_DU);
  assert.equal(kq.cuThe, false);
  assert.match(kq.lyDo!, /asus|laptop|gtx|ssd|inch/i, 'Phai goi y tu lay tu brief');
});

test('hook rong hoac thieu thi truot, khong no', () => {
  for (const h of [null, undefined, '', '   ']) {
    const kq = chamHook(h as never, BRIEF_DU);
    assert.equal(kq.cuThe, false);
    assert.ok(kq.lyDo);
  }
});

test('tu tru tuong khong duoc tinh la noi dung', () => {
  const vo = tuCuTheTuBrief(BRIEF_RONG);
  // "San pham chua xac dinh" — "san", "pham" la tu tru tuong, nhung "xac", "dinh"
  // thi khong nam trong danh sach. Diem quan trong: khong duoc nhan "san pham".
  assert.ok(!vo.has('sản'), '"sản" phai bi loai');
  assert.ok(!vo.has('phẩm'), '"phẩm" phai bi loai');
  assert.ok(!vo.has('vấn'), '"vấn" phai bi loai');
});

test('khong bi lua boi hook chi lap lai tu trong danh muc chung', () => {
  // "San pham cong nghe" la danh muc rong — hook dung lai no van la hook rong.
  const briefMo = {
    product_title: 'Sản phẩm công nghệ',
    category: null, core_offer: null, key_benefits: [], proof_points: [],
    visual_inputs: { notes: [] },
  };
  const kq = chamHook('Sản phẩm này có gì hay?', briefMo);
  assert.equal(kq.cuThe, false, 'Lap lai "san pham" khong phai la cu the');
});

test('khong phan biet hoa thuong va dau cau', () => {
  const a = chamHook('LAPTOP ASUS!', BRIEF_DU);
  const b = chamHook('laptop asus', BRIEF_DU);
  assert.equal(a.cuThe, true);
  assert.equal(b.cuThe, true);
});

test('du lieu hong khong lam no', () => {
  for (const b of [null, undefined, {}, { key_benefits: null }, { visual_inputs: null }]) {
    assert.doesNotThrow(() => chamHook('thử', b as never));
    assert.doesNotThrow(() => tuCuTheTuBrief(b as never));
  }
});

/**
 * Chong bat nham. Mot luat chat qua thi loai ca hook tot, va hau qua con te hon loai
 * sot: moi lan dung deu bi chan, khach khong lam duoc gi.
 */
test('khong bat nham hook tot co dang cau hoi', () => {
  const tot = [
    'Laptop gaming dưới 20 triệu?',
    'SSD 128GB khởi động trong 9 giây',
    'Card rời GTX 1050Ti, giá này?',
    'Bàn phím đèn nền đỏ — nhìn thật',
  ];
  for (const h of tot) {
    const kq = chamHook(h, BRIEF_DU);
    assert.equal(kq.cuThe, true, `Bat nham hook tot: "${h}" (${kq.lyDo})`);
  }
});

test('so sanh hai thuoc tinh DEU co trong brief thi khong phai phan van', () => {
  const brief = {
    product_title: 'Laptop ASUS',
    category: null, core_offer: null,
    key_benefits: ['Máy nhẹ 1,9kg', 'Vỏ bền chuẩn quân đội'],
    proof_points: [], visual_inputs: { notes: [] },
  };
  // "nhe" va "ben" deu la thuoc tinh brief neu ra — day la so sanh co co so.
  const kq = chamHook('Nhẹ hay bền?', brief);
  assert.equal(kq.cuThe, true, `So sanh co co so bi bat nham: ${kq.lyDo}`);
});

test('"hay" trong cau khang dinh khong bi coi la phan van', () => {
  // Khong phai cau hoi thi khong phai dang "chon giua hai thu".
  const kq = chamHook('Laptop ASUS hay thật', BRIEF_DU);
  assert.equal(kq.cuThe, true, `Cau khang dinh bi bat nham: ${kq.lyDo}`);
});

test('bat duoc cau phan van khi dau hoi khong dung ngay sau cap tu', () => {
  // Do that 29/10: ban dau cua luat doi dau '?' dung ngay sau Y nen de lot cau nay.
  const kq = chamHook('Chọn tai nghe, đồng hồ hay laptop mà vẫn rối?', BRIEF_DU);
  assert.equal(kq.cuThe, false, `Van lot: ${JSON.stringify(kq)}`);
  assert.match(kq.lyDo!, /chọn giữa hai thứ/);
});

test('bat enum noi bo lot vao cau ban hang', () => {
  // Do that 29/10 tren san pham ao HAVATA: brief co price_positioning "budget" va
  // model chep thang vao hook. JSON van hop le, cau van dung ngu phap — chi lo khi
  // doc dau ra that.
  const kq = chamHook('Áo trễ vai budget, 2 màu, đủ size S M L', BRIEF_DU);
  assert.equal(kq.cuThe, false, `Van lot: ${JSON.stringify(kq)}`);
  assert.match(kq.lyDo!, /budget/);
});

test('bat ca cac enum noi bo khac', () => {
  for (const e of ['painfirst', 'midrange', 'hero_push', 'undefined']) {
    const kq = chamHook(`Laptop ASUS ${e} giá tốt`, BRIEF_DU);
    assert.equal(kq.cuThe, false, `Lot enum "${e}"`);
  }
});

test('khong bat nham cau binh thuong khong chua enum', () => {
  const briefAo = {
    product_title: 'Áo trễ vai HAVATA',
    category: 'thời trang nữ',
    core_offer: 'Áo croptop trễ vai chất gân tăm',
    key_benefits: ['Hai màu đen và đỏ', 'Đủ size S M L'],
    proof_points: [], visual_inputs: { notes: [] },
  };
  const kq = chamHook('Áo trễ vai HAVATA hai màu', briefAo);
  assert.equal(kq.cuThe, true, `Bat nham: ${kq.lyDo}`);
});

test('danh doi co y: "premium" bi chan du khach that su dung tu do', () => {
  // "premium" vua la enum noi bo vua la tu tieng Viet khach hay dung. Chon chan ca
  // hai: lo mot nhan noi bo ra quang cao te hon la mat mot cach dien dat.
  const briefAo = {
    product_title: 'Áo trễ vai HAVATA', category: 'thời trang nữ',
    core_offer: null, key_benefits: [], proof_points: [], visual_inputs: { notes: [] },
  };
  const kq = chamHook('Áo trễ vai HAVATA bản premium', briefAo);
  assert.equal(kq.cuThe, false, 'Phai chan, du day la danh doi co y');
  assert.match(kq.lyDo!, /premium/);
});
