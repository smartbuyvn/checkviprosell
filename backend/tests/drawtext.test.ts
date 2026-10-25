import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildDrawtext, escapeDrawText } from '../src/lib/drawtext';

const run = promisify(execFile);
const FONT = process.platform === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '';

/**
 * Render one black frame with the given text and report how many non-black pixels it has.
 * Text that FFmpeg silently drops leaves the frame pure black.
 */
async function inkPixels(text: string): Promise<number> {
  const dir = await mkdtemp(path.join(tmpdir(), 'viprosell-drawtext-'));
  const out = path.join(dir, 'frame.rgb');
  try {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=640x200:d=0.1',
      '-vf', buildDrawtext(text, 28, '80', 'white', FONT),
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', out,
    ]);
    const buf = await readFile(out);
    let lit = 0;
    for (let i = 0; i < buf.length; i += 3) {
      if (buf[i] > 40 || buf[i + 1] > 40 || buf[i + 2] > 40) lit++;
    }
    return lit;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('escapeDrawText keeps % and does not truncate', () => {
  assert.equal(escapeDrawText('Giảm 50% hôm nay'), 'Giảm 50% hôm nay');
  const long = 'A'.repeat(120);
  assert.equal(escapeDrawText(long).length, 120);
  assert.equal(escapeDrawText("Gia chi 99:000 'hot'"), 'Gia chi 99\\:000 hot');
  assert.equal(escapeDrawText('C:\\path\\x'), 'C\\:/path/x');
});

test('buildDrawtext sets expansion=none', () => {
  assert.match(buildDrawtext('x', 28, '80'), /expansion=none/);
});

test('text containing % actually renders (regression: it used to vanish)', async () => {
  const plain = await inkPixels('Giam 50 hom nay');
  const withPercent = await inkPixels('Giam 50% hom nay');
  assert.ok(plain > 500, `cảnh nền không có chữ: ${plain} pixel`);
  // Trước khi sửa, con số này là 0 — FFmpeg bỏ cả dòng chữ mà vẫn thoát mã 0
  assert.ok(withPercent > 500, `chữ có % bị mất: chỉ ${withPercent} pixel sáng`);
});

test('Vietnamese diacritics and punctuation render', async () => {
  const lit = await inkPixels('Giảm 50% hôm nay — chỉ 199.000đ');
  assert.ok(lit > 500, `chữ tiếng Việt bị mất: ${lit} pixel sáng`);
});
