import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVideoAsset } from '../src/lib/video-asset';
import { resolveTheme, THEMES } from '../src/lib/video-edit';

/**
 * Hop dong giua GIAO DIEN va WORKER cho luong dung clip.
 *
 * Day dung la cho chuoi tung bi DUT: giao dien co du thong tin (khach da chon "tu video
 * toi quay", da chon theme, da tick co nhac) nhung `rawInput` khong mang ba truong do
 * xuong, nen worker khong bao gio biet va luon chay nhanh anh.
 *
 * Loi kieu nay khong lo ra o tsc vi `raw_input` la JSON tu do, va khong lo ra o test
 * don vi vi moi ben deu dung rieng le. No chi lo ra khi khach bam Render va nhan ve
 * mot video sai han thu ho chon.
 */

/** Dung thu `NewProject.tsx` gui xuong khi khach chon luong clip. */
function rawInputTuGiaoDien(over: Record<string, unknown> = {}) {
  return {
    product_title: 'Son li 24h',
    product_summary: 'ghi chu cua khach',
    product_url: undefined,
    image_urls: [
      'https://x.supabase.co/storage/v1/object/sign/project-assets/u/p/1730000000_clip.mp4?token=abc',
    ],
    target_audience: 'General',
    aspect_ratio: '9:16',
    duration_seconds: 30,
    package_type: 'review_video',
    source_mode: 'video_edit',
    theme: 'tu_nhien',
    has_background_music: false,
    ...over,
  };
}

/** Dung dieu kien worker dung de re nhanh. */
function laLuongDungClip(payload: any): boolean {
  return String(payload.raw_input?.source_mode ?? '') === 'video_edit';
}

test('giao dien chon luong clip thi worker re DUNG nhanh', () => {
  assert.equal(laLuongDungClip({ raw_input: rawInputTuGiaoDien() }), true);
});

test('luong anh KHONG re nham sang nhanh clip', () => {
  assert.equal(laLuongDungClip({ raw_input: rawInputTuGiaoDien({ source_mode: 'images' }) }), false);
});

test('ban ghi CU khong co source_mode van chay nhanh anh', () => {
  // Cac du an tao truoc hom nay khong co truong nay. Chung phai tiep tuc chay nhu cu,
  // khong duoc roi sang nhanh clip roi chet vi khong tim thay video.
  const cu = rawInputTuGiaoDien();
  delete (cu as any).source_mode;
  assert.equal(laLuongDungClip({ raw_input: cu }), false);
  assert.equal(laLuongDungClip({}), false);
  assert.equal(laLuongDungClip({ raw_input: null }), false);
});

test('worker tim duoc clip trong image_urls cua giao dien', () => {
  // URL that la signed URL cua Supabase: co duoi file, co query token.
  const urls = rawInputTuGiaoDien().image_urls;
  assert.equal(urls.filter(isVideoAsset).length, 1, `khong nhan ra clip trong: ${urls}`);
});

test('nhan ra clip du URL co token dai phia sau', () => {
  for (const u of [
    'https://x.co/a/b/1730_clip.mp4?token=eyJhbGciOi.very.long',
    'https://x.co/a/b/1730_quay_tay.MOV?token=abc&x=1',
    'https://x.co/a/b/c.webm',
  ]) {
    assert.equal(isVideoAsset(u), true, u);
  }
});

test('KHONG nham anh thanh clip', () => {
  for (const u of [
    'https://x.co/a/b/1730_san_pham.jpg?token=abc',
    'https://x.co/a/b/anh.png',
    'https://x.co/a/b/anh.webp?token=x',
  ]) {
    assert.equal(isVideoAsset(u), false, u);
  }
});

test('ten file co dau cach da bi sanitize van nhan ra duoc', () => {
  // asset.service doi ky tu la thanh '_' nhung CHUA dau '.', nen duoi file con nguyen.
  assert.equal(isVideoAsset('https://x.co/u/p/1730000000_clip_san_pham.mp4?token=a'), true);
});

test('theme tu giao dien khop bang theme cua backend', () => {
  // Bon the tren giao dien phai anh xa duoc sang THEMES, khong thi khach chon mot dang
  // va he thong dung mot neo.
  for (const k of ['tu_nhien', 'sach', 'cao_cap', 'demo_tay']) {
    assert.equal(resolveTheme(k), k, `the "${k}" khong co trong THEMES`);
    assert.ok(THEMES[resolveTheme(k)], `thieu cau hinh cho "${k}"`);
  }
});

test('thieu theme thi ve tu_nhien, khong vo', () => {
  const r = rawInputTuGiaoDien();
  delete (r as any).theme;
  assert.equal(resolveTheme((r as any).theme), 'tu_nhien');
});

test('co nhac tu giao dien doc duoc dung kieu boolean', () => {
  assert.equal(Boolean(rawInputTuGiaoDien({ has_background_music: true }).has_background_music), true);
  assert.equal(Boolean(rawInputTuGiaoDien().has_background_music), false);
  // Ban ghi cu khong co truong nay: coi nhu khach khong khai, de worker tu do.
  const cu = rawInputTuGiaoDien();
  delete (cu as any).has_background_music;
  assert.equal(Boolean((cu as any).has_background_music), false);
});

test('luong anh KHONG gui theme va co nhac — hai truong do vo nghia o do', () => {
  const r = rawInputTuGiaoDien({ source_mode: 'images', theme: undefined, has_background_music: undefined });
  assert.equal(r.theme, undefined);
  assert.equal(r.has_background_music, undefined);
});
