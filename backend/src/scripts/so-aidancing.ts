import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { creditsFor, type RenderSpec } from '../lib/credit-cost';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const USD = 26_000;              // ty gia gia dinh
const AID_CR_GIAY = 0.12;        // do tu anh: 10s=1,2 15s=1,8 20s=2,4 25s=3,0
const AID_GOI = [
  { usd: 10, credit: 104 },
  { usd: 20, credit: 212 },
];

(async () => {
  console.log(`Ty gia gia dinh: 1 USD = ${USD.toLocaleString('vi')}d\n`);

  console.log('AIDANCING — gia moi credit');
  let reNhat = Infinity;
  for (const g of AID_GOI) {
    const d = (g.usd * USD) / g.credit;
    reNhat = Math.min(reNhat, d);
    console.log(`  ${g.usd} USD = ${(g.usd * USD).toLocaleString('vi')}d / ${g.credit} cr = ${Math.round(d).toLocaleString('vi')}d moi credit`);
  }

  console.log('\nAIDANCING — gia moi video theo thoi luong (goi re nhat)');
  const dai = [10, 15, 20, 25, 30];
  const aidGia: Record<number, number> = {};
  for (const s of dai) {
    const cr = s * AID_CR_GIAY;
    aidGia[s] = Math.round(cr * reNhat);
    console.log(`  ${String(s).padStart(2)}s = ${cr.toFixed(1)} cr = ${aidGia[s].toLocaleString('vi').padStart(7)}d`);
  }

  const { data } = await sb.from('plans').select('*').order('price', { ascending: true });
  const goi = ((data ?? []) as any[]).filter((p) => p.price > 0 && p.is_active);

  console.log('\n\nVIPROSELL HIEN NAY — video 20s');
  const spec20 = (voice: boolean, res: '720p' | '1080p', wm: boolean): Partial<RenderSpec> =>
    ({ durationSec: 20, resolution: res, voice, watermark: wm });
  const kieu: Array<[string, Partial<RenderSpec>]> = [
    ['co giong, 720p, co watermark', spec20(true, '720p', true)],
    ['co giong, 1080p, khong watermark', spec20(true, '1080p', false)],
  ];
  for (const [ten, s] of kieu) {
    const cr = creditsFor(s);
    console.log(`  ${ten} = ${cr} credit`);
    for (const p of goi) {
      const n = Math.floor(p.credits / cr);
      const gia = Math.round(p.price / n);
      const soSanh = gia / aidGia[20];
      console.log(`     ${String(p.code).padEnd(9)} ${gia.toLocaleString('vi').padStart(7)}d  = ${soSanh.toFixed(2)}x aidancing (${aidGia[20].toLocaleString('vi')}d)`);
    }
  }

  console.log('\n\nDE XUAT: 0,5 cr cho <=15s, 1 cr cho <=30s, 2 cr cho <=60s');
  const bac: Array<[string, number]> = [['<=15s', 0.5], ['<=30s', 1], ['<=60s', 2]];
  for (const p of goi) {
    console.log(`  ${p.code} — ${p.price.toLocaleString('vi')}d / ${p.credits} cr`);
    for (const [ten, cr] of bac) {
      const n = Math.floor(p.credits / cr);
      const gia = Math.round(p.price / n);
      const moc = ten === '<=15s' ? aidGia[15] : ten === '<=30s' ? aidGia[30] : aidGia[30] * 2;
      const re = ((1 - gia / moc) * 100);
      console.log(`     ${ten.padEnd(6)} ${String(n).padStart(4)} video  ${gia.toLocaleString('vi').padStart(7)}d  (aidancing ${moc.toLocaleString('vi')}d -> ${re >= 0 ? 're hon ' : 'DAT HON '}${Math.abs(re).toFixed(0)}%)`);
    }
  }
  process.exit(0);
})();
