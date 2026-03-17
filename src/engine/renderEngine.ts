/**
 * Viprosell â€” Local Render Engine
 * Canvas + MediaRecorder based video composer.
 * Handles: image/video slideshow, overlay burn-in, subtitle burn-in, CTA end card.
 * Supports optional local TTS via browser SpeechSynthesis.
 */

export interface RenderSceneInput {
  scene_no: number;
  duration_sec: number;
  visual_instruction: string;
  overlay_text: string;
  voice_line: string;
}

export interface RenderOverlayInput {
  start_sec: number;
  end_sec: number;
  text: string;
  style: 'headline' | 'price' | 'badge' | 'cta';
}

export interface AssetEntry {
  url: string;
  type: 'image' | 'video';
}

export interface LocalRenderConfig {
  width: number;
  height: number;
  fps: number;
  scenes: RenderSceneInput[];
  overlays: RenderOverlayInput[];
  subtitleText: string;
  ctaText: string;
  assets: AssetEntry[];
  productName: string;
  ttsMode?: 'local' | 'none';
  onProgress?: (pct: number) => void;
}

// Legacy compat â€” maps old assetUrls string[] to AssetEntry[]
export interface LegacyRenderConfig {
  width: number;
  height: number;
  fps: number;
  scenes: RenderSceneInput[];
  overlays: RenderOverlayInput[];
  subtitleText: string;
  ctaText: string;
  assetUrls: string[];
  productName: string;
  ttsMode?: 'local' | 'none';
  onProgress?: (pct: number) => void;
}

export interface RenderResult {
  blob: Blob;
  durationMs: number;
  error?: string;
}

// ---------- Constants ----------

const OVERLAY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  headline: { bg: 'rgba(0,0,0,0.7)', text: '#ffffff', border: '#10b981' },
  price: { bg: 'rgba(239,68,68,0.85)', text: '#ffffff', border: '#fbbf24' },
  badge: { bg: 'rgba(16,185,129,0.85)', text: '#ffffff', border: '#10b981' },
  cta: { bg: 'rgba(16,185,129,0.95)', text: '#000000', border: '#10b981' },
};

const RENDER_TIMEOUT_MS = 120_000;
const MAX_CONCURRENT_OVERLAYS = 3;
const MAX_OVERLAY_WORDS = 8;
const FONT_SCALE_PORTRAIT = 1.3; // 30% larger for 9:16

// ---------- Asset Loaders ----------

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error(`Failed to load video: ${url}`));
    video.src = url;
  });
}

type LoadedAsset = {
  type: 'image';
  element: HTMLImageElement;
} | {
  type: 'video';
  element: HTMLVideoElement;
} | null;

async function loadAsset(entry: AssetEntry): Promise<LoadedAsset> {
  try {
    if (entry.type === 'video') {
      const el = await loadVideo(entry.url);
      return { type: 'video', element: el };
    }
    const el = await loadImage(entry.url);
    return { type: 'image', element: el };
  } catch {
    return null;
  }
}

// ---------- Text Helpers ----------

function truncateOverlayText(text: string): string {
  const words = text.split(' ');
  if (words.length <= MAX_OVERLAY_WORDS) return text;
  return words.slice(0, MAX_OVERLAY_WORDS).join(' ') + 'â€¦';
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 3,
): number {
  const words = text.split(' ');
  let line = '';
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + (line ? ' ' : '') + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = words[i];
      lineCount++;
      if (lineCount >= maxLines) break;
    } else {
      line = testLine;
    }
  }
  if (lineCount < maxLines && line) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
    lineCount++;
  }
  return lineCount;
}

// ---------- Drawing Functions ----------

function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number,
): void {
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!srcW || !srcH) return;

  const imgAspect = srcW / srcH;
  const canvasAspect = width / height;
  let sx = 0, sy = 0, sw = srcW, sh = srcH;

  if (imgAspect > canvasAspect) {
    sw = srcH * canvasAspect;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / canvasAspect;
    sy = (srcH - sh) / 2;
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
}

function isPortrait(width: number, height: number): boolean {
  return height > width;
}

function scaledFontSize(base: number, width: number, height: number): number {
  return isPortrait(width, height) ? Math.round(base * FONT_SCALE_PORTRAIT) : base;
}

function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  asset: LoadedAsset,
  scene: RenderSceneInput,
  currentTimeSec: number,
  overlays: RenderOverlayInput[],
  productName: string,
): void {
  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);

  // Draw media (cover fit, center crop)
  if (asset) {
    drawMediaCover(ctx, asset.element, width, height);
    // Slight darkening for text readability
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, width, height);
  } else {
    // Gradient placeholder
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.font = `bold ${scaledFontSize(28, width, height)}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'center';
    ctx.fillText(productName || 'Viprosell', width / 2, height / 2);
    ctx.textAlign = 'start';
  }

  // Scene overlay text (top safe area)
  if (scene.overlay_text) {
    const fontSize = scaledFontSize(24, width, height);
    const padding = 16;
    const topY = 80;
    ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`;
    const truncated = truncateOverlayText(scene.overlay_text);
    const textMetrics = ctx.measureText(truncated);
    const bgW = Math.min(textMetrics.width + padding * 2, width - 40);
    const bgH = fontSize + 20;
    const bgX = (width - bgW) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(bgX, topY, bgW, bgH, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(truncated, width / 2, topY + bgH - 8);
    ctx.textAlign = 'start';
  }

  // Active overlays from overlay_list (cap at MAX_CONCURRENT_OVERLAYS)
  const activeOverlays = overlays
    .filter(o => currentTimeSec >= o.start_sec && currentTimeSec < o.end_sec)
    .slice(0, MAX_CONCURRENT_OVERLAYS);

  let overlayY = 160;
  for (const overlay of activeOverlays) {
    const colors = OVERLAY_COLORS[overlay.style] || OVERLAY_COLORS.headline;
    const fontSize = overlay.style === 'price'
      ? scaledFontSize(32, width, height)
      : overlay.style === 'headline'
        ? scaledFontSize(26, width, height)
        : scaledFontSize(22, width, height);

    ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`;
    const padding = 14;
    const truncated = truncateOverlayText(overlay.text);
    const textMetrics = ctx.measureText(truncated);
    const bgW = Math.min(textMetrics.width + padding * 2, width - 40);
    const bgH = fontSize + 20;
    const bgX = (width - bgW) / 2;

    // Background pill
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(bgX, overlayY, bgW, bgH, 10);
    ctx.fill();

    // Border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bgX, overlayY, bgW, bgH, 10);
    ctx.stroke();

    // Text
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.fillText(truncated, width / 2, overlayY + bgH / 2 + fontSize / 3);
    ctx.textAlign = 'start';

    overlayY += bgH + 12;
  }

  // Voice line / subtitle at bottom (safe area)
  if (scene.voice_line) {
    const fontSize = scaledFontSize(20, width, height);
    const subtitleY = height - 180;
    const subtitleMaxW = width - 60;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(20, subtitleY - 10, width - 40, 80, 12);
    ctx.fill();

    ctx.font = `${fontSize}px "Inter", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    drawWrappedText(ctx, scene.voice_line, width / 2 - subtitleMaxW / 2, subtitleY + 16, subtitleMaxW, fontSize + 6, 2);
    ctx.textAlign = 'start';
  }

  // Scene number badge (bottom-right)
  ctx.font = `bold ${scaledFontSize(14, width, height)}px "Space Grotesk", sans-serif`;
  ctx.fillStyle = 'rgba(16,185,129,0.8)';
  ctx.beginPath();
  ctx.roundRect(width - 50, height - 60, 36, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.fillText(`${scene.scene_no}`, width - 32, height - 43);
  ctx.textAlign = 'start';
}

function drawCtaCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ctaText: string,
  productName: string,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0a0a1a');
  gradient.addColorStop(0.5, '#1a1a2e');
  gradient.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const titleSize = scaledFontSize(32, width, height);
  ctx.font = `bold ${titleSize}px "Space Grotesk", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(productName || 'Viprosell', width / 2, height / 2 - 60);

  const btnW = Math.min(width - 80, 340);
  const btnH = 56;
  const btnX = (width - btnW) / 2;
  const btnY = height / 2;

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 14);
  ctx.fill();

  ctx.font = `bold ${scaledFontSize(22, width, height)}px "Space Grotesk", sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.fillText(ctaText || 'Mua ngay!', width / 2, btnY + 36);
  ctx.textAlign = 'start';

  ctx.font = '14px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'center';
  ctx.fillText('Made with Viprosell', width / 2, height - 60);
  ctx.textAlign = 'start';
}

// ---------- TTS ----------

/**
 * Browser SpeechSynthesis for local TTS.
 * Speaks all voice lines sequentially, returns a promise that resolves
 * when all lines are spoken (or immediately if unsupported).
 */
export function speakText(text: string, lang: string = 'vi-VN'): boolean {
  if (!('speechSynthesis' in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
  return true;
}

function triggerLocalTTS(scenes: RenderSceneInput[]): void {
  const allLines = scenes
    .map(s => s.voice_line)
    .filter(Boolean)
    .join('. ');
  if (allLines) speakText(allLines);
}

// ---------- Main Render ----------

/**
 * Normalise legacy config (assetUrls: string[]) to new format (assets: AssetEntry[]).
 */
function normaliseConfig(config: LocalRenderConfig | LegacyRenderConfig): LocalRenderConfig {
  if ('assetUrls' in config && !('assets' in config)) {
    const legacy = config as LegacyRenderConfig;
    return {
      ...legacy,
      assets: legacy.assetUrls.map(url => ({
        url,
        type: guessAssetType(url),
      })),
    };
  }
  return config as LocalRenderConfig;
}

function guessAssetType(url: string): 'image' | 'video' {
  const lower = url.toLowerCase();
  if (lower.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/)) return 'video';
  return 'image';
}

export async function renderLocalDraft(rawConfig: LocalRenderConfig | LegacyRenderConfig): Promise<RenderResult> {
  const config = normaliseConfig(rawConfig);
  const { width, height, fps, scenes, overlays, subtitleText, ctaText, assets, productName, ttsMode, onProgress } = config;
  const startTime = Date.now();

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Load all assets (images + videos)
  const loadedAssets: LoadedAsset[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const entry = assets[i % (assets.length || 1)];
    if (entry?.url) {
      loadedAssets.push(await loadAsset(entry));
    } else {
      loadedAssets.push(null);
    }
  }

  // Trigger local TTS if requested (plays in background via browser audio)
  if (ttsMode === 'local') {
    triggerLocalTTS(scenes);
  }

  // Calculate total duration
  const sceneDuration = scenes.reduce((sum, s) => sum + s.duration_sec, 0);
  const ctaDuration = 3;
  const totalDuration = sceneDuration + ctaDuration;
  const totalFrames = totalDuration * fps;

  // Setup MediaRecorder
  const stream = canvas.captureStream(fps);

  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  let selectedMime = mimeTypes[0];
  for (const mime of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mime)) {
      selectedMime = mime;
      break;
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<RenderResult>((resolve) => {
    let resolved = false;
    const safeResolve = (result: RenderResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(hardTimeout);
      // Stop TTS if still playing
      if (ttsMode === 'local' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      resolve(result);
    };

    const hardTimeout = setTimeout(() => {
      try { recorder.stop(); } catch {}
      safeResolve({
        blob: new Blob(),
        durationMs: Date.now() - startTime,
        error: 'Render timeout (120s exceeded)',
      });
    }, RENDER_TIMEOUT_MS);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      safeResolve({ blob, durationMs: Date.now() - startTime });
    };

    recorder.onerror = () => {
      safeResolve({
        blob: new Blob(),
        durationMs: Date.now() - startTime,
        error: 'MediaRecorder failed',
      });
    };

    recorder.start();

    let currentFrame = 0;
    const interval = 1000 / fps;

    const renderFrame = () => {
      if (resolved) return;
      if (currentFrame >= totalFrames) {
        recorder.stop();
        return;
      }

      const currentTimeSec = currentFrame / fps;

      // Find current scene
      let elapsed = 0;
      let currentSceneIdx = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (currentTimeSec < elapsed + scenes[i].duration_sec) {
          currentSceneIdx = i;
          break;
        }
        elapsed += scenes[i].duration_sec;
        if (i === scenes.length - 1) currentSceneIdx = scenes.length;
      }

      if (currentSceneIdx >= scenes.length || currentTimeSec >= sceneDuration) {
        drawCtaCard(ctx, width, height, ctaText, productName);
      } else {
        // For video assets, seek to the right time within the scene
        const asset = loadedAssets[currentSceneIdx];
        if (asset?.type === 'video') {
          const sceneElapsed = currentTimeSec - elapsed;
          const vid = asset.element;
          if (Math.abs(vid.currentTime - sceneElapsed) > 0.5) {
            vid.currentTime = sceneElapsed % (vid.duration || 1);
          }
        }

        drawSceneFrame(
          ctx, width, height,
          asset,
          scenes[currentSceneIdx],
          currentTimeSec,
          overlays,
          productName,
        );
      }

      // Progress callback
      if (onProgress && currentFrame % (fps * 2) === 0) {
        onProgress(Math.round((currentFrame / totalFrames) * 100));
      }

      currentFrame++;
      setTimeout(renderFrame, interval / 4);
    };

    renderFrame();
  });
}
