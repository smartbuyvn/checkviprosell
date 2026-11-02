import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qaEditPlan, overlayCoNeo } from '../src/lib/video-qa';
import { MIN_SPEED, MAX_SPEED, type Segment } from '../src/lib/video-edit';

/**
 * Cong kiem ke hoach dung.
 *
 * Cong nay manh hon han `qa-gate.ts` cua nhanh anh, va ly do rat cu the: o day co MOT
 * SU THAT de doi chieu. Nhanh anh sang tac kich ban tu con so khong nen chi chan duoc
 * cac mau chu cam da biet truoc; o day co mot doan phim dai dung bao nhieu mili giay
 * va mot transcript ghi dung nhung gi khach noi.
 */

function doan(over: Partial<Segment> = {}): Segment {
  return {
    id: 'a1', role: 'product', in_ms: 1000, out_ms: 6000,
    crop: 'hold', speed: 1, transition_out: 'cut', overlay: '',
    ...over,
  };
}

/** Bon doan cong lai 20 giay — nam trong khoang 15–26s. */
function keHoachTot(): Segment[] {
  return [
    doan({ id: 'a1', role: 'hook',    in_ms: 8000,  out_ms: 10000 }),
    doan({ id: 'a2', role: 'product', in_ms: 0,     out_ms: 7000 }),
    doan({ id: 'a3', role: 'proof',   in_ms: 11000, out_ms: 19000 }),
    doan({ id: 'a4', role: 'cta',     in_ms: 19000, out_ms: 22000 }),
  ];
}

const CLIP_MS = 30_000;

/* ─────────── Moc thoi gian ─────────── */

test('ke hoach hop le thi pass, khong co block nao', () => {
  const r = qaEditPlan({ segments: keHoachTot(), clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.equal(r.pass, true, JSON.stringify(r.blocks));
  assert.equal(r.blocks.length, 0);
});

test('doan vuot QUA CUOI clip bi loai — day la loi nang nhat', () => {
  // ffmpeg nhan `trim` ngoai pham vi se cho ra doan rong, cac doan sau don len, va
  // ma thoat van la 0. Khach nhan video hong ma he thong bao thanh cong.
  const s = keHoachTot();
  s[2].out_ms = CLIP_MS + 5000;
  const r = qaEditPlan({ segments: s, clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.ok(r.blocks.some((b) => b.reason === 'out_of_range'));
  assert.equal(r.segments.length, 3, 'doan hong phai bi loai khoi ke hoach');
});

test('out_ms <= in_ms bi loai', () => {
  const s = keHoachTot();
  s[1].out_ms = s[1].in_ms;
  const r = qaEditPlan({ segments: s, clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.ok(r.blocks.some((b) => b.reason === 'bad_range'));
});

test('in_ms am bi loai', () => {
  const r = qaEditPlan({ segments: [doan({ in_ms: -500 })], clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.ok(r.blocks.some((b) => b.reason === 'out_of_range'));
});

test('NaN trong moc thoi gian khong lot qua', () => {
  const r = qaEditPlan({
    segments: [doan({ in_ms: NaN as any }), doan({ out_ms: undefined as any })],
    clipDurationMs: CLIP_MS, spokenClaims: [],
  });
  assert.equal(r.segments.length, 0);
  assert.equal(r.pass, false);
});

/* ─────────── Tua ─────────── */

test('tua ngoai 0.85–1.15 bi EP VE 1.0 va ghi nhan', () => {
  for (const t of [0.5, 2, 1.5, 0.2]) {
    const r = qaEditPlan({ segments: [doan({ speed: t })], clipDurationMs: CLIP_MS, spokenClaims: [] });
    assert.equal(r.segments[0].speed, 1, `speed ${t} chua bi ep`);
    assert.ok(r.blocks.some((b) => b.reason === 'speed'), `speed ${t} chua duoc ghi nhan`);
  }
});

test('tua trong khoang duoc giu nguyen', () => {
  for (const t of [MIN_SPEED, 1, MAX_SPEED, 0.95, 1.1]) {
    const r = qaEditPlan({ segments: [doan({ speed: t })], clipDurationMs: CLIP_MS, spokenClaims: [] });
    assert.equal(r.segments[0].speed, t, `speed ${t} bi sua oan`);
  }
});

/* ─────────── Crop ─────────── */

test('crop ngoai enum bi doi ve hold', () => {
  const r = qaEditPlan({ segments: [doan({ crop: 'orbit' as any })], clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.equal(r.segments[0].crop, 'hold');
  assert.ok(r.blocks.some((b) => b.reason === 'crop'));
});

/* ─────────── Chu tren man hinh ─────────── */

test('chu qua 6 tu bi cat', () => {
  const r = qaEditPlan({
    segments: [doan({ overlay: 'mot hai ba bon nam sau bay tam' })],
    clipDurationMs: CLIP_MS,
    spokenClaims: ['mot hai ba bon nam sau bay tam'],
  });
  assert.equal(r.segments[0].overlay.split(/\s+/).length, 6);
  assert.ok(r.blocks.some((b) => b.reason === 'overlay_too_long'));
});

test('ky tu % bi bo', () => {
  const r = qaEditPlan({
    segments: [doan({ overlay: 'giam 50% hom nay' })],
    clipDurationMs: CLIP_MS,
    spokenClaims: ['giam 50 hom nay'],
  });
  assert.ok(!r.segments[0].overlay.includes('%'));
  assert.ok(r.blocks.some((b) => b.reason === 'overlay_percent'));
});

test('CHU KHACH KHONG NOI bi bo — day la diem manh nhat cua cong nay', () => {
  // Bo loc mau cam o qa-gate chi chan cau sai da biet truoc ("so 1", "tot nhat").
  // Cai nay chan MOI cau khach khong noi, ke ca cau nghe rat hop ly.
  const r = qaEditPlan({
    segments: [doan({ overlay: 'chong nuoc tuyet doi' })],
    clipDurationMs: CLIP_MS,
    spokenClaims: ['son nay ben mau ca ngay'],
    productName: 'Son li 24h',
  });
  assert.equal(r.segments[0].overlay, '', 'chu bia phai bi bo');
  assert.ok(r.blocks.some((b) => b.reason === 'invented_claim'));
});

test('chu NEO vao loi khach thi duoc giu', () => {
  const r = qaEditPlan({
    segments: [doan({ overlay: 'ben mau ca ngay' })],
    clipDurationMs: CLIP_MS,
    spokenClaims: ['son nay ben mau ca ngay khong troi'],
    productName: 'Son li 24h',
  });
  assert.equal(r.segments[0].overlay, 'ben mau ca ngay');
  assert.ok(!r.blocks.some((b) => b.reason === 'invented_claim'));
});

test('bo chu bia nhung KHONG chan ca video', () => {
  // Canh khong co chu van la canh dung duoc. Chan ca video vi mot dong chu la phan
  // ung qua tay, va khach mat ca lan render.
  const s = keHoachTot();
  s[1].overlay = 'duoc chung nhan quoc te';
  const r = qaEditPlan({ segments: s, clipDurationMs: CLIP_MS, spokenClaims: ['mau dep lam'] });
  assert.equal(r.pass, true);
  assert.equal(r.segments[1].overlay, '');
});

/* ─────────── overlayCoNeo ─────────── */

test('khach khong noi gi thi chi cho CTA chung', () => {
  assert.equal(overlayCoNeo('Xem chi tiet', [], ''), true);
  assert.equal(overlayCoNeo('Dat hang ngay', [], ''), true);
  assert.equal(overlayCoNeo('Chong nuoc tuyet doi', [], ''), false);
});

test('chu rong luon hop le — khong co chu la mot lua chon dung', () => {
  assert.equal(overlayCoNeo('', ['bat ky'], ''), true);
  assert.equal(overlayCoNeo('   ', [], ''), true);
});

test('tu chuc nang ngan khong bi tinh la bia', () => {
  // Chan theo tung tu mot se chan oan nhung cau ghep lai hoan toan hop le.
  assert.equal(overlayCoNeo('ben va nhe', ['san pham nay ben va nhe'], ''), true);
});

test('ten san pham duoc tinh la nguon hop le', () => {
  assert.equal(overlayCoNeo('Son li 24h', [], 'Son li 24h'), true);
});

/* ─────────── Hook va tong thoi luong ─────────── */

test('hook khong dung dau thi duoc DUA LEN dau, khong chan', () => {
  const s = keHoachTot();
  const daoNguoc = [s[1], s[0], s[2], s[3]];
  const r = qaEditPlan({ segments: daoNguoc, clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.equal(r.segments[0].role, 'hook');
  assert.equal(r.pass, true);
});

test('khong co hook nao thi ghi nhan', () => {
  const s = keHoachTot().map((x) => ({ ...x, role: 'product' as const }));
  const r = qaEditPlan({ segments: s, clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.ok(r.blocks.some((b) => b.reason === 'no_hook'));
});

test('thanh pham qua ngan hoac qua dai bi ghi nhan', () => {
  const ngan = qaEditPlan({ segments: [doan({ role: 'hook', in_ms: 0, out_ms: 2000 })], clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.ok(ngan.blocks.some((b) => b.reason === 'total_out_of_bounds'));

  const dai = qaEditPlan({ segments: [doan({ role: 'hook', in_ms: 0, out_ms: 29000 })], clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.ok(dai.blocks.some((b) => b.reason === 'total_out_of_bounds'));
});

test('bat model CONG SAI total_ms', () => {
  // Model khai mot dang, cac doan cong lai mot neo. Neu no cong sai o day thi rat co
  // the no cung chon moc theo mot phep tinh sai khac.
  const r = qaEditPlan({
    segments: keHoachTot(), clipDurationMs: CLIP_MS, spokenClaims: [], totalMs: 99_000,
  });
  assert.ok(r.blocks.some((b) => b.detail.includes('99000')));
});

test('total_ms khai dung thi khong bao gi', () => {
  const r = qaEditPlan({
    segments: keHoachTot(), clipDurationMs: CLIP_MS, spokenClaims: [], totalMs: 20_000,
  });
  assert.equal(r.blocks.length, 0, JSON.stringify(r.blocks));
});

test('mang rong khong lam no vo, nhung pass = false', () => {
  const r = qaEditPlan({ segments: [], clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.equal(r.pass, false);
  assert.equal(r.segments.length, 0);
});

test('KHONG sua vao ke hoach goc', () => {
  const s = keHoachTot();
  s[0].speed = 3;
  const truoc = JSON.stringify(s);
  qaEditPlan({ segments: s, clipDurationMs: CLIP_MS, spokenClaims: [] });
  assert.equal(JSON.stringify(s), truoc, 'da sua vao ban goc — se kho lan lai khi dieu tra');
});
