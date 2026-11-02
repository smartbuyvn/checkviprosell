/**
 * Lời đọc không được tràn sang cảnh sau.
 *
 * ── Dữ liệu thật đã hỏng ──
 *
 * Render `ea39bbcb` giao cho khách ngày 30/10/2026. Đo độ dài file giọng thật so với
 * độ dài từng cảnh:
 *
 *   cảnh 0:  2,00s — 2,93s   tràn +0,93s
 *   cảnh 1:  3,50s — 3,69s   tràn +0,19s
 *   cảnh 2:  3,00s — 4,32s   tràn +1,32s
 *   cảnh 3:  4,20s — 3,95s   vừa
 *   cảnh 4:  3,80s — 3,74s   vừa
 *   cảnh 5:  3,50s — 5,23s   tràn +1,73s
 *
 * Tổng 4,17 giây chồng tiếng trên 20 giây video. Cảnh cuối tràn nghĩa là câu kết bị
 * cắt ngang — khách báo đúng hai triệu chứng đó: "âm thanh chồng chéo" và "video bị
 * cắt giữa chừng".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { khopCanhVoiTieng, kyTuToiDa, KHOANG_LANG } from '../src/lib/khop-tieng';

/** Timeline và thời lượng tiếng thật của render ea39bbcb. */
const TL_THAT = [
  { start_sec: 0, end_sec: 2 },
  { start_sec: 2, end_sec: 5.5 },
  { start_sec: 5.5, end_sec: 8.5 },
  { start_sec: 8.5, end_sec: 12.7 },
  { start_sec: 12.7, end_sec: 16.5 },
  { start_sec: 16.5, end_sec: 20 },
];
const TIENG_THAT = [2.93, 3.69, 4.32, 3.95, 3.74, 5.23];

test('SAU khi khop, KHONG canh nao ngan hon tieng cua no', () => {
  // Day la phep kiem quan trong nhat — dung thu da hong.
  const { timeline } = khopCanhVoiTieng(TL_THAT, TIENG_THAT);
  for (const [i, c] of timeline.entries()) {
    const dai = (c.end_sec as number) - (c.start_sec as number);
    assert.ok(
      dai >= TIENG_THAT[i] - 1e-6,
      `Canh ${i} dai ${dai.toFixed(2)}s nhung tieng ${TIENG_THAT[i]}s — van chong len canh sau`
    );
  }
});

test('co khoang lang giua cac cau, khong dinh nhau', () => {
  const { timeline } = khopCanhVoiTieng(TL_THAT, TIENG_THAT);
  for (const [i, c] of timeline.entries()) {
    const dai = (c.end_sec as number) - (c.start_sec as number);
    // Chi doi khoang lang o nhung canh PHAI keo dai; canh von du dai thi khong can.
    const goc = TL_THAT[i].end_sec - TL_THAT[i].start_sec;
    if (TIENG_THAT[i] + KHOANG_LANG > goc) {
      assert.ok(
        dai >= TIENG_THAT[i] + KHOANG_LANG - 1e-6,
        `Canh ${i} thieu khoang lang sau cau`
      );
    }
  }
});

test('moc thoi gian LIEN TUC tu 0, khong ho khong chong', () => {
  // `adelay` o worker cong don do dai tung canh de tinh moc. Mot khoang ho trong
  // timeline la tieng lech khoi hinh.
  const { timeline } = khopCanhVoiTieng(TL_THAT, TIENG_THAT);
  assert.equal(timeline[0].start_sec, 0, 'Phai bat dau tu 0');
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(
      Math.abs((timeline[i].start_sec as number) - (timeline[i - 1].end_sec as number)) < 0.02,
      `Ho/chong o canh ${i}: ${timeline[i - 1].end_sec} -> ${timeline[i].start_sec}`
    );
  }
});

test('canh von du dai thi GIU NGUYEN, khong keo vo co', () => {
  const { timeline } = khopCanhVoiTieng(TL_THAT, TIENG_THAT);
  // CHI canh 3 la du: 4,20s cho tieng 3,95s + khoang lang 0,25s = vua khit.
  //
  // Canh 4 (3,80s, tieng 3,74s) TRONG NHU du nhung khong: 3,74 + 0,25 = 3,99 > 3,80.
  // Day la cho chinh toi tinh nham khi viet test lan dau — quen cong khoang lang.
  const dai3 = (timeline[3].end_sec as number) - (timeline[3].start_sec as number);
  assert.ok(Math.abs(dai3 - 4.2) < 0.02, `Canh 3 bi doi du da du dai: ${dai3}`);
});

test('bao dung so giay da keo them', () => {
  const { keoThem, chiTiet } = khopCanhVoiTieng(TL_THAT, TIENG_THAT);
  // Nam canh phai keo: 0, 1, 2, 4, 5. Chi canh 3 vua khit.
  assert.equal(chiTiet.length, 5, `Phai keo 5 canh, thuc te ${chiTiet.length}: ${chiTiet.join(' | ')}`);
  // 1,18 + 0,44 + 1,57 + 0,19 + 1,98 = 5,36 giay.
  assert.ok(
    keoThem > 5 && keoThem < 6,
    `Keo them ${keoThem}s — tinh tay ra 5,36s`
  );
});

test('video dai them bao nhieu — con so de quyet dinh co can siet kich ban khong', () => {
  const goc = TL_THAT[TL_THAT.length - 1].end_sec;
  const { timeline } = khopCanhVoiTieng(TL_THAT, TIENG_THAT);
  const moi = timeline[timeline.length - 1].end_sec as number;
  // 20s -> 25,36s, tang 27%. Con so nay noi rang tang 3 dang viet loi thoai dai hon
  // nhieu so voi thoi luong canh no tu dat ra — phai siet o tang 3, khong chi keo o day.
  assert.ok(moi > goc, 'Phai dai hon ban goc');
  assert.ok(moi < goc * 1.4, `Dai them ${((moi/goc-1)*100).toFixed(0)}% — qua nhieu, kiem lai tang 3`);
});

test('canh khong co tieng thi giu nguyen do dai', () => {
  const { timeline, keoThem } = khopCanhVoiTieng(TL_THAT, [null, null, null, null, null, null]);
  assert.equal(keoThem, 0, 'Khong co tieng thi khong keo gi');
  for (const [i, c] of timeline.entries()) {
    const dai = (c.end_sec as number) - (c.start_sec as number);
    assert.ok(Math.abs(dai - (TL_THAT[i].end_sec - TL_THAT[i].start_sec)) < 1e-6);
  }
});

test('du lieu hong khong lam vo phep tinh', () => {
  const hong = [
    { start_sec: NaN, end_sec: 2 },
    { start_sec: 2, end_sec: undefined },
    { start_sec: 'xyz' as never, end_sec: 9 },
  ];
  const { timeline } = khopCanhVoiTieng(hong as never, [1, NaN, null]);
  for (const c of timeline) {
    assert.ok(Number.isFinite(c.start_sec as number), 'start_sec phai la so');
    assert.ok(Number.isFinite(c.end_sec as number), 'end_sec phai la so');
    assert.ok((c.end_sec as number) > (c.start_sec as number), 'Canh phai co do dai duong');
  }
});

test('timeline rong hoac thieu thi tra rong, khong no', () => {
  for (const x of [[], null, undefined]) {
    const kq = khopCanhVoiTieng(x as never, []);
    assert.deepEqual(kq.timeline, []);
    assert.equal(kq.keoThem, 0);
  }
});

test('giu nguyen cac truong khac cua canh', () => {
  const tl = [{ start_sec: 0, end_sec: 2, asset_id: 'image_1', motion: { type: 'hero_push' } }];
  const { timeline } = khopCanhVoiTieng(tl as never, [3]);
  assert.equal((timeline[0] as any).asset_id, 'image_1', 'Mat asset_id');
  assert.deepEqual((timeline[0] as any).motion, { type: 'hero_push' }, 'Mat motion');
});

/* ─────────────── ngân sách ký tự cho tầng 3 ─────────────── */

test('ky tu toi da khop voi cong thuc toc do tieng Viet', () => {
  // `giay = ky_tu / 28,3 + 0,93`, giai nguoc.
  // Canh 3 giay: (3 - 0,25 - 0,93) x 28,3 = 51 ky tu.
  assert.equal(kyTuToiDa(3), 51);
  // Tang 3 dang viet cau 88 ky tu cho o 3 giay — gap hon mot ruoi muc chua duoc.
  assert.ok(kyTuToiDa(3) < 88, 'Phai chi ra rang 88 ky tu la qua dai cho 3 giay');
});

test('canh qua ngan thi ngan sach bang 0, khong ra so am', () => {
  for (const g of [0, 0.5, 1, 1.1]) {
    assert.ok(kyTuToiDa(g) >= 0, `kyTuToiDa(${g}) ra so am`);
  }
});

test('canh dai hon thi chua duoc nhieu chu hon', () => {
  let truoc = -1;
  for (const g of [2, 3, 4, 5, 6]) {
    const n = kyTuToiDa(g);
    assert.ok(n > truoc, `${g} giay phai chua nhieu hon ${g - 1} giay`);
    truoc = n;
  }
});
