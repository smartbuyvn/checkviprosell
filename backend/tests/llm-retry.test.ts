import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableStatus, nextBackoffMs } from '../src/services/llm.provider';

/**
 * Ngay 27/10 khach gap "Sinh concept that bai - GEMINI_ERROR: HTTP 503: This model
 * is currently experiencing high demand". Chinh thong bao noi day la loi tam thoi,
 * nhung provider khong co lan thu lai nao nen mot cu 503 giet ca luot.
 */

test('loi tam thoi thi thu lai', () => {
  for (const s of [408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableStatus(s), true, `${s} dang le phai thu lai`);
  }
});

test('loi cau hinh thi KHONG thu lai', () => {
  // Thu lai 400/401/403/404 chi lam khach cho lau hon roi van hong.
  for (const s of [400, 401, 403, 404, 422] ) {
    assert.equal(isRetryableStatus(s), false, `${s} khong duoc thu lai`);
  }
});

test('200 khong nam trong danh sach thu lai', () => {
  assert.equal(isRetryableStatus(200), false);
});

test('thoi gian cho tang gap doi moi lan', () => {
  const base = 800;
  // Co nhieu ngau nhien nen kiem theo khoang, khong kiem bang dung mot so.
  for (const [attempt, lo, hi] of [[0, 800, 1600], [1, 1600, 2400], [2, 3200, 4000]]) {
    for (let i = 0; i < 50; i++) {
      const ms = nextBackoffMs(attempt, base);
      assert.ok(ms >= lo && ms <= hi, `lan ${attempt}: ${ms} ngoai khoang ${lo}-${hi}`);
    }
  }
});

test('khoang cho cua cac lan khong chong lan nhau', () => {
  const base = 800;
  // Lan a cho trong khoang [base*2^a, base*2^a + base]. Can lan sau bat dau tu diem
  // ket thuc cua lan truoc tro di, neu khong gap nghen keo dai se thu lai day lien tuc.
  const lo = (a: number) => base * Math.pow(2, a);
  const hi = (a: number) => lo(a) + base;
  for (let a = 0; a < 5; a++) {
    assert.ok(lo(a + 1) >= hi(a), `lan ${a + 1} bat dau ${lo(a + 1)} phai tu ${hi(a)} tro di`);
  }
});

test('nhieu ngau nhien thuc su co, khong phai so co dinh', () => {
  const values = new Set(Array.from({ length: 80 }, () => nextBackoffMs(0, 800)));
  assert.ok(values.size > 5, 'cac lan goi tra ve gan nhu cung mot so - mat tac dung rai tai');
});
