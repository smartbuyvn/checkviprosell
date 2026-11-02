/**
 * Soát video đen: phải bắt được video hỏng mà KHÔNG báo đỏ video đúng.
 *
 * Video đúng của Viprosell CỐ Ý mở và đóng bằng màn đen 0,4 giây. Một phép kiểm
 * ngây thơ sẽ báo đỏ mọi video — và một cổng kiểm báo đỏ liên tục thì chỉ dẫn tới
 * việc người ta tắt nó đi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  docQuangDen,
  chamVideo,
  BO_QUA_HAI_DAU,
  QUANG_DEN_TOI_DA,
} from '../src/lib/soat-video-den';

/** Đầu ra ffmpeg thật, dạng blackdetect in ra stderr. */
const STDERR_VIDEO_DUNG = `
[blackdetect @ 0x55d1c0] black_start:0 black_end:0.366667 black_duration:0.366667
[blackdetect @ 0x55d1c0] black_start:19.1333 black_end:19.5 black_duration:0.366667
frame= 585 fps=120 q=-1.0 Lsize=N/A time=00:00:19.50 bitrate=N/A speed=4.0x
`;

const STDERR_VIDEO_DEN = `
[blackdetect @ 0x55d1c0] black_start:0 black_end:19.5 black_duration:19.5
`;

test('doc duoc quang den tu stderr that', () => {
  const q = docQuangDen(STDERR_VIDEO_DUNG);
  assert.equal(q.length, 2);
  assert.equal(q[0].batDau, 0);
  assert.ok(Math.abs(q[1].ketThuc - 19.5) < 1e-6);
});

test('stderr khong co quang den nao thi tra mang rong', () => {
  assert.deepEqual(docQuangDen('frame= 585 fps=120'), []);
  assert.deepEqual(docQuangDen(''), []);
  assert.deepEqual(docQuangDen(null as never), []);
});

test('bo qua dong hong, khong no', () => {
  const q = docQuangDen('black_start:abc black_end:xyz\nblack_start:5 black_end:3');
  // Dong 1 khong phai so, dong 2 co ket thuc truoc bat dau — bo ca hai.
  assert.deepEqual(q, []);
});

test('VIDEO DUNG khong bi bao do', () => {
  // Day la phep kiem quan trong nhat. Fade dau va cuoi la co y.
  const kq = chamVideo(docQuangDen(STDERR_VIDEO_DUNG), 19.5);
  assert.equal(kq.dat, true, `Bao do video dung: ${kq.lyDo}`);
  assert.equal(kq.denOGiua, 0, 'Khong duoc tinh fade hai dau la den');
});

test('VIDEO DEN HOAN TOAN bi bat', () => {
  const kq = chamVideo(docQuangDen(STDERR_VIDEO_DEN), 19.5);
  assert.equal(kq.dat, false);
  assert.match(kq.lyDo!, /đen/);
});

test('mot quang den dai o giua bi bat du tong chua nhieu', () => {
  // 3 giay den trong video 20 giay = 15%, duoi nguong ti le, nhung 3 giay lien tuc
  // la hong ro rang.
  const kq = chamVideo([{ batDau: 8, ketThuc: 11 }], 20);
  assert.equal(kq.dat, false);
  assert.match(kq.lyDo!, /liên tục/);
  assert.ok(kq.quangDaiNhat > QUANG_DEN_TOI_DA);
});

test('nhieu quang ngan cong lai vuot ti le thi bi bat', () => {
  // Sau quang 1,5 giay = 9 giay / 20 = 45%, khong quang nao vuot 2 giay.
  const quang = [0, 3, 6, 9, 12, 15].map((t) => ({ batDau: t + 1, ketThuc: t + 2.5 }));
  const kq = chamVideo(quang, 20);
  assert.equal(kq.dat, false);
  assert.match(kq.lyDo!, /%/);
  assert.ok(kq.quangDaiNhat <= QUANG_DEN_TOI_DA, 'Phai truot vi TI LE, khong phai vi quang dai');
});

test('quang den nam GON trong vung bo qua thi khong tinh', () => {
  const kq = chamVideo([{ batDau: 0, ketThuc: BO_QUA_HAI_DAU - 0.1 }], 20);
  assert.equal(kq.dat, true);
  assert.equal(kq.denOGiua, 0);
});

test('quang den VUOT khoi vung bo qua thi tinh phan vuot', () => {
  // Den tu 0 toi 5 giay: phan trong vung bo qua khong tinh, con lai 5 - 0,7 = 4,3.
  const kq = chamVideo([{ batDau: 0, ketThuc: 5 }], 20);
  assert.equal(kq.dat, false);
  assert.ok(Math.abs(kq.denOGiua - (5 - BO_QUA_HAI_DAU)) < 1e-6, `denOGiua = ${kq.denOGiua}`);
});

test('thieu thoi luong thi coi nhu dat, khong chan vi thieu du lieu', () => {
  // Chan vi khong doc duoc thoi luong la bien mot phep kiem phu thanh nguon hong moi.
  for (const t of [0, -1, NaN, undefined as never]) {
    assert.equal(chamVideo([{ batDau: 2, ketThuc: 18 }], t).dat, true);
  }
});

test('khong co quang den nao thi dat', () => {
  const kq = chamVideo([], 20);
  assert.equal(kq.dat, true);
  assert.equal(kq.denOGiua, 0);
  assert.equal(kq.lyDo, null);
});

test('du lieu hong khong lam no', () => {
  assert.doesNotThrow(() => chamVideo(null as never, 20));
  assert.doesNotThrow(() => chamVideo(undefined as never, 20));
});

test('ly do viet cho khach doc, khong phai cho lap trinh vien', () => {
  const kq = chamVideo([{ batDau: 5, ketThuc: 15 }], 20);
  assert.equal(kq.dat, false);
  // Khong duoc chua thuat ngu noi bo.
  for (const tu of ['blackdetect', 'pix_th', 'stderr', 'null']) {
    assert.ok(!kq.lyDo!.toLowerCase().includes(tu), `Ly do lo thuat ngu "${tu}": ${kq.lyDo}`);
  }
});
