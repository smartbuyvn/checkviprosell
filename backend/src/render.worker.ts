/**
 * Viprosell — Physical Local Render Worker (Realtime, unified path)
 * Subscribes to Supabase Realtime for new `renders` rows (status=pending).
 *
 * Job resolution order:
 *   1. row.render_plan_json (pre-validated)  → render directly
 *   2. row.scene_graph_json (wizard scene cards / tier3 graph) → Tier 4 (render plan) → render
 *   3. row.raw_input (quick-ads internal)    → full 4-tier Local AI pipeline → render
 *
 * Render: FFmpeg NVENC on GPU 0 (RTX 3060 12GB). LLM runs on GPU 1 via dedicated Ollama.
 * On completion: upload to Supabase Storage + POST render callback (credits deducted by API).
 */
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { SceneGraphService } from './services/scene-graph.service';
import type { Tier3SceneGraph, Tier4RenderPlan } from './services/pipeline.service';
import { buildDrawtext as buildDrawtextFilter } from './lib/drawtext';
import { safeDownload } from './lib/fetch-guard';
import { buildAssFile, escapeFilterPath, type AssCue } from './lib/ass-subtitle';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || path.join(process.cwd(), '..', 'renders_output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const ASSETS_TMP_DIR = path.join(process.cwd(), 'assets', 'tmp');
fs.mkdirSync(ASSETS_TMP_DIR, { recursive: true });

const AUDIO_ASSETS_DIR = path.join(process.cwd(), 'audio-assets');
fs.mkdirSync(AUDIO_ASSETS_DIR, { recursive: true });

// Spec V2 chot FFmpeg CPU libx264: do duoc 13,8 giay CPU cho video 25s, khong can GPU,
// nho vay worker chay duoc tren VPS. Muon dung NVENC thi dat FFMPEG_VIDEO_ENCODER=h264_nvenc
// va FFMPEG_HWACCEL=cuda; de trong thi khong truyen -hwaccel.
const HWACCEL_MODE = process.env.FFMPEG_HWACCEL || '';
const VIDEO_ENCODER = process.env.FFMPEG_VIDEO_ENCODER || 'libx264';
const NVENC_PRESET = process.env.FFMPEG_NVENC_PRESET || 'p4';
const FFMPEG_GPU_INDEX = parseInt(process.env.FFMPEG_GPU_INDEX || '0', 10); // GPU 0 = RTX 3060 12GB

const CALLBACK_URL = process.env.RENDER_CALLBACK_URL || 'http://localhost:3001/api/v1/render/callback';
const CALLBACK_SECRET = process.env.INTERNAL_CALLBACK_SECRET || '';

const IS_WINDOWS = process.platform === 'win32';
const FONT_FILE = IS_WINDOWS ? (process.env.FFMPEG_FONT_FILE || 'C:/Windows/Fonts/arial.ttf') : (process.env.FFMPEG_FONT_FILE || '');

/**
 * Font cho libass. Mac dinh khac nhau theo he dieu hanh vi hai may co bo font khac han:
 *  - Windows (may chay worker): Montserrat - spec uu tien, da kiem chung hien dung dau tieng Viet.
 *    Neu may khong co, dat ASS_FONT_NAME='Arial' (Windows nao cung co va du dau tieng Viet).
 *  - Linux (VPS): DejaVu Sans - font DUY NHAT tren VPS ho tro tieng Viet (fc-list :lang=vi).
 * Font khong ton tai thi libass tu thay the, va ban thay the co the mat dau -> luon kiem tra
 * khung hinh dau tien sau khi doi font.
 */
const ASS_FONT_NAME = process.env.ASS_FONT_NAME || (IS_WINDOWS ? 'Montserrat' : 'DejaVu Sans');

// In ra ngay khi khoi dong: hai thu hay sai nhat la encoder va font phu de,
// va ca hai chi lo ra khi video da render xong moi phat hien hong.
console.log(
  `[Worker] Cau hinh: encoder=${VIDEO_ENCODER}` +
    `, font phu de="${ASS_FONT_NAME}"` +
    `, output=${OUTPUT_DIR}`
);

/** Giu lai cho cac loi goi cu; phu de chinh da chuyen sang ASS (spec S3-2). */
function buildDrawtext(text: string, fontSize: number, y: string, color: string = 'white'): string {
  return buildDrawtextFilter(text, fontSize, y, color, FONT_FILE);
}

function getZoompanFilter(motionType: string, zoomStart: number, zoomEnd: number, width: number, height: number, durationFrames: number, fps: number): string {
  const d = durationFrames;
  const s = `${width}x${height}`;
  const zs = Math.max(1, zoomStart || 1);
  const ze = Math.max(1, zoomEnd || 1.08);
  switch (motionType) {
    case 'zoom_in':
    case 'push_in':
      return `zoompan=z='${zs}+(${ze}-${zs})*on/${d}':d=${d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
    case 'zoom_out':
      return `zoompan=z='${ze}+(${zs}-${ze})*on/${d}':d=${d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
    case 'pan_left':
      return `zoompan=z='1.3':d=${d}:x='(iw-iw/zoom)*(1-on/${d})':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
    case 'pan_right':
      return `zoompan=z='1.3':d=${d}:x='(iw-iw/zoom)*on/${d}':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
    default:
      return `zoompan=z='1':d=${d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${s}:fps=${fps}`;
  }
}

async function setStatus(renderId: string, status: string, extra: Record<string, any> = {}) {
  await supabase.from('renders').update({ status, updated_at: new Date().toISOString(), ...extra }).eq('id', renderId);
}

function execFfmpegWithProgress(args: string[], totalDurationSec: number, renderId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let lastProgressTime = 0;
    let stderrOut = '';

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      stderrOut += output;
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
      if (timeMatch && totalDurationSec > 0) {
        const currentTime = parseFloat(timeMatch[1]) * 3600 + parseFloat(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
        const progress = Math.min(99, Math.round((currentTime / totalDurationSec) * 100));
        const now = Date.now();
        if (now - lastProgressTime > 2000) {
          lastProgressTime = now;
          supabase.from('renders').update({ progress }).eq('id', renderId).then();
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else {
        console.error(`[FFmpeg Error]`, stderrOut.slice(-2000));
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

/** Download a user-supplied image through the SSRF guard (allowlist, no redirects, size cap). */
async function downloadImage(url: string, destPath: string) {
  const body = await safeDownload(url);
  fs.writeFileSync(destPath, body);
}

function resolveMusicFile(renderPlan: Tier4RenderPlan, packageType: string): string {
  const musicAsset = (renderPlan.assets || []).find((a) => a.type === 'music' && a.asset_id === renderPlan.audio_plan?.music_asset_id);
  if (musicAsset?.source) {
    const rel = path.join(AUDIO_ASSETS_DIR, path.basename(musicAsset.source));
    if (fs.existsSync(rel)) return rel;
    if (fs.existsSync(musicAsset.source)) return musicAsset.source;
  }
  const fallback = packageType === 'review_video' ? 'chill_01.mp3' : packageType === 'conversion_video' ? 'urgent_01.mp3' : 'upbeat_01.mp3';
  const p = path.join(AUDIO_ASSETS_DIR, fallback);
  return fs.existsSync(p) ? p : '';
}

function sceneCardsToSceneGraph(sceneCards: any[]): Tier3SceneGraph {
  let cursor = 0;
  const scenes = (sceneCards || []).map((c: any, i: number) => {
    const duration = Math.max(1, Number(c.duration_sec) || 3);
    const scene = {
      scene_id: `s${i + 1}`,
      start_sec: cursor,
      end_sec: cursor + duration,
      purpose: c.visual_instruction || '',
      asset_ref: `image_${i + 1}`,
      visual_type: 'product_closeup' as const,
      camera_motion: { type: 'zoom_in' as const, direction: 'center', speed: 'slow' as const },
      overlay_text: c.overlay_text || '',
      voice_line: c.voice_line || '',
      subtitle: c.voice_line || '',
      music_intensity: 'medium' as const,
      safe_region: { title_y: 0.18, subtitle_y: 0.82, cta_y: 0.9 },
    };
    cursor += duration;
    return scene;
  });
  return {
    video_meta: { aspect_ratio: '9:16', duration_sec: cursor, style: '', target_platform: 'tiktok' },
    scenes,
  };
}

function resolveResolution(resolution: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(resolution || '1080x1920');
  return m ? { width: parseInt(m[1], 10), height: parseInt(m[2], 10) } : { width: 1080, height: 1920 };
}

function buildFfmpegCommandFromPlan(
  renderPlan: Tier4RenderPlan,
  sceneGraph: Tier3SceneGraph,
  inputImages: string[],
  musicPath: string,
  outputPath: string,
  /** Noi ghi file .ass cho lan render nay. */
  assPath: string
): { args: string[]; duration: number } {
  const fps = renderPlan.render_meta?.fps || 30;
  const { width, height } = resolveResolution(renderPlan.export?.resolution);
  const timeline = renderPlan.timeline || [];
  const scenes = sceneGraph?.scenes || [];
  const encoder = renderPlan.export?.codec === 'libx264' ? 'libx264' : VIDEO_ENCODER;
  const encoderArgs = encoder.includes('nvenc')
    ? ['-c:v', encoder, '-preset', NVENC_PRESET, '-gpu', String(FFMPEG_GPU_INDEX), '-b:v', '4M', '-maxrate', '6M', '-bufsize', '8M']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4M'];

  const ffmpegArgs: string[] = [];
  if (encoder.includes('nvenc')) ffmpegArgs.push('-hwaccel', HWACCEL_MODE, '-hwaccel_device', String(FFMPEG_GPU_INDEX));

  const filterParts: string[] = [];
  const inputArgs: string[] = [];
  let totalDuration = 0;
  const cues: AssCue[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const durationSec = Math.max(0.5, (item.end_sec || 0) - (item.start_sec || 0));
    const sceneStart = totalDuration; // moc tuyet doi, lay truoc khi cong don
    totalDuration += durationSec;
    const durationFrames = Math.round(durationSec * fps);

    const imgIdx = Math.min(i, Math.max(0, inputImages.length - 1));
    inputArgs.push('-loop', '1', '-t', durationSec.toFixed(2), '-i', inputImages[imgIdx]);

    let chain = `[${i}:v]`;
    const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
    const zoompanFilter = getZoompanFilter(
      item.motion?.type || 'zoom_in',
      item.motion?.zoom_start || 1,
      item.motion?.zoom_end || 1.08,
      width,
      height,
      durationFrames,
      fps
    );
    chain = `${chain}${scaleFilter},${zoompanFilter},format=yuv420p`;

    if (item.overlay?.text) {
      cues.push({
        startSec: sceneStart,
        endSec: sceneStart + durationSec,
        text: item.overlay.text,
        style: 'Overlay',
        fontSize: item.overlay.font_style === 'headline_bold' ? 52
          : item.overlay.font_style === 'cta' ? 44 : 40,
      });
    }

    const scene = scenes[i];
    if (renderPlan.subtitle_plan?.burn_in && scene?.voice_line) {
      cues.push({
        startSec: sceneStart,
        endSec: sceneStart + durationSec,
        text: scene.voice_line,
        style: 'Sub',
      });
    }

    if (i === 0) chain = `${chain},fade=t=in:st=0:d=0.4`;
    if (i === timeline.length - 1) chain = `${chain},fade=t=out:st=${Math.max(0, totalDuration - 0.4).toFixed(2)}:d=0.4`;

    filterParts.push(`${chain}[scene${i}]`);
  }

  const concatInputs = timeline.map((_: any, i: number) => `[scene${i}]`).join('');
  // Mot file ASS duy nhat cho ca video: cac canh da concat nen moc thoi gian la tuyet doi,
  // chi phai giai ma phu de mot lan. libass tu xuong dong trong pham vi le va giu nguyen
  // '%' lan dau nhay don — hai thu drawtext lam hong.
  if (cues.length > 0) {
    const assContent = buildAssFile(cues, {
      width,
      height,
      fontName: ASS_FONT_NAME,
      overlayFontSize: 52,
      subFontSize: 30,
      overlayMarginV: Math.round(0.18 * height),
      subMarginV: Math.round((1 - (renderPlan.subtitle_plan?.position_y ?? 0.82)) * height),
      marginH: Math.round(0.08 * width), // vung an toan hai ben
    });
    fs.writeFileSync(assPath, assContent, 'utf8');
    filterParts.push(`${concatInputs}concat=n=${timeline.length}:v=1:a=0[vcat]`);
    filterParts.push(`[vcat]subtitles='${escapeFilterPath(assPath)}'[vout]`);
  } else {
    filterParts.push(`${concatInputs}concat=n=${timeline.length}:v=1:a=0[vout]`);
  }

  ffmpegArgs.push(...inputArgs);

  const videoInputCount = timeline.length;
  if (musicPath) {
    ffmpegArgs.push('-i', musicPath);
    const volume = renderPlan.audio_plan?.music_volume ?? 0.18;
    filterParts.push(`[${videoInputCount}:a]volume=${Math.min(1, Math.max(0, volume))}[aout]`);
    ffmpegArgs.push('-filter_complex', filterParts.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:a', 'aac', '-b:a', '128k', '-shortest');
  } else {
    ffmpegArgs.push('-filter_complex', filterParts.join(';'), '-map', '[vout]');
  }

  ffmpegArgs.push(...encoderArgs, '-movflags', '+faststart', '-y', outputPath);

  return { args: ffmpegArgs, duration: totalDuration };
}

async function sendCallback(renderId: string, status: string, extra: Record<string, any> = {}) {
  if (!CALLBACK_SECRET || CALLBACK_SECRET === 'CHANGE_ME_IN_PRODUCTION') {
    console.warn(`[Worker] INTERNAL_CALLBACK_SECRET not set — skipping render callback for ${renderId}`);
    return;
  }
  try {
    const res = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-callback-secret': CALLBACK_SECRET },
      body: JSON.stringify({ renderId, status, ...extra }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) console.warn(`[Worker] Callback HTTP ${res.status}: ${await res.text()}`);
    else console.log(`[Worker] Callback sent: ${renderId} → ${status}`);
  } catch (err: any) {
    console.warn(`[Worker] Callback failed for ${renderId}: ${err.message}`);
  }
}

async function resolveRealImageUrls(payload: any, renderPlan: Tier4RenderPlan): Promise<string[]> {
  const urls = [...(payload.raw_input?.image_urls || [])];
  if (urls.length === 0 && payload.project_id) {
    const { data: assets, error } = await supabase
      .from('project_assets')
      .select('file_url')
      .eq('project_id', payload.project_id)
      .eq('asset_type', 'image')
      .order('sort_order', { ascending: true });
    if (error) console.warn(`[Worker] project_assets query failed: ${error.message}`);
    for (const a of assets || []) if (a.file_url) urls.push(a.file_url);
  }
  if (urls.length > 0) {
    let idx = 0;
    for (const asset of renderPlan.assets || []) {
      if (asset.type === 'image') {
        asset.source = urls[idx % urls.length];
        idx++;
      }
    }
  }
  return urls;
}

/** Job dang chay o tien trinh nay. Sweep luc khoi dong va realtime co the cham cung mot job. */
const inFlight = new Set<string>();

async function processRenderJob(payload: any) {
  const renderId = payload.id;
  const startMs = Date.now();

  if (inFlight.has(renderId)) {
    console.log(`[Worker] Bo qua ${renderId}: dang xu ly roi`);
    return;
  }
  inFlight.add(renderId);

  console.log(`[Worker] Started job ${renderId}`);
  await setStatus(renderId, 'processing', { progress: 5 });

  const jobTmpDir = path.join(ASSETS_TMP_DIR, renderId);
  fs.mkdirSync(jobTmpDir, { recursive: true });

  const outputFileName = `render_final_${renderId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);
  // File phu de dat canh file video, cung ten khac duoi; don o cuoi ham.
  const assPath = outputPath.endsWith('.mp4') ? outputPath.slice(0, -4) + '.ass' : outputPath + '.ass';

  try {
    let sceneGraph: Tier3SceneGraph;
    let renderPlan: Tier4RenderPlan;
    let productBrief: any = null;
    let strategy: any = null;

    if (payload.render_plan_json) {
      console.log(`[Worker] Using pre-validated render plan.`);
      renderPlan = payload.render_plan_json;
      sceneGraph = payload.scene_graph_json || sceneCardsToSceneGraph([]);
    } else if (payload.scene_graph_json) {
      console.log(`[Worker] Generating render plan from existing scene graph...`);
      const raw = payload.scene_graph_json;
      sceneGraph = Array.isArray(raw.scene_cards) ? sceneCardsToSceneGraph(raw.scene_cards) : raw as Tier3SceneGraph;
      renderPlan = await SceneGraphService.generateRenderPlanOnly(sceneGraph);
    } else if (payload.raw_input) {
      console.log(`[Worker] Running full 4-tier Local AI pipeline...`);
      const pipeline = await SceneGraphService.generatePipeline(payload.raw_input);
      productBrief = pipeline.productBrief;
      strategy = pipeline.strategy;
      sceneGraph = pipeline.sceneGraph;
      renderPlan = pipeline.renderPlan;
    } else {
      throw new Error('NO_RENDER_INPUT: renders row has no render_plan_json, scene_graph_json or raw_input');
    }

    await supabase.from('renders').update({
      product_brief_json: productBrief,
      strategy_json: strategy,
      scene_graph_json: sceneGraph,
      render_plan_json: renderPlan,
    }).eq('id', renderId);

    await setStatus(renderId, 'processing', { progress: 15 });

    console.log(`[Worker] Preparing assets...`);
    const realImageUrls = await resolveRealImageUrls(payload, renderPlan);
    const assetById: Record<string, string> = {};
    const inputImages: string[] = [];
    let imgIndex = 0;
    for (const asset of renderPlan.assets || []) {
      if (asset.type === 'image' && asset.source) {
        const destPath = path.join(jobTmpDir, `asset_${imgIndex}.jpg`);
        await downloadImage(asset.source, destPath);
        assetById[asset.asset_id] = destPath;
        inputImages.push(destPath);
        imgIndex++;
      }
    }

    if (inputImages.length === 0 && realImageUrls.length > 0) {
      for (let i = 0; i < realImageUrls.length; i++) {
        const destPath = path.join(jobTmpDir, `asset_${i}.jpg`);
        await downloadImage(realImageUrls[i], destPath);
        inputImages.push(destPath);
      }
    }

    if (inputImages.length === 0) throw new Error('NO_IMAGES: no image assets available for composition');

    const { data: project } = await supabase.from('projects').select('package_type').eq('id', payload.project_id).single();
    const packageType = project?.package_type || 'quick_ads';
    const musicPath = resolveMusicFile(renderPlan, packageType);

    await setStatus(renderId, 'processing', { progress: 25 });

    console.log(`[Worker] FFmpeg bat dau: encoder=${VIDEO_ENCODER}` + (VIDEO_ENCODER.includes('nvenc') ? ` (GPU ${FFMPEG_GPU_INDEX})` : ' (CPU)') + '...');
    const { args: ffmpegArgs, duration } = buildFfmpegCommandFromPlan(renderPlan, sceneGraph, inputImages, musicPath, outputPath, assPath);

    try {
      await execFfmpegWithProgress(ffmpegArgs, duration, renderId);
    } catch (ffmpegErr: any) {
      console.warn(`[Worker] NVENC failed, falling back to CPU (libx264)...`);
      const cpuPlan = { ...renderPlan, export: { ...renderPlan.export, codec: 'libx264' as const } };
      const { args: cpuArgs } = buildFfmpegCommandFromPlan(cpuPlan, sceneGraph, inputImages, musicPath, outputPath, assPath);
      await execFfmpegWithProgress(cpuArgs, duration, renderId);
    }

    console.log(`[Worker] Uploading ${outputFileName} to Supabase Storage...`);
    const fileBuffer = fs.readFileSync(outputPath);
    const { error: uploadErr } = await supabase.storage
      .from('renders')
      .upload(outputFileName, fileBuffer, { contentType: 'video/mp4', upsert: true });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: publicUrlData } = supabase.storage.from('renders').getPublicUrl(outputFileName);
    const outputUrl = publicUrlData.publicUrl;

    const renderTimeMs = Date.now() - startMs;
    console.log(`[Worker] Success. Time: ${renderTimeMs}ms. URL: ${outputUrl}`);

    await setStatus(renderId, 'completed', {
      output_url: outputUrl,
      progress: 100,
      duration_ms: renderTimeMs,
      error_code: null,
      error_message: null,
    });

    await sendCallback(renderId, 'completed', { output_url: outputUrl, duration_ms: renderTimeMs });

  } catch (err: any) {
    console.error(`[Worker] Error:`, err.message);
    await setStatus(renderId, 'failed', {
      error_code: err.message.includes(':') ? err.message.split(':')[0].trim() : 'RENDER_FAILED',
      error_message: err.message.slice(0, 500),
      last_fail_reason: err.message.slice(0, 500),
      progress: 0,
    });
    await sendCallback(renderId, 'failed', { error_code: 'RENDER_FAILED', error_message: err.message.slice(0, 500) });
  } finally {
    inFlight.delete(renderId);
    if (fs.existsSync(jobTmpDir)) fs.rmSync(jobTmpDir, { recursive: true, force: true });
  }
}

/** Toi da bao nhieu job ton dong xu ly trong mot lan quet. */
const SWEEP_LIMIT = parseInt(process.env.RENDER_SWEEP_LIMIT || '20', 10);

/**
 * Quet cac job con 'pending' luc khoi dong.
 * Realtime chi gui su kien INSERT khi worker DANG ket noi. Job tao ra trong luc worker tat
 * se nam mai o 'pending' vi khong con su kien nao de nghe — day la lo hong van hanh lon nhat
 * cua mo hinh nghe realtime thuan. Quet mot lan luc khoi dong la chot chan re nhat.
 */
async function sweepPendingJobs() {
  const { data, error } = await supabase
    .from('renders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(SWEEP_LIMIT);

  if (error) {
    console.error(`[Worker] Khong quet duoc job ton dong: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    console.log('[Worker] Khong co job ton dong.');
    return;
  }

  console.log(`[Worker] Tim thay ${data.length} job ton dong — xu ly lan luot.`);
  // Tuan tu chu khong song song: may ca nhan chi co bay nhieu CPU, chay cung luc
  // lam cham tat ca va de het RAM giua chung.
  for (const job of data) {
    await processRenderJob(job).catch((e) =>
      console.error(`[Worker] Job ${job.id} that bai khi quet:`, e)
    );
  }
}

console.log(`[Worker] Starting Viprosell Render Worker (Supabase Realtime, unified path)...`);

const channel = supabase.channel('public:renders')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'renders', filter: 'status=eq.pending' },
    (payload) => {
      console.log(`[Realtime] Received new pending job:`, payload.new.id);
      processRenderJob(payload.new).catch(console.error);
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[Realtime] Listening for new jobs on 'renders' table...`);
      // Quet SAU khi da dang ky nghe: job moi phat sinh trong luc quet van duoc nhan,
      // va inFlight chan viec xu ly trung.
      void sweepPendingJobs();
    } else {
      console.log(`[Realtime] Status changed:`, status);
    }
  });

process.on('SIGINT', () => {
  supabase.removeChannel(channel);
  process.exit();
});