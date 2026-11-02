import { test } from 'vitest';
import assert from 'node:assert/strict';
import { assetUrls } from './assetUrls';

/**
 * Lay URL anh tu hang `project_assets`.
 *
 * Boi canh 28/10: cot that la `file_url`, nhung giao dien doc `a.url`. `getByProject`
 * dung `select('*')` nen tra hang tho va TypeScript khong bat giup duoc — moi hang cho
 * ra `undefined`.
 *
 * Hau qua di qua hai giai doan, ca hai deu te:
 *   1. Mang `[undefined, ...]` di thang xuong worker va no o `u.split('/')`.
 *   2. Sau khi them bo loc null, no thanh mang RONG va chan cung voi thong bao
 *      "Chua co anh nao tai len duoc" — trong khi anh van nam du trong CSDL.
 *
 * Sai ten cot la loi IM LANG. Test nay la cho duy nhat bat duoc no.
 */

test('doc dung cot file_url', () => {
  const hang = [
    { id: '1', file_url: 'https://x/a.jpg', asset_type: 'image' },
    { id: '2', file_url: 'https://x/b.png', asset_type: 'image' },
  ];
  assert.deepEqual(assetUrls(hang), ['https://x/a.jpg', 'https://x/b.png']);
});

test('KHONG tra mang rong khi hang co file_url — day la loi 28/10', () => {
  const hang = [{ id: '1', file_url: 'https://x/a.jpg' }];
  assert.equal(assetUrls(hang).length, 1, 'doc nham ten cot, anh that bi bo qua');
});

test('van nhan `url` lam phuong an du phong', () => {
  // Phong khi service doi sang tra hang da anh xa.
  assert.deepEqual(assetUrls([{ url: 'https://x/c.jpg' }]), ['https://x/c.jpg']);
});

test('file_url duoc uu tien hon url khi co ca hai', () => {
  assert.deepEqual(
    assetUrls([{ file_url: 'https://x/that.jpg', url: 'https://x/cu.jpg' }]),
    ['https://x/that.jpg']
  );
});

test('bo hang thieu URL, giu hang con lai', () => {
  const hang = [
    { id: '1', file_url: 'https://x/a.jpg' },
    { id: '2', file_url: null },
    { id: '3' },
    { id: '4', file_url: '   ' },
    { id: '5', file_url: 'https://x/e.jpg' },
  ];
  // Upload do dang de lai hang khong URL; bo rieng chung, khong bo ca lo.
  assert.deepEqual(assetUrls(hang), ['https://x/a.jpg', 'https://x/e.jpg']);
});

test('null/undefined/rong khong lam no vo', () => {
  for (const x of [null, undefined, []]) {
    assert.deepEqual(assetUrls(x as any), []);
  }
});

test('hang la null trong mang khong lam no vo', () => {
  assert.deepEqual(assetUrls([null, undefined, { file_url: 'https://x/a.jpg' }] as any), ['https://x/a.jpg']);
});

test('URL co token van giu nguyen', () => {
  // Supabase tra signed URL kem query string; cat mat token la anh khong tai duoc.
  const u = 'https://x.supabase.co/storage/v1/object/sign/project-assets/p/a.jpg?token=eyJhbGci';
  assert.deepEqual(assetUrls([{ file_url: u }]), [u]);
});

test('khong tra ve gia tri khong phai chuoi', () => {
  const hang = [{ file_url: 123 }, { file_url: {} }, { file_url: true }, { file_url: 'https://x/ok.jpg' }];
  assert.deepEqual(assetUrls(hang as any), ['https://x/ok.jpg']);
});
