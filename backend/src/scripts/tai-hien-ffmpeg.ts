/**
 * Dung lai DUNG lenh ffmpeg worker da chay cho mot render hong, roi chay that.
 *
 * Tai anh that ve, dung lenh tu render_plan_json da luu, va in stderr day du. Doan
 * mo ma loi la cach cham nhat de sua mot loi ffmpeg — lam nay rong va chac.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { buildFfmpegCommandFromPlan } from '../render.worker';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const TMP = process.argv[3] || path.join(process.cwd(), 'tmp-taihien');

(async () => {
  const renderId = process.argv[2];
  const { data } = await sb.from('renders').select('*').eq('id', renderId).maybeSingle();
  const r = data as any;
  if (!r) { console.error('Khong co render nay'); process.exit(1); }

  console.log(`render ${renderId.slice(0,8)}  mode=${r.render_mode}  aspect=${r.aspect_ratio}`);
  const plan = r.render_plan_json;
  const sg = r.scene_graph_json;
  if (!plan) { console.error('Khong co render_plan_json'); process.exit(1); }

  fs.mkdirSync(TMP, { recursive: true });

  // Lam DUNG nhu `resolveRealImageUrls` cua worker: `plan.assets[].source` chi la id
  // (`image_1`), URL that lay tu bang project_assets roi thay vao.
  const { data: ds } = await sb.from('project_assets').select('file_url')
    .eq('project_id', r.project_id).eq('asset_type', 'image').order('sort_order');
  const urls = ((ds ?? []) as any[]).map((a) => a.file_url).filter(Boolean);
  console.log(`  ${urls.length} URL anh that tu project_assets`);
  if (urls.length === 0) { console.error('Du an khong co anh — worker se nem NO_PRODUCT_IMAGES'); process.exit(1); }
  let k = 0;
  for (const a of (plan.assets || [])) {
    if (a.type === 'image') { a.source = urls[k % urls.length]; k++; }
  }

  const inputImages: string[] = [];
  const assetById: Record<string, string> = {};
  let i = 0;
  for (const a of (plan.assets || [])) {
    if (a.type !== 'image' || !a.source) continue;
    const dich = path.join(TMP, `asset_${i}.jpg`);
    if (!fs.existsSync(dich)) {
      const res = await fetch(a.source);
      fs.writeFileSync(dich, Buffer.from(await res.arrayBuffer()));
    }
    // `CHUAN_HOA=1`: doi anh sang JPEG truoc, de thu xem co het sap khong.
    let dung = dich;
    if (process.env.CHUAN_HOA === '1') {
      const sach = dich.replace(/\.jpg$/, '_sach.jpg');
      if (!fs.existsSync(sach)) {
        await new Promise<void>((ok) => {
          const q = spawn('ffmpeg', ['-v', 'error', '-i', dich, '-q:v', '2', '-y', sach]);
          q.on('close', () => ok());
          q.on('error', () => ok());
        });
      }
      if (fs.existsSync(sach)) dung = sach;
    }
    assetById[a.asset_id] = dung;
    inputImages.push(dung);
    i++;
  }
  console.log(`  ${inputImages.length} anh da tai ve`);

  const out = path.join(TMP, 'ra.mp4');
  const ass = path.join(TMP, 'phude.ass');
  const { args, duration } = buildFfmpegCommandFromPlan(
    plan, sg, inputImages, assetById, '', out, ass, [], [], r.aspect_ratio, undefined,
    { khongChu: Boolean(r.raw_input?.no_text_overlay), catVien: Number(r.raw_input?.crop_edges) || 0 }
  );
  console.log(`  thoi luong ke hoach: ${duration}s`);
  fs.writeFileSync(path.join(TMP, 'lenh.txt'), args.join('\n'), 'utf8');
  console.log(`  lenh day du ghi o: ${path.join(TMP, 'lenh.txt')}`);

  const p = spawn('ffmpeg', ['-v', 'warning', ...args]);
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => {
    console.log(`\n=== ffmpeg thoat voi ma ${code} ===`);
    if (code !== 0) console.log(err.slice(-2500));
    else console.log('CHAY DUOC — loi khong tai hien duoc voi dau vao nay');
    // Thoat han: module worker giu event loop song (kenh Supabase realtime).
    process.exit(code === 0 ? 0 : 1);
  });
})();
