/** Kinh tế của gói Free ở hai mức 3 và 5 credit. */
const BIEN_DOI = 332;          // đ/video, đo 28/10 (LLM+TTS+lưu trữ) × hệ số lãng phí 2×
const GIA_STARTER = 129000;

for (const credit of [3, 5]) {
  const chiPhi = credit * BIEN_DOI;
  const soFreeMoiDonStarter = GIA_STARTER / chiPhi;
  console.log(
    `Free = ${credit} credit:  chi phi ${chiPhi.toLocaleString('vi-VN')}d/nguoi  ` +
    `| 1 don Starter nuoi duoc ${soFreeMoiDonStarter.toFixed(0)} nguoi dung thu  ` +
    `| ty le chuyen doi toi thieu ${(100 / soFreeMoiDonStarter).toFixed(2)}%`
  );
}
console.log(`\nChenh lech: ${(2 * BIEN_DOI).toLocaleString('vi-VN')}d moi nguoi dang ky.`);
console.log(`Voi 1.000 nguoi/thang: ${(2 * BIEN_DOI * 1000).toLocaleString('vi-VN')}d/thang`);
console.log(`So sanh chi phi co dinh 2.591.192d/thang: ${(2 * BIEN_DOI * 1000 / 2591192 * 100).toFixed(0)}%`);
