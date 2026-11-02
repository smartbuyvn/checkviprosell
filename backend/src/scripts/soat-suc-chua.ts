/** Sức chứa theo nguyên liệu thật — đối chiếu phân bố ảnh đo được 30/10. */
import { sucChuaGiay, mocThoiLuongChoPhep, MOC_THOI_LUONG } from '../lib/credit-cost';
import { soCanhTheoThoiLuong } from '../prompts/tiers/tier3-scene-graph';

const mau: Array<[string, any]> = [
  ['1 anh 1024px (trung vi)', { anh: [{ canhNgan: 1024 }] }],
  ['3 anh 600px (nho)', { anh: Array(3).fill({ canhNgan: 600 }) }],
  ['3 anh 1024px  <- pho bien nhat', { anh: Array(3).fill({ canhNgan: 1024 }) }],
  ['3 anh 2000px (to)', { anh: Array(3).fill({ canhNgan: 2000 }) }],
  ['4 anh 1024px', { anh: Array(4).fill({ canhNgan: 1024 }) }],
  ['5 anh 1024px', { anh: Array(5).fill({ canhNgan: 1024 }) }],
  ['5 anh 2000px', { anh: Array(5).fill({ canhNgan: 2000 }) }],
  ['3 anh 1024 + 1 clip', { anh: Array(3).fill({ canhNgan: 1024 }), soClip: 1 }],
  ['chi 1 clip', { anh: [], soClip: 1 }],
];

console.log('NGUYEN LIEU                      suc chua   moc duoc mo');
for (const [ten, n] of mau) {
  const moc = mocThoiLuongChoPhep(n).map((m) => m.giay).join(', ');
  console.log(`  ${ten.padEnd(30)} ${String(sucChuaGiay(n)).padStart(5)}s   ${moc}`);
}

console.log('\nQUY TAC CU (moi anh 10 giay) de so sanh:');
for (const soAnh of [1, 3, 4, 5]) {
  const cu = MOC_THOI_LUONG.filter((m) => m.giay <= soAnh * 10).map((m) => m.giay);
  console.log(`  ${soAnh} anh bat ky -> ${(cu.length ? cu : [15]).join(', ')}  (khong phan biet 300px hay 2296px)`);
}

console.log('\nSO CANH TANG 3 XIN, THEO THOI LUONG:');
for (const g of [15, 20, 30, 45]) {
  const { itNhat, nhieuNhat } = soCanhTheoThoiLuong(g);
  console.log(`  ${String(g).padStart(2)}s -> ${itNhat}-${nhieuNhat} canh (${(g / nhieuNhat).toFixed(1)}-${(g / itNhat).toFixed(1)}s moi canh)`);
}
console.log('  ban cu: 4-10 canh cho MOI thoi luong');
console.log('          15s/10 canh = 1,5s moi canh — ngan hon ca canh hook');
console.log('          45s/10 canh = 4,5s moi canh — dai hon nhip lap luan 2,5-4s');
export {};
