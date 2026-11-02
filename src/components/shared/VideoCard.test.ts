import { test } from 'vitest';
import assert from 'node:assert/strict';
import { stageOf, formatDuration } from './VideoCard';

/**
 * Giai doan cua mot the video.
 *
 * Boi canh: ngay 28/10 bang dieu khien hien 33 du an quay spinner kem dong chu
 * "Dang xu ly..." — 22 ban nhap, 7 phan tich do, 4 cho chon concept — trong khi
 * co so du lieu KHONG co mot render nao dang chay. Nguoi dung ngoi cho mot viec
 * khong bao gio toi, va thao tac duy nhat con dung duoc la xoa.
 *
 * Nen test o day canh dung mot dieu: thu dang cho NGUOI DUNG khong bao gio duoc
 * xep vao nhom may dang chay.
 */

test('xong va co file thi la ready', () => {
  assert.equal(stageOf('completed', true), 'ready');
});

test('xong nhung KHONG co file thi khong phai ready', () => {
  // Trang thai noi da xong ma khong co URL nghia la co gi do sai. Cho hien nut
  // "Chia se"/"Tai" luc nay se dan toi lien ket hong.
  assert.notEqual(stageOf('completed', false), 'ready');
});

test('that bai luon la failed, ke ca khi co file', () => {
  assert.equal(stageOf('failed', false), 'failed');
  assert.equal(stageOf('failed', true), 'failed');
});

test('MAY dang chay thi moi duoc quay spinner', () => {
  for (const s of ['renderqueued', 'rendering', 'processing', 'queued']) {
    assert.equal(stageOf(s, false), 'working', `${s} phai la working`);
  }
});

test('BAN NHAP KHONG PHAI dang xu ly — day chinh la loi 28/10', () => {
  // 22 ban nhap quay spinner vinh vien. Khong ai dang xu ly chung ca.
  assert.equal(stageOf('draft', false), 'waiting');
});

test('phan tich do, cho chon concept, cho dung: deu la cho NGUOI DUNG', () => {
  for (const s of ['analyzing', 'conceptready', 'scriptready']) {
    assert.equal(stageOf(s, false), 'waiting', `${s} phai la waiting, khong phai working`);
  }
});

test('trang thai la thi nghieng ve waiting, KHONG nghieng ve working', () => {
  // Doan sai ve phia waiting: nguoi dung thay mot nut "Tiep tuc" hoi thua.
  // Doan sai ve phia working: ho ngoi cho vinh vien. Hai cai sai khong bang nhau.
  for (const s of ['', 'trang_thai_moi_nao_do', 'deleted_pending_cleanup']) {
    assert.equal(stageOf(s, false), 'waiting', `"${s}" khong duoc quay spinner`);
  }
});

test('KHONG trang thai nao vua la ready vua khong co file', () => {
  const moi = ['draft', 'analyzing', 'conceptready', 'scriptready', 'renderqueued',
               'rendering', 'processing', 'queued', 'failed', 'completed', 'la_hoac'];
  for (const s of moi) {
    const g = stageOf(s, false);
    assert.notEqual(g, 'ready', `${s} khong co file ma van ra ready`);
  }
});

/* ── formatDuration ── */

test('do dai hop le', () => {
  assert.equal(formatDuration(25), '0:25');
  assert.equal(formatDuration(60), '1:00');
  assert.equal(formatDuration(95), '1:35');
});

test('khong ro do dai thi tra chuoi rong, KHONG bia so', () => {
  for (const v of [null, undefined, 0, -5, NaN, Infinity]) {
    assert.equal(formatDuration(v as any), '', `${v} phai cho chuoi rong`);
  }
});
