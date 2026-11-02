import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from('renders')
    .select('id,status,progress,render_mode,error_code,error_message,created_at,updated_at')
    .order('created_at', { ascending: false }).limit(5);
  for (const r of data ?? []) {
    const tuoi = ((Date.now() - new Date(r.created_at).getTime()) / 1000).toFixed(0);
    const imLang = ((Date.now() - new Date(r.updated_at).getTime()) / 1000).toFixed(0);
    console.log(`${r.status.padEnd(11)} ${String(r.progress ?? '-').padStart(3)}%  ${r.render_mode.padEnd(16)} tao ${tuoi}s truoc, im lang ${imLang}s  ${r.error_code ?? ''} ${String(r.error_message ?? '').slice(0,80)}`);
  }
})();
