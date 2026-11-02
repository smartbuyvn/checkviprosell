import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildFfmpegCommandFromPlan } from '../render.worker';
import { khopCanhVoiTieng } from '../lib/khop-tieng';

const TMP = process.env.THU_MUC_THU || path.join(process.cwd(), 'assets', 'tmp', 'do');
fs.mkdirSync(TMP, { recursive: true });

function doDai(f: string): number {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', f], { encoding: 'utf8' });
  return parseFloat(String(r.stdout).trim()) || 0;
}

function taoAnh(ten: string, w: number, h: number, mau: string): string {
  const p = path.join(TMP, ten);
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
    `color=c=${mau}:s=${w}x${h}`, '-frames:v', '1', p]);
  return p;
}

function taoTieng(ten: string, giay: number): string {
  const p = path.join(TMP, ten);
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
    `sine=f=300:d=${giay}`, '-ar', '48000', p]);
  return p;
}

(async () => {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from('renders').select('render_plan_json, scene_graph_json, aspect_ratio')
    .eq('id', 'f1f588fa-e138-48dd-afdf-ba599186f83f').limit(1);
  const r: any = (data ?? [])[0];
  const plan = r.render_plan_json;
  const sg = r.scene_graph_json;

  // Dung dung do dai tieng worker da do trong log.
  const daiTieng = [2.40, 3.11, 3.20, 3.20, 4.19, 3.42];
  const khop = khopCanhVoiTieng(plan.timeline as any, daiTieng);
  plan.timeline = khop.timeline;
  console.log('timeline sau khi khop tieng:');
  for (const [i, c] of plan.timeline.entries()) {
    console.log(`  ${i}: ${c.start_sec.toFixed(2)} -> ${c.end_sec.toFixed(2)}`);
  }
  const mongDoi = plan.timeline[plan.timeline.length - 1].end_sec;
  console.log(`=> mong doi ${mongDoi.toFixed(2)}s\n`);

  const anh = [
    taoAnh('a0.jpg', 1200, 1200, 'red'),
    taoAnh('a1.jpg', 1600, 900, 'green'),
    taoAnh('a2.jpg', 800, 1400, 'blue'),
  ];
  const assetById: Record<string, string> = {};
  for (const [i, a] of (plan.assets ?? []).entries()) {
    if (a.asset_id) assetById[a.asset_id] = anh[i % anh.length];
  }

  const tiengFiles = daiTieng.map((d, i) => taoTieng(`t${i}.wav`, d));
  const nhac = path.join(process.cwd(), 'audio-assets', 'upbeat_01.mp3');

  const bienThe: Array<[string, string[], string]> = [
    ['chi hinh', [], ''],
    ['hinh + nhac', [], nhac],
    ['hinh + tieng + nhac', tiengFiles, nhac],
    ['hinh + tieng, khong nhac', tiengFiles, ''],
  ];

  for (const [ten, tiengs, nh] of bienThe) {
    const out = path.join(TMP, `ra-${ten.replace(/[^a-z]+/g, '-')}.mp4`);
    const assP = path.join(TMP, 'p.ass');
    const { args, duration } = buildFfmpegCommandFromPlan(
      plan, sg, anh, assetById, nh, out, assP,
      tiengs.length ? (tiengs as any) : [], [], r.aspect_ratio, new Map(), {}
    );
    const kq = spawnSync('ffmpeg', args, { encoding: 'utf8' });
    const d = fs.existsSync(out) ? doDai(out) : 0;
    const lech = d - mongDoi;
    console.log(`${ten.padEnd(26)} duration-tra-ve=${duration.toFixed(2)}s  file=${d.toFixed(2)}s  lech=${lech >= 0 ? '+' : ''}${lech.toFixed(2)}s  exit=${kq.status}`);
    if (kq.status !== 0) console.log('   stderr:', String(kq.stderr).split('\n').slice(-6).join('\n   '));
    if (Math.abs(lech) > 0.5) fs.writeFileSync(path.join(TMP, `lenh-${ten.replace(/[^a-z]+/g, '-')}.txt`), args.join('\n'));
  }
  process.exit(0);
})();
