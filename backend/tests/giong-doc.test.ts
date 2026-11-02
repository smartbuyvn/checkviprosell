/**
 * Chọn giọng đọc.
 *
 * ── Danh sách lấy từ nhà cung cấp, không đoán ──
 *
 * Ngày 30/10/2026 gửi một mã giọng sai và nhà cung cấp trả về danh sách hợp lệ:
 *
 *   unknown voice 'leminh'. Available: fci_phuongan, fci_xuantoan, std_banmai,
 *   std_kimngan, std_minhquang, std_quanganh, std_vietkhoa
 *
 * Đã chạy thử cả bảy, tất cả tổng hợp được (2,59–2,92 giây cho cùng một câu).
 *
 * ── Vì sao không được ném lỗi ──
 *
 * Mã giọng sai làm nhà cung cấp trả HTTP 400, và lỗi đó xảy ra SAU khi đã tiêu tiền
 * cho bốn tầng LLM. Một mã lạ phải lùi về mặc định, không được giết cả lần dựng.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chonGiong, gioiTinhCua, BANG_GIONG } from '../src/lib/giong-doc';

/** Danh sách nhà cung cấp tự khai, chép nguyên văn. */
const NHA_CUNG_CAP_HO_TRO = [
  'fci_phuongan', 'fci_xuantoan', 'std_banmai', 'std_kimngan',
  'std_minhquang', 'std_quanganh', 'std_vietkhoa',
];

test('bang giong khop DUNG danh sach nha cung cap ho tro', () => {
  // Them mot ma khong co that vao bang la mot lan dung video hong o buoc cuoi.
  const coTrongBang = BANG_GIONG.map((g) => g.ma).sort();
  assert.deepEqual(coTrongBang, [...NHA_CUNG_CAP_HO_TRO].sort());
});

test('co ca giong nam lan giong nu', () => {
  const nu = BANG_GIONG.filter((g) => g.gioiTinh === 'nu');
  const nam = BANG_GIONG.filter((g) => g.gioiTinh === 'nam');
  assert.ok(nu.length >= 1, 'Thieu giong nu');
  assert.ok(nam.length >= 1, 'Thieu giong nam');
});

test('chon theo gioi tinh tra ve dung gioi do', () => {
  assert.equal(gioiTinhCua(chonGiong('nu')), 'nu');
  assert.equal(gioiTinhCua(chonGiong('nam')), 'nam');
});

test('nhan ca tieng Viet co dau lan tieng Anh', () => {
  for (const x of ['nu', 'nữ', 'female', 'NU', ' Nữ ']) {
    assert.equal(gioiTinhCua(chonGiong(x)), 'nu', `Khong nhan "${x}"`);
  }
  for (const x of ['nam', 'male', 'NAM', ' Nam ']) {
    assert.equal(gioiTinhCua(chonGiong(x)), 'nam', `Khong nhan "${x}"`);
  }
});

test('ma day du duoc dung nguyen', () => {
  for (const ma of NHA_CUNG_CAP_HO_TRO) {
    assert.equal(chonGiong(ma), ma, `Ma ${ma} bi doi`);
  }
});

test('ma LA lui ve mac dinh, KHONG nem loi', () => {
  // Nha cung cap tra HTTP 400 cho ma sai, SAU khi da tieu tien bon tang LLM.
  for (const x of ['leminh', 'banmai', 'khong-ton-tai', '', '   ', null, undefined, 123]) {
    let ra: string | undefined;
    assert.doesNotThrow(() => { ra = chonGiong(x as never); }, `Nem loi voi ${JSON.stringify(x)}`);
    assert.ok(
      NHA_CUNG_CAP_HO_TRO.includes(ra!),
      `Tra ve ma khong hop le "${ra}" cho dau vao ${JSON.stringify(x)}`
    );
  }
});

test('ket qua LUON la ma nha cung cap chap nhan', () => {
  // Phep kiem bao trum: du dau vao la gi, dau ra phai goi duoc.
  const thu = ['nu', 'nam', 'std_banmai', 'rac', '', 'Nữ', 'MALE', '!@#$'];
  for (const x of thu) {
    assert.ok(NHA_CUNG_CAP_HO_TRO.includes(chonGiong(x)), `"${x}" -> "${chonGiong(x)}" khong hop le`);
  }
});

test('moi giong co ten va mo ta doc duoc cho nguoi ban', () => {
  for (const g of BANG_GIONG) {
    assert.ok(g.ten.length >= 2, `${g.ma} thieu ten`);
    assert.ok(g.moTa.length >= 5, `${g.ma} thieu mo ta`);
    // Khong duoc lo ma noi bo ra giao dien.
    assert.ok(!g.ten.includes('_'), `Ten "${g.ten}" trong nhu ma noi bo`);
  }
});

test('worker CO truyen giong xuong, khong chi dung .env', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const worker = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');
  assert.match(worker, /voice:\s*giongDung/, 'Worker khong truyen giong vao synthesize');
  assert.match(worker, /chonGiong\(payload\.raw_input\?\.voice\)/, 'Worker khong doc voice tu raw_input');
});
