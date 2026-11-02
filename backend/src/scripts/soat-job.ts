import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from('renders')
    .select('id, status, progress, created_at, updated_at, error_code, error_message, last_fail_reason, raw_input')
    .order('created_at', { ascending: false }).limit(3);
  for (const r of (data ?? []) as any[]) {
    const ri = r.raw_input ?? {};
    console.log(`\n${r.id.slice(0,8)} ${String(r.status).padEnd(10)} ${r.progress ?? 0}%`);
    console.log(`  tao ${new Date(r.created_at).toLocaleTimeString()}  sua ${new Date(r.updated_at).toLocaleTimeString()}`);
    console.log(`  voice=${ri.voice ?? '-'} khongChu=${ri.no_text_overlay ?? '-'} catVien=${ri.crop_edges ?? '-'} anh=${(ri.image_urls||[]).length}`);
    if (r.error_message) console.log(`  LOI: ${String(r.error_message).slice(0,140)}`);
    if (r.last_fail_reason && r.last_fail_reason !== r.error_message)
      console.log(`  stderr: ${String(r.last_fail_reason).replace(/\s+/g,' ').slice(0,500)}`);
  }
  console.log(`\nBay gio: ${new Date().toLocaleTimeString()}`);
  process.exit(0);
})();
