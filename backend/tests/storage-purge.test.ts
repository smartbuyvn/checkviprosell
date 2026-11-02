import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storagePathFromUrl, renderStoragePaths } from '../src/lib/storage-purge';

/**
 * Don file qua han. Day la ma XOA DU LIEU THAT nen test tap trung vao viec
 * KHONG xoa nham, hon la viec xoa duoc.
 */

const BASE = 'https://zwyslulwwfdvjxrkcleq.supabase.co/storage/v1/object/public';

test('lay dung duong dan tu URL cong khai', () => {
  const url = `${BASE}/renders/render_final_abc-123.mp4`;
  assert.equal(storagePathFromUrl(url, 'renders'), 'render_final_abc-123.mp4');
});

test('lay dung duong dan co thu muc', () => {
  const url = `${BASE}/project-assets/user-1/anh-1.jpg`;
  assert.equal(storagePathFromUrl(url, 'project-assets'), 'user-1/anh-1.jpg');
});

test('TU CHOI url cua bucket KHAC — day la cho de xoa nham nhat', () => {
  const url = `${BASE}/project-assets/user-1/anh-1.jpg`;
  assert.equal(
    storagePathFromUrl(url, 'renders'),
    null,
    'nhan nham bucket thi lenh xoa video se tro vao anh goc cua khach'
  );
});

test('TU CHOI url khong phai cua Supabase Storage', () => {
  assert.equal(storagePathFromUrl('https://example.com/video.mp4', 'renders'), null);
  assert.equal(storagePathFromUrl('https://v.ninhle.com/assets/x.js', 'renders'), null);
});

test('TU CHOI url rong hoac khong phai chuoi', () => {
  assert.equal(storagePathFromUrl('', 'renders'), null);
  assert.equal(storagePathFromUrl(null as any, 'renders'), null);
  assert.equal(storagePathFromUrl(undefined as any, 'renders'), null);
});

test('TU CHOI duong dan leo ra ngoai', () => {
  const url = `${BASE}/renders/..%2F..%2Fproject-assets%2Fanh.jpg`;
  assert.equal(storagePathFromUrl(url, 'renders'), null, 'duong dan co .. phai bi chan');
});

test('bo tham so truy van sau dau ?', () => {
  const url = `${BASE}/renders/video.mp4?t=123&download=`;
  assert.equal(storagePathFromUrl(url, 'renders'), 'video.mp4');
});

test('giai ma ky tu da ma hoa trong duong dan', () => {
  const url = `${BASE}/renders/thu%20muc/video%20moi.mp4`;
  assert.equal(storagePathFromUrl(url, 'renders'), 'thu muc/video moi.mp4');
});

test('gom ca video va anh dai dien cua mot ban render', () => {
  const paths = renderStoragePaths({
    output_url: `${BASE}/renders/render_final_x.mp4`,
    thumbnail_url: `${BASE}/renders/render_final_x.jpg`,
  });
  assert.deepEqual(paths, ['render_final_x.mp4', 'render_final_x.jpg']);
});

test('ban render chua co anh dai dien thi chi lay video', () => {
  const paths = renderStoragePaths({
    output_url: `${BASE}/renders/render_final_x.mp4`,
    thumbnail_url: null,
  });
  assert.deepEqual(paths, ['render_final_x.mp4']);
});

test('ban render chua co gi thi tra mang rong, khong nem loi', () => {
  assert.deepEqual(renderStoragePaths({ output_url: null, thumbnail_url: null }), []);
  assert.deepEqual(renderStoragePaths({}), []);
});
