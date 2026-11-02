import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const id = process.argv[2];
  const { data: p } = await sb.from('projects').select('*').eq('id', id).maybeSingle();
  if (!p) { console.log('KHONG CO du an nay'); return; }
  const x = p as any;
  console.log(`du an    : ${x.title}`);
  console.log(`trang thai: ${x.status}  tao ${new Date(x.created_at).toLocaleString()}`);
  for (const [bang, cot] of [['project_assets','project_id'],['scripts','project_id'],['concepts','project_id'],['renders','project_id']] as const) {
    const { data, error } = await sb.from(bang).select('*').eq(cot, id);
    console.log(`  ${bang.padEnd(16)} ${error ? 'LOI ' + error.message.slice(0,40) : (data?.length ?? 0) + ' dong'}`);
  }
  const { data: sc } = await sb.from('scripts').select('*').eq('project_id', id).maybeSingle();
  if (sc) console.log(`\n  scripts cot: ${Object.keys(sc).join(', ')}`);
})();
