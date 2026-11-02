import { test } from 'node:test';
import assert from 'node:assert/strict';
import { framePlan } from '../src/services/video-edit.service';
import { MAX_FRAMES } from '../src/prompts/video/call1-read-clip';

/**
 * Chon moc trich khung gui cho model thi giac.
 *
 * Moi khung la khoang 1.600 token dau vao — day la phan DAT NHAT cua luong dung clip,
 * va la phan ban de xuat 28/10 khong nhac toi khi de nghi 12 khung. Sau khung du cho
 * mot clip 30 giay: hiem khi co qua 6 canh khac nhau trong tung do thoi gian.
 */

test('khong bao gio vuot tran so khung', () => {
  for (const d of [1, 5, 15, 30, 60, 300]) {
    assert.ok(framePlan(d).length <= MAX_FRAMES, `clip ${d}s sinh ${framePlan(d).length} khung`);
  }
});

test('moi moc deu nam TRONG clip', () => {
  for (const d of [2, 8, 30]) {
    for (const ms of framePlan(d)) {
      assert.ok(ms >= 0 && ms <= d * 1000, `clip ${d}s co moc ${ms}ms nam ngoai`);
    }
  }
});

test('bo nua giay dau va cuoi — do la luc tay con cham may', () => {
  const moc = framePlan(30);
  assert.ok(moc[0] >= 400, `khung dau o ${moc[0]}ms, chua bo doan rung`);
  assert.ok(moc[moc.length - 1] <= 29_600, `khung cuoi o ${moc[moc.length - 1]}ms, qua sat cuoi`);
});

test('cac moc TANG DAN va khong trung nhau', () => {
  const moc = framePlan(30);
  for (let i = 1; i < moc.length; i++) {
    assert.ok(moc[i] > moc[i - 1], `moc ${i} khong tang: ${moc[i - 1]} -> ${moc[i]}`);
  }
});

test('clip rat ngan van cho it nhat mot khung', () => {
  for (const d of [0.5, 1, 1.5]) {
    assert.ok(framePlan(d).length >= 1, `clip ${d}s khong cho khung nao`);
  }
});

test('do dai la hoac am khong lam no vo', () => {
  for (const d of [0, -5, NaN, Infinity]) {
    const m = framePlan(d as number);
    assert.ok(Array.isArray(m) && m.length >= 1);
    assert.ok(m.every((x) => Number.isFinite(x)), `co moc hong: ${m}`);
  }
});

test('clip ngan khong sinh nhieu khung hon so giay', () => {
  // Trich 6 khung tu clip 3 giay la lay 2 khung moi giay — khong them thong tin gi
  // ma van tinh du tien token.
  assert.ok(framePlan(3).length <= 3);
});
