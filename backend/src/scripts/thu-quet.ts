import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
(async () => {
  const URL = process.env.SUPABASE_URL!;
  for (const [ten, key] of [
    ['SERVICE_ROLE', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['ANON', process.env.SUPABASE_ANON_KEY],
  ] as Array<[string, string | undefined]>) {
    if (!key) { console.log(`  ${ten.padEnd(14)} (khong co trong .env)`); continue; }
    const sb = createClient(URL, key);
    const { data, error } = await sb.from('renders').select('id, status')
      .eq('status', 'pending').order('created_at').limit(5);
    console.log(`  ${ten.padEnd(14)} ${error ? 'LOI: ' + error.message.slice(0,60) : (data?.length ?? 0) + ' job pending'}`);
  }
  // Doc thang job do
  const sb = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from('renders').select('id, status, deleted_at, project_id')
    .order('created_at', { ascending: false }).limit(1);
  console.log(`\n  job moi nhat: ${JSON.stringify((data ?? [])[0])}`);
  process.exit(0);
})();
