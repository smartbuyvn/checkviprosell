/** Soat trang thai du an va render. Chi DOC, khong ghi gi. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

(async () => {
  const { data: projects, error } = await sb
    .from('projects')
    .select('id, status, created_at, deleted_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { console.error('loi projects:', error.message); process.exit(1); }

  const dem: Record<string, number> = {};
  for (const p of projects ?? []) {
    const k = `${p.status}${p.deleted_at ? ' (da xoa)' : ''}`;
    dem[k] = (dem[k] ?? 0) + 1;
  }
  console.log('=== TRANG THAI DU AN ===');
  for (const [k, v] of Object.entries(dem).sort((a, b) => b[1] - a[1])) console.log(`${String(v).padStart(4)}  ${k}`);

  const { data: renders } = await sb
    .from('renders')
    .select('id, status, created_at, updated_at, error_code, error_message')
    .order('created_at', { ascending: false })
    .limit(200);

  const demR: Record<string, number> = {};
  for (const r of renders ?? []) demR[r.status] = (demR[r.status] ?? 0) + 1;
  console.log('\n=== TRANG THAI RENDER ===');
  for (const [k, v] of Object.entries(demR).sort((a, b) => b[1] - a[1])) console.log(`${String(v).padStart(4)}  ${k}`);

  const loi = (renders ?? []).filter((r) => r.error_code || r.error_message).slice(0, 8);
  if (loi.length) {
    console.log('\n=== LOI GAN NHAT ===');
    for (const r of loi) console.log(`${r.status.padEnd(16)} ${r.error_code ?? '-'} :: ${String(r.error_message ?? '').slice(0, 110)}`);
  }

  const dangCho = (renders ?? []).filter((r) => ['pending', 'processing', 'queued'].includes(r.status));
  if (dangCho.length) {
    console.log(`\n=== ${dangCho.length} RENDER DANG TREO ===`);
    for (const r of dangCho.slice(0, 6)) {
      const tuoi = (Date.now() - new Date(r.created_at).getTime()) / 36e5;
      console.log(`${r.status.padEnd(12)} tao cach day ${tuoi.toFixed(1)} gio`);
    }
  }
})();
