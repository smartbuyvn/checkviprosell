import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildFfmpegCommandFromPlan } from '../render.worker';
import { synthesize } from '../services/tts.provider';
import { storagePathFromUrl } from '../lib/storage-purge';

const TMP = path.join(process.cwd(), 'assets', 'tmp', 'thu');
fs.mkdirSync(TMP, { recursive: true });
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function doMuc(f: string) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', f, '-map', '0:a', '-af',
    'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const j = String(r.stderr).match(/\{[\s\S]*?\}/);
  return j ? JSON.parse(j[0]) : {};
}

function duong(url: string): string | null {
  const c = storagePathFromUrl(url, 'project-assets');
  if (c) return c;
  const i = url.indexOf('/object/sign/project-assets/');
  return i === -1 ? null : decodeURIComponent(url.slice(i + 28).split('?')[0]);
}

(async () => {
  const { data: r } = await sb.from('renders')
    .select('render_plan_json, scene_graph_json, project_id')
    .eq('status', 'completed').not('render_plan_json', 'is', null)
    .order('created_at', { ascending: false }).limit(1).single() as any;

  const { data: ass } = await sb.from('project_assets')
    .select('file_url').eq('project_id', r.project_id)
    .eq('asset_type', 'image').order('sort_order', { ascending: true });

  const anh: string[] = [];
  for (const [i, a] of ((ass ?? []) as any[]).entries()) {
    const d = a.file_url ? duong(String(a.file_url)) : null;
    if (!d) continue;
    const { data: ky } = await sb.storage.from('project-assets').createSignedUrl(d, 300);
    if (!ky?.signedUrl) continue;
    const p = path.join(TMP, `a${i}.bin`);
    spawnSync('curl', ['-sL', '--max-time', '40', '-o', p, ky.signedUrl]);
    const jpg = path.join(TMP, `a${i}.jpg`);
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', p, '-frames:v', '1', jpg]);
    if (fs.existsSync(jpg)) anh.push(jpg);
  }
  console.log(`${anh.length} anh\n`);

  const tl = r.render_plan_json.timeline ?? [];
  const loi = tl.map((_: any, i: number) =>
    ['Nơ ren nữ tính, tôn đường cong.', 'Chất vải mềm mại, thoáng mát cả ngày.',
     'Mặc đi làm hay đi chơi đều hợp.', 'Form dáng tôn eo, che khuyết điểm.',
     'Nhiều màu để bạn chọn.', 'Sở hữu ngay hôm nay!'][i % 6]);

  const tieng: (string | null)[] = [];
  for (const [i, c] of loi.entries()) {
    try {
      const t = await synthesize({ text: c, voice: 'std_banmai', traceId: 'thu' });
      tieng.push(t.filePath);
    } catch { tieng.push(null); }
  }
  console.log(`${tieng.filter(Boolean).length}/${tl.length} canh co tieng`);

  const assetById: Record<string, string> = {};
  for (const [i, a] of (r.render_plan_json.assets ?? []).entries()) {
    if (a.asset_id) assetById[a.asset_id] = anh[i % Math.max(1, anh.length)];
  }
  const nhac = path.join(process.cwd(), 'audio-assets', 'upbeat_01.mp3');

  for (const [ten, ti] of [['1:1', '1:1'], ['9:16', '9:16']] as const) {
    const out = path.join(TMP, `ra-${ten.replace(':', 'x')}.mp4`);
    const { args } = buildFfmpegCommandFromPlan(
      JSON.parse(JSON.stringify(r.render_plan_json)), r.scene_graph_json, anh, assetById,
      nhac, out, path.join(TMP, 'p-' + ten.replace(':','x') + '.ass'), tieng, [], ti, new Map(), {}
    );
    const kq = spawnSync('ffmpeg', args, { encoding: 'utf8' });
    if (kq.status !== 0) { console.log(`${ten} ffmpeg loi ${kq.status}`); continue; }
    const m = doMuc(out);
    console.log(`\n${ten}:  I=${m.input_i} LUFS  TP=${m.input_tp} dB  LRA=${m.input_lra}  (${m.normalization_type})`);
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', '7', '-i', out, '-frames:v', '1',
      out.replace('.mp4', '.png')]);
  }
  console.log(`\nthu muc: ${TMP}`);
  process.exit(0);
})();
