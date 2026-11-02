/**
 * Canh quyền sở hữu job: nhận, giữ, chặn ghi khi mất lease.
 *
 * Dùng db GIẢ, không nối Supabase: những điều cần canh ở đây là LOGIC quyết định
 * (lỗi mạng khác với mất lease, đường cũ không bị chặn, nhịp tim chịu được chớp mạng),
 * không phải việc Postgres có chạy đúng không — phần đó migration và hàm SQL lo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_TYPES_MAC_DINH,
  LEASE_GIAY_MAC_DINH,
  SO_LAN_LOI_TOI_DA,
  MatLeaseError,
  jobTypesHoTro,
  tenWorker,
  nhipTimGiay,
  leaseDangBat,
  nhanJob,
  quyenTuDong,
  giaHanLease,
  ghiCoChan,
  batDauNhipTim,
  type QuyenJob,
} from '../src/lib/lease';

const QUYEN: QuyenJob = { renderId: 'r1', attemptId: 'a1', worker: 'may:123' };

/**
 * Chờ tới khi điều kiện đúng, hoặc hết hạn.
 *
 * Hạn 10 giây chứ không phải 2: các phép kiểm nhịp tim chạy xong trong 60–120 ms khi máy
 * rảnh, nhưng chúng chạy cùng 48 tệp test khác và `node --test` chạy song song. Hạn 2 giây
 * đã đỏ một lần vì đói CPU chứ không vì mã sai — một test chập chờn tệ hơn không có test,
 * vì lần sau nó đỏ thì không ai tin là lỗi thật.
 *
 * 10 giây vẫn cho khoảng 80 lần dư, và vẫn đỏ nhanh nếu nhịp tim thật sự không chạy.
 */
async function cho(dieuKien: () => boolean, hanMs = 10_000): Promise<void> {
  const batDau = Date.now();
  const het = batDau + hanMs;
  while (!dieuKien()) {
    if (Date.now() > het) throw new Error(`Het han cho sau ${Date.now() - batDau}ms`);
    await new Promise((r) => setTimeout(r, 2));
  }
}

type LenhGhi = { truong: Record<string, unknown>; eq: Record<string, unknown> };

function dbGia(opts: {
  rpc?: (ten: string, tham: any) => { data: any; error: any };
  ghi?: (l: LenhGhi) => { data: any; error: any };
}) {
  const goiRpc: Array<{ ten: string; tham: any }> = [];
  const lenhGhi: LenhGhi[] = [];

  const db = {
    goiRpc,
    lenhGhi,
    async rpc(ten: string, tham: any) {
      goiRpc.push({ ten, tham });
      return opts.rpc ? opts.rpc(ten, tham) : { data: null, error: null };
    },
    from(_bang: string) {
      const l: LenhGhi = { truong: {}, eq: {} };
      const self: any = {
        update(t: Record<string, unknown>) { l.truong = t; return self; },
        eq(k: string, v: unknown) { l.eq[k] = v; return self; },
        select(_c: string) {
          lenhGhi.push(l);
          return Promise.resolve(opts.ghi ? opts.ghi(l) : { data: [{ id: 'r1' }], error: null });
        },
      };
      return self;
    },
  };
  return db;
}

// ───────────────────────── Capability registry ─────────────────────────

test('jobTypesHoTro: mac dinh dung hai loai worker THAT SU lam duoc', () => {
  assert.deepEqual(jobTypesHoTro({}), ['image_ads', 'clip_edit']);
  // Khai them loai chua lam duoc la tu nhan job roi de no chet.
  assert.equal(JOB_TYPES_MAC_DINH.includes('face_swap'), false);
  assert.equal(JOB_TYPES_MAC_DINH.includes('koc'), false);
});

test('jobTypesHoTro: WORKER_JOB_TYPES thu hep duoc, va bo khoang trang', () => {
  assert.deepEqual(jobTypesHoTro({ WORKER_JOB_TYPES: 'image_ads' }), ['image_ads']);
  assert.deepEqual(jobTypesHoTro({ WORKER_JOB_TYPES: ' clip_edit , image_ads ' }), ['clip_edit', 'image_ads']);
});

test('jobTypesHoTro: dat rong thi lui ve mac dinh, KHONG ve danh sach rong', () => {
  // Danh sach rong nghia la worker khong nhan viec gi — mot bien moi truong go sai
  // se lam ca he thong dung im lang.
  for (const x of ['', '   ', ',', ' , , ']) {
    assert.deepEqual(jobTypesHoTro({ WORKER_JOB_TYPES: x }), ['image_ads', 'clip_edit'], `voi "${x}"`);
  }
});

// ───────────────────────── Tên worker ─────────────────────────

test('tenWorker: phan biet duoc hai TIEN TRINH tren cung mot may', () => {
  const a = tenWorker({}, 'maytinh', 111);
  const b = tenWorker({}, 'maytinh', 222);
  assert.notEqual(a, b, 'Hai worker cung may phai khac ten — neu khong thi khong thu duoc viec nhan trung');
  assert.match(a, /maytinh/);
});

test('tenWorker: WORKER_NAME de ghi de', () => {
  assert.equal(tenWorker({ WORKER_NAME: 'vps-1' }, 'maytinh', 1), 'vps-1');
});

// ───────────────────────── Nhịp và cờ bật ─────────────────────────

test('nhipTimGiay: mot phan ba lease, khong bao gio duoi 5 giay', () => {
  assert.equal(nhipTimGiay(90), 30);
  assert.equal(nhipTimGiay(30), 10);
  // Lease ngan thi nhip khong duoc ngan theo xuong 0 — se thanh vong lap nong.
  assert.equal(nhipTimGiay(3), 5);
  assert.equal(nhipTimGiay(0), 5);
});

test('leaseDangBat: MAC DINH TAT — worker chay y nhu truoc', () => {
  assert.equal(leaseDangBat({}), false);
  assert.equal(leaseDangBat({ HANG_DOI_LEASE: '0' }), false);
  assert.equal(leaseDangBat({ HANG_DOI_LEASE: '1' }), true);
});

// ───────────────────────── Nhận job ─────────────────────────

test('nhanJob: tra ve dong va truyen dung tham so cho RPC', async () => {
  const db = dbGia({ rpc: () => ({ data: [{ id: 'r9', attempt_id: 'a9' }], error: null }) });
  const dong = await nhanJob(db, { worker: 'w1', jobTypes: ['image_ads'], leaseGiay: 60 });

  assert.equal(dong?.id, 'r9');
  assert.deepEqual(db.goiRpc[0], {
    ten: 'nhan_job_render',
    tham: { p_worker: 'w1', p_job_types: ['image_ads'], p_lease_giay: 60 },
  });
});

test('nhanJob: hang doi rong thi tra null', async () => {
  for (const data of [[], null, undefined]) {
    const db = dbGia({ rpc: () => ({ data, error: null }) });
    assert.equal(await nhanJob(db, { worker: 'w', jobTypes: ['image_ads'] }), null);
  }
});

test('nhanJob: loi RPC thi NEM, khong tra null', async () => {
  // "Khong co viec" va "khong goi duoc CSDL" la hai chuyen khac nhau. Lan chung vao
  // nhau thi mot su co mang trong y nhu hang doi rong, khong ai biet worker dang doi.
  const db = dbGia({ rpc: () => ({ data: null, error: { message: 'mat ket noi' } }) });
  await assert.rejects(
    () => nhanJob(db, { worker: 'w', jobTypes: ['image_ads'] }),
    /nhan_job_render that bai.*mat ket noi/,
  );
});

test('nhanJob: lease mac dinh 90 giay khi khong dat', async () => {
  const db = dbGia({ rpc: () => ({ data: [], error: null }) });
  await nhanJob(db, { worker: 'w', jobTypes: ['image_ads'] });
  assert.equal(db.goiRpc[0].tham.p_lease_giay, LEASE_GIAY_MAC_DINH);
});

test('quyenTuDong: thieu attempt_id thi nem — khong im lang bo qua', () => {
  assert.deepEqual(quyenTuDong({ id: 'r1', attempt_id: 'a1' }, 'w'), {
    renderId: 'r1', attemptId: 'a1', worker: 'w',
  });
  assert.throws(() => quyenTuDong({ id: 'r1' }, 'w'), /khong co attempt_id/);
  assert.throws(() => quyenTuDong({} as any, 'w'), /khong co id/);
});

// ───────────────────────── Gia hạn lease ─────────────────────────

test('giaHanLease: TRUE/FALSE di thang tu RPC', async () => {
  for (const [data, mong] of [[true, true], [false, false], [null, false]] as const) {
    const db = dbGia({ rpc: () => ({ data, error: null }) });
    assert.equal(await giaHanLease(db, QUYEN), mong);
  }
});

test('giaHanLease: loi thi NEM, khong bien thanh FALSE', async () => {
  // FALSE nghia la "job khong con cua may" va worker phai huy viec. Coi loi mang
  // thanh FALSE se huy mot ca render dang chay vi mot goi tin roi.
  const db = dbGia({ rpc: () => ({ data: null, error: { message: 'timeout' } }) });
  await assert.rejects(() => giaHanLease(db, QUYEN), /gia_han_lease that bai.*timeout/);
});

test('giaHanLease: truyen dung ca ba manh quyen so huu', async () => {
  const db = dbGia({ rpc: () => ({ data: true, error: null }) });
  await giaHanLease(db, QUYEN, 45);
  assert.deepEqual(db.goiRpc[0].tham, {
    p_id: 'r1', p_attempt: 'a1', p_worker: 'may:123', p_lease_giay: 45,
  });
});

// ───────────────────────── Ghi có chặn ─────────────────────────

test('ghiCoChan: co quyen thi chan bang ca attempt_id VA claimed_by', async () => {
  const db = dbGia({});
  const duoc = await ghiCoChan(db, QUYEN, 'r1', { status: 'processing', progress: 50 });

  assert.equal(duoc, true);
  assert.deepEqual(db.lenhGhi[0].eq, { id: 'r1', attempt_id: 'a1', claimed_by: 'may:123' });
  assert.deepEqual(db.lenhGhi[0].truong, { status: 'processing', progress: 50 });
});

test('ghiCoChan: 0 dong bi sua thi tra FALSE — attempt da bi thay', async () => {
  const db = dbGia({ ghi: () => ({ data: [], error: null }) });
  assert.equal(await ghiCoChan(db, QUYEN, 'r1', { status: 'completed' }), false);
});

test('ghiCoChan: quyen null thi KHONG chan — day la duong cu', async () => {
  // Chua bat lease thi dong render khong co attempt_id nao de so. Chan o day se lam
  // moi lenh ghi that bai, tuc tat worker.
  const db = dbGia({ ghi: () => ({ data: [], error: null }) });
  const duoc = await ghiCoChan(db, null, 'r7', { status: 'failed' });

  assert.equal(duoc, true, 'Duong cu phai luon coi la ghi thanh cong');
  assert.deepEqual(db.lenhGhi[0].eq, { id: 'r7' }, 'Khong duoc them dieu kien nao');
});

test('ghiCoChan: loi ghi thi NEM, khong tra FALSE', async () => {
  const db = dbGia({ ghi: () => ({ data: null, error: { message: 'het ket noi' } }) });
  await assert.rejects(() => ghiCoChan(db, QUYEN, 'r1', { progress: 1 }), /Ghi renders that bai/);
});

// ───────────────────────── Nhịp tim ─────────────────────────

test('nhip tim: gia han lap lai cho toi khi dung', async () => {
  let soLan = 0;
  const db = dbGia({ rpc: () => { soLan += 1; return { data: true, error: null }; } });
  const nhip = batDauNhipTim(db, QUYEN, { nhipMs: 3 });

  await cho(() => soLan >= 3);
  nhip.dung();
  const chot = soLan;
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(soLan, chot, 'Da dung thi khong gia han them');
  assert.equal(nhip.daMat(), false);
});

test('nhip tim: RPC tra FALSE thi bao mat lease NGAY va tu dung', async () => {
  const lyDo: string[] = [];
  const db = dbGia({ rpc: () => ({ data: false, error: null }) });
  const nhip = batDauNhipTim(db, QUYEN, { nhipMs: 3, onMatLease: (l) => lyDo.push(l) });

  await cho(() => nhip.daMat());
  assert.equal(lyDo.length, 1);
  assert.match(lyDo[0], /FALSE/);

  await new Promise((r) => setTimeout(r, 20));
  assert.equal(lyDo.length, 1, 'onMatLease chi duoc goi MOT lan');
});

test('nhip tim: chiu duoc chop mang — chua du so lan loi thi KHONG huy job', async () => {
  let soLan = 0;
  const db = dbGia({
    rpc: () => {
      soLan += 1;
      // Loi hai lan roi lai duoc: dung mot ca render nam phut vi chuyen nay la sai.
      if (soLan <= 2) return { data: null, error: { message: 'chop mang' } };
      return { data: true, error: null };
    },
  });
  const loi: number[] = [];
  const nhip = batDauNhipTim(db, QUYEN, { nhipMs: 3, onLoi: (_e, n) => loi.push(n) });

  await cho(() => soLan >= 4);
  nhip.dung();

  assert.deepEqual(loi, [1, 2], 'Dem loi phai tang lien tiep');
  assert.equal(nhip.daMat(), false, 'Hai lan loi roi lai duoc thi KHONG duoc coi la mat lease');
});

test('nhip tim: du so lan loi LIEN TIEP thi coi la mat lease', async () => {
  const lyDo: string[] = [];
  const db = dbGia({ rpc: () => ({ data: null, error: { message: 'chet han' } }) });
  const nhip = batDauNhipTim(db, QUYEN, { nhipMs: 3, onMatLease: (l) => lyDo.push(l) });

  await cho(() => nhip.daMat());
  assert.match(lyDo[0], new RegExp(`${SO_LAN_LOI_TOI_DA} lan`));
});

test('nhip tim: mot lan dung duoc reset dem loi', async () => {
  // Loi, loi, duoc, loi, loi — tong 4 loi nhung khong bao gio 3 lan LIEN TIEP.
  const chuoi = [false, false, true, false, false, true, true];
  let i = 0;
  const db = dbGia({
    rpc: () => {
      const ok = chuoi[Math.min(i++, chuoi.length - 1)];
      return ok ? { data: true, error: null } : { data: null, error: { message: 'x' } };
    },
  });
  const nhip = batDauNhipTim(db, QUYEN, { nhipMs: 3 });

  await cho(() => i >= chuoi.length);
  nhip.dung();
  assert.equal(nhip.daMat(), false, 'Khong co 3 lan loi lien tiep thi khong mat lease');
});

test('nhip tim: dung() goi nhieu lan khong vo', async () => {
  const db = dbGia({ rpc: () => ({ data: true, error: null }) });
  const nhip = batDauNhipTim(db, QUYEN, { nhipMs: 3 });
  nhip.dung();
  nhip.dung();
  nhip.dung();
  assert.equal(nhip.daMat(), false);
});

test('MatLeaseError giu renderId de log biet job nao', () => {
  const e = new MatLeaseError('r42', 'thu nghiem');
  assert.equal(e.renderId, 'r42');
  assert.equal(e.name, 'MatLeaseError');
  assert.match(e.message, /r42/);
});
