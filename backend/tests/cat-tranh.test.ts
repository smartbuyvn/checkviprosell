/**
 * Cắt tránh dấu bản quyền.
 *
 * ── Vì sao cắt tránh chứ không xoá ──
 *
 * Đo ngày 31/10 trên ảnh thật 2752×1536, dấu chữ chiếm 1,8% diện tích ở góc:
 *
 *     chưa xử lý ............... SSIM 0,9803
 *     sau `delogo` ............. SSIM 0,9837, để lại VỆT KÉO DỌC ngay trên nền phẳng
 *     cắt viền 8% đều .......... mất 29% diện tích, dấu vẫn sót
 *     **cắt tránh dải dấu** .... mất **10%** diện tích, không vệt nào
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tinhKhungTranh, bieuThucCrop, GIU_TOI_THIEU, NOI_THEM, type Khung } from '../src/lib/cat-tranh';

const dt = (k: Khung) => k.w * k.h;
/** Hai khung có chạm nhau không. */
const cham = (a: Khung, b: Khung) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test('khong co dau thi giu nguyen ca khung', () => {
  for (const x of [[], null, undefined]) {
    const r = tinhKhungTranh(x as never);
    assert.deepEqual(r.khung, { x: 0, y: 0, w: 1, h: 1 });
    assert.equal(r.giuLai, 1);
  }
});

test('dau HAVATA that: goc tren phai 63%,5% co 34x7% — ne duoc, giu phan lon anh', () => {
  const dau: Khung = { x: 0.63, y: 0.05, w: 0.34, h: 0.07 };
  const r = tinhKhungTranh([dau]);

  assert.ok(!cham(r.khung, dau), 'Khung cat van cham vao dau');
  // Ne bang cach bo dai tren: giu tu y = 0,05+0,07+noi tro xuong.
  assert.ok(r.giuLai > 0.85, `Chi giu ${Math.round(r.giuLai * 100)}%, dang le phai hon 85%`);
});

test('ne xong thi dau nam HOAN TOAN ngoai khung', () => {
  const cacDau: Khung[][] = [
    [{ x: 0.63, y: 0.05, w: 0.34, h: 0.07 }],              // tren phai
    [{ x: 0.02, y: 0.88, w: 0.25, h: 0.08 }],              // duoi trai
    [{ x: 0.00, y: 0.00, w: 1.00, h: 0.12 }],              // ca dai tren
    [{ x: 0.39, y: 0.12, w: 0.22, h: 0.06 }],              // giua dinh
  ];
  for (const dau of cacDau) {
    const r = tinhKhungTranh(dau);
    for (const d of dau) {
      assert.ok(!cham(r.khung, d),
        `Dau tai ${d.x},${d.y} van nam trong khung ${JSON.stringify(r.khung)}`);
    }
  }
});

test('noi them quanh dau de khong lo bong do', () => {
  // Khung bao cua Tesseract bam sat net chu; cat sat mep van lo phan mo quanh dau.
  const dau: Khung = { x: 0, y: 0, w: 1, h: 0.10 };
  const r = tinhKhungTranh([dau]);
  assert.ok(r.khung.y >= 0.10 + NOI_THEM - 1e-9,
    `Cat tu ${r.khung.y}, chua noi du ${NOI_THEM} quanh dau`);
});

test('chon cach ne GIU DUOC NHIEU NHAT', () => {
  // Dau o sat mep tren: ne bang cach bo dai tren (mat 12%) tot hon bo dai duoi (mat 88%).
  const r = tinhKhungTranh([{ x: 0, y: 0, w: 1, h: 0.10 }]);
  assert.ok(r.giuLai > 0.8, `Chon nham huong ne, chi giu ${Math.round(r.giuLai * 100)}%`);
});

test('ne nhieu dau cung luc', () => {
  const dau: Khung[] = [
    { x: 0.63, y: 0.03, w: 0.34, h: 0.07 },
    { x: 0.02, y: 0.90, w: 0.25, h: 0.06 },
  ];
  const r = tinhKhungTranh(dau);
  for (const d of dau) assert.ok(!cham(r.khung, d), `Con cham dau tai ${d.x},${d.y}`);
  assert.ok(r.giuLai > 0.7, `Giu ${Math.round(r.giuLai * 100)}%, mat qua nhieu`);
});

test('dau GIUA anh thi BO QUA — ne se mat ca san pham', () => {
  /**
   * Day la gioi han that cua cat tranh, va no phai that bai MOT CACH AN TOAN:
   * tha de nguyen dau con hon cat mat san pham.
   */
  const giua: Khung = { x: 0.35, y: 0.40, w: 0.30, h: 0.20 };
  const r = tinhKhungTranh([giua]);
  assert.ok(r.giuLai >= GIU_TOI_THIEU, `Giu ${Math.round(r.giuLai * 100)}%, duoi nguong an toan`);
  assert.match(r.moTa, /bo qua/, 'Khong noi ro la da bo qua dau nay');
});

test('KHONG BAO GIO cat duoi nguong an toan', () => {
  // Du nhieu dau rai khap anh, van phai giu lai du de con nhin ra san pham.
  const nhieu: Khung[] = [
    { x: 0, y: 0, w: 1, h: 0.2 }, { x: 0, y: 0.8, w: 1, h: 0.2 },
    { x: 0, y: 0, w: 0.2, h: 1 }, { x: 0.8, y: 0, w: 0.2, h: 1 },
    { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
  ];
  const r = tinhKhungTranh(nhieu);
  assert.ok(r.giuLai >= GIU_TOI_THIEU, `Giu ${Math.round(r.giuLai * 100)}%, duoi nguong ${GIU_TOI_THIEU}`);
});

test('khung tra ve luon nam tron trong anh', () => {
  const thu: Khung[][] = [
    [{ x: 0.63, y: 0.05, w: 0.34, h: 0.07 }],
    [{ x: -0.1, y: -0.1, w: 0.5, h: 0.5 }],
    [{ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }],
  ];
  for (const d of thu) {
    const k = tinhKhungTranh(d).khung;
    assert.ok(k.x >= -1e-9 && k.y >= -1e-9, `Khung co toa do am: ${JSON.stringify(k)}`);
    assert.ok(k.x + k.w <= 1 + 1e-9 && k.y + k.h <= 1 + 1e-9, `Khung tran ra ngoai: ${JSON.stringify(k)}`);
    assert.ok(k.w > 0 && k.h > 0, `Khung rong: ${JSON.stringify(k)}`);
  }
});

test('khung hong (rong 0, am) bi bo qua, khong lam no', () => {
  const r = tinhKhungTranh([
    { x: 0.5, y: 0.5, w: 0, h: 0.1 },
    { x: 0.5, y: 0.5, w: -0.2, h: 0.1 },
    null as never,
  ]);
  assert.deepEqual(r.khung, { x: 0, y: 0, w: 1, h: 1 });
});

/* ── Biểu thức ffmpeg ── */

test('khung day du thi KHONG sinh bieu thuc crop', () => {
  // Them mot phep cat khong cat gi chi lam chuoi filter dai ra.
  assert.equal(bieuThucCrop({ x: 0, y: 0, w: 1, h: 1 }), '');
});

test('bieu thuc crop dung thu tu w:h:x:y cua ffmpeg', () => {
  const s = bieuThucCrop({ x: 0.1, y: 0.2, w: 0.8, h: 0.7 });
  assert.match(s, /^crop=iw\*0\.8000:ih\*0\.7000:iw\*0\.1000:ih\*0\.2000$/,
    `Bieu thuc sai thu tu hoac dinh dang: ${s}`);
});

test('bieu thuc cua khung ne dau that doc duoc', () => {
  const r = tinhKhungTranh([{ x: 0.63, y: 0.05, w: 0.34, h: 0.07 }]);
  const s = bieuThucCrop(r.khung);
  assert.ok(s.startsWith('crop=iw*'), `Khong sinh crop: "${s}"`);
  assert.doesNotMatch(s, /NaN|undefined|-/, `Bieu thuc chua gia tri hong: ${s}`);
});
