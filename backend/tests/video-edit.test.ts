import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, resolveTheme, cropFilter, gradeFilter, stabilizeParams,
  xfadeDurationSec, MAX_CROP_STEP, XFADE_FRAMES,
  minTotalFor, maxTotalFor, MIN_TOTAL_MS, MAX_TOTAL_MS, ABS_MIN_TOTAL_MS,
  type Theme, type Crop,
} from '../src/lib/video-edit';

/**
 * Phan quyet dinh bang CODE cua luong dung clip: bang theme va ban do sang ffmpeg.
 *
 * Dat o code chu khong hoi model vi cung ly do da dua tang 4 ve code: dich ten sang
 * tham so la viec may moc, hoi model chi ton token va them mot lop loi JSON.
 */

/* ─────────── Theme ─────────── */

test('theme mac dinh la tu_nhien', () => {
  // Dung loi hua "giu nguyen cam giac ban tu quay". cao_cap va demo_tay phai do khach
  // chu dong chon, khong tu bat.
  for (const x of ['', null, undefined, 'khong_co_theme_nay']) {
    assert.equal(resolveTheme(x as any), 'tu_nhien');
  }
});

test('theme hop le duoc giu nguyen', () => {
  for (const t of Object.keys(THEMES) as Theme[]) {
    assert.equal(resolveTheme(t), t);
  }
});

test('tu_nhien KHONG nhac, KHONG chinh mau', () => {
  // Day la noi dung cua loi hua, khong phai tuy chon tham my: them nhac hay chinh mau
  // vao la video het "tu quay" ngay.
  assert.equal(THEMES.tu_nhien.music, 'none');
  assert.equal(THEMES.tu_nhien.grade, 'none');
});

test('tu_nhien KHONG dung on dinh muc medium', () => {
  // Nan manh lam mat chinh cai rung nhe khien nguoi xem tin day la nguoi that cam may.
  assert.notEqual(THEMES.tu_nhien.stabilize, 'medium');
});

test('cao_cap it canh hon sach', () => {
  assert.ok(THEMES.cao_cap.targetSegments < THEMES.sach.targetSegments);
});

test('moi theme deu co nhan va mo ta cho nguoi dung doc', () => {
  for (const [ten, c] of Object.entries(THEMES)) {
    assert.ok(c.label.length > 0, `${ten} thieu nhan`);
    assert.ok(c.hint.length > 20, `${ten} mo ta qua ngan: ${c.hint}`);
  }
});

/* ─────────── cropFilter ─────────── */

test('hold KHONG dung zoompan', () => {
  // Crop tinh thi khong co gi de noi suy; them zoompan chi ton mot luot scale 2x vo ich.
  const f = cropFilter('hold', 1080, 1920, 150, 30);
  assert.ok(!f.includes('zoompan'));
  assert.ok(f.includes('crop=1080:1920'));
});

test('punch_in va punch_out co zoompan, va di NGUOC chieu nhau', () => {
  const vao = cropFilter('punch_in', 1080, 1920, 180, 30);
  const ra = cropFilter('punch_out', 1080, 1920, 180, 30);
  assert.ok(vao.includes('zoompan'));
  assert.ok(ra.includes('zoompan'));

  const buocVao = Number(/\+(-?[\d.]+)\*on/.exec(vao)![1]);
  const buocRa = Number(/\+(-?[\d.]+)\*on/.exec(ra)![1]);
  assert.ok(buocVao > 0, `punch_in phai phong to, buoc = ${buocVao}`);
  assert.ok(buocRa < 0, `punch_out phai thu nho, buoc = ${buocRa}`);
});

test('BUOC ZOOM moi khung KHONG BAO GIO vuot tran — day la thu chong giat', () => {
  // Ban de xuat 28/10 ghi "zoompan 1.00 -> 1.30, buoc moi khung <= 0.001". Hai dieu do
  // khong cung dung duoc: mot doan 6 giay o 30fps chi co 180 khung, tuc di duoc toi da
  // 0.18. Code phai ha bien do cho vua ngan sach buoc, khong phai gap doi buoc.
  for (const crop of ['punch_in', 'punch_out'] as Crop[]) {
    for (const khung of [30, 60, 120, 180, 300, 600]) {
      const f = cropFilter(crop, 1080, 1920, khung, 30);
      const m = /\+(-?[\d.]+)\*on/.exec(f);
      if (!m) continue;
      const buoc = Math.abs(Number(m[1]));
      assert.ok(
        buoc <= MAX_CROP_STEP + 1e-9,
        `${crop} o ${khung} khung: buoc ${buoc} vuot tran ${MAX_CROP_STEP}`
      );
    }
  }
});

test('doan NGAN bi ha bien do thay vi tang buoc', () => {
  const ngan = cropFilter('punch_in', 1080, 1920, 30, 30);   // 1 giay
  const dai = cropFilter('punch_in', 1080, 1920, 300, 30);   // 10 giay
  const bNgan = Number(/\+(-?[\d.]+)\*on/.exec(ngan)![1]);
  const bDai = Number(/\+(-?[\d.]+)\*on/.exec(dai)![1]);
  // Doan dai duoc dung tron bien do nen buoc moi khung NHO hon doan ngan bi ep.
  assert.ok(bNgan <= MAX_CROP_STEP + 1e-9 && bDai <= MAX_CROP_STEP + 1e-9);
});

test('zoompan luon xuat ra DUNG kho khach chon', () => {
  for (const [w, h] of [[1080, 1920], [1920, 1080], [1080, 1080]] as const) {
    const f = cropFilter('punch_in', w, h, 150, 30);
    assert.ok(f.includes(`s=${w}x${h}`), `thieu kho dau ra trong: ${f}`);
  }
});

test('phong gap doi TRUOC zoompan de bot giat', () => {
  const f = cropFilter('punch_in', 1080, 1920, 150, 30);
  assert.ok(f.includes('scale=2160:3840'), `thieu buoc phong gap doi: ${f}`);
});

test('so khung 0 hoac am khong sinh filter hong', () => {
  for (const n of [0, -5, NaN]) {
    const f = cropFilter('punch_in', 1080, 1920, n as number, 30);
    assert.ok(!/NaN|Infinity/.test(f), `filter chua gia tri hong: ${f}`);
  }
});

/* ─────────── gradeFilter ─────────── */

test('grade none tra chuoi rong de nguoi goi bo han khau nay', () => {
  assert.equal(gradeFilter('none'), '');
});

test('premium ha bao hoa, clean thi tang', () => {
  // cao_cap tram mau; sach thi tuoi hon mot chut.
  assert.ok(gradeFilter('premium').includes('saturation=0.92'));
  assert.ok(gradeFilter('clean').includes('saturation=1.05'));
});

/* ─────────── stabilize ─────────── */

test('off tra null de khong chay vidstab', () => {
  // vidstab la bo loc HAI LUOT: bat no khi khong can la giai ma clip them mot lan.
  assert.equal(stabilizeParams('off'), null);
});

test('medium nan manh hon light', () => {
  assert.ok(stabilizeParams('medium')!.shakiness > stabilizeParams('light')!.shakiness);
});

/* ─────────── xfade ─────────── */

test('xfade 5 khung, doi theo fps', () => {
  assert.equal(XFADE_FRAMES, 5);
  assert.ok(Math.abs(xfadeDurationSec(30) - 0.1667) < 0.001);
  assert.ok(Math.abs(xfadeDurationSec(60) - 0.0833) < 0.001);
});

test('fps 0 khong gay chia cho 0', () => {
  const d = xfadeDurationSec(0);
  assert.ok(Number.isFinite(d) && d > 0, `xfade = ${d}`);
});

test('tu_nhien KHONG cho xfade — cat cung moi dung cam giac tu quay', () => {
  assert.equal(THEMES.tu_nhien.allowXfade, false);
});

test('zoompan dung d=1 — clip da co san khung cua chinh no', () => {
  // `d` la so khung XUAT RA TREN MOI KHUNG VAO. Dat d=soKhung thi moi khung vao no
  // them soKhung lan nua: do that 28/10 cho ra video 396 giay thay vi 7,4 giay.
  //
  // Loi nay khong lo ra o test chuoi filter nao — chi lo khi chay ffmpeg that roi do
  // lai do dai file.
  for (const khung of [30, 150, 300]) {
    const f = cropFilter('punch_in', 1080, 1920, khung, 30);
    assert.ok(/:d=1:/.test(f), `d phai la 1, khong phai ${khung}: ${f}`);
  }
});

test('zoompan KHONG duoc mang tham so fps — do la thu lam ffmpeg sap', () => {
  // `d=1` + `fps=` -> ACCESS_VIOLATION (3221225477), do that 28/10. Nhip khung da duoc
  // dat bang filter `fps` phia truoc; dat lai lan nua ben trong zoompan la thua va sap.
  const f = cropFilter('punch_in', 1080, 1920, 150, 30);
  assert.ok(f.includes('zoompan'));
  assert.ok(!/zoompan[^,]*fps=/.test(f), `zoompan van mang fps: ${f}`);
});

/* ─────────── Nguong do dai theo CLIP THAT ─────────── */

test('clip 8 giay KHONG bi doi 15 giay thanh pham', () => {
  // Ca bon clip mau 28/10 deu dung 8 giay. Quy tac cung 15 giay se chan sach — chan
  // mot clip hop le chi vi no ngan la chan oan.
  const duoi = minTotalFor(8000);
  assert.ok(duoi <= 8000, `doi ${duoi}ms tu clip 8000ms`);
  assert.ok(duoi >= ABS_MIN_TOTAL_MS);
});

test('clip dai thi van giu nguong 15 giay', () => {
  assert.equal(minTotalFor(30000), MIN_TOTAL_MS);
  assert.equal(minTotalFor(60000), MIN_TOTAL_MS);
});

test('nguong duoi KHONG BAO GIO vuot thu clip that co', () => {
  for (const d of [6000, 8000, 12000, 20000, 30000]) {
    assert.ok(minTotalFor(d) <= d, `clip ${d}ms ma doi ${minTotalFor(d)}ms`);
  }
});

test('nguong tren khong vuot do dai clip', () => {
  assert.ok(maxTotalFor(8000) <= 8000);
  assert.equal(maxTotalFor(60000), MAX_TOTAL_MS);
});

test('nguong duoi luon nho hon nguong tren', () => {
  for (const d of [6000, 8000, 15000, 26000, 60000]) {
    assert.ok(minTotalFor(d) <= maxTotalFor(d), `clip ${d}ms: ${minTotalFor(d)} > ${maxTotalFor(d)}`);
  }
});

test('do dai la hoac 0 thi lui ve nguong mac dinh', () => {
  for (const d of [0, -5, NaN]) {
    assert.equal(minTotalFor(d as number), MIN_TOTAL_MS);
    assert.equal(maxTotalFor(d as number), MAX_TOTAL_MS);
  }
});
