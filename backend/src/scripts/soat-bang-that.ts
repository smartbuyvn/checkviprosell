/**
 * Đối chiếu CSDL THẬT với danh sách bảng mà mã nguồn cần.
 *
 * Vì sao cần: `tests/db-tables.test.ts` chỉ đối chiếu mã nguồn với một danh sách
 * cứng — nó giả định mọi migration trong repo đã chạy. Ngày 29/10 phát hiện
 * `idempotency_keys` có migration trong repo nhưng CHƯA BAO GIỜ được chạy trên CSDL
 * thật, và hậu quả là webhook SePay fail-closed: mọi giao dịch trả 500, không ai mua
 * được. Không một test nào bắt được, vì không test nào hỏi CSDL thật.
 *
 * Lưu ý về cách dò: phải dùng `select(...).limit(1)`, KHÔNG dùng
 * `select('*', { count: 'exact', head: true })`. Với bảng không tồn tại, truy vấn
 * `head` trả về `error = null` và `count = null` — nên `count ?? 0` biến "không có
 * bảng" thành "bảng rỗng". Đó đúng là lỗi đã khiến `soat-tien.ts` báo
 * "idempotency_keys 0 dong" trong khi bảng không hề tồn tại.
 *
 * Chạy: npx tsx src/scripts/soat-bang-that.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Mọi bảng mã nguồn đụng tới. Thêm migration mới thì bổ sung vào đây. */
const BANG_CAN = [
  'admin_audit_logs', 'affiliate_events', 'affiliate_withdrawals', 'caption_exports',
  'concepts', 'credit_ledger', 'face_replace_jobs', 'idempotency_keys', 'payments',
  'plans', 'product_intelligence', 'profiles', 'project_assets', 'projects',
  'prompts', 'renders', 'scenes', 'scripts', 'service_health_logs',
  'system_settings', 'usage_logs', 'user_roles', 'visual_packs',
];

/** Bảng nào mất thì hỏng tới đường tiền — in riêng cho dễ thấy. */
const DUONG_TIEN = new Set([
  'idempotency_keys', 'payments', 'credit_ledger', 'plans',
  'affiliate_events', 'affiliate_withdrawals',
]);

async function main() {
  const thieu: string[] = [];
  const co: string[] = [];

  for (const bang of BANG_CAN) {
    const { error } = await sb.from(bang).select('*').limit(1);
    if (error && error.code === 'PGRST205') thieu.push(bang);
    else if (error) console.log(`  ?  ${bang.padEnd(24)} loi la: ${error.code} ${error.message.slice(0, 50)}`);
    else co.push(bang);
  }

  console.log(`Co   : ${co.length}/${BANG_CAN.length} bang`);

  if (thieu.length === 0) {
    console.log('Thieu: khong. CSDL that khop voi ma nguon.');
    return;
  }

  console.log(`Thieu: ${thieu.length} bang\n`);
  for (const b of thieu) {
    console.log(`  ${DUONG_TIEN.has(b) ? 'TIEN ' : '     '} ${b}`);
  }
  if (thieu.some((b) => DUONG_TIEN.has(b))) {
    console.log('\nCo bang thuoc duong tien bi thieu — chuc nang thanh toan dang hong.');
  }
  console.log('\nChay migration tuong ung trong supabase/migrations/ qua SQL Editor.');
  process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
