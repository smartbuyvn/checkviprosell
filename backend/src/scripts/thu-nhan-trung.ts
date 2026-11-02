/**
 * Chứng minh hàng đợi có khoá thật sự chặn hai worker nhận trùng một job.
 *
 * ── Vì sao phải thử trên CSDL thật ──
 *
 * `tests/lease.test.ts` canh logic quyết định bằng db giả, nhưng điều quan trọng nhất —
 * `FOR UPDATE SKIP LOCKED` có thật sự chỉ cho một người thắng không — là hành vi của
 * Postgres, không phải của mã TypeScript. Db giả không chứng minh được nó.
 *
 * ── Vì sao an toàn khi chạy trên CSDL đang sống ──
 *
 * Job thử dùng `job_type = '__thu_nghiem__'`. Worker thật chỉ nhận `image_ads` và
 * `clip_edit` (xem `jobTypesHoTro`), nên dù script chết giữa chừng và không dọn được,
 * dòng đó cũng không bao giờ bị worker nào nhặt lên dựng. Đây đúng là việc mà capability
 * registry sinh ra để làm, nên phép thử này cũng kiểm luôn cả nó.
 *
 * Dòng thử được sao từ một dòng render CÓ THẬT rồi đổi vài trường, để mọi ràng buộc
 * NOT NULL và khoá ngoại đều thoả mà không cần biết trước schema.
 *
 * Dùng:  npx tsx src/scripts/thu-nhan-trung.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { nhanJob, giaHanLease, ghiCoChan, quyenTuDong } from '../lib/lease';

const JOB_TYPE_THU = '__thu_nghiem__';
const SO_WORKER = 5;

let soDat = 0;
let soHong = 0;

function kiem(ten: string, dat: boolean, chiTiet = '') {
  if (dat) { soDat += 1; console.log(`  OK   ${ten}`); }
  else { soHong += 1; console.log(`  HONG ${ten}${chiTiet ? ' — ' + chiTiet : ''}`); }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Thieu SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Sao tu mot dong that de moi rang buoc NOT NULL / khoa ngoai deu thoa.
  const { data: mau, error: eMau } = await db
    .from('renders').select('*').is('deleted_at', null).limit(1).single();
  if (eMau || !mau) throw new Error(`Khong lay duoc dong render mau: ${eMau?.message}`);

  const dongThu: Record<string, any> = { ...mau };
  for (const bo of [
    'id', 'created_at', 'updated_at', 'attempt_id', 'attempt_count', 'claimed_by',
    'lease_expires_at', 'heartbeat_at', 'started_at', 'completed_at', 'cancelled_at',
    'output_url', 'thumbnail_url', 'idempotency_key', 'progress',
  ]) delete dongThu[bo];
  dongThu.job_type = JOB_TYPE_THU;
  dongThu.status = 'pending';
  dongThu.next_retry_at = null;

  const { data: tao, error: eTao } = await db.from('renders').insert(dongThu).select('id').single();
  if (eTao || !tao) throw new Error(`Khong tao duoc job thu: ${eTao?.message}`);
  const id = tao.id as string;
  console.log(`Job thu: ${id} (job_type=${JOB_TYPE_THU})\n`);

  try {
    // ── 1. Nam worker chiem cung luc: dung mot nguoi thang ──
    console.log(`[1] ${SO_WORKER} worker chiem cung luc`);
    const ketQua = await Promise.all(
      Array.from({ length: SO_WORKER }, (_, i) =>
        nhanJob(db, { worker: `thu-${i}`, jobTypes: [JOB_TYPE_THU], leaseGiay: 60 })
          .then((d) => (d ? { worker: `thu-${i}`, dong: d } : null))
          .catch((e) => { console.log(`       thu-${i} loi: ${e.message}`); return null; }),
      ),
    );
    const thang = ketQua.filter(Boolean) as Array<{ worker: string; dong: any }>;
    kiem(`dung MOT worker thang (thuc te: ${thang.length})`, thang.length === 1,
      thang.length > 1 ? 'HAI WORKER CUNG NHAN MOT JOB — khoa khong hoat dong' : 'khong ai nhan duoc');
    if (thang.length !== 1) return;

    const { worker, dong } = thang[0];
    const quyen = quyenTuDong(dong, worker);
    console.log(`       ${worker} thang, attempt=${quyen.attemptId}`);
    kiem('status thanh processing', dong.status === 'processing', `thuc te: ${dong.status}`);
    kiem('stage thanh claimed', dong.stage === 'claimed', `thuc te: ${dong.stage}`);
    kiem('attempt_count tang len 1', dong.attempt_count === 1, `thuc te: ${dong.attempt_count}`);
    kiem('co lease_expires_at', !!dong.lease_expires_at);

    // ── 2. Job dang co chu: khong ai nhan them duoc ──
    console.log('\n[2] Job dang co chu, lease con han');
    const them = await nhanJob(db, { worker: 'thu-ngoai', jobTypes: [JOB_TYPE_THU], leaseGiay: 60 });
    kiem('khong nhan duoc job dang chay', them === null, them ? `nhan duoc ${them.id}` : '');

    // ── 3. Capability registry: job_type khong khai thi khong nhan ──
    console.log('\n[3] Capability registry');
    const saiLoai = await nhanJob(db, { worker: 'thu-sai', jobTypes: ['image_ads', 'clip_edit'], leaseGiay: 60 });
    kiem('worker khong khai __thu_nghiem__ thi KHONG nhan job nay',
      saiLoai === null || saiLoai.id !== id,
      saiLoai?.id === id ? 'nhan mat job sai loai' : '');

    // ── 4. Gia han lease ──
    console.log('\n[4] Gia han lease');
    kiem('chu that gia han duoc', await giaHanLease(db, quyen, 60) === true);
    kiem('attempt_id sai thi KHONG gia han duoc',
      await giaHanLease(db, { ...quyen, attemptId: '00000000-0000-0000-0000-000000000000' }, 60) === false);
    kiem('ten worker sai thi KHONG gia han duoc',
      await giaHanLease(db, { ...quyen, worker: 'ke-mao-danh' }, 60) === false);

    // ── 5. Chan ghi theo attempt_id ──
    console.log('\n[5] Chan ghi theo attempt_id');
    kiem('chu that ghi duoc', await ghiCoChan(db, quyen, id, { progress: 42 }) === true);
    kiem('attempt cu KHONG ghi duoc',
      await ghiCoChan(db, { ...quyen, attemptId: '00000000-0000-0000-0000-000000000000' }, id, { progress: 99 }) === false);

    const { data: sau } = await db.from('renders').select('progress').eq('id', id).single();
    kiem('gia tri cua attempt cu KHONG lot vao CSDL', sau?.progress === 42, `thuc te: ${sau?.progress}`);

    // ── 6. Lease het han thi nhan lai duoc ──
    console.log('\n[6] Lease het han');
    await db.from('renders')
      .update({ lease_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', id);
    const nhanLai = await nhanJob(db, { worker: 'thu-moi', jobTypes: [JOB_TYPE_THU], leaseGiay: 60 });
    kiem('worker moi nhan lai duoc job het lease', nhanLai?.id === id);
    kiem('attempt_count tang len 2', nhanLai?.attempt_count === 2, `thuc te: ${nhanLai?.attempt_count}`);
    kiem('attempt_id la gia tri MOI', nhanLai?.attempt_id !== quyen.attemptId);
    kiem('claimed_by doi sang worker moi', nhanLai?.claimed_by === 'thu-moi', `thuc te: ${nhanLai?.claimed_by}`);

    // ── 7. Chu cu mat quyen sau khi bi nhan lai ──
    console.log('\n[7] Chu cu sau khi bi nhan lai');
    kiem('chu cu KHONG gia han duoc nua', await giaHanLease(db, quyen, 60) === false);
    kiem('chu cu KHONG ghi duoc nua', await ghiCoChan(db, quyen, id, { progress: 1 }) === false);
  } finally {
    const { error } = await db.from('renders').delete().eq('id', id);
    console.log(`\nDon job thu ${id}: ${error ? 'LOI — ' + error.message + ' (xoa tay di)' : 'xong'}`);
  }

  console.log(`\n${soDat} dat, ${soHong} hong`);
  if (soHong > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('VO:', e.message); process.exit(1); });
