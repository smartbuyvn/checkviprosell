import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data: rs } = await sb.from('renders')
    .select('id,project_id,status,render_mode,raw_input,created_at')
    .order('created_at', { ascending: false }).limit(4);

  for (const r of rs ?? []) {
    const raw: any = r.raw_input;
    const tuRaw = Array.isArray(raw?.image_urls) ? raw.image_urls.filter(Boolean).length : 0;
    const { data: assets } = await sb.from('project_assets')
      .select('file_url,asset_type').eq('project_id', r.project_id);
    const anh = (assets ?? []).filter((a: any) => a.asset_type === 'image' && a.file_url);
    console.log(`${r.status.padEnd(10)} ${r.render_mode.padEnd(16)} raw_input.image_urls=${tuRaw}  project_assets(image)=${anh.length}  tong_assets=${(assets ?? []).length}`);
    if (anh.length > 0) console.log(`    vi du: ${String(anh[0].file_url).slice(0, 90)}`);
  }
})();
