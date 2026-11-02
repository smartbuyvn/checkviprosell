import { test } from 'vitest';
import assert from 'node:assert/strict';
import { stageOf } from '../components/shared/VideoCard';

/**
 * Quy tac chon nhom cho DON HANG LOAT.
 *
 * Day la ma XOA DU LIEU CUA KHACH, nen test tap trung vao thu KHONG duoc dong toi.
 * Dong nham mot video da hoan thanh la khach mat thanh pham; dong nham mot video dang
 * dung la huy giua chung ma credit da tru roi.
 *
 * Giu dong bo voi `nhomDonDuoc` trong Dashboard.tsx — cung mot bieu thuc loc.
 */

type DuAn = { id: string; status: string; video?: unknown };

/** Ban sao cua `nhomDonDuoc` trong Dashboard.tsx. */
function chonNhom(ds: DuAn[], tab: string): DuAn[] {
  const cho = ds.filter((p) => !p.video && stageOf(p.status, false) === 'waiting');
  const hong = ds.filter((p) => !p.video && p.status === 'failed');
  if (tab === 'waiting') return cho;
  if (tab === 'failed') return hong;
  if (tab === 'all') return [...cho, ...hong];
  return [];
}

const MAU: DuAn[] = [
  { id: 'nhap1', status: 'draft' },
  { id: 'nhap2', status: 'analyzing' },
  { id: 'nhap3', status: 'conceptready' },
  { id: 'hong1', status: 'failed' },
  { id: 'hong2', status: 'failed' },
  { id: 'xong1', status: 'completed', video: { output_url: 'https://x/y.mp4' } },
  { id: 'dang1', status: 'rendering' },
  { id: 'dang2', status: 'processing' },
];

test('KHONG BAO GIO dong toi video da hoan thanh', () => {
  // Khach mat thanh pham, va credit da tru khong hoan lai.
  for (const tab of ['all', 'waiting', 'failed', 'done', 'working']) {
    const ds = chonNhom(MAU, tab);
    assert.ok(!ds.some((p) => p.id === 'xong1'), `tab "${tab}" dinh vao video da xong`);
  }
});

test('KHONG BAO GIO dong toi video dang dung', () => {
  // Huy giua chung van ton credit da tru, va nguoi ban khong hieu vi sao mat.
  for (const tab of ['all', 'waiting', 'failed', 'done', 'working']) {
    const ds = chonNhom(MAU, tab);
    for (const id of ['dang1', 'dang2']) {
      assert.ok(!ds.some((p) => p.id === id), `tab "${tab}" dinh vao "${id}" dang dung`);
    }
  }
});

test('tab "Khong thanh cong" don duoc video HONG', () => {
  // Day la lo hong cua ban dau: chi bat nhom 'waiting' nen 5 du an hong khong don
  // duoc — ma video hong moi la thu nguoi ban muon don nhat.
  const ds = chonNhom(MAU, 'failed');
  assert.equal(ds.length, 2);
  assert.ok(ds.every((p) => p.status === 'failed'));
});

test('tab "Chua hoan tat" chi don ban nhap', () => {
  const ds = chonNhom(MAU, 'waiting');
  assert.equal(ds.length, 3);
  assert.ok(!ds.some((p) => p.status === 'failed'), 'khong duoc gom video hong vao day');
});

test('tab "Tat ca" don ca hai nhom, khong trung lap', () => {
  const ds = chonNhom(MAU, 'all');
  assert.equal(ds.length, 5);
  assert.equal(new Set(ds.map((p) => p.id)).size, 5, 'co du an bi dem hai lan');
});

test('tab "Hoan thanh" va "Dang dung" KHONG cho don hang loat', () => {
  assert.equal(chonNhom(MAU, 'done').length, 0);
  assert.equal(chonNhom(MAU, 'working').length, 0);
});

test('du an co video thi khong bao gio bi dong, du trang thai la gi', () => {
  // Trang thai co the sai lech, nhung CO FILE nghia la khach co thanh pham.
  const la: DuAn[] = [
    { id: 'x', status: 'draft', video: { output_url: 'https://x/y.mp4' } },
    { id: 'y', status: 'failed', video: { output_url: 'https://x/z.mp4' } },
  ];
  assert.equal(chonNhom(la, 'all').length, 0);
});

test('danh sach rong khong lam no vo', () => {
  for (const tab of ['all', 'waiting', 'failed']) {
    assert.deepEqual(chonNhom([], tab), []);
  }
});
