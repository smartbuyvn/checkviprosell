/**
 * Xác minh migration 20261102000001 đã vào — KHÔNG ghi một dòng nào.
 *
 * Hai phép gọi dưới đây được chọn vì chúng thoát TRƯỚC mọi lệnh ghi:
 *
 *   - `p_so_credit = 0` → hàm trả `SO_CREDIT_KHONG_HOP_LE` ngay đầu, trước cả khi lấy
 *     khoá. Chứng minh hàm tồn tại và chạy được, với đúng 0 tác dụng lề.
 *   - Một `user_id` ngẫu nhiên (không có bút toán nào) → số dư 0 → `KHONG_DU_CREDIT`.
 *     Chứng minh đường đọc số dư chạy đúng, vẫn không ghi gì.
 *
 * Phép thử CÓ ghi (5 lần trừ đồng thời) nằm ở `thu-tru-credit.ts` và cần được cho phép.
 *
 * Dùng:  npx tsx src/scripts/soat-tru-credit.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { thieuHamRpc } from '../lib/loi-rpc';

let soDat = 0;
let soHong = 0;
function kiem(ten: string, dat: boolean, chiTiet = '') {
  if (dat) { soDat += 1; console.log(`  OK   ${ten}`); }
  else { soHong += 1; console.log(`  HONG ${ten}${chiTiet ? ' — ' + chiTiet : ''}`); }
}

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, key, { auth: { persistSession: false } });

  // ── 1. Cot render_id co trong schema that chua ──
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const doc: any = await r.json();
  const cot = (doc.definitions ?? doc.components?.schemas ?? {}).credit_ledger?.properties ?? {};
  kiem('cot credit_ledger.render_id ton tai', 'render_id' in cot);

  // ── 2. Ham ton tai va chay — tham so khong hop le, thoat truoc moi lenh ghi ──
  const { data: d1, error: e1 } = await db.rpc('tru_credit_render', {
    p_user: randomUUID(), p_project: null, p_render: randomUUID(),
    p_so_credit: 0, p_ly_do: 'soat_khong_ghi',
  });
  if (e1) {
    kiem('ham tru_credit_render goi duoc', false,
      thieuHamRpc(e1, 'tru_credit_render')
        ? 'CHUA CO trong schema cache — chay NOTIFY pgrst, reload schema'
        : e1.message);
  } else {
    const x = Array.isArray(d1) ? d1[0] : d1;
    kiem('ham goi duoc', true);
    kiem('tru 0 credit bi tu choi', x?.dat === false && x?.ma === 'SO_CREDIT_KHONG_HOP_LE', `ma: ${x?.ma}`);
  }

  // ── 3. Duong doc so du: user ngau nhien co so du 0 ──
  const { data: d2, error: e2 } = await db.rpc('tru_credit_render', {
    p_user: randomUUID(), p_project: null, p_render: randomUUID(),
    p_so_credit: 1, p_ly_do: 'soat_khong_ghi',
  });
  if (e2) {
    kiem('duong doc so du chay', false, e2.message);
  } else {
    const x = Array.isArray(d2) ? d2[0] : d2;
    kiem('user khong co but toan thi bi tu choi', x?.dat === false && x?.ma === 'KHONG_DU_CREDIT', `ma: ${x?.ma}`);
    kiem('tra ve so du 0', x?.so_du_sau === 0, `thuc te: ${x?.so_du_sau}`);
  }

  // ── 4. Khong co dong nao bi them vao so cai ──
  const { data: so } = await db.from('credit_ledger').select('id').like('reason', 'soat_khong_ghi%');
  kiem('KHONG dong nao bi ghi vao credit_ledger', (so ?? []).length === 0, `thay ${(so ?? []).length} dong`);

  const { data: nk } = await db.from('usage_logs').select('id').like('step_name', 'soat_khong_ghi%');
  kiem('KHONG dong nao bi ghi vao usage_logs', (nk ?? []).length === 0, `thay ${(nk ?? []).length} dong`);

  // ── 5. So du that cua he thong khong doi ──
  const { data: tat } = await db.from('credit_ledger').select('delta');
  const tong = (tat ?? []).reduce((t: number, x: any) => t + (x.delta ?? 0), 0);
  console.log(`\nTong so cai: ${(tat ?? []).length} dong, tong delta = ${tong}`);

  console.log(`\n${soDat} dat, ${soHong} hong`);
  if (soHong > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('VO:', e.message); process.exit(1); });
