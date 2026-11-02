/**
 * Chặn hồi quy lệch công thức tính credit giữa backend và frontend.
 *
 * Giao diện báo giá trước khi dựng bằng `src/lib/creditCost.ts`; backend trừ tiền bằng
 * `backend/src/lib/credit-cost.ts`. Hai dự án biên dịch riêng nên không import chéo
 * được, buộc phải sao chép công thức — và bản sao thì trôi.
 *
 * Khuôn lỗi này đã cắn ba lần trong dự án: `validators.ts` giữ danh sách góc máy riêng
 * với `CAMERA_TABLE`, `getZoompanFilter` chỉ biết bộ tên cũ, `THEME_CARDS` và `THEMES`
 * là hai nơi. Lần này hậu quả là tiền: khách thấy một con số rồi bị trừ con số khác.
 *
 * Test nạp CẢ HAI bản và so kết quả trên mọi tổ hợp, chứ không so mã nguồn — cách viết
 * khác nhau mà kết quả giống nhau vẫn đạt, còn đổi luật một bên là trượt ngay.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as be from '../src/lib/credit-cost';
import * as fe from '../../src/lib/creditCost';
import * as tier3 from '../src/prompts/tiers/tier3-scene-graph';

const THOI_LUONG = [0, 5, 15, 19, 20, 21, 25, 40, 41, 60, 90];
const PHAN_GIAI = ['720p', '1080p'] as const;
const GIONG = [true, false];
const WATERMARK = [true, false];

test('hai ban tinh ra cung so credit tren moi to hop', () => {
  let soToHop = 0;
  for (const durationSec of THOI_LUONG) {
    for (const resolution of PHAN_GIAI) {
      for (const voice of GIONG) {
        for (const watermark of WATERMARK) {
          const spec = { durationSec, resolution, voice, watermark };
          soToHop++;
          assert.equal(
            fe.creditsFor(spec as any),
            be.creditsFor(spec as any),
            `Lech o ${JSON.stringify(spec)}`
          );
        }
      }
    }
  }
  assert.ok(soToHop >= 48, `Chi thu ${soToHop} to hop, qua it de tin`);
});

test('hai ban giai thich giong het nhau', () => {
  for (const durationSec of THOI_LUONG) {
    for (const resolution of PHAN_GIAI) {
      const spec = { durationSec, resolution, voice: true, watermark: false };
      assert.deepEqual(
        fe.giaiThichCredit(spec as any),
        be.giaiThichCredit(spec as any),
        `Lech loi giai o ${JSON.stringify(spec)}`
      );
    }
  }
});

test('tong cac dong giai thich luon bang tong credit', () => {
  for (const durationSec of THOI_LUONG) {
    for (const resolution of PHAN_GIAI) {
      for (const voice of GIONG) {
        for (const watermark of WATERMARK) {
          const spec = { durationSec, resolution, voice, watermark };
          const tong = be.giaiThichCredit(spec as any).reduce((t, d) => t + d.credit, 0);
          assert.equal(
            tong,
            be.creditsFor(spec as any),
            `Giai thich cong ra ${tong} nhung tinh ra ${be.creditsFor(spec as any)} o ${JSON.stringify(spec)}`
          );
        }
      }
    }
  }
});

test('hang so goc giong nhau', () => {
  assert.equal(fe.BASE_CREDITS, be.BASE_CREDITS);
  assert.equal(fe.BASE_DURATION_SEC, be.BASE_DURATION_SEC);
});

/**
 * Giao dien dung ten che do kieu `draftlocaltts`, CSDL dung `draft_local_tts`.
 * Nham dang la bao gia thieu phu phi giong doc — nen phai canh ca hai dang.
 */
test('hai dang ten che do render cho ra cung mot spec', () => {
  const cap: Array<[string, string]> = [
    ['draft_local', 'draft_local'],
    ['draftlocaltts', 'draft_local_tts'],
    ['premiumcloud', 'premium_cloud'],
  ];
  for (const [dangUI, dangDb] of cap) {
    const specUI = fe.specFromChoices({ durationSec: 30, renderMode: dangUI });
    const specDb = be.specFromRequest({ duration_seconds: 30 }, dangDb);
    assert.deepEqual(specUI, specDb, `Lech giua "${dangUI}" va "${dangDb}"`);
  }
});

test('gia tinh theo don khach dat, khong theo ke hoach AI dung ra', () => {
  // Khach dat 30 giay — dung mot moc bac. Ke hoach AI ra 31 giay, vuot bac.
  //
  // Day la cho nguy hiem that: khach chon 30 giay, thay bao 2 credit, roi bi tru 3 vi
  // ke hoach dung ra dai hon mot giay. May quyet chu khong phai khach quyet, va khong
  // bao truoc duoc.
  const theoDon = be.creditsFor(be.specFromRequest({ duration_seconds: 30 }, 'draft_local'));
  const theoKeHoach = be.creditsFor(
    be.specFromRender({ render_mode: 'draft_local' }, { timeline: [{ end_sec: 31 }] })
  );

  assert.equal(theoDon, 2, 'Dat 30 giay thi phai la 2 credit');
  assert.equal(theoKeHoach, 3, 'Cach cu tinh 31 giay thanh 3 credit — day la cho tung sai');
  assert.notEqual(theoDon, theoKeHoach, 'Hai cach phai khac nhau, neu khong test nay vo nghia');
});

/* ── Bang gia chot 30/10: 1 credit moi 15 giay, khong phu phi ── */

test('bac thoi luong dung bang da duyet', () => {
  const mong: Array<[number, number]> = [
    [5, 1], [10, 1], [15, 1],
    [16, 2], [20, 2], [30, 2],
    [31, 3], [45, 3],
    [46, 4], [60, 4],
  ];
  for (const [giay, cr] of mong) {
    assert.equal(be.creditsFor({ durationSec: giay }), cr, `${giay} giay phai la ${cr} credit (backend)`);
    assert.equal(fe.creditsFor({ durationSec: giay }), cr, `${giay} giay phai la ${cr} credit (frontend)`);
  }
});

test('KHONG con phu phi giong doc, 1080p hay bo watermark', () => {
  // Ba phu phi cu lam gia mot video dang duoc len gap 4,3 lan con so quang cao,
  // trong khi chung chi mang lai vai goi ban moi thang.
  const goc = { durationSec: 20 };
  for (const them of [
    { voice: true },
    { resolution: '1080p' as const },
    { watermark: false },
    { voice: true, resolution: '1080p' as const, watermark: false },
  ]) {
    assert.equal(
      be.creditsFor({ ...goc, ...them }),
      be.creditsFor(goc),
      `Van con tinh them cho ${JSON.stringify(them)}`
    );
    assert.equal(fe.creditsFor({ ...goc, ...them } as any), fe.creditsFor(goc));
  }
});

test('moc thoi luong hien cho khach khop dung cong thuc', () => {
  assert.ok(be.MOC_THOI_LUONG.length > 0, 'Khong co moc nao de khach chon');
  assert.deepEqual(
    be.MOC_THOI_LUONG,
    fe.MOC_THOI_LUONG,
    'Bang moc thoi luong hai ben lech nhau — khach thay gia khac luc tru'
  );
  for (const m of be.MOC_THOI_LUONG) {
    assert.equal(m.credit, be.creditsFor({ durationSec: m.giay }), `Moc ${m.giay}s ghi sai credit`);
  }
});

/* ── Mốc thời lượng theo SỨC CHỨA của nguyên liệu ── */

/**
 * Đo thật 30/10 trên 40 ảnh khách đã tải lên: trung vị 1024px, nhỏ nhất 300px, và chỉ
 * 16/40 đủ pixel để cắt cận 1,28× mà vẫn nét ở 1080.
 *
 * Bản đầu chia thẳng "mỗi ảnh 10 giây" — coi tấm 300px ngang hàng tấm 2296px, bỏ qua
 * clip tự quay, và bỏ qua cảnh CTA vốn không tiêu ảnh nào.
 */

const anhNho = { canhNgan: 600 };     // chỉ gánh một cảnh góc rộng
const anhVua = { canhNgan: 1024 };    // trung vị đo thật — hai cảnh
const anhTo = { canhNgan: 2000 };     // ba cảnh, cắt cận vẫn nét

test('do phan giai quyet dinh so canh moi anh ganh duoc', () => {
  for (const [px, canh] of [[300, 1], [600, 1], [899, 1], [900, 2], [1024, 2], [1381, 2], [1382, 3], [2296, 3]] as Array<[number, number]>) {
    assert.equal(be.soCanhMoiAnh(px), canh, `${px}px phai ganh ${canh} canh`);
    assert.equal(fe.soCanhMoiAnh(px), canh, `${px}px lech o frontend`);
  }
});

test('khong do duoc kich thuoc thi lui ve trung vi do that, khong doan rong tay', () => {
  // Trung vi 1024px ung voi 2 canh.
  for (const x of [undefined, null, 0, -1, NaN, 'abc']) {
    assert.equal(be.soCanhMoiAnh(x as any), 2);
  }
});

test('anh TO mo duoc moc dai hon anh NHO, cung so luong', () => {
  const nho = be.mocThoiLuongChoPhep({ anh: [anhNho, anhNho, anhNho] }).map((m: any) => m.giay);
  const to = be.mocThoiLuongChoPhep({ anh: [anhTo, anhTo, anhTo] }).map((m: any) => m.giay);
  assert.ok(
    to.length > nho.length,
    `Ba anh 2000px (${to.join(',')}) khong mo duoc nhieu hon ba anh 600px (${nho.join(',')})`
  );
});

test('clip tu quay gop suc chua, khong bi bo qua', () => {
  const chiAnh = be.sucChuaGiay({ anh: [anhVua] });
  const themClip = be.sucChuaGiay({ anh: [anhVua], soClip: 1 });
  assert.ok(themClip > chiAnh, 'Clip khong duoc tinh vao suc chua');
  assert.equal(themClip - chiAnh, be.CANH_MOI_CLIP * be.GIAY_MOI_CANH);
});

test('canh CTA khong tieu anh nao van duoc cong vao', () => {
  // Mot anh ganh 2 canh, cong canh chu = 3 canh = 9 giay.
  assert.equal(be.soCanhDungDuoc({ anh: [anhVua] }), 2 + be.CANH_KHONG_CAN_ANH);
});

test('khong co nguyen lieu nao thi suc chua bang 0', () => {
  assert.equal(be.sucChuaGiay({ anh: [], soClip: 0 }), 0);
  assert.equal(be.sucChuaGiay(null), 0);
  // Nhung van phai chao mot moc de khach co cai ma bam.
  assert.equal(be.mocThoiLuongChoPhep({ anh: [] }).length, 1);
});

test('ba anh trung vi 1024px — truong hop pho bien nhat', () => {
  // 3 anh x 2 canh + 1 canh chu = 7 canh x 3 giay = 21 giay.
  const nguon = { anh: [anhVua, anhVua, anhVua] };
  assert.equal(be.sucChuaGiay(nguon), 21);
  assert.deepEqual(be.mocThoiLuongChoPhep(nguon).map((m: any) => m.giay), [15, 20]);
});

test('nam anh 2000px mo duoc moc dai nhat', () => {
  // 5 x 3 + 1 = 16 canh x 3 = 48 giay.
  const nguon = { anh: [anhTo, anhTo, anhTo, anhTo, anhTo] };
  assert.ok(be.sucChuaGiay(nguon) >= 45);
  assert.deepEqual(be.mocThoiLuongChoPhep(nguon).map((m: any) => m.giay), [15, 20, 30, 45]);
});

test('hai ban cho cung ket qua tren moi to hop nguyen lieu', () => {
  const mau = [anhNho, anhVua, anhTo, {}];
  for (let n = 0; n <= 4; n++) {
    for (const a of mau) {
      for (const clip of [0, 1, 2]) {
        const nguon = { anh: Array.from({ length: n }, () => a), soClip: clip };
        assert.equal(be.sucChuaGiay(nguon), fe.sucChuaGiay(nguon), JSON.stringify(nguon));
        assert.deepEqual(
          be.mocThoiLuongChoPhep(nguon).map((m: any) => m.giay),
          fe.mocThoiLuongChoPhep(nguon).map((m: any) => m.giay),
          JSON.stringify(nguon)
        );
      }
    }
  }
});

test('ly do khoa noi RO phai lam gi, khong chi noi khong duoc', () => {
  const ly = be.viSaoKhoaMoc(45, { anh: [anhNho, anhNho, anhNho] });
  assert.ok(ly.length > 0, '45 giay voi ba anh 600px phai bi khoa');
  assert.match(ly, /ảnh/, 'Khong noi gi ve anh');
  // Van de la DO PHAN GIAI, nen phai nhac toi no — bao "them anh" roi khach them ba
  // tam 600px nua thi van khong mo duoc.
  assert.match(ly, new RegExp(String(be.PX_CHO_CAN_CANH)), 'Khong noi nguong pixel can co');
  assert.doesNotMatch(ly, /sucChua|canhNgan|undefined|NaN/i, 'Lo ten bien ra giao dien');
});

test('moc nao duoc mo thi nguyen lieu that su ganh duoc', () => {
  const to = [anhNho, anhVua, anhTo, {}];
  for (let n = 0; n <= 5; n++) {
    for (const a of to) {
      const nguon = { anh: Array.from({ length: n }, () => a) };
      const tran = be.sucChuaGiay(nguon);
      for (const m of be.mocThoiLuongChoPhep(nguon)) {
        if (m.giay === be.MOC_THOI_LUONG[0].giay) continue; // moc ngan nhat luon mo
        assert.ok(m.giay <= tran, `Mo ${m.giay}s nhung suc chua chi ${tran}s`);
      }
    }
  }
});

test('nhan ca dang cu (mot con so la so anh) de noi goi cu khong vo', () => {
  assert.ok(be.mocThoiLuongChoPhep(3).length >= 1);
  assert.equal(be.viSaoKhoaMoc(15, 3), '', '15 giay voi ba anh phai mo');
});

/* ── Số cảnh tầng 3 suy từ thời lượng ── */

test('so canh tang 3 theo dung nhip prompt quy dinh', () => {
  // Nhip: hook 1,5-2,5s, lap luan 2,5-4s, CTA 2,5-3,5s.
  for (const giay of [15, 20, 30, 45]) {
    const { itNhat, nhieuNhat } = tier3.soCanhTheoThoiLuong(giay);
    assert.ok(itNhat >= 4, `${giay}s: it nhat ${itNhat} canh, duoi san 4`);
    assert.ok(nhieuNhat > itNhat, `${giay}s: khoang canh rong 0`);
    assert.ok(giay / nhieuNhat >= 2.4, `${giay}s chia ${nhieuNhat} canh = ${(giay / nhieuNhat).toFixed(1)}s moi canh, ngan hon nhip`);
    assert.ok(giay / itNhat <= 4.1, `${giay}s chia ${itNhat} canh = ${(giay / itNhat).toFixed(1)}s moi canh, dai hon nhip`);
  }
});

test('video dai hon thi duoc nhieu canh hon', () => {
  const a = tier3.soCanhTheoThoiLuong(15);
  const b = tier3.soCanhTheoThoiLuong(45);
  assert.ok(b.nhieuNhat > a.nhieuNhat, 'Tran canh khong tang theo thoi luong');
});

test('prompt tang 3 KHONG con viet cung "4 and 10"', () => {
  const p15 = tier3.buildTier3Prompt({ desired_duration_sec: 15 }, {});
  const p45 = tier3.buildTier3Prompt({ desired_duration_sec: 45 }, {});
  assert.doesNotMatch(p15, /between 4 and 10 scenes/, 'Van con khoang canh viet cung');
  assert.notEqual(
    p15.match(/between \d+ and \d+ scenes/)?.[0],
    p45.match(/between \d+ and \d+ scenes/)?.[0],
    'Prompt 15 giay va 45 giay xin cung so canh'
  );
  assert.doesNotMatch(p45, /{{canh_/, 'Con cho trong chua thay');
});
