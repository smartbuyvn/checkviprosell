import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'net-'));
const GOC = path.join(TMP, 'goc.png');

// Anh goc do net cao, co hoa tiet min de thay ro mat chi tiet.
spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
  'testsrc2=s=2400x2400:d=1,format=rgb24', '-frames:v', '1', GOC]);

/** Dung canh `detail_macro`: cat 1,28x roi dua ve khung 1080. */
function dungCan(nguon: string, ra: string) {
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', nguon, '-vf',
    'crop=iw/1.28:ih/1.28,scale=1080:1080:flags=lanczos', '-frames:v', '1', ra]);
}

console.log('MAT NET KHI CAT CAN 1,28x TU ANH NHO');
console.log('(so voi cung anh do o 2400px — SSIM 1,000 la giong het)\n');

const chuan = path.join(TMP, 'chuan.png');
dungCan(GOC, chuan);

for (const px of [600, 800, 1024, 1200, 1382, 1600, 2000]) {
  const nho = path.join(TMP, `n${px}.png`);
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', GOC, '-vf',
    `scale=${px}:${px}:flags=lanczos`, '-frames:v', '1', nho]);
  const ra = path.join(TMP, `r${px}.png`);
  dungCan(nho, ra);

  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', ra, '-i', chuan,
    '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = String(r.stderr).match(/All:([\d.]+)/);
  const ssim = m ? Number(m[1]) : NaN;
  const sauCat = Math.round(px / 1.28);
  const phong = (1080 / sauCat).toFixed(2);
  console.log(
    `  anh ${String(px).padStart(4)}px -> cat con ${String(sauCat).padStart(4)}px -> phong ${phong}x len 1080` +
    `   SSIM ${ssim.toFixed(4)}${px >= 1382 ? '' : '   <- phai phong len'}`
  );
}
fs.rmSync(TMP, { recursive: true, force: true });
export {};
