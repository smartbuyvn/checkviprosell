/**
 * Nhịp chuyển cảnh và độ phong phú góc máy.
 *
 * ── Dữ liệu thật đã hỏng ──
 *
 * Render `ea39bbcb` giao khách ngày 30/10/2026:
 *
 *   góc máy:  hero_push, detail_macro, hero_push, detail_macro, hero_push, hero_push
 *   chuyển:   fade, cut, cut, cut, cut, cut
 *
 * Cả hai góc đó đều là phóng to thuần, và cả năm ranh giới bên trong đều cắt phựt.
 * Khách mô tả đúng cái nhìn thấy: "hiệu ứng, chuyển cảnh chỉ là phóng to ảnh dần".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nhipChuyenCanh, demChuyenMem } from '../src/lib/nhip-chuyen-canh';
import { diversify } from '../src/lib/camera-moves';
import { lapKeHoachChuyen } from '../src/lib/transitions';

/* ─────────────── nhịp chuyển cảnh ─────────────── */

test('mo bang fade tu man den, dong bang fade ve man den', () => {
  const n = nhipChuyenCanh(6);
  assert.equal(n[0].transition_in, 'fade', 'Canh dau phai fade tu den');
  assert.equal(n[5].transition_out, 'fade', 'Canh cuoi phai fade ve den');
});

test('KHONG phai moi ranh gioi deu la cat cung — day la loi da hong', () => {
  const mem = demChuyenMem(nhipChuyenCanh(6));
  assert.ok(mem > 0, 'Khong co mot chuyen mem nao — dung thu da hong ngay 30/10');
});

test('cat cung van la chu dao, khong hoa het', () => {
  // Hoa het thi video nhao. Dung phim quang cao that dung cat lam chu dao.
  for (const n of [5, 6, 8, 10]) {
    const nhip = nhipChuyenCanh(n);
    const mem = demChuyenMem(nhip);
    const soRanhGioi = n - 1;
    assert.ok(
      mem < soRanhGioi,
      `${n} canh: hoa ${mem}/${soRanhGioi} ranh gioi — nhieu qua, video se nhao`
    );
    assert.ok(mem >= 1, `${n} canh: khong co chuyen mem nao`);
  }
});

test('ranh gioi vao canh CUOI luon hoa mem — bao sap het', () => {
  for (const n of [4, 5, 6, 8]) {
    const nhip = nhipChuyenCanh(n);
    assert.notEqual(
      nhip[n - 1].transition_in,
      'cut',
      `${n} canh: vao loi chot ma van cat phut`
    );
  }
});

test('dung nhieu hon mot kieu chuyen mem', () => {
  // Chi toan `fade` thi van don dieu, chi la don dieu kieu khac.
  const kieu = new Set(nhipChuyenCanh(10).map((x) => x.transition_in));
  kieu.delete('cut');
  assert.ok(kieu.size >= 2, `Chi co ${kieu.size} kieu chuyen mem: ${[...kieu].join(', ')}`);
});

test('video ngan thi giu don gian', () => {
  assert.deepEqual(nhipChuyenCanh(1), [{ transition_in: 'fade', transition_out: 'fade' }]);
  const hai = nhipChuyenCanh(2);
  assert.equal(hai.length, 2);
  assert.equal(hai[0].transition_in, 'fade');
  assert.equal(hai[1].transition_out, 'fade');
});

test('so canh hong khong lam no', () => {
  for (const x of [0, -1, NaN, 1.7]) {
    assert.doesNotThrow(() => nhipChuyenCanh(x as never));
  }
  assert.deepEqual(nhipChuyenCanh(0), []);
});

test('nhip sinh ra DUNG duoc cho transitions.ts', () => {
  // Phep kiem noi hai module: ten chuyen phai la thu `lapKeHoachChuyen` hieu.
  const n = 6;
  const nhip = nhipChuyenCanh(n);
  const tl = nhip.map((x, i) => ({
    start_sec: i * 3,
    end_sec: (i + 1) * 3,
    transition_in: x.transition_in,
    transition_out: x.transition_out,
  }));
  const kh = lapKeHoachChuyen(tl);
  assert.equal(kh.coChuyenMem, true, 'transitions.ts khong nhan ra chuyen mem nao');
  const soMem = kh.ranhGioi.filter((r) => r.mem).length;
  assert.ok(soMem >= 1, `Chi ${soMem} ranh gioi duoc hoa that su`);
});

/* ─────────────── độ phong phú góc máy ─────────────── */

test('dung HET bang goc may, khong chi hai kieu phong to', () => {
  // Du lieu that: model xin toan hero_push.
  const model = Array(6).fill('hero_push');
  const ra = diversify(model);
  const khac = new Set(ra);
  assert.ok(
    khac.size >= 3,
    `Chi ${khac.size} goc khac nhau: ${[...khac].join(', ')} — van don dieu`
  );
});

test('co it nhat mot goc KHONG phai phong to thuan', () => {
  // `reveal_up` lia doc, `lifestyle_hold` gan nhu dung yen. Thieu chung thi video
  // chi la mot chuoi phong to.
  const ra = diversify(Array(6).fill('hero_push'));
  const coKhac = ra.some((m) => m === 'reveal_up' || m === 'lifestyle_hold');
  assert.ok(coKhac, `Toan phong to: ${ra.join(', ')}`);
});

test('khong lap goc may o hai canh lien tiep', () => {
  for (const vao of [Array(8).fill('hero_push'), ['hero_push', 'hero_push', 'detail_macro']]) {
    const ra = diversify(vao);
    for (let i = 1; i < ra.length; i++) {
      assert.notEqual(ra[i], ra[i - 1], `Lap goc o canh ${i}: ${ra.join(', ')}`);
    }
  }
});

test('rai deu, khong don het vao mot goc', () => {
  const ra = diversify(Array(8).fill('hero_push'));
  const dem = new Map<string, number>();
  for (const m of ra) dem.set(m, (dem.get(m) ?? 0) + 1);
  const nhieuNhat = Math.max(...dem.values());
  assert.ok(nhieuNhat <= 3, `Mot goc chiem ${nhieuNhat}/8 canh: ${ra.join(', ')}`);
});

test('ton trong endcard_lock o canh cuoi', () => {
  const ra = diversify(['hero_push', 'detail_macro', 'endcard_lock']);
  assert.equal(ra[2], 'endcard_lock', 'Canh cuoi dung yen la lua chon co chu y');
});
