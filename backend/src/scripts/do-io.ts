/** Đo lượng dữ liệu mỗi vòng quét của worker phải đọc từ Supabase. Chạy: npx tsx src/scripts/do-io.ts */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const COT_NANG = ['raw_input', 'scene_graph_json', 'product_brief_json', 'strategy_json', 'render_plan_json'];

async function main() {
  for (const b of ['renders', 'projects', 'assets', 'scripts', 'credit_ledger', 'usage_events']) {
    const { count } = await sb.from(b).select('id', { count: 'exact', head: true });
    console.log(`${b.padEnd(16)} ${String(count ?? '?').padStart(7)} dong`);
  }

  console.log('\n— Kich thuoc mot hang `renders` (select * doc het) —');
  const { data } = await sb.from('renders').select('*').order('created_at', { ascending: false }).limit(30);
  if (!data?.length) return console.log('  (khong co hang nao)');

  let tongHang = 0, tongNang = 0;
  for (const h of data) {
    tongHang += Buffer.byteLength(JSON.stringify(h), 'utf8');
    for (const c of COT_NANG) if ((h as any)[c] != null) tongNang += Buffer.byteLength(JSON.stringify((h as any)[c]), 'utf8');
  }
  const tbHang = tongHang / data.length, tbNang = tongNang / data.length;
  console.log(`  trung binh ca hang : ${(tbHang / 1024).toFixed(1)} KB`);
  console.log(`  rieng 5 cot JSONB  : ${(tbNang / 1024).toFixed(1)} KB  (${(tbNang / tbHang * 100).toFixed(0)}% cua hang)`);
  const lonNhat = Math.max(...data.map(h => Buffer.byteLength(JSON.stringify(h), 'utf8')));
  console.log(`  hang lon nhat      : ${(lonNhat / 1024).toFixed(1)} KB`);

  console.log('\n— Vong quet moi 20 giay doc bao nhieu —');
  const { count: pend } = await sb.from('renders').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: tong } = await sb.from('renders').select('id', { count: 'exact', head: true });
  console.log(`  dang pending: ${pend}   |   tong renders: ${tong}`);
  const moiNgay = (86400 / 20);
  console.log(`  so vong/ngay : ${moiNgay}  (worker) + reclaimStuckJobs cung tan suat = ${moiNgay * 2} truy van/ngay`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
