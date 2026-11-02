/** Doi render gan nhat ve trang thai cuoi, roi in ket qua day du. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const pid = process.argv[2];

(async () => {
  for (let i = 0; i < 60; i++) {
    const { data } = await sb.from('renders')
      .select('id, status, progress, error_code, error_message, output_url, duration_ms, render_mode')
      .eq('project_id', pid).order('created_at', { ascending: false }).limit(1);
    const r = (data ?? [])[0] as any;
    if (!r) { console.log('chua co render nao'); return; }
    if (['completed', 'failed', 'cancelled'].includes(r.status)) {
      console.log(`\n=== ${r.status.toUpperCase()} ===`);
      console.log(`  render  : ${r.id.slice(0,8)}  mode=${r.render_mode}`);
      console.log(`  thoi gian: ${r.duration_ms ? (r.duration_ms/1000).toFixed(1) + 's' : '?'}`);
      if (r.error_code) console.log(`  loi     : ${r.error_code} — ${r.error_message}`);
      if (r.output_url) console.log(`  video   : ${r.output_url}`);
      const { data: led } = await sb.from('credit_ledger').select('delta, reason')
        .eq('project_id', pid);
      console.log(`  credit  : ${(led ?? []).length ? (led as any[]).map(l => `${l.delta} (${String(l.reason).slice(0,60)})`).join(' | ') : 'CHUA TRU'}`);
      return;
    }
    process.stdout.write(`\r  ${r.status} ${r.progress ?? 0}%   `);
    await new Promise(r2 => setTimeout(r2, 5000));
  }
  console.log('\nQua 5 phut van chua xong.');
})();
