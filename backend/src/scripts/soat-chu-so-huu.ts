/** Ai đang sở hữu những dự án mà dashboard admin nhìn thấy. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: duAn, error } = await sb
    .from('projects').select('*').is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(50);
  if (error) { console.error('LOI:', error.message); return; }

  const theoChu = new Map<string, number>();
  for (const p of duAn ?? []) {
    const u = String((p as any).user_id);
    theoChu.set(u, (theoChu.get(u) ?? 0) + 1);
  }

  const { data: hoSo } = await sb.from('profiles').select('id, email').in('id', [...theoChu.keys()]);
  const mail = new Map((hoSo ?? []).map((h: any) => [h.id, h.email]));

  for (const [chu, n] of theoChu) {
    console.log(`${n} du an  ${mail.get(chu) ?? '(khong ro email)'}  ${chu}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
