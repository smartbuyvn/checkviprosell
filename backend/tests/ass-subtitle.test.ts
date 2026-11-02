/**
 * Phụ đề ASS — test bám đúng các lỗi mà drawtext từng gây ra trên video thật.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAssFile, escapeAssText, toAssTime, escapeFilterPath } from '../src/lib/ass-subtitle';

const OPTS = {
  width: 1080, height: 1920, fontName: 'DejaVu Sans',
  overlayFontSize: 52, subFontSize: 30,
  overlayMarginV: 345, subMarginV: 345, marginH: 108,
};

test('giữ nguyên dấu % — drawtext nuốt cả dòng chữ vì chỗ này', () => {
  assert.equal(escapeAssText('Giảm 50% hôm nay'), 'Giảm 50% hôm nay');
});

test('giữ nguyên dấu nháy đơn — escapeDrawText đang xoá mất', () => {
  assert.equal(escapeAssText("Son 'Lì' 24h"), "Son 'Lì' 24h");
});

test('không cắt ngắn câu dài', () => {
  const long = 'Kem chống nắng nâng tông, kiềm dầu suốt 12 tiếng, không gây bí da, phù hợp da dầu mụn nhạy cảm';
  assert.equal(escapeAssText(long), long);
  assert.ok(escapeAssText(long).length > 60);
});

test('thoát { } để không nuốt phần còn lại của dòng', () => {
  assert.equal(escapeAssText('Giá {chỉ} 99k'), 'Giá \\{chỉ\\} 99k');
});

test('xuống dòng thật thành ngắt dòng ASS', () => {
  assert.equal(escapeAssText('Dòng 1\nDòng 2'), 'Dòng 1\\NDòng 2');
});

test('gạch chéo ngược thành dấu chia, không lọt thành mã điều khiển', () => {
  // '\\N' trong nguon = mot gach cheo + N luc chay; neu de nguyen, libass
  // hieu la lenh ngat dong thay vi ky tu thuong.
  assert.equal(escapeAssText('a\\Nb'), 'a/Nb');
});

test('định dạng thời gian đúng chuẩn ASS', () => {
  assert.equal(toAssTime(0), '0:00:00.00');
  assert.equal(toAssTime(5.5), '0:00:05.50');
  assert.equal(toAssTime(65.25), '0:01:05.25');
  assert.equal(toAssTime(3661.5), '1:01:01.50');
});

test('làm tròn không sinh centisecond = 100', () => {
  const t = toAssTime(2.999);
  assert.ok(!t.endsWith('.100'), `thoi gian khong hop le: ${t}`);
  assert.equal(t, '0:00:03.00');
});

test('file .ass có đủ phần bắt buộc và hai style', () => {
  const ass = buildAssFile(
    [{ startSec: 0, endSec: 2, text: 'Hook mạnh', style: 'Overlay' }], OPTS);
  for (const s of ['[Script Info]', '[V4+ Styles]', '[Events]', 'Style: Overlay,', 'Style: Sub,'])
    assert.ok(ass.includes(s), `thieu: ${s}`);
  assert.ok(ass.includes('PlayResX: 1080') && ass.includes('PlayResY: 1920'));
  assert.ok(ass.includes('Dialogue: 0,0:00:00.00,0:00:02.00,Overlay,'));
});

test('bỏ qua cue rỗng hoặc thời lượng không hợp lệ', () => {
  const ass = buildAssFile([
    { startSec: 0, endSec: 2, text: '  ', style: 'Sub' },
    { startSec: 5, endSec: 5, text: 'Không có thời lượng', style: 'Sub' },
    { startSec: 1, endSec: 3, text: 'Hợp lệ', style: 'Sub' },
  ], OPTS);
  assert.equal(ass.match(/^Dialogue:/gm)?.length, 1);
  assert.ok(ass.includes('Hợp lệ'));
});

test('thoát dấu hai chấm trong đường dẫn cho filter subtitles', () => {
  assert.equal(escapeFilterPath('C:\\tmp\\a.ass'), 'C\\:/tmp/a.ass');
  assert.equal(escapeFilterPath('/srv/x/a.ass'), '/srv/x/a.ass');
});

/**
 * Vien chu phai NHE va chu phai DU TO.
 *
 * Khach bao ngay 30/10: "hieu ung vien chu phu de can nhe hon, tranh nang ne, tang
 * size phu hop voi khung hinh video".
 *
 * Ban cu: Outline=3 cho phu de va Outline=4 cho tieu de, voi
 * `ScaledBorderAndShadow: yes` tren PlayResX=1080 — vien den DAC day 3-4 pixel quanh
 * moi net chu. Co chu phu de 30px chi la 2,8% be ngang khung.
 *
 * Do tren nen xam phang, dem dien tich diem anh:
 *
 *   cu:   chu 0,072%   vien+bong 0,284%   ti le vien/chu 3,96
 *   moi:  chu 0,186%   vien+bong 0,321%   ti le vien/chu 1,72
 *
 * Chu to gap 2,6 lan, luc muc den quanh net giam hon mot nua.
 */
test('vien chu MONG, khong phai vien dac 3-4px', () => {
  const ass = buildAssFile(
    [{ startSec: 0, endSec: 3, text: 'Thu', style: 'Sub' }],
    { width: 1080, height: 1920, fontName: 'Arial', overlayFontSize: 70, subFontSize: 45,
      overlayMarginV: 345, subMarginV: 345, marginH: 86 }
  );
  const dongSub = ass.split('\n').find((l) => l.startsWith('Style: Sub,'))!;
  const truong = dongSub.replace('Style: ', '').split(',');
  // Thu tu: Name,Fontname,Fontsize,Primary,Secondary,Outline,Back,Bold,Italic,
  // Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,...
  const doDayVien = Number(truong[16]);
  // Tran tren: tren 2 la nang ne nhu phu de karaoke cu.
  assert.ok(doDayVien <= 2, `Vien day ${doDayVien} — nang ne nhu phu de karaoke cu`);
  // San 0,5: duoi muc nay chu chim vao nen sang.
  //
  // Da ha ba lan theo yeu cau khach: 1,2 -> 0,9 -> 0,6. Do ti le muc toi tren chu
  // tren nen xam phang, cung nguong 110: 1,26 -> 1,11 -> 0,96.
  //
  // Bu lai bang BONG DO, khong phai vien: vien la duong ke bam sat net chu nen mat
  // doc ra la "nang"; bong toa ra ngoai va mo dan nen tang bong khong lam chu day.
  assert.ok(doDayVien >= 0.5, `Vien ${doDayVien} mong qua, chu se chim vao nen sang`);
});

test('dung bong MO ban trong suot, khong phai bong den dac', () => {
  const ass = buildAssFile(
    [{ startSec: 0, endSec: 3, text: 'Thu', style: 'Sub' }],
    { width: 1080, height: 1920, fontName: 'Arial', overlayFontSize: 70, subFontSize: 45,
      overlayMarginV: 345, subMarginV: 345, marginH: 86 }
  );
  // BackColour la truong thu 7. Alpha nam o hai ky tu dau sau &H.
  const dongSub = ass.split('\n').find((l) => l.startsWith('Style: Sub,'))!;
  const back = dongSub.replace('Style: ', '').split(',')[6];
  assert.match(back, /^&H[1-9A-F]/i, `BackColour ${back} van dac — phai co alpha`);
});

test('lam mem canh bang blur', () => {
  const ass = buildAssFile(
    [{ startSec: 0, endSec: 3, text: 'Thu', style: 'Sub' },
     { startSec: 3, endSec: 6, text: 'Tieu de', style: 'Overlay' }],
    { width: 1080, height: 1920, fontName: 'Arial', overlayFontSize: 70, subFontSize: 45,
      overlayMarginV: 345, subMarginV: 345, marginH: 86 }
  );
  // Dung indexOf chu khong dung bieu thuc chinh quy: dau `\` trong ASS de bi
  // nuot qua nhieu lop trich dan, va mot test khong khop vi ly do do thi gay
  // hieu nham la ma nguon hong.
  assert.ok(ass.includes('\\blur0.4'), 'Phu de thieu blur');
  assert.ok(ass.includes('\\blur0.6'), 'Tieu de thieu blur');
  // Tren 1,0 thi chu nhoe, kho doc tren nen dang chuyen dong.
  const cacBlur = [...ass.matchAll(/blur([0-9.]+)/g)].map((m) => Number(m[1]));
  for (const b of cacBlur) assert.ok(b > 0 && b <= 1, `blur${b} ngoai khoang doc duoc`);
});

test('vien tinh theo be ngang khung, khong viet cung', () => {
  // Video 1:1 hay 16:9 khong duoc co vien day gap doi so voi 9:16.
  const lay = (w: number) => {
    const ass = buildAssFile(
      [{ startSec: 0, endSec: 3, text: 'Thu', style: 'Sub' }],
      { width: w, height: Math.round(w * 16 / 9), fontName: 'Arial',
        overlayFontSize: 70, subFontSize: 45, overlayMarginV: 100, subMarginV: 100, marginH: 50 }
    );
    return Number(ass.split('\n').find((l) => l.startsWith('Style: Sub,'))!
      .replace('Style: ', '').split(',')[16]);
  };
  assert.ok(lay(2160) > lay(1080), 'Khung rong gap doi phai co vien day hon');
});
