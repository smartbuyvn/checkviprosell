/**
 * Dọn clip gốc sau khi render xong, và dọn thư mục tạm còn sót trên ổ đĩa.
 *
 * ── Vì sao cần ──
 *
 * Bảng dung lượng ở spec V3 chỉ đếm video XUẤT RA. Clip khách tự quay nặng hơn nhiều
 * và trước nay nằm lại tới khi dự án vào thùng rác rồi quá 30 ngày: 1.000 dự án/tháng
 * là 176 GB thay vì 12 GB — gấp 14 lần.
 *
 * ── Vì sao kiểm bằng client giả ──
 *
 * Đây là mã XOÁ DỮ LIỆU CỦA KHÁCH. Một phép kiểm chạy trên CSDL thật mà sai điều kiện
 * thì chính nó là sự cố. Client giả cho kiểm được đúng thứ nguy hiểm nhất — rằng nó
 * KHÔNG xoá thứ chưa được phép xoá — mà không rủi ro gì.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  purgeSourceClips,
  donThuMucTamCu,
  GIU_CLIP_GOC_GIO,
  storagePathFromUrl,
} from '../src/lib/storage-purge';

const GIO = 3600_000;
const truoc = (gio: number) => new Date(Date.now() - gio * GIO).toISOString();
const URL_CLIP = (t: string) =>
  `https://abc.supabase.co/storage/v1/object/public/project-assets/${t}/clip.mp4`;

/**
 * Supabase giả, đủ cho đúng những lời gọi `purgeSourceClips` dùng.
 * Ghi lại mọi thứ bị xoá để phép kiểm soi được.
 */
function sbGia(opts: {
  renders?: any[];
  assets?: Record<string, any[]>;
  loiXoa?: string;
  loiGhi?: string;
}) {
  const daXoa: string[] = [];
  const daGhi: Array<{ ids: string[]; moc: string }> = [];

  const truyVan = (bang: string) => {
    const dk: any = { bang, loc: {} };
    const api: any = {
      select: () => api,
      eq: (c: string, v: any) => { dk.loc[c] = v; return api; },
      in: (c: string, v: any) => { dk.loc[c] = v; return api; },
      lt: () => api,
      is: () => api,
      order: () => api,
      limit: () => ketQua(),
      update: (giaTri: any) => ({
        in: (_c: string, ids: string[]) => {
          if (opts.loiGhi) return Promise.resolve({ error: { message: opts.loiGhi } });
          daGhi.push({ ids, moc: giaTri.storage_deleted_at });
          return Promise.resolve({ error: null });
        },
      }),
      then: (r: any) => Promise.resolve(ketQua()).then(r),
    };
    function ketQua() {
      if (bang === 'renders') return { data: opts.renders ?? [], error: null };
      const id = dk.loc.project_id;
      return { data: (opts.assets ?? {})[id] ?? [], error: null };
    }
    return api;
  };

  return {
    daXoa,
    daGhi,
    from: (bang: string) => truyVan(bang),
    storage: {
      from: () => ({
        remove: (duong: string[]) => {
          if (opts.loiXoa) return Promise.resolve({ error: { message: opts.loiXoa } });
          daXoa.push(...duong);
          return Promise.resolve({ error: null });
        },
      }),
    },
  } as any;
}

test('giu dung 24 gio theo spec', () => {
  assert.equal(GIU_CLIP_GOC_GIO, 24, 'Spec V3 §10 chot 24 gio');
});

test('xoa clip cua du an da render xong qua han', async () => {
  const sb = sbGia({
    renders: [{ project_id: 'da', updated_at: truoc(30) }],
    assets: { da: [{ id: 'a1', file_url: URL_CLIP('da') }] },
  });
  const r = await purgeSourceClips(sb);

  assert.equal(r.clipDaXoa, 1, 'Khong xoa clip nao');
  assert.deepEqual(sb.daXoa, ['da/clip.mp4']);
  assert.equal(r.loi.length, 0, r.loi.join('; '));
});

test('KHONG xoa clip cua du an render xong CHUA qua han', async () => {
  // Khach vua dung xong 2 tieng truoc, van con quyen dung lai ma khong phai tai len.
  const sb = sbGia({
    renders: [],  // truy van `.lt(updated_at, moc)` loc het, nen danh sach rong
    assets: { moi: [{ id: 'a1', file_url: URL_CLIP('moi') }] },
  });
  const r = await purgeSourceClips(sb);

  assert.equal(r.clipDaXoa, 0);
  assert.deepEqual(sb.daXoa, [], 'Da xoa clip chua qua han!');
});

test('KHONG xoa clip cua du an chua render lan nao', async () => {
  // Khong co render nao -> khong co project_id nao de xet.
  const sb = sbGia({
    renders: [],
    assets: { dangLam: [{ id: 'a1', file_url: URL_CLIP('dangLam') }] },
  });
  const r = await purgeSourceClips(sb);

  assert.equal(r.duAnDaCham, 0);
  assert.deepEqual(sb.daXoa, [], 'Da xoa clip cua du an khach dang lam do!');
});

test('ghi moc SAU khi xoa file, khong phai truoc', async () => {
  // Ghi moc truoc roi xoa hong thi file thanh mo coi vinh vien.
  const sb = sbGia({
    renders: [{ project_id: 'da', updated_at: truoc(30) }],
    assets: { da: [{ id: 'a1', file_url: URL_CLIP('da') }] },
    loiXoa: 'bucket tu choi',
  });
  const r = await purgeSourceClips(sb);

  assert.equal(r.clipDaXoa, 0);
  assert.equal(sb.daGhi.length, 0, 'Da ghi moc du file chua xoa duoc — file thanh mo coi');
  assert.ok(r.loi.length > 0, 'Nuot loi xoa file');
});

test('danh dau bang hang sau khi xoa xong', async () => {
  const sb = sbGia({
    renders: [{ project_id: 'da', updated_at: truoc(30) }],
    assets: { da: [{ id: 'a1', file_url: URL_CLIP('da') }, { id: 'a2', file_url: URL_CLIP('da') }] },
  });
  await purgeSourceClips(sb);

  assert.equal(sb.daGhi.length, 1);
  assert.deepEqual(sb.daGhi[0].ids, ['a1', 'a2'], 'Thieu hang duoc danh dau');
  assert.ok(sb.daGhi[0].moc, 'Khong ghi moc thoi gian');
});

test('mot du an hong khong chan cac du an con lai', async () => {
  const sb = sbGia({
    renders: [
      { project_id: 'hong', updated_at: truoc(30) },
      { project_id: 'lanh', updated_at: truoc(30) },
    ],
    assets: {
      hong: [{ id: 'x', file_url: 'https://ngoai.example.com/clip.mp4' }],
      lanh: [{ id: 'y', file_url: URL_CLIP('lanh') }],
    },
  });
  const r = await purgeSourceClips(sb);
  assert.equal(r.duAnDaCham, 2, 'Du an sau bi bo qua');
});

test('dryRun khong xoa gi het', async () => {
  const sb = sbGia({
    renders: [{ project_id: 'da', updated_at: truoc(30) }],
    assets: { da: [{ id: 'a1', file_url: URL_CLIP('da') }] },
  });
  await purgeSourceClips(sb, { dryRun: true });

  assert.deepEqual(sb.daXoa, [], 'dryRun van xoa file');
  assert.equal(sb.daGhi.length, 0, 'dryRun van ghi moc');
});

test('url khong thuoc bucket nay thi khong sinh duong dan xoa', () => {
  // Tha bo sot mot file con hon xoa nham thu khong phai cua minh.
  assert.equal(storagePathFromUrl('https://ngoai.example.com/a.mp4', 'project-assets'), null);
  assert.equal(storagePathFromUrl(URL_CLIP('x'), 'renders'), null);
  assert.equal(storagePathFromUrl(URL_CLIP('x'), 'project-assets'), 'x/clip.mp4');
});

/* ── Thư mục tạm trên ổ đĩa ── */

function thuMucThu(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'don-tam-'));
}

function taoThuMuc(goc: string, ten: string, gioTuoi: number): string {
  const d = path.join(goc, ten);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'f.bin'), 'x');
  const t = new Date(Date.now() - gioTuoi * GIO);
  fs.utimesSync(d, t, t);
  return d;
}

test('xoa thu muc tam cu hon han giu', () => {
  const goc = thuMucThu();
  taoThuMuc(goc, 'cu', 30);
  const r = donThuMucTamCu(fs, path, goc);
  assert.equal(r.daXoa, 1);
  assert.equal(fs.existsSync(path.join(goc, 'cu')), false);
  fs.rmSync(goc, { recursive: true, force: true });
});

test('GIU thu muc tam con moi', () => {
  const goc = thuMucThu();
  taoThuMuc(goc, 'moi', 2);
  const r = donThuMucTamCu(fs, path, goc);
  assert.equal(r.daXoa, 0);
  assert.ok(fs.existsSync(path.join(goc, 'moi')), 'Xoa mat thu muc con moi');
  fs.rmSync(goc, { recursive: true, force: true });
});

test('KHONG BAO GIO xoa thu muc cua job dang chay, du moc cu', () => {
  // Job chay lau (clip dai, may cham) co the vuot 24 gio. Xoa giua chung la hong render.
  const goc = thuMucThu();
  taoThuMuc(goc, 'dang-chay', 50);
  const r = donThuMucTamCu(fs, path, goc, { dangChay: new Set(['dang-chay']) });
  assert.equal(r.daXoa, 0);
  assert.ok(fs.existsSync(path.join(goc, 'dang-chay')), 'Xoa thu muc cua job dang dung!');
  fs.rmSync(goc, { recursive: true, force: true });
});

test('KHONG xoa worker.lock — xoa no la hai worker cung chay', () => {
  const goc = thuMucThu();
  const khoa = path.join(goc, 'worker.lock');
  fs.writeFileSync(khoa, '1234');
  const t = new Date(Date.now() - 100 * GIO);
  fs.utimesSync(khoa, t, t);

  donThuMucTamCu(fs, path, goc);
  assert.ok(fs.existsSync(khoa), 'Da xoa worker.lock');
  fs.rmSync(goc, { recursive: true, force: true });
});

test('thu muc goc chua ton tai thi khong nem loi', () => {
  const r = donThuMucTamCu(fs, path, path.join(os.tmpdir(), 'khong-he-ton-tai-' + Date.now()));
  assert.equal(r.daXoa, 0);
  assert.equal(r.loi.length, 0);
});

test('chi hoi trang thai CO THAT trong enum render_status', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const nguon = readFileSync(join(__dirname, '..', 'src', 'lib', 'storage-purge.ts'), 'utf8');

  // Enum that: pending, queued, processing, completed, failed, cancelled.
  //
  // Ban dau hoi `['completed', 'exported']` — chep tu `render.ts`, noi 'exported' chi
  // la mot chuoi trong mang JavaScript nen khong ai phat hien. Postgres thi tu choi ca
  // cau lenh: "invalid input value for enum render_status: exported", va vong don chet
  // moi gio mot lan trong im lang — do that tren nhat ky worker ngay 30/10.
  assert.doesNotMatch(nguon, /'exported'/, "Van con hoi trang thai 'exported' khong co trong enum");

  const hopLe = ['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'];
  for (const m of nguon.matchAll(/\.(?:eq|in)\('status',\s*(.+?)\)/g)) {
    for (const g of String(m[1]).matchAll(/'([^']+)'/g)) {
      assert.ok(hopLe.includes(g[1]), `Trang thai "${g[1]}" khong co trong enum render_status`);
    }
  }
});
