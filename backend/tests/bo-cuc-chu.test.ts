/**
 * Bố cục chữ phải GIỐNG NHAU ở cả hai luồng dựng, và tuỳ chọn "bỏ chữ" phải có tác
 * dụng ở cả hai.
 *
 * ── Hai lỗi lần này ──
 *
 * 1. `video-edit.job.ts` (luồng clip tự quay) dựng phụ đề rồi đốt lên video **dù
 *    khách đã tick "Không chèn chữ lên video"**. Nó không hề đọc `no_text_overlay` —
 *    chỉ luồng ảnh đọc. Người bán tick xong vẫn thấy chữ, và không có cách nào biết
 *    vì sao.
 *
 * 2. Hai luồng tự tính bố cục riêng: luồng ảnh dùng Montserrat với cỡ chữ theo BỀ
 *    NGANG khung, luồng clip dùng Arial với cỡ chữ theo CHIỀU CAO, và đặt
 *    `overlayMarginV = 0,17·h` ngay sát `subMarginV = 0,18·h`. Từ khi Overlay đổi
 *    sang neo mép dưới (alignment 8 → 2), hai cụm chữ đó chồng lên nhau.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boCucChu, FONT_CHU } from '../src/lib/bo-cuc-chu';

const doc = (f: string) => readFileSync(join(__dirname, '..', 'src', f), 'utf8');

test('khung DOC van chua phan tu duoi cho lop phu nen tang', () => {
  const bc = boCucChu(1080, 1920);
  const tuDay = bc.subMarginV / 1920;
  assert.ok(tuDay >= 0.25, `Phu de chi cach day ${(tuDay * 100).toFixed(1)}%, chui vao vung TikTok dat caption`);
  assert.ok(tuDay < 0.30, `Phu de cach day ${(tuDay * 100).toFixed(1)}%, day chu len qua cao`);
});

test('khung VUONG khong chua phan tu duoi — no duoc long khung, lop phu nam ngoai', () => {
  const bc = boCucChu(1080, 1080);
  const tuDay = bc.subMarginV / 1080;
  assert.ok(tuDay <= 0.10, `Khung vuong chua ${(tuDay * 100).toFixed(1)}% day — chu bi day len giua anh san pham`);
});

test('ca tieu de lan phu de deu nam o NUA DUOI khung', () => {
  for (const [w, h] of [[1080, 1920], [1080, 1080], [1920, 1080]]) {
    const bc = boCucChu(w, h);
    assert.ok(
      bc.overlayMarginV < h * 0.5,
      `${w}x${h}: tieu de cach day ${bc.overlayMarginV}px (${((bc.overlayMarginV / h) * 100).toFixed(0)}%) — nam o nua tren`
    );
  }
});

test('tieu de nam TREN phu de, du cho hai dong, nhung sat nhau', () => {
  for (const [w, h] of [[1080, 1920], [1080, 1080], [1920, 1080]]) {
    const bc = boCucChu(w, h);
    const khe = bc.overlayMarginV - bc.subMarginV;
    const haiDong = bc.subFontSize * 1.25 * 2;

    assert.ok(khe > haiDong, `${w}x${h}: khe ${khe}px khong du hai dong phu de (${haiDong.toFixed(0)}px) — chu se de nhau`);
    assert.ok(
      khe < haiDong + bc.subFontSize * 0.6,
      `${w}x${h}: khe ${khe}px roi rac qua so voi hai dong ${haiDong.toFixed(0)}px — hai cum khong doc nhu mot`
    );
  }
});

test('co chu tinh theo BE NGANG, khong theo chieu cao', () => {
  // Cung be ngang, khac chieu cao -> cung co chu.
  assert.equal(boCucChu(1080, 1920).subFontSize, boCucChu(1080, 1080).subFontSize);
  // Khac be ngang -> khac co chu.
  assert.notEqual(boCucChu(1080, 1080).subFontSize, boCucChu(1920, 1080).subFontSize);
});

test('le hai ben du rong de tranh cot nut ben phai', () => {
  const bc = boCucChu(1080, 1920);
  assert.ok(bc.marginH >= 0.12 * 1080, 'Le ngang hep, chu chui xuong duoi cot nut TikTok');
});

test('luong CLIP ton trong tuy chon bo chu', () => {
  const s = doc('video-edit.job.ts');
  assert.match(s, /no_text_overlay/, 'video-edit.job.ts khong doc no_text_overlay — tick bo chu se vo tac dung');
  assert.match(s, /khongChenChu/, 'video-edit.job.ts khong co nhanh bo chu');
});

test('luong ANH ton trong tuy chon bo chu', () => {
  const s = doc('render.worker.ts');
  assert.match(s, /no_text_overlay/, 'render.worker.ts khong doc no_text_overlay');
  assert.match(s, /tuyChon\.khongChu/, 'render.worker.ts khong co nhanh bo chu');
});

test('CA HAI luong doc chung mot nguon bo cuc', () => {
  for (const f of ['render.worker.ts', 'video-edit.job.ts']) {
    const s = doc(f);
    assert.match(s, /boCucChu\(/, `${f} khong goi boCucChu — bo cuc se lech giua hai luong`);
    assert.match(s, /FONT_CHU/, `${f} khong dung FONT_CHU — hai luong se khac font`);
  }
});

test('khong con le viet cung trong luong clip', () => {
  const s = doc('video-edit.job.ts');
  // Day la hinh hai cu: tieu de 0,17h ngay sat phu de 0,18h, va font Arial viet cung.
  assert.doesNotMatch(s, /overlayMarginV:\s*Math\.round\(0\.17/, 'Van con le tieu de viet cung 0,17h');
  assert.doesNotMatch(s, /fontName:\s*'Arial'/, "Van con fontName: 'Arial' viet cung");
});

test('font lay tu bien moi truong, co duong lui', () => {
  assert.ok(FONT_CHU.length > 0, 'FONT_CHU rong');
});
