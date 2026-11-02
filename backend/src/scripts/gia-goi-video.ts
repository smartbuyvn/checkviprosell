/** Giá vốn từng loại gói video, quy ra VND. Nguồn giá ghi trong spec nghiên cứu. */
const USD = 26_000;
const d = (usd: number) => Math.round(usd * USD).toLocaleString('vi') + 'd';
const GIAY = 30, GIA_BAN_STARTER = 4_300;

console.log('=== GIA VON MOI VIDEO 30 GIAY ===\n');
const goi: Array<[string, number, string]> = [
  ['Hien tai (ffmpeg Ken Burns + nang anh)', 538 / USD, 'da do'],
  ['Loi giua: 2.5D parallax + doi mau (CPU VPS)', 538 / USD, 'cong them ~0d'],
  ['Loi giua, mask chay tren T4 thue', (538 + 4 * 52) / USD, '4 anh x ~52d'],
  ['AI i2v — Wan 2.5 (fal $0,05/giay)', 0.05 * GIAY, 're nhat'],
  ['AI i2v — Kling 2.5 Turbo ($0,07/giay)', 0.07 * GIAY, ''],
  ['AI i2v — Wan 2.1 Replicate 480p ($0,09/giay)', 0.09 * GIAY, ''],
  ['AI i2v — Seedance 2 (~$0,24/giay)', 0.24 * GIAY, 'dat nhat'],
];
for (const [ten, usd, ghi] of goi) {
  const vnd = usd * USD;
  const lan = vnd / GIA_BAN_STARTER;
  const co = lan > 1 ? `  >>> GAP ${lan.toFixed(1)} LAN GIA BAN` : `  bien lai ${((1 - vnd / GIA_BAN_STARTER) * 100).toFixed(0)}%`;
  console.log(`${ten.padEnd(46)} ${d(usd).padStart(10)}${co}  ${ghi}`);
}

console.log('\n=== GIA BAN TOI THIEU NEU DUNG AI i2v (bien lai 60%) ===');
for (const [ten, usd] of goi.slice(3)) {
  const can = (usd * USD) / 0.4;
  console.log(`  ${ten.padEnd(44)} phai ban >= ${Math.round(can).toLocaleString('vi')}d/video  (hien ${GIA_BAN_STARTER.toLocaleString('vi')}d)`);
}

console.log('\n=== TINH NANG RIENG LE (moi lan goi) ===');
for (const [ten, usd] of [
  ['Thay do — FLUX Try-On Pro', 0.04],
  ['Thay do — FASHN v1.5', 0.075],
  ['Nang anh — Replicate T4 (do that 8,8s)', 8.8 * 0.000225],
  ['Nhac AI — Google Lyria 30 giay', 0.04],
  ['Nhac AI — ElevenLabs Music / phut', 0.15],
] as Array<[string, number]>) console.log(`  ${ten.padEnd(40)} ${d(usd).padStart(9)}`);
export {};
