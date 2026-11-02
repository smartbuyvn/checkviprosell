import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  for (const [ten, bang] of [['credit_ledger','credit_ledger'],['payments','payments'],['affiliate_events','affiliate_events'],['affiliate_withdrawals','affiliate_withdrawals'],['idempotency_keys','idempotency_keys']] as const) {
    // Phai `select(...).limit(1)` chu khong `head: true`: voi bang KHONG TON TAI,
    // truy van head tra ve error=null va count=null, nen `count ?? 0` in ra "0 dong"
    // y het mot bang rong. Dung lo do ma `idempotency_keys` mat tich suot thoi gian
    // dai trong khi webhook thanh toan chet han.
    const { error: loiCo } = await sb.from(bang).select('*').limit(1);
    if (loiCo?.code === 'PGRST205') { console.log(`  ${ten.padEnd(22)} KHONG CO BANG NAY`); continue; }
    const { count, error } = await sb.from(bang).select('*', { count: 'exact', head: true });
    console.log(`  ${ten.padEnd(22)} ${error ? 'LOI: ' + error.message.slice(0,40) : (count ?? 0) + ' dong'}`);
  }
  console.log('\n=== 6 but toan credit gan nhat ===');
  // Cot la `delta`, khong phai `amount`. Ban cu doc `amount` nen truy van loi, `data`
  // ve null, va vong lap khong in gi — trong y het "chua co but toan nao". Loi cau am:
  // bo qua `error` thi moi sai ten cot deu hien ra thanh "khong co du lieu".
  const { data: l, error: loiSo } = await sb.from('credit_ledger')
    .select('delta,reason,created_at').order('created_at',{ascending:false}).limit(6);
  if (loiSo) console.log(`  LOI doc so: ${loiSo.message}`);
  for (const r of l ?? []) console.log(`  ${String(r.delta).padStart(5)}  ${String(r.reason).padEnd(24)} ${new Date(r.created_at).toLocaleString()}`);
  console.log('\n=== render hoan thanh gan nhat ===');
  const { data: rr } = await sb.from('renders').select('id,status,created_at').eq('status','completed').order('created_at',{ascending:false}).limit(3);
  for (const r of rr ?? []) console.log(`  ${r.id.slice(0,8)} ${new Date(r.created_at).toLocaleString()}`);
})();
