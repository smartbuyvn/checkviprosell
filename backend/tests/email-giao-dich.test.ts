/**
 * Thư giao dịch: nội dung phải đúng, và gửi hỏng KHÔNG được làm vỡ đường tiền.
 *
 * ── Vì sao điều thứ hai quan trọng hơn ──
 *
 * `baoThanhToanXong` được gọi trong webhook SePay, ngay sau khi credit đã cộng. Nếu
 * nó ném lỗi — nhà cung cấp email chết, mạng rớt, hồ sơ thiếu email — thì webhook vỡ
 * và SePay sẽ gửi lại. Khách đã trả tiền, credit đã vào, mà hệ thống vẫn báo lỗi.
 *
 * Nội dung thư cũng phải đúng vì đó là thứ khách đọc và là thứ dễ sai nhất: số tiền,
 * số credit, số dư sau giao dịch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  thuThanhToanThanhCong,
  thuVideoDaXong,
  thuRutHoaHong,
} from '../src/lib/email-templates';
import { htmlToText, looksLikeEmail } from '../src/services/email.provider';

const NOTIFY = readFileSync(join(__dirname, '..', 'src', 'services', 'email.notify.ts'), 'utf8');
const WEBHOOK = readFileSync(join(__dirname, '..', 'src', 'routes', 'webhooks.ts'), 'utf8');
const RENDER = readFileSync(join(__dirname, '..', 'src', 'routes', 'render.ts'), 'utf8');

/* ─────────────── đã nối vào đúng chỗ chưa ─────────────── */

test('webhook thanh toan CO goi thu — khong phai viet roi de day', () => {
  // Ngay 29/10 ca hai file email deu ton tai ma khong mot cho nao goi: dung khuon
  // "ham viet du, cho dung khong noi" da lap lai nhieu lan trong du an nay.
  assert.match(WEBHOOK, /baoThanhToanXong\(/, 'Webhook phai goi baoThanhToanXong');
});

test('callback render CO goi thu video', () => {
  assert.match(RENDER, /baoVideoXong\(/, 'Callback phai goi baoVideoXong');
});

test('thu gui SAU khi cong credit, khong phai truoc', () => {
  // Thu noi "credit da vao tai khoan". Gui truoc khi cong la noi sai.
  const iCong = WEBHOOK.indexOf('CreditService.grantToLedger');
  const iThu = WEBHOOK.indexOf('baoThanhToanXong(');
  assert.ok(iCong > 0 && iThu > iCong, 'baoThanhToanXong phai nam SAU grantToLedger');
});

test('thu video gui SAU khi tru credit thanh cong', () => {
  const iTru = RENDER.indexOf('deductToLedger');
  const iThu = RENDER.indexOf('baoVideoXong(');
  assert.ok(iTru > 0 && iThu > iTru, 'baoVideoXong phai nam SAU deductToLedger');
});

test('KHONG await thu — duong tien khong duoc cho mot la thu', () => {
  for (const [ten, src, ham] of [['webhook', WEBHOOK, 'baoThanhToanXong'], ['render', RENDER, 'baoVideoXong']] as const) {
    assert.ok(src.includes(`void ${ham}(`), `${ten} phai goi \`void ${ham}(\`, khong await`);
    assert.ok(!src.includes(`await ${ham}(`), `${ten} dang await ${ham} — webhook se cho email`);
  }
});

test('moi ham bao thu deu nuot loi tai cho', () => {
  // Nguoi goi khong bat loi, nen ham phai tu bat. Thieu mot `catch` la mot duong
  // lam vo webhook.
  const soTry = (NOTIFY.match(/try \{/g) || []).length;
  const soCatch = (NOTIFY.match(/\} catch/g) || []).length;
  assert.ok(soTry >= 3, `Chi co ${soTry} khoi try — phai co it nhat 3 ham bao thu`);
  assert.equal(soCatch, soTry, 'Moi try phai co catch');
});

/* ─────────────── nội dung thư ─────────────── */

test('thu thanh toan neu du so tien, credit va SO DU SAU', () => {
  const t = thuThanhToanThanhCong({
    tenGoi: 'starter',
    soTien: 129000,
    creditNhan: 30,
    soDuSau: 48,
    linkBangDieuKhien: 'https://v.ninhle.com/dashboard',
  });
  const chu = htmlToText(t.html);
  assert.match(chu, /129\.000₫/, 'Phai co so tien dinh dang Viet');
  assert.match(chu, /30 credit/, 'Phai neu so credit nhan duoc');
  assert.match(chu, /48 credit/, 'Phai neu SO DU SAU — con so khach that su muon biet');
  assert.match(t.subject, /starter/i);
});

test('thu thanh toan hien thuong gioi thieu khi co', () => {
  const co = htmlToText(thuThanhToanThanhCong({
    tenGoi: 'pro', soTien: 249000, creditNhan: 80, creditThuong: 8, soDuSau: 88,
    linkBangDieuKhien: '/',
  }).html);
  assert.match(co, /\+8 credit/, 'Phai neu phan thuong');

  const khong = htmlToText(thuThanhToanThanhCong({
    tenGoi: 'pro', soTien: 249000, creditNhan: 80, creditThuong: 0, soDuSau: 80,
    linkBangDieuKhien: '/',
  }).html);
  assert.ok(!/Thưởng giới thiệu/.test(khong), 'Khong co thuong thi khong hien dong do');
});

test('thu video neu HAN LUU TRU — khach khong biet thi mat video', () => {
  const chu = htmlToText(thuVideoDaXong({
    tenVideo: 'Áo trễ vai HAVATA',
    linkVideo: 'https://v.ninhle.com/v/abc',
    soCreditDaTru: 2,
    soDuSau: 46,
    soNgayLuu: 30,
  }).html);
  assert.match(chu, /30 ngày/, 'Phai noi truoc han luu tru');
  assert.match(chu, /2 credit/);
  assert.match(chu, /46 credit/);
});

test('bon trang thai rut tien cho ra bon noi dung khac nhau', () => {
  const tieuDe = (['requested', 'approved', 'paid', 'rejected'] as const).map(
    (tt) => thuRutHoaHong({ soTien: 500000, trangThai: tt, linkDoiTac: '/' }).subject
  );
  assert.equal(new Set(tieuDe).size, 4, `Tieu de bi trung: ${tieuDe.join(' | ')}`);
  for (const t of tieuDe) assert.ok(t.length > 5, 'Tieu de qua ngan');
});

test('thu tu choi KHONG doa khach mat tien', () => {
  const chu = htmlToText(thuRutHoaHong({ soTien: 500000, trangThai: 'rejected', linkDoiTac: '/' }).html);
  assert.match(chu, /vẫn nằm nguyên|vẫn còn/, 'Phai tran an rang tien khong mat');
});

test('HTML thu dung bang, khong dung flexbox/grid', () => {
  // Hop thu dien tu cat bo CSS hien dai. Tha xau deu con hon dep mot noi vo cho khac.
  const html = thuThanhToanThanhCong({
    tenGoi: 'pro', soTien: 1, creditNhan: 1, soDuSau: 1, linkBangDieuKhien: '/',
  }).html;
  assert.ok(!/display:\s*flex/.test(html), 'Khong duoc dung flexbox');
  assert.ok(!/display:\s*grid/.test(html), 'Khong duoc dung grid');
  assert.match(html, /<table/, 'Phai dung bang de bo cuc');
});

test('du lieu bien khong lam vo mau thu', () => {
  assert.doesNotThrow(() => thuThanhToanThanhCong({
    tenGoi: '', soTien: 0, creditNhan: 0, soDuSau: 0, linkBangDieuKhien: '',
  }));
  assert.doesNotThrow(() => thuVideoDaXong({
    tenVideo: '', linkVideo: '', soCreditDaTru: 0, soDuSau: 0, soNgayLuu: 0,
  }));
});

/* ─────────────── địa chỉ nhận ─────────────── */

test('chan dia chi hong truoc khi ton mot lan goi mang', () => {
  for (const x of ['', '   ', 'khong-co-a-cong', 'a@b', 'a@@b.com', 'co khoang@trang.com', null, undefined]) {
    assert.equal(looksLikeEmail(x as never), false, `Phai chan: ${JSON.stringify(x)}`);
  }
  for (const x of ['a@b.com', 'nguoi.ban+tag@shop.vn']) {
    assert.equal(looksLikeEmail(x), true, `Phai cho qua: ${x}`);
  }
});

test('ban chu thuan bo het the HTML', () => {
  const chu = htmlToText('<p>Xin chào<br>bạn</p><a href="#">bấm</a>&amp;');
  assert.ok(!chu.includes('<'), 'Con sot the HTML');
  assert.match(chu, /Xin chào/);
  assert.match(chu, /&/, 'Phai giai ma &amp;');
});
