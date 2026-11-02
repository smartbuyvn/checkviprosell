/**
 * Đặt 30 giây thì phải ra 30 giây.
 *
 * ── Vì sao ──
 *
 * Các nền tảng xếp video ngắn theo mốc thời lượng, nên một video đặt 30 giây mà xuất
 * xưởng ở 35 giây là lệch mốc.
 *
 * Đo trên render `57c684ca` ngày 31/10: tầng 3 viết lời thoại dài hơn sức chứa ở
 * **tám trên mười** cảnh (61–72 ký tự cho ô 3 giây chỉ chứa được 51), nên mọi cảnh
 * đều bị kéo ra và video dài 35,10 giây thay vì 30,00.
 *
 * ── Thứ tự ưu tiên ──
 *
 *   1. Vừa sẵn thì giữ nguyên.
 *   2. Hơi dài thì cắt chữ ở ranh giới từ.
 *   3. Còn dư thì tăng nhịp đọc tới 1,15× — giữ trọn chữ.
 *   4. Vẫn dư thì mới kéo cảnh. Đây là lựa chọn CUỐI CÙNG.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  catLoiChoVua,
  tempoChoVua,
  kyTuToiDa,
  khopCanhVoiTieng,
  TEMPO_TOI_DA,
  KHOANG_LANG,
} from '../src/lib/khop-tieng';

test('loi da vua thi giu nguyen tung chu', () => {
  const loi = 'Áo trễ vai dễ mặc.';
  assert.equal(catLoiChoVua(loi, 5), loi);
});

test('loi qua dai thi bi cat, va cat o RANH GIOI TU', () => {
  const loi = 'Chất thun tăm mềm mại ôm nhẹ theo dáng người mặc rất thoải mái cả ngày dài';
  const ra = catLoiChoVua(loi, 3);
  assert.ok(ra.length < loi.length, 'Khong cat gi ca');
  // Khong duoc cat giua mot tu: ky tu cuoi truoc dau cham phai thuoc mot tu tron.
  const thanTu = ra.replace(/[.\s]+$/, '');
  assert.ok(loi.startsWith(thanTu), `Cat ra "${thanTu}" khong phai tien to cua cau goc`);
  const sauDo = loi.slice(thanTu.length);
  assert.ok(sauDo === '' || sauDo.startsWith(' '), `Cat giua tu: "...${thanTu.slice(-12)}|${sauDo.slice(0, 8)}..."`);
});

test('uu tien cat o DAU CAU khi co the', () => {
  const loi = 'Áo rất đẹp. Chất vải mềm mại thoáng mát và mặc cả ngày không hề thấy bí chút nào';
  const ra = catLoiChoVua(loi, 2.5);
  assert.ok(ra.endsWith('.'), `Khong ket thuc bang dau cham: "${ra}"`);
});

test('loi cat ra VUA duoc canh, tinh ca phan tang nhip', () => {
  for (const giay of [2, 2.5, 3, 3.5, 4]) {
    const loi = 'a'.repeat(400);
    const ra = catLoiChoVua(loi, giay);
    const tran = kyTuToiDa(giay) * TEMPO_TOI_DA;
    assert.ok(ra.length <= tran + 1, `${giay}s: cat ra ${ra.length} ky tu, tran ${tran.toFixed(0)}`);
  }
});

test('loi rong hoac hong khong lam no', () => {
  for (const x of ['', '   ', null, undefined]) {
    assert.equal(catLoiChoVua(x as never, 3), '');
  }
});

/* ── Tăng nhịp đọc ── */

test('tieng da vua thi KHONG tang nhip', () => {
  // Doc nhanh hon muc can thiet la lam hong nhip ma khong duoc gi.
  assert.equal(tempoChoVua(2.0, 3), 1);
  assert.equal(tempoChoVua(2.74, 3), 1, 'Vua sat tran van bi tang nhip');
});

test('tieng hoi dai thi tang nhip vua du', () => {
  // Canh 3 giay, tru 0,25 im lang, con 2,75 giay cho tieng.
  const t = tempoChoVua(3.0, 3);
  assert.ok(t > 1 && t <= TEMPO_TOI_DA, `He so ${t} ngoai khoang`);
  assert.ok(Math.abs(3.0 / t - (3 - KHOANG_LANG)) < 0.05, `Sau khi tang nhip van khong vua: ${(3.0 / t).toFixed(2)}s`);
});

test('KHONG BAO GIO vuot tran nghe tu nhien', () => {
  // Tren 1,25 thi tieng noi nghe gap gap, va gap gap doc ra la thieu tin cay.
  assert.ok(TEMPO_TOI_DA <= 1.2, `Tran ${TEMPO_TOI_DA} qua cao, se nghe gap gap`);
  for (const dai of [5, 10, 60, 600]) {
    assert.ok(tempoChoVua(dai, 3) <= TEMPO_TOI_DA, `${dai}s bi tang nhip qua tran`);
  }
});

test('KHONG BAO GIO lam cham lai', () => {
  // Keo dan tieng noi nghe con lo hon nen.
  for (const dai of [0.1, 0.5, 1]) {
    assert.equal(tempoChoVua(dai, 3), 1, `${dai}s bi lam cham lai`);
  }
});

test('do dai hong thi doc nguyen nhip', () => {
  for (const x of [null, undefined, 0, -1, NaN]) {
    assert.equal(tempoChoVua(x as never, 3), 1);
  }
});

/* ── Ba bước cộng lại phải giữ đúng thời lượng ── */

test('cat chu + tang nhip thi KHONG con phai keo canh', () => {
  /**
   * Day la phep kiem tong hop: lay dung tinh huong da hong ngay 31/10 — muoi canh,
   * loi dai 20-40% so voi suc chua — roi chay het ba buoc.
   */
  const giayCanh = 3;
  const loiGoc = 'Chất thun tăm mềm mại, ôm nhẹ theo dáng, mặc lên rất thoải mái cả ngày';
  assert.ok(loiGoc.length > kyTuToiDa(giayCanh), 'Du lieu thu khong con qua dai, phep kiem mat y nghia');

  const loi = catLoiChoVua(loiGoc, giayCanh);
  // Do dai tieng uoc theo cong thuc do that: giay = ky_tu / 28,3 + 0,93.
  const giayTieng = loi.length / 28.3 + 0.93;
  const tempo = tempoChoVua(giayTieng, giayCanh);
  const sauNhip = giayTieng / tempo;

  assert.ok(
    sauNhip <= giayCanh - KHOANG_LANG + 0.02,
    `Sau khi cat va tang nhip van con ${sauNhip.toFixed(2)}s, canh chi chua ${(giayCanh - KHOANG_LANG).toFixed(2)}s`
  );

  // Va khi do `khopCanhVoiTieng` khong duoc keo them gi.
  const tl = [{ start_sec: 0, end_sec: giayCanh }];
  const khop = khopCanhVoiTieng(tl as never, [sauNhip]);
  assert.equal(khop.keoThem, 0, `Van keo them ${khop.keoThem}s`);
});

test('video 30 giay giu dung 30 giay sau ca ba buoc', () => {
  const soCanh = 10;
  const giayCanh = 3;
  const loiGoc = 'Form basic nên bạn có thể mặc đi làm hoặc đi chơi đều rất hợp lý';

  const tl = Array.from({ length: soCanh }, (_, i) => ({ start_sec: i * giayCanh, end_sec: (i + 1) * giayCanh }));
  const daiTieng = tl.map(() => {
    const loi = catLoiChoVua(loiGoc, giayCanh);
    const giay = loi.length / 28.3 + 0.93;
    return giay / tempoChoVua(giay, giayCanh);
  });

  const khop = khopCanhVoiTieng(tl as never, daiTieng);
  const tong = khop.timeline[khop.timeline.length - 1].end_sec;
  assert.equal(khop.keoThem, 0, `Phinh them ${khop.keoThem}s`);
  assert.ok(Math.abs(tong - soCanh * giayCanh) < 0.01, `Tong ${tong}s thay vi ${soCanh * giayCanh}s`);
});

/* ── Worker phải dùng cả ba bước, đúng thứ tự ── */

test('worker cat loi TRUOC khi tong hop, khong cat sau', () => {
  // Tra tien TTS cho nhung chu se bi bo di la tra tien cho rac.
  const s = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');
  assert.match(s, /catLoiChoVua\(/, 'Worker khong cat loi thoai');
  assert.ok(
    s.indexOf('catLoiChoVua(') < s.indexOf('await synthesize('),
    'Cat loi SAU khi tong hop — tra tien TTS cho chu se bi bo di'
  );
});

test('atempo dat TRUOC adelay', () => {
  // `atempo` doi do dai doan tieng; chay sau adelay thi no keo ca khoang im lang o
  // dau va moc thoi gian bi xe dich.
  const s = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');
  const m = s.match(/\[\$\{inputIndex\}:a\]\$\{[^`]*`/);
  assert.ok(m, 'Khong tim thay chuoi loc tieng');
  const chuoi = m![0];
  assert.ok(chuoi.indexOf('nhip') < chuoi.indexOf('adelay'), `atempo nam sau adelay: ${chuoi}`);
});

test('keo canh la lua chon CUOI CUNG', () => {
  const s = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');
  assert.ok(
    s.indexOf('tempoChoVua(') < s.indexOf('khopCanhVoiTieng('),
    'Keo canh chay truoc khi tang nhip — se keo nhieu hon can thiet'
  );
});
