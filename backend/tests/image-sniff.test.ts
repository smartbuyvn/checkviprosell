import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Chan loai loi: tai ve mot thu KHONG phai anh roi dem di dung video.
 *
 * safeDownload chi kiem ma HTTP va kich thuoc. Mot URL tra 200 kem HTML (trang loi,
 * hoac SPA fallback cua nginx) van duoc ghi thanh .jpg, ffmpeg nhan rac va cho ra
 * video rong — khong loi, khong dau vet. Phai nhan ra ngay luc tai.
 */

// sniffImageType nam trong render.worker.ts, ma file do khoi tao Supabase client o
// top level nen import vao test se doi bien moi truong. Doc lai logic tu ma nguon
// de kiem dung ham that dang duoc dung, thay vi chep mot ban song song roi tu kiem.
const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'render.worker.ts'),
  'utf8'
);

/** Trich ham sniffImageType tu ma nguon va chay that. */
function loadSniffer(): (buf: Buffer) => string | null {
  const start = SRC.indexOf('function sniffImageType');
  assert.notEqual(start, -1, 'khong tim thay sniffImageType trong render.worker.ts');

  let depth = 0;
  let end = -1;
  for (let i = SRC.indexOf('{', start); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.notEqual(end, -1, 'ham sniffImageType khong dong ngoac');

  const body = SRC.slice(start, end)
    .replace(/: Buffer/g, '')
    .replace(/: string \| null/g, '');

  // eslint-disable-next-line no-new-func
  return new Function('Buffer', `${body}; return sniffImageType;`)(Buffer);
}

const sniff = loadSniffer();

test('nhan dung JPEG', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
  assert.equal(sniff(jpeg), 'jpeg');
});

test('nhan dung PNG', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(20),
  ]);
  assert.equal(sniff(png), 'png');
});

test('nhan dung WebP', () => {
  const webp = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(20),
  ]);
  assert.equal(sniff(webp), 'webp');
});

test('nhan dung GIF', () => {
  const gif = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(20)]);
  assert.equal(sniff(gif), 'gif');
});

test('TU CHOI trang HTML — day la thu nginx tra ve cho duong dan thieu', () => {
  const html = Buffer.from('<!doctype html><html><head><title>404</title></head></html>', 'utf8');
  assert.equal(sniff(html), null, 'HTML bi nham la anh se cho ra video rong');
});

test('TU CHOI JSON loi', () => {
  const json = Buffer.from('{"error":"object not found","statusCode":"404"}', 'utf8');
  assert.equal(sniff(json), null);
});

test('TU CHOI file rong va file qua ngan', () => {
  assert.equal(sniff(Buffer.alloc(0)), null);
  assert.equal(sniff(Buffer.from([0xff, 0xd8])), null, 'file cut giua chung khong duoc tinh la hop le');
});

test('downloadImage nem loi co kem dau file de con lan ra nguyen nhan', () => {
  assert.match(SRC, /NOT_AN_IMAGE/, 'phai co ma loi rieng cho truong hop nay');
  assert.match(SRC, /Dau file/, 'phai in dau file ra, neu khong lai phai doan tiep');
});
