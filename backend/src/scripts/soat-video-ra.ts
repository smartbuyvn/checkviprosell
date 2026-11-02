import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from('renders').select('id,status,output_url,duration_ms,created_at')
    .eq('status', 'completed').order('created_at', { ascending: false }).limit(2);
  for (const r of data ?? []) console.log(`${new Date(r.created_at).toLocaleTimeString()}  ${r.output_url}`);
})();
