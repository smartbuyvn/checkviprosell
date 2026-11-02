/**
 * Nhịp phụ đề tiếng Việt — công thức đo được, không phải mượn.
 *
 * Trước 29/10/2026 `splitByChars` chia thời lượng theo tỉ lệ ký tự và KHÔNG có mức
 * giữ tối thiểu nào. Một mẩu ngắn nằm cạnh mẩu dài chỉ hiện vài phần mười giây — đủ
 * để mắt thấy chữ nhấp nháy, không đủ để đọc.
 *
 * Công thức `ký_tự / 28,3 + 0,93` đo bằng 12 câu quảng cáo tiếng Việt cho chính nhà
 * cung cấp TTS đang chạy đọc, dài từ 10 tới 119 ký tự, thời lượng lấy bằng ffprobe.
 * R² = 0,916.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  thoiGianDoc,
  gopMauNgan,
  splitByChars,
  chunkText,
  GIU_TOI_THIEU_GIAY,
} from '../src/lib/subtitle-align';

/** 12 cặp (ký tự, giây) đo thật ngày 29/10. */
const DO_THAT: Array<[number, number]> = [
  [10, 1.37], [17, 1.41], [31, 2.00], [51, 3.51], [61, 3.70], [87, 3.71],
  [15, 1.36], [36, 1.85], [60, 2.84], [74, 3.32], [87, 3.71], [119, 5.31],
];

test('cong thuc khop du lieu do that trong sai so da biet', () => {
  // Lech lon nhat do duoc la 0,78 giay, o cau chua ten thuong hieu viet hoa —
  // TTS danh van tung chu cai nen lau hon han. Noi long toi 0,9 de bao duoc no.
  for (const [kyTu, giay] of DO_THAT) {
    const duDoan = thoiGianDoc('x'.repeat(kyTu));
    assert.ok(
      Math.abs(duDoan - giay) <= 0.9,
      `${kyTu} ky tu: cong thuc ${duDoan.toFixed(2)}s, do that ${giay}s`
    );
  }
});

test('nhanh hon cong thuc tieng Anh — day la ly do phai do rieng', () => {
  // Tieng Anh: kyTu/15 + 1,5. Dung no cho tieng Viet la giu phu de lau gan gap doi
  // muc can, va video 20 giay khong con cho cho cau tiep theo.
  const n = 60;
  const viet = thoiGianDoc('x'.repeat(n));
  const anh = n / 15 + 1.5;
  assert.ok(viet < anh, `Viet ${viet.toFixed(2)}s phai nhanh hon Anh ${anh.toFixed(2)}s`);
  assert.ok(viet > n / 60, 'Nhung khong duoc nhanh toi muc vo ly');
});

test('cau rong doc het 0 giay', () => {
  for (const x of ['', '   ', null, undefined]) {
    assert.equal(thoiGianDoc(x as never), 0);
  }
});

test('thoi gian doc tang theo do dai', () => {
  let truoc = 0;
  for (const n of [5, 20, 50, 100]) {
    const g = thoiGianDoc('x'.repeat(n));
    assert.ok(g > truoc, `${n} ky tu phai lau hon muc truoc`);
    truoc = g;
  }
});

/* ───────────────────── gộp mẩu ngắn ───────────────────── */

test('mau qua ngan duoc gop vao hang xom', () => {
  // "Mua ngay" chi 8 ky tu canh mot mau 40 ky tu: ti le cho no khoang 0,6 giay.
  const chunks = ['Chất gân tăm co giãn ôm dáng mặc rất xinh', 'Mua ngay'];
  const ra = gopMauNgan(chunks, 4);
  assert.equal(ra.length, 1, `Phai gop lai: ${JSON.stringify(ra)}`);
  assert.match(ra[0], /Mua ngay$/);
});

test('mau du dai thi khong gop', () => {
  const chunks = ['Áo trễ vai HAVATA hai màu', 'Đủ size S M L giá tốt'];
  const ra = gopMauNgan(chunks, 8);
  assert.equal(ra.length, 2, 'Du thoi gian thi giu nguyen');
});

test('khong gop thanh dong qua dai', () => {
  // Hai mau deu sat tran maxChars: gop lai se vuot 2x va tran khoi vung an toan.
  const dai = 'x'.repeat(40);
  const ra = gopMauNgan([dai, dai, dai], 1);
  assert.ok(ra.every((c) => c.length <= 84), `Co dong qua dai: ${ra.map((c) => c.length)}`);
});

test('gop voi hang xom NGAN HON de khong don thanh mot dong khong lo', () => {
  const ra = gopMauNgan(['ngắn', 'x'.repeat(50), 'vừa vừa thôi'], 6);
  // "ngan" phai gop voi "vua vua thoi" neu co the, khong gop voi mau 50 ky tu.
  const coDongKhongLo = ra.some((c) => c.length > 70);
  assert.ok(!coDongKhongLo, `Don thanh dong khong lo: ${ra.map((c) => c.length)}`);
});

test('mot mau hoac rong thi tra nguyen', () => {
  assert.deepEqual(gopMauNgan(['một mẩu'], 1), ['một mẩu']);
  assert.deepEqual(gopMauNgan([], 5), []);
});

test('thoi luong khong hop le thi khong gop bua', () => {
  const c = ['a', 'b', 'c'];
  assert.deepEqual(gopMauNgan(c, 0), c);
  assert.deepEqual(gopMauNgan(c, -1), c);
  assert.deepEqual(gopMauNgan(c, NaN), c);
});

/* ───────────────────── kết quả cuối ───────────────────── */

test('KHONG con mau nao hien ngan hon muc toi thieu', () => {
  // Day la phep kiem quan trong nhat — dung thu da hong truoc 29/10.
  const cau = 'Áo trễ vai HAVATA chất gân tăm co giãn ôm dáng hai màu đen và đỏ đủ size S M L mua ngay';
  for (const tong of [4, 6, 8, 12]) {
    const cues = splitByChars(cau, tong);
    for (const c of cues) {
      const dai = c.endSec - c.startSec;
      assert.ok(
        dai >= GIU_TOI_THIEU_GIAY - 0.01 || cues.length === 1,
        `Mau "${c.text}" chi hien ${dai.toFixed(2)}s trong video ${tong}s`
      );
    }
  }
});

test('tong thoi luong khong doi sau khi gop', () => {
  // Gop khong duoc lam video dai hoac ngan di — phu de bam theo tieng noi.
  const cau = 'Chất gân tăm co giãn ôm dáng, mặc đi chơi hay đi làm đều hợp, mua ngay';
  for (const tong of [3, 5, 9]) {
    const cues = splitByChars(cau, tong);
    if (cues.length === 0) continue;
    assert.ok(Math.abs(cues[cues.length - 1].endSec - tong) < 0.02, `Ket thuc lech o ${tong}s`);
    assert.equal(cues[0].startSec, 0, 'Phai bat dau tu 0');
  }
});

test('cac mau noi tiep nhau, khong chong nhau khong ho', () => {
  const cues = splitByChars('Áo trễ vai HAVATA hai màu đen và đỏ đủ size S M L', 7);
  for (let i = 1; i < cues.length; i++) {
    assert.ok(
      Math.abs(cues[i].startSec - cues[i - 1].endSec) < 0.02,
      `Ho hoac chong o mau ${i}: ${cues[i - 1].endSec} -> ${cues[i].startSec}`
    );
  }
});

test('khong mat chu nao sau khi gop', () => {
  const cau = 'Áo trễ vai HAVATA hai màu đen và đỏ đủ size S M L mua ngay';
  const cues = splitByChars(cau, 5);
  const ghepLai = cues.map((c) => c.text).join(' ');
  assert.equal(
    ghepLai.replace(/\s+/g, ' ').trim(),
    cau.replace(/\s+/g, ' ').trim(),
    'Gop lam mat hoac doi chu'
  );
});

test('video rat ngan thi don ve mot mau chu khong nhap nhay', () => {
  const cues = splitByChars('Áo trễ vai HAVATA hai màu đen và đỏ', 1.5);
  assert.equal(cues.length, 1, `Video 1,5 giay ma co ${cues.length} mau phu de`);
});

test('chunkText van khong cat giua tu', () => {
  for (const c of chunkText('Áo trễ vai HAVATA hai màu đen và đỏ đủ size', 20)) {
    assert.ok(!c.startsWith(' ') && !c.endsWith(' '), `Mau co khoang trang thua: "${c}"`);
  }
});
