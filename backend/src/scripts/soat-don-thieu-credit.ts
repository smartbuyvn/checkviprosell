/**
 * Dò các đơn đã ghi là `paid` nhưng không có dòng credit tương ứng.
 *
 * Đây là lưới an toàn cho lỗ thủng tiền ở webhook SePay: trước 29/10 webhook gọi
 * `grantToLedger` rồi không đọc kết quả, nên ledger ghi hỏng là khách mất tiền mà
 * không có credit, trong khi đơn vẫn hiện "đã trả" và không có lỗi nào được ghi.
 *
 * Đã sửa chỗ gốc, nhưng mọi đơn hỏng từ TRƯỚC đó vẫn nằm im trong CSDL — không ai
 * đi mở lại một đơn đã ghi là xong. Script này tìm chúng ra.
 *
 * Chạy: npx tsx src/scripts/soat-don-thieu-credit.ts
 * Sửa tay bằng: npx tsx src/scripts/tang-credit.ts <email> <so-credit>
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: donDaTra, error } = await sb
    .from('payments')
    .select('id, user_id, amount, plan_code, created_at')
    .eq('status', 'paid')
    .order('created_at', { ascending: false });
  if (error) { console.error(`Doc payments that bai: ${error.message}`); process.exit(1); }

  const don = (donDaTra ?? []) as any[];
  if (don.length === 0) { console.log('Chua co don nao o trang thai paid.'); return; }

  const { data: dongSo } = await sb
    .from('credit_ledger')
    .select('payment_id, delta')
    .not('payment_id', 'is', null);
  const daCong = new Map<string, number>();
  for (const d of (dongSo ?? []) as any[]) {
    daCong.set(d.payment_id, (daCong.get(d.payment_id) ?? 0) + (d.delta || 0));
  }

  const { data: hoSo } = await sb.from('profiles').select('id, email');
  const mail = new Map(((hoSo ?? []) as any[]).map((h) => [h.id, h.email]));

  const thieu = don.filter((d) => !daCong.has(d.id));

  console.log(`Don da tra      : ${don.length}`);
  console.log(`Don thieu credit: ${thieu.length}`);

  if (thieu.length === 0) { console.log('\nKhong co don nao bi thung. Tot.'); return; }

  console.log('\n--- Danh sach can sua tay ---');
  for (const d of thieu) {
    console.log(
      `  ${d.created_at.slice(0, 10)}  ${String(mail.get(d.user_id) ?? d.user_id).padEnd(30)} ` +
      `goi ${String(d.plan_code ?? '?').padEnd(10)} ${String(d.amount).padStart(8)}d  don ${d.id}`
    );
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
