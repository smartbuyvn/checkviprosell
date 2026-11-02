import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  console.log('=== 5 render moi nhat ===');
  const { data: r } = await sb.from('renders').select('id,status,created_at,error_message,project_id')
    .order('created_at', { ascending: false }).limit(5);
  for (const x of (r ?? []) as any[])
    console.log(`  ${x.id.slice(0,8)} ${String(x.status).padEnd(11)} ${new Date(x.created_at).toLocaleString()}  ${x.error_message ?? ''}`);
  console.log('\n=== 5 du an moi nhat ===');
  const { data: p } = await sb.from('projects').select('id,title,status,created_at')
    .order('created_at', { ascending: false }).limit(5);
  for (const x of (p ?? []) as any[])
    console.log(`  ${x.id.slice(0,8)} ${String(x.status).padEnd(12)} ${new Date(x.created_at).toLocaleString()}  ${String(x.title).slice(0,30)}`);
  console.log('\n=== 5 anh moi nhat ===');
  const { data: a } = await sb.from('project_assets').select('id,created_at,file_url')
    .order('created_at', { ascending: false }).limit(5);
  for (const x of (a ?? []) as any[])
    console.log(`  ${new Date(x.created_at).toLocaleString()}  ${String(x.file_url ?? '(trong)').slice(-45)}`);
})();
