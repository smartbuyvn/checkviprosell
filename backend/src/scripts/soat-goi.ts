import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from('plans').select('code,name,credits,price,is_active').order('price');
  console.log('=== bang plans trong CSDL ===');
  for (const p of data ?? []) {
    const moiCredit = p.credits > 0 ? Math.round(p.price / p.credits) : 0;
    console.log(`  ${String(p.code).padEnd(10)} ${String(p.name).padEnd(10)} ${String(p.credits).padStart(4)} credit  ${String(p.price).padStart(7)}d  ${moiCredit}d/credit  ${p.is_active ? 'dang ban' : 'TAT'}`);
  }
})();
