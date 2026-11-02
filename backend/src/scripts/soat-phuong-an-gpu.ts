/** Kinh tế của việc thêm sinh video bằng diffusion vào pipeline hiện tại. */
const DIEN_KWH = 2_500;        // d/kWh, suy tu 349.303d/thang o 194W lien tuc
const W_THUONG = 194;          // do that tai o cam
const W_GPU = 350;             // uoc khi 3060 chay het tai
const CO_DINH = 2_591_192;     // d/thang
const GIA_VIDEO = 4_300;       // Starter sau khi doi bang gia
const BIEN_DOI_HIEN = 332;     // d/video, do that

function dien(phut: number, watt: number): number {
  return (watt / 1000) * (phut / 60) * DIEN_KWH;
}

const pa = [
  { ten: 'Hien nay (ghep anh)', phut: 1, watt: W_THUONG, themLLM: 0 },
  { ten: 'Them 1 canh sinh 5s (Wan2.1 1.3B)', phut: 1 + 11, watt: W_GPU, themLLM: 0 },
  { ten: 'Sinh TOAN BO 20s (4 canh x 5s)', phut: 44, watt: W_GPU, themLLM: 0 },
  { ten: 'Nang anh 3 tam (Real-ESRGAN 2x)', phut: 1 + 0.1, watt: W_GPU, themLLM: 0 },
];

console.log('PHUONG AN                              phut  dien/video  bien doi  video/ngay  tran DT/thang');
for (const p of pa) {
  const d = dien(p.phut, p.watt);
  const bien = p.ten.startsWith('Hien nay') ? BIEN_DOI_HIEN : BIEN_DOI_HIEN + d;
  const moiNgay = Math.floor((24 * 60) / p.phut);
  const tranDT = moiNgay * 30 * GIA_VIDEO;
  console.log(
    `  ${p.ten.padEnd(36)} ${String(p.phut).padStart(4)}  ${Math.round(d).toLocaleString('vi').padStart(9)}d` +
    `  ${Math.round(bien).toLocaleString('vi').padStart(7)}d  ${String(moiNgay).padStart(10)}  ${(tranDT / 1e6).toFixed(1)} trieu`
  );
}

console.log('\nSO VIDEO/THANG CAN BAN DE BU CHI PHI CO DINH 2,59 trieu:');
for (const p of pa) {
  const d = p.ten.startsWith('Hien nay') ? 0 : dien(p.phut, p.watt);
  const lai = GIA_VIDEO - BIEN_DOI_HIEN - d;
  const can = Math.ceil(CO_DINH / lai);
  const moiNgay = Math.floor((24 * 60) / p.phut);
  const tran = moiNgay * 30;
  console.log(
    `  ${p.ten.padEnd(36)} can ${String(can).padStart(5)} video` +
    `  (nang luc toi da ${tran.toLocaleString('vi')})  ${can <= tran * 0.4 ? 'CHAY DUOC' : can <= tran ? 'SAT NGUONG' : 'KHONG THE'}`
  );
}
export {};
