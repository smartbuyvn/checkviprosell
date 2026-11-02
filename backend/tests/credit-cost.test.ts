import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creditsFor,
  giaiThichCredit,
  specFromRender,
  specFromRequest,
  BASE_CREDITS,
  GIAY_MOI_CREDIT,
  MOC_THOI_LUONG,
} from '../src/lib/credit-cost';

/**
 * Số credit mỗi video. Đây là mã quyết định GIÁ BÁN THẬT, nên test tập trung vào việc
 * không tính sai tiền khách.
 *
 * ── Bảng giá chốt 30/10/2026 ──
 *
 * **1 credit cho mỗi 15 giây bắt đầu.** Không phụ phí giọng đọc, độ phân giải hay
 * watermark.
 *
 * Bản 28/10 cộng ba phụ phí đó, và đo ra giá thật trên gói Starter là 18.429₫ cho một
 * video đăng được — gấp 4,3 lần con số quảng cáo 4.300₫. Trong khi aidancing.net bán
 * video 20 giây ở 5.887₫ bằng diffusion trên GPU, còn Viprosell chỉ ghép ảnh tĩnh với
 * giá vốn biến đổi 332₫.
 *
 * Phụ phí "có giọng đọc" tính thêm 4.300₫ cho một khoản tốn 170₫, và nó nhân đôi giá
 * niêm yết để đổi lấy vài gói bán mỗi tháng — chi phí cố định 2,59 triệu/tháng áp đảo
 * hoàn toàn chi phí biến đổi.
 */

test('bac thoi luong dung bang da duyet', () => {
  const mong: Array<[number, number]> = [
    [5, 1], [10, 1], [15, 1],
    [16, 2], [20, 2], [30, 2],
    [31, 3], [45, 3],
    [46, 4], [60, 4],
  ];
  for (const [giay, cr] of mong) {
    assert.equal(creditsFor({ durationSec: giay }), cr, `${giay} giay phai la ${cr} credit`);
  }
});

test('moc 15 giay la hang so, khong viet cung rai rac', () => {
  assert.equal(GIAY_MOI_CREDIT, 15);
  assert.equal(creditsFor({ durationSec: GIAY_MOI_CREDIT }), 1);
  assert.equal(creditsFor({ durationSec: GIAY_MOI_CREDIT + 1 }), 2);
});

test('video ngan nhat van tinh mot credit', () => {
  assert.equal(BASE_CREDITS, 1);
  assert.equal(creditsFor({ durationSec: 3 }), 1);
});

test('KHONG con phu phi giong doc', () => {
  // Day la phu phi da nhan doi gia cua MOI video — khach nao cung bat giong doc.
  assert.equal(
    creditsFor({ durationSec: 20, voice: true }),
    creditsFor({ durationSec: 20, voice: false }),
    'Van con tinh them cho giong doc'
  );
});

test('KHONG con phu phi 1080p', () => {
  // Do phan giai gio la quyen cua goi, khong phai thu tra tien tung lan dung.
  assert.equal(
    creditsFor({ durationSec: 20, resolution: '1080p' }),
    creditsFor({ durationSec: 20, resolution: '720p' })
  );
});

test('KHONG con phu phi bo watermark', () => {
  assert.equal(
    creditsFor({ durationSec: 20, watermark: false }),
    creditsFor({ durationSec: 20, watermark: true })
  );
});

test('video day du khong dat hon video tran', () => {
  // Phep kiem bao trum: bat MOI tuy chon len cung khong doi gia.
  assert.equal(
    creditsFor({ durationSec: 30, resolution: '1080p', voice: true, watermark: false }),
    creditsFor({ durationSec: 30 }),
    'Van con mot phu phi nao do sot lai'
  );
});

test('KHONG BAO GIO tra ve 0 — 0 nghia la dung mien phi khong gioi han', () => {
  assert.ok(creditsFor(null) >= 1);
  assert.ok(creditsFor(undefined) >= 1);
  assert.ok(creditsFor({}) >= 1);
  assert.ok(creditsFor({ durationSec: 0 }) >= 1);
  assert.ok(creditsFor({ durationSec: -99 }) >= 1);
  assert.ok(creditsFor({ durationSec: NaN as any }) >= 1);
});

// Doi 02/11/2026: mac dinh 20 -> 15 giay. 20 la bac gia cua bang cu (truoc 30/10);
// luat hien tai la 1 credit moi 15 giay, nen mac dinh 20 bat mot don thieu thoi luong
// phai tra 2 credit trong khi video ngan nhat chi dang 1. Ghim cung so 15 o day la co
// y: lan sau doi nguong gia thi test phai do, buoc nguoi doi phai co y thuc.
test('thieu thoi luong thi dung mac dinh 15 giay, khong tinh dat', () => {
  assert.equal(creditsFor({}), creditsFor({ durationSec: 15 }));
  assert.equal(creditsFor({}), 1);
});

test('luon tra ve so nguyen — so cai la cot INTEGER', () => {
  // `credit_ledger.delta` va `balance_after` deu la INTEGER. Mot so le o day la mot
  // lan ghi so cai that bai, hoac te hon: Postgres lam tron im lang.
  for (const d of [1, 7, 23, 37, 51, 99, 1000]) {
    const n = creditsFor({ durationSec: d });
    assert.equal(n, Math.round(n), `${d} giay cho ra so le: ${n}`);
    assert.ok(Number.isInteger(n));
  }
});

/* ── Giải thích cho khách ── */

test('tong cac dong giai thich LUON bang so credit tru that', () => {
  // Hai noi giai thich khac nhau ve cung mot lan tru tien la cach nhanh nhat de mat
  // long tin. Giao dien bao gia va so cai dung chung ham nay.
  for (const d of [10, 15, 20, 30, 45, 60]) {
    const spec = { durationSec: d };
    const tong = giaiThichCredit(spec).reduce((t, x) => t + x.credit, 0);
    assert.equal(tong, creditsFor(spec), `${d} giay: giai thich ${tong} nhung tru ${creditsFor(spec)}`);
  }
});

test('giai thich doc duoc cho nguoi ban, khong phai cho lap trinh vien', () => {
  const dong = giaiThichCredit({ durationSec: 30 });
  assert.equal(dong.length, 1, 'Mot con so chi can mot dong de giai thich');
  assert.match(dong[0].nhan, /giây/, 'Nhan khong nhac toi thoi luong');
  assert.doesNotMatch(dong[0].nhan, /durationSec|credit_ledger|spec/i, 'Lo ten bien ra giao dien');
});

/* ── Mốc cho khách chọn ── */

test('moc thoi luong khop dung cong thuc', () => {
  assert.ok(MOC_THOI_LUONG.length >= 3, 'Qua it lua chon cho khach');
  for (const m of MOC_THOI_LUONG) {
    assert.equal(m.credit, creditsFor({ durationSec: m.giay }), `Moc ${m.giay}s ghi sai credit`);
    assert.match(m.nhan, /giây/);
  }
});

test('khong chao moc nao pipeline khong dung duoc', () => {
  // Schema tang 1 va tang 3 deu kep `duration_sec` trong 10..45. Chao 60 giay la ban
  // mot thu pipeline se lang le cat xuong 45.
  for (const m of MOC_THOI_LUONG) {
    assert.ok(m.giay >= 10, `Moc ${m.giay}s duoi nguong tang 1 (10 giay)`);
    assert.ok(m.giay <= 45, `Moc ${m.giay}s vuot tran tang 1 va tang 3 (45 giay)`);
  }
});

/* ── Suy spec từ đơn hàng ── */

test('specFromRequest lay thoi luong tu don khach dat', () => {
  assert.equal(specFromRequest({ duration_seconds: 45 }, 'draft_local').durationSec, 45);
  assert.equal(creditsFor(specFromRequest({ duration_seconds: 45 }, 'draft_local')), 3);
});

test('specFromRequest thieu thoi luong thi lui ve mac dinh, khong ve 0', () => {
  for (const x of [null, undefined, {}, { duration_seconds: 0 }, { duration_seconds: 'abc' }]) {
    const spec = specFromRequest(x as any, 'draft_local');
    assert.equal(spec.durationSec, 15);
    assert.equal(creditsFor(spec), 1);
  }
});

test('specFromRender: che do co giong doc thi danh dau voice', () => {
  // Khong con anh huong gia, nhung so cai va nhat ky van phai doc duoc chuyen gi da xay ra.
  assert.equal(specFromRender({ render_mode: 'draft_local_tts' }).voice, true);
  assert.equal(specFromRender({ render_mode: 'draft_local' }).voice, false);
});

test('specFromRender: nhan ra 1080p tu do phan giai', () => {
  assert.equal(specFromRender({ render_mode: 'draft_local' }, { export: { resolution: '1080x1920' } }).resolution, '1080p');
  assert.equal(specFromRender({ render_mode: 'draft_local' }, { export: { resolution: '720x1280' } }).resolution, '720p');
});

test('specFromRender: lay do dai tu moc ket thuc cuoi cung', () => {
  const spec = specFromRender({ render_mode: 'draft_local' }, { timeline: [{ end_sec: 10 }, { end_sec: 32 }] });
  assert.equal(spec.durationSec, 32);
  assert.equal(creditsFor(spec), 3);
});

test('specFromRender: khong co timeline thi dung do dai chuan, khong phai 0', () => {
  assert.equal(specFromRender({ render_mode: 'draft_local' }, {}).durationSec, 15);
  assert.equal(specFromRender(null, null).durationSec, 15);
});
