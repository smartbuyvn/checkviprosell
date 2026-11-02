/**
 * Chuyển cảnh: số học thời gian phải khớp tuyệt đối với kế hoạch.
 *
 * Đây là phần dễ sai nhất và sai thì im lặng: `xfade` nuốt thời gian, phụ đề ASS dùng
 * mốc tuyệt đối, nên lệch một chút ở mỗi ranh giới là tới cảnh cuối chữ chạy trước
 * hình cả giây — video vẫn ra, ffmpeg vẫn trả 0, không ai biết cho tới khi xem.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lapKeHoachChuyen,
  dungChuoiXfade,
  THOI_LUONG_HOA,
  THOI_LUONG_CAT,
} from '../src/lib/transitions';

/** Timeline thật lấy từ render a7d667cc ngày 29/10. */
const TIMELINE_THAT = [
  { start_sec: 0, end_sec: 2, transition_in: 'fade', transition_out: 'cut' },
  { start_sec: 2, end_sec: 5.5, transition_in: 'cut', transition_out: 'cut' },
  { start_sec: 5.5, end_sec: 9, transition_in: 'fade', transition_out: 'cut' },
  { start_sec: 9, end_sec: 12.5, transition_in: 'cut', transition_out: 'cut' },
  { start_sec: 12.5, end_sec: 16, transition_in: 'fade', transition_out: 'cut' },
  { start_sec: 16, end_sec: 19.5, transition_in: 'cut', transition_out: 'cut' },
];

test('moi ranh gioi deu co mot muc, khong thua khong thieu', () => {
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  assert.equal(kh.ranhGioi.length, TIMELINE_THAT.length - 1);
  assert.equal(kh.keoDai.length, TIMELINE_THAT.length);
});

test('canh cuoi khong bao gio bi keo dai', () => {
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  assert.equal(kh.keoDai[kh.keoDai.length - 1], 0, 'Keo dai canh cuoi la cong them thoi luong vao video');
});

test('keo dai cua moi canh bang dung thoi luong hoa phia sau no', () => {
  // Day la bat dang thuc giu cho tong thoi luong khong doi. Sai o day la video dai
  // hoac ngan hon ke hoach, va phu de lech theo.
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  for (const [i, r] of kh.ranhGioi.entries()) {
    assert.equal(kh.keoDai[i], r.thoiLuong, `Canh ${i} keo dai khong khop ranh gioi sau no`);
  }
});

test('moc hoa chinh la start_sec cua canh ke', () => {
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  for (const [i, r] of kh.ranhGioi.entries()) {
    assert.equal(r.moc, TIMELINE_THAT[i + 1].start_sec, `Moc ranh gioi ${i} sai`);
  }
});

/**
 * Ranh gioi `i` nam giua canh `i` va `i+1`, nen no doc `transition_in` cua canh
 * `i+1`. Voi TIMELINE_THAT:
 *
 *   ranh gioi 0 (canh0→canh1): canh1.in=cut,  canh0.out=cut  → cat cung
 *   ranh gioi 1 (canh1→canh2): canh2.in=fade                 → hoa mem
 *   ranh gioi 2 (canh2→canh3): canh3.in=cut,  canh2.out=cut  → cat cung
 *   ranh gioi 3 (canh3→canh4): canh4.in=fade                 → hoa mem
 *   ranh gioi 4 (canh4→canh5): canh5.in=cut,  canh4.out=cut  → cat cung
 *
 * `transition_in` cua canh 0 la fade tu man den o dau video — viec do do fade tong
 * lo, khong phai ranh gioi giua hai canh.
 */
test('ton trong "cut" — khong tu bien thanh chuyen mem', () => {
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  for (const i of [0, 2, 4]) {
    assert.equal(kh.ranhGioi[i].mem, false, `Ranh gioi ${i} phai la cat cung`);
    assert.equal(kh.ranhGioi[i].thoiLuong, THOI_LUONG_CAT, `Ranh gioi ${i} phai dai dung mot khung`);
  }
});

test('nhan ra "fade" du chi mot trong hai truong noi', () => {
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  for (const i of [1, 3]) {
    assert.equal(kh.ranhGioi[i].mem, true, `transition_in=fade cua canh ${i + 1} phai du de hoa`);
    assert.equal(kh.ranhGioi[i].hieuUng, 'fade');
    assert.equal(kh.ranhGioi[i].thoiLuong, THOI_LUONG_HOA, 'Canh 3,5 giay du cho hoa day du');
  }
});

test('canh qua ngan thi ha thoi luong hoa, khong nuot mat canh', () => {
  const ngan = [
    { start_sec: 0, end_sec: 0.4, transition_in: 'fade', transition_out: 'fade' },
    { start_sec: 0.4, end_sec: 3, transition_in: 'fade', transition_out: 'cut' },
  ];
  const kh = lapKeHoachChuyen(ngan);
  const r = kh.ranhGioi[0];
  assert.ok(r.thoiLuong <= 0.2, `Hoa ${r.thoiLuong}s vao canh 0,4s la nuot mat canh`);
  assert.ok(r.thoiLuong > 0, 'Van phai co thoi luong duong, xfade khong nhan 0');
});

test('mot canh hoac rong thi khong co ranh gioi nao', () => {
  for (const tl of [[], [TIMELINE_THAT[0]], null, undefined]) {
    const kh = lapKeHoachChuyen(tl as never);
    assert.equal(kh.ranhGioi.length, 0);
    assert.equal(kh.coChuyenMem, false);
  }
});

test('du lieu hong khong lam vo phep tinh', () => {
  const hong = [
    { start_sec: NaN, end_sec: 2, transition_in: 'fade' },
    { start_sec: 2, end_sec: undefined, transition_in: 'fade' },
    { start_sec: 'xyz' as never, end_sec: 9, transition_in: 'fade' },
  ];
  const kh = lapKeHoachChuyen(hong as never);
  for (const r of kh.ranhGioi) {
    assert.ok(Number.isFinite(r.thoiLuong) && r.thoiLuong > 0, 'thoiLuong phai la so duong');
    assert.ok(Number.isFinite(r.moc) && r.moc >= 0, 'moc phai la so khong am');
  }
  for (const k of kh.keoDai) assert.ok(Number.isFinite(k), 'keoDai phai la so');
});

test('chuoi xfade noi dung thu tu va ket thuc o nhan ra', () => {
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  const buoc = dungChuoiXfade(kh, (i) => `scene${i}`, 'vcat');
  assert.ok(buoc, 'Phai dung duoc chuoi khi co chuyen mem');
  assert.equal(buoc!.length, TIMELINE_THAT.length - 1);

  assert.match(buoc![0], /^\[scene0\]\[scene1\]xfade=/, 'Buoc dau phai noi canh 0 voi 1');
  assert.match(buoc![buoc!.length - 1], /\[vcat\]$/, 'Buoc cuoi phai ra nhan ket qua');

  // Moi buoc trung gian phai tieu thu dung nhan ma buoc truoc sinh ra.
  for (let i = 1; i < buoc!.length; i++) {
    assert.ok(buoc![i].startsWith(`[xf${i}]`), `Buoc ${i} khong noi tiep buoc truoc: ${buoc![i]}`);
  }
});

test('offset trong chuoi tang dan va khop ke hoach', () => {
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  const buoc = dungChuoiXfade(kh, (i) => `scene${i}`, 'vcat')!;
  const offsets = buoc.map((b) => Number(b.match(/offset=([0-9.]+)/)![1]));
  for (let i = 1; i < offsets.length; i++) {
    assert.ok(offsets[i] > offsets[i - 1], `Offset phai tang dan: ${offsets}`);
  }
  assert.deepEqual(offsets, [2, 5.5, 9, 12.5, 16]);
});

test('khong co chuyen mem nao thi tra null de nguoi goi dung concat', () => {
  const toanCat = TIMELINE_THAT.map((m) => ({ ...m, transition_in: 'cut', transition_out: 'cut' }));
  const kh = lapKeHoachChuyen(toanCat);
  assert.equal(kh.coChuyenMem, false);
  assert.equal(dungChuoiXfade(kh, (i) => `scene${i}`, 'vcat'), null);
});

test('tong thoi luong sau khi hoa bang dung ke hoach', () => {
  // Day la phep kiem quan trong nhat: mo phong lai dung cach xfade tinh.
  const kh = lapKeHoachChuyen(TIMELINE_THAT);
  const keHoachTong = TIMELINE_THAT[TIMELINE_THAT.length - 1].end_sec;

  // Moi canh dung dai = thoi luong ke hoach + phan keo dai.
  const dungDai = TIMELINE_THAT.map((m, i) => (m.end_sec - m.start_sec) + kh.keoDai[i]);
  // xfade: ket qua = tong cac doan dung - tong cac overlap.
  const tongDung = dungDai.reduce((a, b) => a + b, 0);
  const tongOverlap = kh.ranhGioi.reduce((a, r) => a + r.thoiLuong, 0);

  assert.ok(
    Math.abs((tongDung - tongOverlap) - keHoachTong) < 1e-6,
    `Tong ra ${tongDung - tongOverlap}s, ke hoach ${keHoachTong}s — phu de se lech`
  );
});

test('thoi luong hoa mac dinh nam trong khoang nhin thay duoc', () => {
  assert.ok(THOI_LUONG_HOA >= 0.25, 'Duoi 0,25s thi khong phan biet duoc voi cat cung');
  assert.ok(THOI_LUONG_HOA <= 0.5, 'Tren 0,5s thi video ngan mat qua nhieu thoi luong cho chuyen');
});

/**
 * Hieu ung chuyen canh gay SAP khong duoc toi duoc ffmpeg.
 *
 * Thu that ngay 30/10/2026, moi hieu ung mot lan dung 6 canh o 1080x1920:
 *
 *   SAP (SIGSEGV):  squeezev (3/3 lan), vertopen, dissolve
 *   CHAY DUOC:      fade, squeezeh, zoomin, circleopen, circleclose, radial,
 *                   vertclose, horzopen, horzclose, pixelize, wipetl, diagtl, hblur
 *
 * Cung lop loi voi preset x264 `medium` tro len: ffmpeg nhan tham so, khong bao gi,
 * roi sap giua chung. Nguoi dung chi thay mot ma so vo nghia.
 */
test('ten hieu ung gay SAP khong lot duoc vao chuoi filter', () => {
  const SAP = ['squeezev', 'vertopen', 'dissolve'];
  const tl = [
    { start_sec: 0, end_sec: 3, transition_in: 'fade', transition_out: 'cut' },
    { start_sec: 3, end_sec: 6, transition_in: 'lat_doc', transition_out: 'cut' },
    { start_sec: 6, end_sec: 9, transition_in: 'lat_ngang', transition_out: 'fade' },
  ];
  const chuoi = (dungChuoiXfade(lapKeHoachChuyen(tl), (i) => `s${i}`, 'vout') ?? []).join(';');
  for (const x of SAP) {
    assert.ok(
      !chuoi.includes(`transition=${x}`),
      `Hieu ung "${x}" lam ffmpeg SIGSEGV nhung van lot vao chuoi: ${chuoi}`
    );
  }
});

test('ten la lui ve fade thay vi truyen thang xuong ffmpeg', () => {
  const tl = [
    { start_sec: 0, end_sec: 3, transition_in: 'fade', transition_out: 'cut' },
    { start_sec: 3, end_sec: 6, transition_in: 'khong_ton_tai' as never, transition_out: 'fade' },
  ];
  const kh = lapKeHoachChuyen(tl);
  const chuoi = (dungChuoiXfade(kh, (i) => `s${i}`, 'vout') ?? []).join(';');
  // Ten khong co trong bang thi coi nhu cat cung; neu co lot qua thi phai thanh fade.
  if (chuoi) {
    assert.ok(
      !/transition=khong_ton_tai/.test(chuoi),
      'Ten la bi truyen thang xuong ffmpeg'
    );
  }
});

test('nhom xoay lat dung ten ffmpeg DA THU', () => {
  const tl = [
    { start_sec: 0, end_sec: 3, transition_in: 'fade', transition_out: 'cut' },
    { start_sec: 3, end_sec: 6, transition_in: 'lat_ngang', transition_out: 'cut' },
    { start_sec: 6, end_sec: 9, transition_in: 'lat_doc', transition_out: 'cut' },
    { start_sec: 9, end_sec: 12, transition_in: 'xuyen_qua', transition_out: 'cut' },
    { start_sec: 12, end_sec: 15, transition_in: 'he_lo', transition_out: 'fade' },
  ];
  const chuoi = (dungChuoiXfade(lapKeHoachChuyen(tl), (i) => `s${i}`, 'vout') ?? []).join(';');
  for (const mong of ['squeezeh', 'vertclose', 'zoomin', 'circleopen']) {
    assert.ok(chuoi.includes(`transition=${mong}`), `Thieu hieu ung ${mong}: ${chuoi}`);
  }
});
