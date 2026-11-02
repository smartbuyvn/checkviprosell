/**
 * Tìm dấu bản quyền trên ảnh nguồn — phần lọc theo lặp vị trí.
 *
 * ── Vì sao phép lọc này là thứ nguy hiểm nhất ──
 *
 * Đo ngày 31/10 trên 80 ảnh thật: Tesseract đọc được dấu "HAVATA" trên đúng 6/6 ảnh
 * có dấu. Nhưng nó cũng đọc ra "LIU GEMOLOGICAL RESEARCH" (giấy chứng nhận đá quý),
 * "Hung Dao Street," (địa chỉ trên giấy đó) và "ninhle.com" (in trên vỏ hộp) — toàn
 * là nội dung của chính sản phẩm.
 *
 * Về mặt pixel, dấu của sàn và chữ in trên hộp giống hệt nhau. Lọc sai ở đây nghĩa là
 * cắt mất sản phẩm của khách.
 *
 * ── Kết quả thật của bộ lọc trên 10 dự án ──
 *
 *     2 dự án  → tìm đúng dấu HAVATA (2/4 ảnh, tại 63%,5%)
 *     6 dự án  → 0 ứng viên, loại sạch chữ của sản phẩm
 *     2 dự án  → dương tính giả ("ninhle.com" in trên hộp, và rác OCR)
 *
 * Nên khách PHẢI xác nhận. Phép kiểm cuối file canh điều đó không bị bỏ đi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gomDauLap,
  duongDocChu,
  VUNG_VIEN,
  LECH_TOI_DA,
  SO_ANH_TOI_THIEU,
  TIN_TOI_THIEU,
  type KhungChu,
} from '../src/lib/dau-anh';

const k = (x: number, y: number, text = 'MARK', tin = 90, w = 0.2, h = 0.05): KhungChu =>
  ({ x, y, w, h, text, tin });

test('chu chi thay tren MOT anh thi bi loai — do la chu cua san pham', () => {
  // "LIU GEMOLOGICAL RESEARCH" nam tren to giay chung nhan, chi mot anh co.
  const ra = gomDauLap([
    [k(0.1, 0.05, 'LIU')],
    [k(0.6, 0.9, 'Street,')],
    [],
  ]);
  assert.deepEqual(ra, [], 'Van giu chu chi thay mot lan');
});

test('chu lap vi tri tren hai anh thi thanh ung vien', () => {
  const ra = gomDauLap([
    [k(0.63, 0.05, 'HAVATA')],
    [k(0.63, 0.05, 'HAVAIA')],
    [],
  ]);
  assert.equal(ra.length, 1);
  assert.equal(ra[0].soAnh, 2);
  assert.deepEqual(ra[0].anh, [0, 1]);
});

test('khop theo VI TRI chu khong theo CHU — font serif lam T thanh I', () => {
  // Day la truong hop that: cung mot dau doc thanh HAVATA va HAVAIA.
  const ra = gomDauLap([[k(0.63, 0.05, 'HAVATA')], [k(0.63, 0.05, 'HAVAIA')]]);
  assert.equal(ra.length, 1, 'Khop theo chu nen truot mat mot nua');
});

test('chu tin cay cao nhat duoc chon de hien cho khach', () => {
  const ra = gomDauLap([
    [k(0.63, 0.05, 'HAVAIA', 83)],
    [k(0.63, 0.05, 'HAVATA', 91)],
  ]);
  assert.equal(ra[0].text, 'HAVATA', 'Hien chu doc sai cho khach');
});

test('hai dau o hai goc khac nhau KHONG bi gop lam mot', () => {
  const ra = gomDauLap([
    [k(0.05, 0.05, 'TRAI'), k(0.80, 0.05, 'PHAI')],
    [k(0.05, 0.05, 'TRAI'), k(0.80, 0.05, 'PHAI')],
  ]);
  assert.equal(ra.length, 2, 'Gop nham hai dau o hai goc');
});

test('lech nho hon nguong van coi la cung mot dau', () => {
  const nhich = LECH_TOI_DA * 0.8;
  const ra = gomDauLap([[k(0.63, 0.05)], [k(0.63 + nhich, 0.05)]]);
  assert.equal(ra.length, 1, `Lech ${nhich.toFixed(3)} dang le van la mot dau`);
});

test('lech lon hon nguong thi la hai dau khac nhau', () => {
  const xa = LECH_TOI_DA * 2.5;
  const ra = gomDauLap([[k(0.2, 0.05)], [k(0.2 + xa, 0.05)]]);
  assert.equal(ra.length, 0, 'Gop hai vi tri cach xa nhau roi loai ca hai');
});

test('khung bao la GOP cua moi lan thay, khong phai lan dau', () => {
  // Cat tranh phai ne duoc MOI lan xuat hien, neu khong lan rong hon van lo dau.
  // Tâm hai khung lệch 0,05 — dưới ngưỡng 0,06 nên vẫn là một dấu.
  const ra = gomDauLap([
    [{ x: 0.60, y: 0.04, w: 0.20, h: 0.05, text: 'A', tin: 90 }],  // tâm x 0,70
    [{ x: 0.63, y: 0.05, w: 0.24, h: 0.07, text: 'A', tin: 90 }],  // tâm x 0,75
  ]);
  assert.equal(ra.length, 1, 'Hai khung lech 0,05 dang le phai gop lam mot');
  assert.ok(Math.abs(ra[0].x - 0.60) < 1e-9, 'Khung bao khong lay mep trai nho nhat');
  assert.ok(Math.abs((ra[0].x + ra[0].w) - 0.87) < 1e-9, 'Khung bao khong lay mep phai lon nhat');
  assert.ok(Math.abs(ra[0].y - 0.04) < 1e-9, 'Khung bao khong lay mep tren cao nhat');
  assert.ok(Math.abs((ra[0].y + ra[0].h) - 0.12) < 1e-9, 'Khung bao khong phu het chieu cao');
});

test('dau tren nhieu anh hon duoc xep truoc', () => {
  const ra = gomDauLap([
    [k(0.1, 0.05, 'IT'), k(0.7, 0.05, 'NHIEU')],
    [k(0.7, 0.05, 'NHIEU')],
    [k(0.7, 0.05, 'NHIEU')],
    [k(0.1, 0.05, 'IT')],
  ]);
  assert.equal(ra[0].text, 'NHIEU', 'Khong xep dau chac chan nhat len truoc');
  assert.equal(ra[0].soAnh, 3);
});

test('du lieu rong hoac hong khong lam no', () => {
  assert.deepEqual(gomDauLap([]), []);
  assert.deepEqual(gomDauLap([[], [], []]), []);
  assert.deepEqual(gomDauLap([null as never, undefined as never]), []);
});

test('nguong so anh toi thieu la 2 — mot lan khong du lam bang chung', () => {
  assert.equal(SO_ANH_TOI_THIEU, 2);
  assert.equal(gomDauLap([[k(0.6, 0.05)]]).length, 0, 'Mot anh ma da ket luan la dau');
});

/* ── Vùng quét ── */

test('quet DAI NGANG toan be rong, khong quet bon o goc', () => {
  // Dau "HAVATA Basic Fashion" nam o GIUA DINH anh, lot dung khe giua cac o goc.
  const tren = VUNG_VIEN.find((v) => v.ten === 'tren');
  assert.ok(tren, 'Khong co vung tren');
  assert.equal(tren!.w, 1, 'Vung tren khong phu het be rong — se bo sot dau o giua dinh');
  const duoi = VUNG_VIEN.find((v) => v.ten === 'duoi');
  assert.equal(duoi!.w, 1, 'Vung duoi khong phu het be rong');
});

test('KHONG quet phan giua khung — do la cho cua san pham', () => {
  for (const v of VUNG_VIEN) {
    const chamGiua = v.x < 0.45 && v.x + v.w > 0.55 && v.y < 0.45 && v.y + v.h > 0.55;
    assert.ok(!chamGiua, `Vung "${v.ten}" phu ca giua khung — se doc chu tren san pham`);
  }
});

test('moi vung nam tron trong khung anh', () => {
  for (const v of VUNG_VIEN) {
    assert.ok(v.x >= 0 && v.y >= 0, `Vung "${v.ten}" co toa do am`);
    assert.ok(v.x + v.w <= 1.0001 && v.y + v.h <= 1.0001, `Vung "${v.ten}" tran ra ngoai anh`);
  }
});

test('mac dinh TAT — khong chay Tesseract khi chua ai cau hinh', () => {
  const truoc = process.env.DOC_CHU_BIN;
  delete process.env.DOC_CHU_BIN;
  try {
    assert.equal(duongDocChu(), '');
  } finally {
    if (truoc !== undefined) process.env.DOC_CHU_BIN = truoc;
  }
});

test('nguong tin cay du cao de bo rac', () => {
  // Duoi muc nay Tesseract tra ve nhung thu nhu "\", "©", "|".
  assert.ok(TIN_TOI_THIEU >= 60, `Nguong ${TIN_TOI_THIEU} qua thap, se nhan ca rac`);
});

test('KHONG duoc xoa dau tu dong — khach phai xac nhan', () => {
  /**
   * Do that tren 10 du an: 2 tim dung dau, 6 loai sach, nhung 2 van cho duong tinh
   * gia — "ninhle.com" in tren vo hop, va rac OCR doc thanh "qua"/"rad".
   *
   * Xoa tu dong nhung thu do la cat mat san pham cua khach. Phep kiem nay canh rang
   * khong ai bo buoc xac nhan di cho tien.
   */
  const lib = readFileSync(join(__dirname, '..', 'src', 'lib', 'dau-anh.ts'), 'utf8');
  assert.match(lib, /khách xác nhận|Khách xác nhận|khach xac nhan/i,
    'Tai lieu trong lib khong con nhac toi buoc khach xac nhan');
  // `gomDauLap` tra ve UNG VIEN, khong tra ve quyet dinh.
  assert.match(lib, /DauUngVien/, 'Doi ten kieu tra ve — kiem lai rang no van la ung vien');
});
