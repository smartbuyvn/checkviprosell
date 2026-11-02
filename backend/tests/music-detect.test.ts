import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSilentGaps, speechWindows, compareDb, detectMusicBed, MIN_GAP_MS, NGUONG_DB } from '../src/lib/music-detect';
import { qaEditPlan } from '../src/lib/video-qa';
import type { Segment } from '../src/lib/video-edit';

/**
 * Phat hien clip co nhac lan trong tieng noi.
 *
 * Giong va nhac trong file khach nop la MOT dang song — khong tach duoc neu khong co
 * source separation. Nhung biet duoc clip CO nhac hay khong van quan trong, vi no doi
 * han cach duoc phep dung: dao thu tu canh tren clip co nhac se lam bai hat nhay.
 *
 * Viec nay KHONG hoi model: model nghe mo ta khung hinh chu khong nghe tieng.
 */

/* ─────────── findSilentGaps ─────────── */

test('tim duoc khoang im giua hai mau loi', () => {
  const g = findSilentGaps([{ startSec: 0, endSec: 2 }, { startSec: 5, endSec: 7 }], 10);
  assert.ok(g.some((x) => x.startMs === 2000 && x.endMs === 5000), JSON.stringify(g));
});

test('khoang NGAN hon 400ms bi bo qua', () => {
  // Do la cho ngat hoi giua cau, van con duoi vang cua tu truoc.
  const g = findSilentGaps([{ startSec: 0, endSec: 2 }, { startSec: 2.2, endSec: 4 }], 4);
  assert.equal(g.length, 0, JSON.stringify(g));
  assert.equal(MIN_GAP_MS, 400);
});

test('tinh ca khoang im dau clip va cuoi clip', () => {
  const g = findSilentGaps([{ startSec: 2, endSec: 4 }], 8);
  assert.ok(g.some((x) => x.startMs === 0), 'thieu khoang dau');
  assert.ok(g.some((x) => x.endMs === 8000), 'thieu khoang cuoi');
});

test('mau loi khong theo thu tu van xu ly dung', () => {
  const g = findSilentGaps([{ startSec: 5, endSec: 7 }, { startSec: 0, endSec: 2 }], 10);
  for (const x of g) assert.ok(x.endMs > x.startMs, `khoang am: ${JSON.stringify(x)}`);
});

test('mau loi chong nhau khong sinh khoang am', () => {
  const g = findSilentGaps([{ startSec: 0, endSec: 5 }, { startSec: 3, endSec: 8 }], 10);
  for (const x of g) assert.ok(x.endMs > x.startMs);
});

test('khong co loi nao: ca clip la mot khoang im', () => {
  const g = findSilentGaps([], 10);
  assert.equal(g.length, 1);
  assert.equal(g[0].startMs, 0);
});

test('speechWindows bo cac mau rong', () => {
  const w = speechWindows([{ startSec: 1, endSec: 3 }, { startSec: 5, endSec: 5 }]);
  assert.equal(w.length, 1);
});

/* ─────────── compareDb ─────────── */

test('chenh lech LON = phong yen, khong co nhac', () => {
  // Noi -12dB, im -45dB: chenh 33dB.
  assert.equal(compareDb(-12, -45), false);
});

test('chenh lech NHO = luc im van day am thanh = co nhac', () => {
  // Noi -12dB, im -16dB: chenh 4dB. Luc khong ai noi van gan nhu to bang luc noi.
  assert.equal(compareDb(-12, -16), true);
});

test('dung nguong 8dB la ranh gioi', () => {
  assert.equal(compareDb(-12, -12 - NGUONG_DB), false, 'dung nguong thi coi la khong co nhac');
  assert.equal(compareDb(-12, -12 - NGUONG_DB + 0.1), true);
});

test('so do hong thi nghieng ve phia CO nhac', () => {
  // Doan sai phia nay: video hoi kem linh hoat. Doan sai phia kia: bai hat nhay giua
  // video va khach nghe ra ngay.
  assert.equal(compareDb(NaN, -40), true);
  assert.equal(compareDb(-12, Infinity), true);
});

/* ─────────── detectMusicBed ─────────── */

test('KHACH TICK thi khong do nua — loi khach la dung', () => {
  return detectMusicBed({
    filePath: '/khong/ton/tai.mp4', hasAudio: true, userDeclared: true,
    cues: [], clipDurationSec: 10,
  }).then((r) => {
    assert.equal(r.likely, true);
    assert.equal(r.reason, 'nguoi_dung_khai');
  });
});

test('clip khong co tieng thi khong the co nhac', () => {
  return detectMusicBed({
    filePath: '/khong/ton/tai.mp4', hasAudio: false, cues: [], clipDurationSec: 10,
  }).then((r) => {
    assert.equal(r.likely, false);
    assert.equal(r.reason, 'khong_co_tieng');
  });
});

test('khong do duoc thi nghieng ve phia CO nhac', () => {
  return detectMusicBed({
    filePath: '/khong/ton/tai.mp4', hasAudio: true,
    cues: [{ startSec: 0, endSec: 10 }], clipDurationSec: 10,
  }).then((r) => {
    assert.equal(r.likely, true);
    assert.equal(r.reason, 'khong_do_duoc');
  });
});

/* ─────────── Rang buoc khi co BAT ─────────── */

function doan(over: Partial<Segment> = {}): Segment {
  return {
    id: 'a1', role: 'product', in_ms: 0, out_ms: 6000,
    crop: 'hold', speed: 1, transition_out: 'cut', overlay: '',
    ...over,
  };
}

test('co nhac: KHONG duoc dao thu tu canh', () => {
  // Day la rang buoc nang nhat cua co nay. No bo mat ky thuat "keo cau manh nhat o
  // giua clip len lam hook". Doi lai, bai nhac khong nhay.
  const r = qaEditPlan({
    segments: [
      doan({ id: 'a1', role: 'hook', in_ms: 15000, out_ms: 17000 }),
      doan({ id: 'a2', in_ms: 0, out_ms: 8000 }),
      doan({ id: 'a3', role: 'cta', in_ms: 20000, out_ms: 28000 }),
    ],
    clipDurationMs: 30000, spokenClaims: [], musicBedLikely: true,
  });
  assert.ok(r.blocks.some((b) => b.reason === 'reorder_with_music'));
  for (let i = 1; i < r.segments.length; i++) {
    assert.ok(r.segments[i].in_ms >= r.segments[i - 1].in_ms, 'van con dao thu tu');
  }
});

test('KHONG co nhac: van duoc keo doan giua clip len lam hook', () => {
  const r = qaEditPlan({
    segments: [
      doan({ id: 'a1', role: 'hook', in_ms: 15000, out_ms: 17000 }),
      doan({ id: 'a2', in_ms: 0, out_ms: 8000 }),
      doan({ id: 'a3', role: 'cta', in_ms: 20000, out_ms: 28000 }),
    ],
    clipDurationMs: 30000, spokenClaims: [], musicBedLikely: false,
  });
  assert.ok(!r.blocks.some((b) => b.reason === 'reorder_with_music'));
  assert.equal(r.segments[0].in_ms, 15000, 'hook phai duoc giu o dau');
});

test('co nhac: toc do bi EP ve 1.0', () => {
  const r = qaEditPlan({
    segments: [doan({ role: 'hook', speed: 1.1, out_ms: 18000 })],
    clipDurationMs: 30000, spokenClaims: [], musicBedLikely: true,
  });
  assert.equal(r.segments[0].speed, 1);
  assert.ok(r.blocks.some((b) => b.reason === 'speed_with_music'));
});

/* ─────────── xfade chi khi LIEN NHAU ─────────── */

test('hai doan CACH nhau tren clip goc thi xfade bi ep ve cut', () => {
  // Hoa hai thoi diem khac nhau vao nhau nghia la tieng cua hai cho chong len.
  const r = qaEditPlan({
    segments: [
      doan({ id: 'a1', role: 'hook', in_ms: 0, out_ms: 2000, transition_out: 'xfade_160' }),
      doan({ id: 'a2', in_ms: 10000, out_ms: 18000 }),
      doan({ id: 'a3', role: 'cta', in_ms: 18000, out_ms: 26000 }),
    ],
    clipDurationMs: 30000, spokenClaims: [],
  });
  assert.equal(r.segments[0].transition_out, 'cut');
  assert.ok(r.blocks.some((b) => b.reason === 'xfade_not_adjacent'));
});

test('hai doan LIEN NHAU thi giu duoc xfade', () => {
  const r = qaEditPlan({
    segments: [
      doan({ id: 'a1', role: 'hook', in_ms: 0, out_ms: 2000, transition_out: 'xfade_160' }),
      doan({ id: 'a2', in_ms: 2000, out_ms: 10000 }),
      doan({ id: 'a3', role: 'cta', in_ms: 10000, out_ms: 20000 }),
    ],
    clipDurationMs: 30000, spokenClaims: [],
  });
  assert.equal(r.segments[0].transition_out, 'xfade_160');
  assert.ok(!r.blocks.some((b) => b.reason === 'xfade_not_adjacent'));
});

test('doan CUOI luon la cut — khong con gi de hoa vao', () => {
  const r = qaEditPlan({
    segments: [
      doan({ id: 'a1', role: 'hook', in_ms: 0, out_ms: 2000 }),
      doan({ id: 'a2', in_ms: 2000, out_ms: 20000, transition_out: 'xfade_160' }),
    ],
    clipDurationMs: 30000, spokenClaims: [],
  });
  assert.equal(r.segments[r.segments.length - 1].transition_out, 'cut');
});
