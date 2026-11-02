/** Xác minh migration 20261101000001 đã vào: cột, hàm, chỉ mục — không chạm job thật. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const COT_MOI = [
  'job_type', 'input_mode', 'duration_seconds', 'idempotency_key', 'stage',
  'attempt_id', 'attempt_count', 'claimed_by', 'lease_expires_at', 'heartbeat_at',
  'retryable', 'next_retry_at', 'input_manifest', 'output_manifest',
  'credit_reservation_id', 'prompt_bundle_version', 'render_plan_version',
  'degraded_reason', 'started_at', 'completed_at', 'cancelled_at',
];

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 1. Cột — đọc từ PostgREST OpenAPI, là schema THẬT đang phục vụ.
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const doc: any = await r.json();
  const props = (doc.definitions ?? doc.components?.schemas ?? {}).renders?.properties ?? {};
  const thieu = COT_MOI.filter((c) => !(c in props));
  console.log(`[1] Cot moi: ${COT_MOI.length - thieu.length}/${COT_MOI.length}` +
    (thieu.length ? `  THIEU: ${thieu.join(', ')}` : '  OK'));

  // 2. nhan_job_render — job_type khong ton tai => chac chan 0 dong, khong cuop job nao.
  const { data: j, error: ej } = await db.rpc('nhan_job_render', {
    p_worker: 'kiem-tra-migration',
    p_job_types: ['__khong_ton_tai__'],
    p_lease_giay: 90,
  });
  console.log(`[2] nhan_job_render: ${ej ? 'LOI — ' + ej.message : `OK, tra ve ${(j ?? []).length} dong (dung phai 0)`}`);

  // 3. gia_han_lease — id ngau nhien => phai tra FALSE, khong sua dong nao.
  const { data: g, error: eg } = await db.rpc('gia_han_lease', {
    p_id: '00000000-0000-0000-0000-000000000000',
    p_attempt: '00000000-0000-0000-0000-000000000000',
    p_worker: 'kiem-tra-migration',
    p_lease_giay: 90,
  });
  console.log(`[3] gia_han_lease: ${eg ? 'LOI — ' + eg.message : `OK, tra ve ${g} (dung phai false)`}`);

  // 4. Hang doi hien tai — de biet co an toan de noi worker khong.
  const { data: hd } = await db.from('renders').select('status').is('deleted_at', null);
  const dem: Record<string, number> = {};
  for (const x of hd ?? []) dem[(x as any).status] = (dem[(x as any).status] ?? 0) + 1;
  console.log(`[4] Hang doi: ${JSON.stringify(dem)}  (tong ${(hd ?? []).length})`);

  // 5. job_type da backfill chua.
  const { data: jt } = await db.from('renders').select('job_type').is('deleted_at', null);
  const demJt: Record<string, number> = {};
  for (const x of jt ?? []) demJt[(x as any).job_type] = (demJt[(x as any).job_type] ?? 0) + 1;
  console.log(`[5] job_type: ${JSON.stringify(demJt)}`);
}

main().catch((e) => { console.error('VO:', e.message); process.exit(1); });
