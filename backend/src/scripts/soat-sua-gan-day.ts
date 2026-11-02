import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from('projects')
    .select('id, title, status, created_at, updated_at')
    .order('updated_at', { ascending: false }).limit(5);
  console.log('=== 5 du an SUA gan nhat ===');
  for (const p of (data ?? []) as any[])
    console.log(`  ${p.id.slice(0,8)} ${String(p.status).padEnd(12)} sua ${new Date(p.updated_at).toLocaleString()}  tao ${new Date(p.created_at).toLocaleString()}`);
  const { data: a } = await sb.from('project_assets').select('created_at').order('created_at',{ascending:false}).limit(1);
  console.log(`\nAnh moi nhat: ${(a??[])[0] ? new Date((a as any)[0].created_at).toLocaleString() : '(khong co)'}`);
  console.log(`Bay gio     : ${new Date().toLocaleString()}`);
})();
