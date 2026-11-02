/** Lấy schema THẬT từ PostgREST OpenAPI — bằng chứng OBSERVED cho spec. */
import 'dotenv/config';
async function main() {
  const url = process.env.SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const doc: any = await r.json();
  const defs = doc.definitions ?? doc.components?.schemas ?? {};
  const ten = Object.keys(defs).sort();
  console.log(`SO BANG: ${ten.length}\n`);
  for (const t of ten) {
    const props = defs[t]?.properties ?? {};
    const cot = Object.entries(props).map(([k, v]: [string, any]) => {
      const e = v.enum ? `=[${v.enum.join('|')}]` : '';
      return `${k}:${v.format ?? v.type ?? '?'}${e}`;
    });
    console.log(`## ${t}`);
    console.log(`   ${cot.join('  ')}\n`);
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
