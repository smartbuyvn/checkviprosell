import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_TABLE,
  normalizeCamera,
  resolveMove,
  diversify,
  spreadAssets,
  type CameraMove,
} from '../src/lib/camera-moves';

/**
 * Goc may va gioi han buoc zoom.
 *
 * Boi canh: video ngay 28/10 ra voi mot anh phong to dan va BI GIUT. Nguyen nhan la
 * buoc zoom moi khung qua lon — zoompan dich khung cat theo buoc roi rac, buoc lon
 * thi mat thay nhay. Test o day canh dung mot thu: buoc moi khung khong bao gio
 * vuot gioi han, ke ca khi canh rat ngan.
 */

test('ten goc may cu van dich duoc sang bo moi', () => {
  assert.equal(normalizeCamera('zoom_in'), 'hero_push');
  assert.equal(normalizeCamera('push_in'), 'hero_push');
  assert.equal(normalizeCamera('static'), 'endcard_lock');
  assert.equal(normalizeCamera('pan_left'), 'reveal_up');
});

test('ten moi giu nguyen', () => {
  for (const ten of Object.keys(CAMERA_TABLE) as CameraMove[]) {
    assert.equal(normalizeCamera(ten), ten);
  }
});

test('ten la hoac rong thi ve hero_push, khong bao gio undefined', () => {
  assert.equal(normalizeCamera(null), 'hero_push');
  assert.equal(normalizeCamera(undefined), 'hero_push');
  assert.equal(normalizeCamera(''), 'hero_push');
  assert.equal(normalizeCamera('dolly_zoom_kieu_hitchcock'), 'hero_push');
});

test('BUOC ZOOM moi khung KHONG BAO GIO vuot gioi han', () => {
  // Day la test quan trong nhat trong file. Vuot gioi han = video giat.
  for (const ten of Object.keys(CAMERA_TABLE) as CameraMove[]) {
    for (const soKhung of [1, 5, 15, 30, 45, 60, 90, 120, 300]) {
      const m = resolveMove(ten, soKhung);
      if (!m.animated || soKhung <= 1) continue;
      const buoc = Math.abs(m.zoomEnd - m.zoomStart) / soKhung;
      assert.ok(
        buoc <= m.maxStepPerFrame + 1e-9,
        `${ten} o ${soKhung} khung: buoc ${buoc.toFixed(6)} vuot ${m.maxStepPerFrame}`
      );
    }
  }
});

test('canh ngan thi HA BIEN DO, khong giu nguyen roi giat', () => {
  // hero_push muon di 1.00 -> 1.12 (bien do 0,12). O 30 khung (1 giay) gioi han la
  // 0,0008 x 30 = 0,024 — nho hon nhieu, nen phai bi ep xuong.
  const ngan = resolveMove('hero_push', 30);
  assert.ok(ngan.clamped, 'canh 1 giay phai bi ep bien do');
  assert.ok(ngan.zoomEnd < CAMERA_TABLE.hero_push.zoomEnd);

  // O 150 khung (5 giay) gioi han la 0,12 — vua du, khong can ep.
  const dai = resolveMove('hero_push', 150);
  assert.equal(dai.clamped, false);
  assert.equal(dai.zoomEnd, CAMERA_TABLE.hero_push.zoomEnd);
});

test('ep bien do van giu DUNG HUONG zoom', () => {
  const m = resolveMove('hero_push', 10);
  assert.ok(m.zoomEnd > m.zoomStart, 'hero_push la phong to, ep roi van phai phong to');
});

test('endcard_lock dung yen hoan toan, moi do dai', () => {
  for (const soKhung of [1, 30, 300]) {
    const m = resolveMove('endcard_lock', soKhung);
    assert.equal(m.zoomStart, m.zoomEnd, 'endcard khong duoc dich');
    assert.equal(m.animated, false);
  }
});

test('khung = 0 hoac am khong lam no vo', () => {
  for (const n of [0, -1, NaN]) {
    const m = resolveMove('hero_push', n as number);
    assert.ok(Number.isFinite(m.zoomStart) && Number.isFinite(m.zoomEnd));
  }
});

test('diversify: KHONG de hai canh lien tiep cung goc may', () => {
  // Day chinh la loi ngay 28/10: ca video mot goc duy nhat.
  const vao = ['zoom_in', 'zoom_in', 'zoom_in', 'zoom_in', 'zoom_in'];
  const ra = diversify(vao);
  for (let i = 1; i < ra.length - 1; i++) {
    assert.notEqual(ra[i], ra[i - 1], `canh ${i + 1} lap goc cua canh ${i}`);
  }
});

test('diversify: giu lua chon cua model khi no da da dang', () => {
  const vao: CameraMove[] = ['hero_push', 'detail_macro', 'lifestyle_hold', 'endcard_lock'];
  assert.deepEqual(diversify(vao), vao);
});

test('diversify: canh cuoi giu endcard_lock du canh truoc cung vay', () => {
  const ra = diversify(['hero_push', 'static', 'static']);
  assert.equal(ra[ra.length - 1], 'endcard_lock', 'canh cuoi phai duoc khoa');
});

test('diversify: mang rong tra mang rong', () => {
  assert.deepEqual(diversify([]), []);
});

test('bien do zoom khong qua lon: tren 1,35 la mo vi phong qua anh goc', () => {
  for (const [ten, p] of Object.entries(CAMERA_TABLE)) {
    assert.ok(p.zoomEnd <= 1.35, `${ten} phong den ${p.zoomEnd} — anh se bi mo`);
    assert.ok(p.zoomStart >= 1.0, `${ten} bat dau duoi 1.0 se lo vien den`);
  }
});

/* ──────── Rai anh ra cac canh ──────── */

test('KHONG de hai canh lien tiep dung cung mot anh', () => {
  // Do that 29/10: video co 3 anh nhung `image_1` dung o 4/6 canh — cong voi zoom gan
  // nhu khong thay, video thanh mot tam anh tinh keo dai 20 giay.
  const r = spreadAssets(['a', 'a', 'a', 'a', 'a', 'a'], ['a', 'b', 'c']);
  for (let i = 1; i < r.length; i++) {
    assert.notEqual(r[i], r[i - 1], `canh ${i + 1} lap anh cua canh ${i}`);
  }
});

test('DUNG HET so anh dang co', () => {
  const r = spreadAssets(['a', 'a', 'a', 'a', 'a', 'a'], ['a', 'b', 'c']);
  assert.equal(new Set(r).size, 3, `chi dung ${new Set(r).size}/3 anh: ${r.join(',')}`);
});

test('rai deu, khong dồn het vao mot anh', () => {
  const r = spreadAssets(Array(9).fill('a'), ['a', 'b', 'c']);
  const dem = ['a', 'b', 'c'].map((x) => r.filter((y) => y === x).length);
  assert.ok(Math.max(...dem) - Math.min(...dem) <= 1, `lech qua nhieu: ${dem.join(',')}`);
});

test('giu lua chon cua model khi no da rai deu', () => {
  const vao = ['a', 'b', 'c', 'a', 'b', 'c'];
  assert.deepEqual(spreadAssets(vao, ['a', 'b', 'c']), vao);
});

test('chi co mot anh thi moi canh deu dung no', () => {
  const r = spreadAssets(['a', 'b', 'c'], ['a']);
  assert.deepEqual(r, ['a', 'a', 'a']);
});

test('ten anh model bia ra bi thay bang anh that', () => {
  // Tang 3 hay tra ve `placeholder_1`, `image_9`... khong co trong danh sach anh that.
  const r = spreadAssets(['placeholder_1', 'image_9', 'khong_co'], ['a', 'b']);
  assert.ok(r.every((x) => ['a', 'b'].includes(x)), `con ten bia: ${r.join(',')}`);
});

test('khong co anh nao thi khong lam no vo', () => {
  assert.deepEqual(spreadAssets(['a', 'b'], []), ['a', 'b']);
  assert.deepEqual(spreadAssets([], ['a']), []);
});

test('bien do zoom nay DU THAY tren canh 2 giay', () => {
  // Tran cu ep hero_push xuong 1.00->1.048 tren canh 2 giay — mat gan nhu khong thay.
  const m = resolveMove('hero_push', 60);
  assert.ok(m.zoomEnd - m.zoomStart >= 0.10, `chi di duoc ${(m.zoomEnd - m.zoomStart).toFixed(3)}`);
});
