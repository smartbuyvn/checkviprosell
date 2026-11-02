/** Doc moi cau hook that da sinh ra, de danh gia bang du lieu chu khong bang cam tinh. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from('renders')
    .select('id, created_at, scene_graph_json, strategy_json')
    .not('scene_graph_json', 'is', null)
    .order('created_at', { ascending: false }).limit(12);

  for (const r of (data ?? []) as any[]) {
    const canh = r.scene_graph_json?.scenes ?? [];
    const hook = canh[0]?.overlay_text ?? canh[0]?.voice_line ?? '(khong co)';
    const chien = r.strategy_json?.strategies?.[0]?.primary_hook;
    console.log(`\n${r.id.slice(0, 8)}  ${new Date(r.created_at).toLocaleDateString()}`);
    console.log(`  overlay canh 1 : ${String(hook).slice(0, 90)}`);
    if (chien) console.log(`  hook chien luoc: ${String(chien).slice(0, 90)}`);
  }
})();
