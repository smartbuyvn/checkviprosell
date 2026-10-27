/**
 * Ma don hang (ref) — chong lai loi that: webhook doan goi theo so tien.
 *
 * Truoc day noi dung chuyen khoan la "VIPRO <8 hex dau cua user id>", gan voi NGUOI
 * chu khong phai DON HANG, nen moi don cua cung mot khach deu giong het nhau va
 * webhook khong the biet ho mua goi nao.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOrderRef, parseOrderRef, parseTransferCode } from '../src/lib/security';

test('ma don hang dung dinh dang P + 7 ky tu', () => {
  for (let i = 0; i < 50; i++) {
    const r = generateOrderRef();
    assert.equal(r.length, 8, `do dai sai: ${r}`);
    assert.ok(/^P[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/.test(r), `sai dinh dang: ${r}`);
  }
});

test('khong dung ky tu de doc nham: 0 O 1 I L', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) for (const c of generateOrderRef().slice(1)) seen.add(c);
  for (const bad of ['0', 'O', '1', 'I', 'L']) assert.ok(!seen.has(bad), `van sinh ra "${bad}"`);
});

test('ma don hang gan nhu khong trung nhau', () => {
  const s = new Set(Array.from({ length: 2000 }, () => generateOrderRef()));
  assert.ok(s.size > 1990, `trung qua nhieu: chi co ${s.size}/2000 ma khac nhau`);
});

test('doc duoc ma tu noi dung chuyen khoan that cua ngan hang', () => {
  assert.equal(parseOrderRef('NGUYEN VAN A CK VIPRO P7K3M9QX'), 'P7K3M9QX'.toUpperCase());
  assert.equal(parseOrderRef('VIPROP7K3M9QX'), 'P7K3M9QX');           // ngan hang bo khoang trang
  assert.equal(parseOrderRef('vipro p7k3m9qx chuyen tien'), 'P7K3M9QX'); // chu thuong
});

test('khong co ma thi tra null, khong doan bua', () => {
  for (const c of ['CHUYEN TIEN', '', 'VIPRO', 'VIPRO 123'])
    assert.equal(parseOrderRef(c), null, `khong duoc nhan dien: "${c}"`);
});

test('MA DON HANG va MA NGUOI DUNG khong bao gio lan nhau', () => {
  // Ma nguoi dung = 8 ky tu hex. Ma don hang bat dau bang 'P' (khong phai hex).
  const user = 'VIPRO a1b2c3d4';
  assert.equal(parseTransferCode(user), 'a1b2c3d4');
  assert.equal(parseOrderRef(user), null, 'ma nguoi dung bi nham thanh ma don hang');

  const order = 'VIPRO P7K3M9QX';
  assert.equal(parseOrderRef(order), 'P7K3M9QX');
  assert.equal(parseTransferCode(order), null, 'ma don hang bi nham thanh ma nguoi dung');
});

test('ma sinh ra that su khong bi nham thanh ma nguoi dung', () => {
  for (let i = 0; i < 200; i++) {
    const content = `CK VIPRO ${generateOrderRef()}`;
    assert.equal(parseTransferCode(content), null, `bi nham: ${content}`);
    assert.ok(parseOrderRef(content), `khong doc duoc: ${content}`);
  }
});
