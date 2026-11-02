/** In chi tiet so sach cua mot tai khoan de tim cho lech. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const email = process.argv[2];
  const { data: h } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
  const { data } = await sb.from('credit_ledger').select('*').eq('user_id', (h as any).id)
    .order('created_at', { ascending: true });
  let chay = 0;
  for (const r of (data ?? []) as any[]) {
    chay += r.delta;
    const dau = chay === r.balance_after ? ' ' : 'X';
    console.log(`${dau} ${r.created_at.slice(0,19)}  delta=${String(r.delta).padStart(4)}  ` +
      `balance_after=${String(r.balance_after).padStart(4)}  cong-don=${String(chay).padStart(4)}  ${r.reason}`);
  }
})();
