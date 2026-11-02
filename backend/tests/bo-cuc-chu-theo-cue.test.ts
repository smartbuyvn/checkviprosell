/**
 * Lề riêng từng dòng thoại, và phép đo số dòng phụ đề.
 *
 * ── Vì sao có file này ──
 *
 * `MarginV` trong phần `[V4+ Styles]` của ASS là MỘT giá trị cho cả file. Chỉ cần một
 * câu phụ đề trong video tràn hai dòng là mọi tiêu đề đều bị đẩy lên cao bằng đó — kể
 * cả những lúc phụ đề chỉ có một dòng, và chỗ chừa thừa hiện ra thành khoảng trống.
 *
 * Đo trên khung 1080×1080 ngày 30/10: khoảng trống 57px, đúng bằng một dòng. Người
 * bán kêu suốt bốn lượt sửa, và ba lượt đầu tôi chỉnh lề chung — sai chỗ.
 *
 * ── Hai cái bẫy đã sập ──
 *
 * 1. Tiêu đề dùng `durationSec` (đã cộng phần `xfade` nuốt) làm mốc kết thúc, nên thò
 *    sang cảnh sau ~0,35 giây và vớ phải phụ đề hai dòng của cảnh đó.
 * 2. `cropdetect` chạy thẳng trên nguồn `lavfi` trả khung bao hỏng (bề ngang ÂM), nên
 *    phép đo im lặng rơi về đường lui suốt mà không ai biết.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAssFile, type AssCue } from '../src/lib/ass-subtitle';
import { boCucChu, uocSoDong } from '../src/lib/bo-cuc-chu';

const worker = () => readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');

const OPTS = {
  width: 1080, height: 1080, fontName: 'Montserrat',
  overlayFontSize: 70, subFontSize: 45,
  overlayMarginV: 152, subMarginV: 32, marginH: 140,
};

/** Trường MarginV của một dòng Dialogue (trường thứ 8). */
function leCua(dong: string): number {
  return Number(dong.split(',')[7]);
}

test('cue co marginV rieng thi ghi dung vao dong Dialogue', () => {
  const cues: AssCue[] = [
    { startSec: 0, endSec: 2, text: 'Tiêu đề', style: 'Overlay', marginV: 95 },
    { startSec: 0, endSec: 2, text: 'Phụ đề', style: 'Sub' },
  ];
  const dong = buildAssFile(cues, OPTS).split('\n').filter((l) => l.startsWith('Dialogue:'));
  assert.equal(leCua(dong[0]), 95, 'Khong ghi marginV rieng cho tieu de');
  assert.equal(leCua(dong[1]), 0, 'Cue khong dat marginV phai de 0 de dung le cua style');
});

test('marginV khong hop le thi de 0, khong ghi NaN vao file', () => {
  for (const x of [undefined, null, 0, -5, NaN, 'abc']) {
    const dong = buildAssFile(
      [{ startSec: 0, endSec: 1, text: 'x', style: 'Overlay', marginV: x as never }],
      OPTS
    ).split('\n').filter((l) => l.startsWith('Dialogue:'));
    assert.equal(leCua(dong[0]), 0, `marginV=${JSON.stringify(x)} phai ra 0`);
  }
});

test('bo cuc chua dung so dong duoc yeu cau', () => {
  const mot = boCucChu(1080, 1080, { soDongPhuDe: 1 });
  const hai = boCucChu(1080, 1080, { soDongPhuDe: 2 });

  assert.equal(mot.subMarginV, hai.subMarginV, 'Phu de luon neo cung mot cho');
  assert.ok(hai.overlayMarginV > mot.overlayMarginV, 'Hai dong phai day tieu de len cao hon');

  const chenh = hai.overlayMarginV - mot.overlayMarginV;
  const motDong = mot.subFontSize * 1.25;
  assert.ok(
    Math.abs(chenh - motDong) < 2,
    `Chenh lech ${chenh}px, phai bang dung mot dong ${motDong.toFixed(0)}px`
  );
});

test('so dong ngoai khoang 1-2 bi kep lai', () => {
  // Chua ba dong thi chu chiem gan nua khung; chua 0 dong thi tieu de de len phu de.
  assert.equal(
    boCucChu(1080, 1080, { soDongPhuDe: 9 }).overlayMarginV,
    boCucChu(1080, 1080, { soDongPhuDe: 2 }).overlayMarginV
  );
  // 0 nghĩa là "chưa biết", không phải "không có dòng nào" — lùi về chừa an toàn
  // hai dòng, giống hệt khi không truyền gì.
  assert.equal(
    boCucChu(1080, 1080, { soDongPhuDe: 0 }).overlayMarginV,
    boCucChu(1080, 1080, { soDongPhuDe: 2 }).overlayMarginV
  );
});

test('khong co so dong thi chua AN TOAN hai dong', () => {
  // Thieu cho thi chu de nhau; thua cho chi la mot khoang trong.
  assert.equal(
    boCucChu(1080, 1080).overlayMarginV,
    boCucChu(1080, 1080, { soDongPhuDe: 2 }).overlayMarginV
  );
});

test('uoc so dong sai ve phia AN TOAN', () => {
  // He so 0,44 lon hon muc do that 0,420, nen uoc nghieng ve chua thua.
  const beRong = 800, coChu = 45;
  assert.equal(uocSoDong('a'.repeat(20), coChu, beRong), 1);
  assert.equal(uocSoDong('a'.repeat(80), coChu, beRong), 2);
  // Khong bao gio tra 0 hay am.
  for (const t of ['', '   ', null, undefined]) {
    assert.ok(uocSoDong(t as never, coChu, beRong) >= 1);
  }
});

/* ── Hai cái bẫy, canh thẳng trên mã nguồn ── */

test('tieu de ket thuc theo KE HOACH, khong theo do dai da keo cho xfade', () => {
  const s = worker();
  // `durationSec` da cong phan xfade nuot; dung no thi tieu de tho sang canh sau.
  assert.doesNotMatch(
    s,
    /endSec:\s*sceneStart \+ durationSec/,
    'Tieu de van dung durationSec — se tho sang canh sau va lay nham so dong phu de'
  );
  assert.match(s, /endSec:\s*sceneStart \+ durationKeHoach/, 'Tieu de khong dung moc ke hoach');
});

test('phu de bi kep trong pham vi canh cua no', () => {
  const s = worker();
  assert.match(s, /Math\.min\(hetCanh,/, 'Khong kep cue phu de trong pham vi canh');
});

test('phep do dong MA HOA ra file truoc khi cropdetect', () => {
  const s = readFileSync(join(__dirname, '..', 'src', 'lib', 'do-chu.ts'), 'utf8');
  // Chay cropdetect thang tren nguon lavfi tra khung bao be ngang AM.
  assert.doesNotMatch(
    s,
    /subtitles='\$\{escapeFilterPath\(duongAss\)\}',cropdetect/,
    'Van chay cropdetect thang tren lavfi — khung bao se hong'
  );
  assert.match(s, /libx264/, 'Khong ma hoa ra file truoc khi do');
});

test('khuon mau doc cropdetect chap nhan ca so AM', () => {
  // Khung bao hong tra `crop=-1078:24:...`. Khuon chi doi chu so thi khong khop, ham
  // tra null, va ca phep do im lang roi ve duong lui — dung ba lan sua truoc.
  const s = readFileSync(join(__dirname, '..', 'src', 'lib', 'do-chu.ts'), 'utf8');
  assert.match(s, /crop=\(-\?/, 'Khuon mau khong nhan so am nen se khong phat hien duoc khung bao hong');
});

test('worker dat le rieng cho tung tieu de', () => {
  const s = worker();
  assert.match(s, /tieuDe\.marginV\s*=/, 'Worker khong dat le rieng cho tieu de');
  assert.match(s, /doSoDongNhieu\(/, 'Worker khong do so dong phu de');
});
