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
