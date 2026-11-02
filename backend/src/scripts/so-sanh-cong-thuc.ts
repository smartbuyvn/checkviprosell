/** So sánh: đổi công thức credit thì cần bán thêm bao nhiêu gói để hoà vốn. */
const CO_DINH = 2_591_192;
const BIEN_DOI = 332;

const goi = [
  { ten: 'starter', gia: 129_000, credit: 30 },
  { ten: 'pro', gia: 249_000, credit: 80 },
  { ten: 'business', gia: 499_000, credit: 180 },
];

const phuongAn = [
  { ten: 'HIEN NAY (video co giong = 2cr)', cr: 2 },
  { ten: 'HIEN NAY, video "dang duoc" (1080p+giong+khong wm) = 4cr', cr: 4 },
  { ten: 'DE XUAT: 1 credit = 1 video tron ven', cr: 1 },
];

for (const pa of phuongAn) {
  console.log(`\n${pa.ten}`);
  console.log('  goi        video/goi   gia moi video   lai gop/goi   can ban/thang');
  for (const g of goi) {
    const n = Math.floor(g.credit / pa.cr);
    const giaVideo = Math.round(g.gia / n);
    const laiGop = g.gia - n * BIEN_DOI;
    const canBan = Math.ceil(CO_DINH / laiGop);
    console.log(
      `  ${g.ten.padEnd(10)} ${String(n).padStart(9)}   ${giaVideo.toLocaleString('vi').padStart(13)}d` +
      `   ${laiGop.toLocaleString('vi').padStart(11)}d   ${String(canBan).padStart(13)} goi`
    );
  }
}

console.log('\n\nRUI RO NEU BO HAN CREDIT (thue bao khong gioi han)');
console.log('  Moi video ton 332d bien doi. Nguong hoa von cua tung goi:');
for (const g of goi) {
  console.log(`  ${g.ten.padEnd(10)} ${g.gia.toLocaleString('vi')}d -> lo khi khach dung qua ${Math.floor(g.gia / BIEN_DOI).toLocaleString('vi')} video/thang`);
}
console.log('\n  Nang luc may: render that do duoc ~60 giay/video.');
const moiNgay = Math.floor((24 * 3600) / 65);
console.log(`  Toi da ly thuyet ${moiNgay.toLocaleString('vi')} video/ngay = ${(moiNgay * 30).toLocaleString('vi')} video/thang (chay lien tuc 100%).`);
console.log(`  Thuc te an toan ~40% cong suat = ${Math.round(moiNgay * 30 * 0.4).toLocaleString('vi')} video/thang.`);

export {};
