/**
 * Nâng độ phân giải ảnh sản phẩm trước khi dựng.
 *
 * ── Vì sao đây là việc đáng làm nhất cho chất lượng ──
 *
 * Đo ngày 30/10 trên 40 ảnh khách đã tải lên: trung vị chiều ngắn 1024px, nhỏ nhất
 * 300px, chỉ 16/40 đủ pixel để cắt cận `detail_macro` 1,28× mà vẫn nét ở khung 1080.
 *
 * Mất nét khi cắt cận, so với cùng ảnh ở 2400px (SSIM đo thật):
 *
 *      600px → 0,9101     1024px → 0,9677     1382px → 0,9811     2000px → 0,9909
 *
 * Khoảng cách 1024 ↔ 2000 là **0,023**, gấp mười lần chênh lệch 0,0024 giữa hai bộ
 * mã hoá mà tôi đã cân nhắc kỹ ngày 29/10.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canNang, duongBoNang, PX_CAN_CO, PX_TOI_THIEU, PX_TRAN } from '../src/lib/nang-anh';
import { PX_CHO_CAN_CANH, soCanhMoiAnh, sucChuaGiay, mocThoiLuongChoPhep } from '../src/lib/credit-cost';

test('nguong nang anh KHOP nguong cat can ben bang gia', () => {
  // Hai con so nay phai bang nhau, neu khong he thong nang anh toi mot khổ ma bang
  // gia van coi la chua du — khach tra tien cho mot buoc khong mo duoc gi.
  assert.equal(PX_CAN_CO, PX_CHO_CAN_CANH, 'Nguong lech giua nang-anh.ts va credit-cost.ts');
  assert.equal(PX_CAN_CO, Math.round(1080 * 1.28), 'Nguong khong con bang 1080 x 1,28 cua detail_macro');
});

test('anh da du net thi KHONG nang — khong tieu GPU vo ich', () => {
  for (const px of [PX_CAN_CO, 1600, 2400]) {
    const r = canNang(px);
    assert.equal(r.nen, false, `${px}px van bi nang`);
    assert.match(r.lyDo, /du net/, `Ly do khong noi ro vi sao bo qua ${px}px`);
  }
});

test('anh thieu net trong tam voi tay thi nang', () => {
  for (const px of [PX_TOI_THIEU, 600, 800, 1024, 1200, PX_CAN_CO - 1]) {
    assert.equal(canNang(px).nen, true, `${px}px dang le phai duoc nang`);
  }
});

test('anh QUA nho thi khong nang — phong 4x cung khong du', () => {
  // Real-ESRGAN phong 4x, nen duoi `PX_CAN_CO / 4` la vo vong.
  assert.equal(PX_TOI_THIEU, Math.ceil(PX_CAN_CO / 4));
  for (const px of [100, 300, PX_TOI_THIEU - 1]) {
    const r = canNang(px);
    assert.equal(r.nen, false, `${px}px van bi nang du nang xong cung khong du`);
    assert.match(r.lyDo, /qua nho/);
  }
});

test('khong do duoc kich thuoc thi khong nang, va noi ro ly do', () => {
  for (const x of [null, undefined, 0, -5, NaN, 'abc']) {
    const r = canNang(x as never);
    assert.equal(r.nen, false);
    assert.ok(r.lyDo.length > 0, `Khong noi ly do cho ${JSON.stringify(x)}`);
  }
});

test('mac dinh TAT — khong bat dau mot tien trinh la khi chua ai cau hinh', () => {
  const truoc = process.env.NANG_ANH_BIN;
  delete process.env.NANG_ANH_BIN;
  try {
    assert.equal(duongBoNang(), '');
  } finally {
    if (truoc !== undefined) process.env.NANG_ANH_BIN = truoc;
  }
});

test('tran dau ra du cho khung dung lon nhat', () => {
  // Khung cao nhat he thong dung la 1920. Tran phai hon the de con cho cat can.
  assert.ok(PX_TRAN >= 1920 * 1.2, `Tran ${PX_TRAN}px khong du cho khung 1920 cat can`);
});

/* ── Lợi ích kép: mở mốc thời lượng dài hơn ── */

test('bat nang anh thi anh trung vi 1024px ganh duoc 3 canh thay vi 2', () => {
  assert.equal(soCanhMoiAnh(1024, false), 2);
  assert.equal(soCanhMoiAnh(1024, true), 3, 'Bat nang anh ma van chi 2 canh');
});

test('nang anh KHONG cuu duoc anh qua nho', () => {
  // 300px la tam nho nhat do duoc trong 40 anh that. Nang 4x ra 1200px, van duoi 1382.
  assert.equal(soCanhMoiAnh(300, true), 1, 'Anh 300px khong duoc coi nhu da du net');
  assert.ok(300 < PX_CHO_CAN_CANH / 4);
});

test('ba anh trung vi mo duoc moc 30 giay khi bat nang anh', () => {
  const anh = [{ canhNgan: 1024 }, { canhNgan: 1024 }, { canhNgan: 1024 }];
  const tat = sucChuaGiay({ anh });
  const bat = sucChuaGiay({ anh, seNangAnh: true });

  assert.equal(tat, 21, 'Suc chua khi TAT da doi — kiem lai phep do goc');
  assert.ok(bat > tat, 'Bat nang anh khong tang suc chua');
  assert.ok(
    mocThoiLuongChoPhep({ anh, seNangAnh: true }).some((m) => m.giay === 30),
    'Ba anh 1024px van khong mo duoc moc 30 giay du da bat nang anh'
  );
  assert.ok(
    !mocThoiLuongChoPhep({ anh }).some((m) => m.giay === 30),
    'Moc 30 giay mo san ca khi TAT — phep kiem nay mat y nghia'
  );
});

test('worker goi buoc nang anh sau khi chuan hoa', () => {
  const s = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');
  assert.match(s, /nangAnh\(/, 'Worker khong goi nangAnh');
  // Phai nang SAU chuan hoa: bo nang khong doc duoc WebP dong.
  assert.ok(
    s.indexOf('await chuanHoaAnh(dich)') < s.indexOf('await nangAnh('),
    'Nang anh chay TRUOC chuan hoa — bo nang se gap dinh dang no khong doc duoc'
  );
});

test('worker noi ro nang anh dang bat hay tat luc khoi dong', () => {
  const s = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');
  assert.match(s, /Nang anh: BAT/, 'Khong bao khi bat');
  assert.match(s, /Nang anh: TAT/, 'Khong bao khi tat — se khong ai biet vi sao anh van mem');
});
