/**
 * Canh `requireRenderOwner` — cửa duy nhất chặn người này đọc/xếp lại render của người kia.
 *
 * ── Vì sao phải canh kỹ ──
 *
 * Trước 02/11/2026 hai route `/render/retry` và `/render/status/:renderId` **không kiểm
 * gì cả**: bất kỳ ai biết một renderId đều xếp lại được hàng đợi render của người khác
 * (đốt CPU và TRỪ CREDIT của chủ sở hữu), hoặc đọc được `output_url` của họ.
 *
 * Bảng `renders` không có cột `user_id` — quyền đi vòng qua
 * `renders.project_id → projects.user_id`. Vòng đó có nhiều chỗ hở hơn một phép so sánh
 * trực tiếp, nên từng nhánh đều có test riêng.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireRenderOwner } from '../src/lib/auth';

const ID = '11111111-2222-3333-4444-555555555555';
const CHU = 'user-chu';
const KE_KHAC = 'user-khac';

function reqGia(token = 'Bearer x') {
  return { headers: { authorization: token } } as any;
}

function replyGia() {
  const ra: { ma?: number; than?: any } = {};
  const self: any = {
    status(n: number) { ra.ma = n; return self; },
    send(t: any) { ra.than = t; return self; },
    ket: ra,
  };
  return self;
}

/** db giả: trả dòng theo bảng, và đếm số lượt truy vấn để kiểm cả hiệu năng. */
function dbGia(bang: Record<string, any>) {
  const demTruyVan: string[] = [];
  return {
    demTruyVan,
    from(ten: string) {
      demTruyVan.push(ten);
      const self: any = {
        select: () => self,
        eq: () => self,
        single: () => Promise.resolve({ data: bang[ten] ?? null, error: null }),
      };
      return self;
    },
  };
}

const DB_BINH_THUONG = () => dbGia({
  renders: { id: ID, project_id: 'p1', status: 'failed' },
  projects: { user_id: CHU },
});

test('renderId khong dung dang UUID thi 400, KHONG di tiep xuong CSDL', async () => {
  // Chuoi rac tha vao cot uuid lam Postgres nem loi, thanh 500 — che mat loi that
  // cua nguoi goi va bien mot yeu cau sai thanh mot su co server.
  for (const xau of ['', 'abc', '1; DROP TABLE renders', '11111111-2222-3333-4444']) {
    const reply = replyGia();
    const db = DB_BINH_THUONG();
    const ra = await requireRenderOwner(reqGia(), reply, xau, { db, layUserId: async () => CHU });

    assert.equal(ra, null, `voi "${xau}"`);
    assert.equal(reply.ket.ma, 400, `voi "${xau}"`);
    assert.deepEqual(db.demTruyVan, [], 'Khong duoc truy van gi khi id da sai dang');
  }
});

test('khong co token thi 401', async () => {
  const reply = replyGia();
  const ra = await requireRenderOwner(reqGia(undefined as any), reply, ID, {
    db: DB_BINH_THUONG(),
    layUserId: async () => null,
  });
  assert.equal(ra, null);
  assert.equal(reply.ket.ma, 401);
});

test('render khong ton tai thi 404', async () => {
  const reply = replyGia();
  const ra = await requireRenderOwner(reqGia(), reply, ID, {
    db: dbGia({ renders: null }),
    layUserId: async () => CHU,
  });
  assert.equal(ra, null);
  assert.equal(reply.ket.ma, 404);
});

test('render KHONG co project_id thi 403 — khong ai chung minh duoc quyen', async () => {
  // Day la nhanh de bo sot nhat. Nguon sinh ra dong khong chu da bit ngay 02/11
  // (startRender gio bat buoc projectId), nhung nhanh nay van phai dong: no bao ve
  // cac dong cu va moi duong ghi moi co the quen. Cho qua la cho TAT CA moi nguoi.
  for (const pid of [null, undefined, '']) {
    const reply = replyGia();
    const ra = await requireRenderOwner(reqGia(), reply, ID, {
      db: dbGia({ renders: { id: ID, project_id: pid }, projects: { user_id: CHU } }),
      layUserId: async () => CHU,
    });
    assert.equal(ra, null, `voi project_id=${JSON.stringify(pid)}`);
    assert.equal(reply.ket.ma, 403, `voi project_id=${JSON.stringify(pid)}`);
  }
});

test('du an khong ton tai thi 404, khong cho qua', async () => {
  // Du an bi xoa that, hay khoa ngoai hong — ca hai deu la "khong chung minh duoc".
  const reply = replyGia();
  const ra = await requireRenderOwner(reqGia(), reply, ID, {
    db: dbGia({ renders: { id: ID, project_id: 'p1' }, projects: null }),
    layUserId: async () => CHU,
  });
  assert.equal(ra, null);
  assert.equal(reply.ket.ma, 404);
});

test('nguoi khac khong phai admin thi 403', async () => {
  const reply = replyGia();
  const ra = await requireRenderOwner(reqGia(), reply, ID, {
    db: DB_BINH_THUONG(),
    layUserId: async () => KE_KHAC,
    kiemAdmin: async () => false,
  });
  assert.equal(ra, null);
  assert.equal(reply.ket.ma, 403);
  assert.match(String(reply.ket.than?.error), /do not own/i);
});

test('chu so huu thi qua, va tra ve ca dong render de khoi doc lai', async () => {
  const reply = replyGia();
  const ra = await requireRenderOwner(reqGia(), reply, ID, {
    db: DB_BINH_THUONG(),
    layUserId: async () => CHU,
  });
  assert.equal(ra?.userId, CHU);
  assert.equal(ra?.render.id, ID);
  assert.equal(ra?.render.status, 'failed', 'Noi goi dung truong nay, khong duoc mat');
  assert.equal(reply.ket.ma, undefined, 'Khong duoc gui ma loi nao khi hop le');
});

test('admin di qua duoc render cua nguoi khac', async () => {
  const reply = replyGia();
  const ra = await requireRenderOwner(reqGia(), reply, ID, {
    db: DB_BINH_THUONG(),
    layUserId: async () => KE_KHAC,
    kiemAdmin: async () => true,
  });
  assert.equal(ra?.userId, KE_KHAC);
  assert.equal(reply.ket.ma, undefined);
});

test('KHONG hoi vai tro admin khi nguoi goi da la chu', async () => {
  // Hoi admin la mot luot truy van nua. Tra cho moi request cua nguoi dung binh thuong
  // la tra khong can thiet.
  let soLanHoi = 0;
  const reply = replyGia();
  await requireRenderOwner(reqGia(), reply, ID, {
    db: DB_BINH_THUONG(),
    layUserId: async () => CHU,
    kiemAdmin: async () => { soLanHoi += 1; return true; },
  });
  assert.equal(soLanHoi, 0);
});

test('chi truy van renders roi projects, dung thu tu, khong du', async () => {
  const db = DB_BINH_THUONG();
  await requireRenderOwner(reqGia(), replyGia(), ID, { db, layUserId: async () => CHU });
  assert.deepEqual(db.demTruyVan, ['renders', 'projects']);
});

test('kiemAdmin nem loi thi KHONG cho qua', async () => {
  // `isAdmin` that fail-closed, nhung neu no nem thi ham nay cung khong duoc cho qua.
  const reply = replyGia();
  await assert.rejects(() => requireRenderOwner(reqGia(), reply, ID, {
    db: DB_BINH_THUONG(),
    layUserId: async () => KE_KHAC,
    kiemAdmin: async () => { throw new Error('CSDL hong'); },
  }));
  // Nem ra ngoai thi route tra 500 — khong phai 200. Dieu quan trong la KHONG qua duoc.
});
