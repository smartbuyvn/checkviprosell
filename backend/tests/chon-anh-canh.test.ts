/**
 * Worker phải dùng đúng ảnh mà kế hoạch chỉ định cho từng cảnh.
 *
 * Lỗi thật đo ngày 29/10/2026: `buildFfmpegCommandFromPlan` nhận `inputImages` rồi
 * chọn bằng `inputImages[Math.min(i, len-1)]` — tức theo CHỈ SỐ CẢNH, kẹp trần. Với
 * 6 cảnh và 3 ảnh thì ra:
 *
 *   image_1  image_2  image_3  image_3  image_3  image_3
 *
 * Bốn cảnh cuối cùng một tấm ảnh — 14 giây liền. Đó chính là lời than "video đơn
 * điệu", và nó xảy ra DÙ tầng kế hoạch đã chạy `spreadAssets` rải đều thành 2/2/2 và
 * ghi vào `asset_id`: kết quả đó bị ném đi vì không ai đọc.
 *
 * Khuôn lỗi quen thuộc của dự án này — hàm viết đủ, chỗ dùng không nối.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spreadAssets } from '../src/lib/camera-moves';

const WORKER = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');

test('worker doc asset_id cua tung canh', () => {
  assert.match(
    WORKER,
    /assetById\[item\.asset_id\]/,
    'Worker phai tra anh theo asset_id cua ke hoach, khong lay theo chi so canh'
  );
});

test('assetById duoc truyen vao ham dung lenh, khong chi nam trong scope ngoai', () => {
  // Ban cu co `assetById` day du nhung khong bao gio truyen xuong — bien song ma
  // vo dung la khong khac gi khong co.
  const soLanTruyen = (WORKER.match(/buildFfmpegCommandFromPlan\([^)]*assetById/g) || []).length;
  assert.ok(soLanTruyen >= 2, `Chi ${soLanTruyen} cho goi truyen assetById; phai du ca duong NVENC lan duong CPU`);
});

test('van co duong lui khi asset_id khong tra duoc anh', () => {
  // Ke hoach cu khong co asset_id, hoac id khong khop anh nao tai duoc — luc do van
  // phai ra video chu khong duoc no.
  assert.match(
    WORKER,
    /assetById\[item\.asset_id\]\)\s*\|\|\s*inputImages\[imgIdx\]/,
    'Thieu duong lui ve chi so canh'
  );
});

test('spreadAssets rai deu dung du lieu that da gay loi', () => {
  // Du lieu lay tu render a7d667cc: model doi image_1 cho 4/6 canh.
  const muon = ['image_1', 'image_2', 'image_1', 'image_3', 'image_1', 'image_1'];
  const co = ['image_1', 'image_2', 'image_3'];
  const ra = spreadAssets(muon, co);

  const dem = new Map<string, number>();
  for (const a of ra) dem.set(a, (dem.get(a) ?? 0) + 1);

  for (const anh of co) {
    assert.equal(dem.get(anh), 2, `${anh} phai len hinh dung 2 lan, thuc te ${dem.get(anh)}`);
  }
  for (let i = 1; i < ra.length; i++) {
    assert.notEqual(ra[i], ra[i - 1], `Canh ${i} lap lai anh cua canh truoc: ${ra.join(' ')}`);
  }
});

test('khong anh nao bi bo quen khi so canh it hon so anh', () => {
  const ra = spreadAssets(['a', 'a'], ['a', 'b', 'c']);
  // Hai canh thi khong the dung het ba anh, nhung khong duoc lap lien tiep.
  assert.notEqual(ra[0], ra[1], `Hai canh lien tiep trung anh: ${ra.join(' ')}`);
});
