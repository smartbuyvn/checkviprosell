/** Liet ke bucket storage. Chi DOC. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await sb.storage.listBuckets();
  if (error) { console.error('loi:', error.message); process.exit(1); }
  console.log('=== BUCKET DANG CO ===');
  for (const b of data ?? []) console.log(`  ${b.name.padEnd(20)} public=${b.public}`);
  const can = ['renders', 'product-images', 'projects', 'thumbnails', 'assets'];
  console.log('\n=== DOI CHIEU ===');
  for (const c of can) console.log(`  ${c.padEnd(20)} ${(data ?? []).some(b => b.name === c) ? 'CO' : 'THIEU'}`);
})();
