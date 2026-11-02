import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from('renders').select('status');
  const dem = new Map<string, number>();
  for (const r of (data ?? []) as any[]) dem.set(r.status, (dem.get(r.status) ?? 0) + 1);
  const tong = (data ?? []).length;
  for (const [s, n] of [...dem].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(s).padEnd(12)} ${String(n).padStart(3)}  ${(n / tong * 100).toFixed(0)}%`);
  console.log(`  ${'TONG'.padEnd(12)} ${String(tong).padStart(3)}`);
})();
