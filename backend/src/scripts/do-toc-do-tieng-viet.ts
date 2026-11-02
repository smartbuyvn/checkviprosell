/**
 * Do toc do noi tieng Viet bang chinh nha cung cap TTS dang chay.
 *
 * Cong thuc trong TECHNIQUE.md cua lemo-opuscar tinh cho tieng Anh (letters/15+1.5)
 * va tieng Trung (chars/4.5+1.5). Tieng Viet khac ca hai: am tiet tach roi bang dau
 * cach, co dau thanh, va mot "tu" thuong la hai am tiet. Phai do chu khong muon.
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { synthesize } from '../services/tts.provider';

const CAU = [
  'Áo đẹp lắm',
  'Hai màu đen và đỏ',
  'Áo trễ vai HAVATA, chất gân tăm',
  'Áo trễ vai HAVATA, hai màu đen và đỏ, đủ size S M L',
  'Chất gân tăm co giãn, ôm dáng, mặc đi chơi hay đi làm đều hợp',
  'Cổ trễ vai lệch khoe xương quai xanh, phối với quần ống rộng hoặc chân váy đều rất xinh',
];

function doDai(f: string): Promise<number> {
  return new Promise((ok) => {
    const p = spawn('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', f]);
    let o = ''; p.stdout.on('data', (d) => { o += d; });
    p.on('close', () => ok(Number(o.trim()) || 0));
    p.on('error', () => ok(0));
  });
}

(async () => {
  console.log('  kytu  amtiet  giay   kytu/s  amtiet/s   cau');
  console.log('  ' + '-'.repeat(78));
  const diem: Array<{ kyTu: number; amTiet: number; giay: number }> = [];

  for (const cau of CAU) {
    const r = await synthesize({ text: cau });
    if (!r?.filePath || !fs.existsSync(r.filePath)) { console.log(`  LOI: ${cau}`); continue; }
    const giay = await doDai(r.filePath);
    const kyTu = cau.length;
    const amTiet = cau.trim().split(/\s+/).length;
    diem.push({ kyTu, amTiet, giay });
    console.log(
      `  ${String(kyTu).padStart(4)}  ${String(amTiet).padStart(6)}  ${giay.toFixed(2).padStart(5)}` +
      `  ${(kyTu/giay).toFixed(1).padStart(6)}  ${(amTiet/giay).toFixed(2).padStart(8)}   ${cau.slice(0,40)}`
    );
  }

  // Hoi quy tuyen tinh giay = a*kyTu + b, binh phuong toi thieu.
  const n = diem.length;
  const sx = diem.reduce((t,d)=>t+d.kyTu,0), sy = diem.reduce((t,d)=>t+d.giay,0);
  const sxy = diem.reduce((t,d)=>t+d.kyTu*d.giay,0), sxx = diem.reduce((t,d)=>t+d.kyTu*d.kyTu,0);
  const a = (n*sxy - sx*sy) / (n*sxx - sx*sx);
  const b = (sy - a*sx) / n;
  console.log(`\n  Hoi quy: giay = ${a.toFixed(4)} * kyTu + ${b.toFixed(3)}`);
  console.log(`  Tuc la : kyTu / ${(1/a).toFixed(1)} + ${b.toFixed(2)}`);
  console.log(`  (tieng Anh: kyTu/15 + 1.5 | tieng Trung: kyTu/4.5 + 1.5)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
