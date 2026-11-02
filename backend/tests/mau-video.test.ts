/**
 * Chặn hồi quy dải màu và chất lượng nén.
 *
 * Lỗi thật đo được ngày 29/10/2026 trên video `a7d667cc` đã giao cho khách:
 * `pix_fmt=yuvj420p` — dải màu đầy đủ kiểu JPEG. Mọi nền tảng giải mã lại theo dải
 * hẹp, nên đen bị nâng lên và trắng bị ép xuống: video đăng lên **bạc màu** so với
 * ảnh sản phẩm gốc. Đúng thứ người bán để ý nhất, và không một test nào bắt được vì
 * chuỗi filter vẫn hợp lệ, ffmpeg vẫn trả mã 0.
 *
 * Test này đọc chính mã nguồn worker, vì chuỗi filter là một chuỗi ký tự — `tsc`
 * không kiểm được gì, và chạy ffmpeg thật trong CI thì quá chậm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKER = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');

test('chuoi loc co buoc doi dai mau that, khong chi gan nhan', () => {
  // `setparams` gan nhan. Neu CHI gan nhan ma khong doi pixel thi con sai hon la de
  // nguyen: video mang dai day du nhung tu khai la dai hep.
  assert.match(
    WORKER,
    /scale=out_range=tv:out_color_matrix=bt709/,
    'Thieu buoc doi dai mau — video se ra yuvj420p va bac mau tren nen tang'
  );
  assert.match(WORKER, /setparams=[^'"`]*range=tv/, 'Thieu nhan range=tv');
});

test('gan du ca bon nhan mau', () => {
  // Do that: dat -colorspace/-color_primaries/-color_trc sau -c:v thi ffprobe doc ra
  // "unknown" cho hai cai sau. Chi `setparams` trong chuoi loc moi ghi du.
  for (const nhan of ['color_primaries=bt709', 'color_trc=bt709', 'colorspace=bt709']) {
    assert.ok(WORKER.includes(nhan), `Thieu nhan ${nhan} trong setparams`);
  }
});

test('ep pix_fmt yuv420p', () => {
  assert.match(WORKER, /'-pix_fmt',\s*'yuv420p'/, 'Khong ep pix_fmt thi JPEG vao se ra yuvj420p');
});

test('dung CRF chu khong phai bitrate co dinh cho libx264', () => {
  const khoi = WORKER.slice(WORKER.indexOf('const encoderArgs'), WORKER.indexOf('const ffmpegArgs'));
  assert.match(khoi, /'-crf'/, 'libx264 phai dung CRF');
  assert.doesNotMatch(
    khoi,
    /'libx264',\s*'-preset',\s*PRESET_X264,\s*'-b:v'/,
    'Bitrate co dinh chia deu byte nen bo doi luc dang phong to'
  );
});

test('preset nam trong dai an toan — co TRAN TREN, khong chi tran duoi', () => {
  const m = WORKER.match(/FFMPEG_X264_PRESET\s*\|\|\s*'([a-z]+)'/);
  assert.ok(m, 'Khong tim thay preset mac dinh');
  const preset = m![1];

  // Do that 30/10/2026 tren dung chuoi filter cua worker (6 canh, sieu lay mau
  // 2160x3840, fade hai dau, chuan hoa mau):
  //
  //   ultrafast  ma thoat 0    23 MB
  //   veryfast   ma thoat 0   5,5 MB
  //   faster     ma thoat 0   6,7 MB
  //   medium     ma thoat 139 (SIGSEGV)   48 byte
  //   slow       ma thoat 139 (SIGSEGV)   48 byte
  //
  // Tu `medium` tro len, bo ma hoa SAP. Tren Windows ma do hien ra thanh
  // 3221225477 — dung ma loi khach gap ngay 29/10.
  const SAP = ['medium', 'slow', 'slower', 'veryslow', 'placebo'];
  assert.ok(
    !SAP.includes(preset),
    `Preset "${preset}" lam bo ma hoa SAP voi chuoi filter day du (do that 30/10, SIGSEGV)`
  );

  // Qua nhanh thi mat chat luong thay duoc: ultrafast/superfast cho file lon gap
  // nhieu lan ma van mo hon.
  const QUA_NHANH = ['ultrafast', 'superfast'];
  assert.ok(!QUA_NHANH.includes(preset), `Preset "${preset}" doi chat luong lay toc do khong dang`);
});

test('preset dang dung phai tot hon ban goc ve chat luong', () => {
  // SSIM so voi ban khong nen, cung nguon, cung chuoi:
  //   veryfast + bitrate 4M (ban goc)  0,99425
  //   veryfast + CRF 16                0,99575
  //   faster   + CRF 16                0,99663
  const m = WORKER.match(/FFMPEG_X264_PRESET\s*\|\|\s*'([a-z]+)'/);
  assert.equal(m![1], 'faster', 'Do duoc: faster + CRF16 net hon ban goc ma khong sap');
});

test('co duong lui khi ffmpeg sap', () => {
  // Tran preset khac nhau theo may. Sap mot lan khong duoc giet ca lan dung video.
  assert.match(WORKER, /PRESET_LUI/, 'Thieu preset lui');
  assert.match(WORKER, /sapDo/, 'Khong phan biet SAP voi tham so sai');
  assert.match(
    WORKER,
    /laSapDo[\s\S]{0,200}3221225477/,
    'Phai nhan ra ma Windows 3221225477 (0xC0000005)'
  );
});

test('CRF nam trong khoang do duoc la hop ly', () => {
  const m = WORKER.match(/FFMPEG_CRF\s*\|\|\s*'(\d+)'/);
  assert.ok(m, 'Khong tim thay CRF mac dinh');
  const crf = Number(m![1]);
  // Do 29/10: SSIM so voi ban khong nen — 18 duoc 0.99493, 16 duoc 0.99577,
  // 14 duoc 0.99628. Tren 20 la thay mo ro; duoi 12 la tang dung luong vo ich.
  assert.ok(crf >= 12 && crf <= 20, `CRF ${crf} nam ngoai khoang da do (12-20)`);
});
