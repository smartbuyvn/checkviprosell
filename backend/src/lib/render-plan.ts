/**
 * Viprosell — Tầng 4 dựng bằng code, không gọi LLM
 *
 * Tầng 4 từng là một lần gọi model: đưa vào đồ thị cảnh, nhận về kế hoạch render.
 * Nhưng việc nó làm hoàn toàn máy móc — sao lại scene_id, đổi tên góc máy thành số,
 * điền độ phân giải. Không có quyết định sáng tạo nào ở đây, mà lại trả giá bằng:
 *
 *   - Một lần gọi LLM (1/4 chi phí token mỗi video) cho việc đổi tên trường.
 *   - Lỗi JSON: "expected object, received array", thiếu trường, sai kiểu.
 *   - Và lỗi nặng nhất: model tự điền `resolution`. Khách chọn 9:16, model trả
 *     "1080x1080", video ra vuông. Xảy ra thật ngày 28/10.
 *
 * Độ phân giải là lựa chọn của khách. Không hỏi model nữa.
 *
 * Ba tầng đầu vẫn là LLM — ở đó có phán đoán thật (hiểu sản phẩm, chọn góc kể,
 * viết lời). Tầng 4 thì không.
 */
import { diversify, resolveMove, spreadAssets, type CameraMove } from './camera-moves';
import { nhipChuyenCanh } from './nhip-chuyen-canh';
import type { Tier3SceneGraph } from '../prompts/tiers/tier3-scene-graph';
import type { Tier4RenderPlan } from '../prompts/tiers/tier4-render-plan';

/** Lề an toàn. Đáy rộng hơn vì thanh caption và nút của TikTok/Reels che mất. */
export const SAFE_MARGIN_X = 0.08;
export const SAFE_MARGIN_BOTTOM = 0.12;
export const SAFE_MARGIN_TOP = 0.10;

const ASPECT_SIZE: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1':  { width: 1080, height: 1080 },
  '4:5':  { width: 1080, height: 1350 },
};

/**
 * Typography theo VAI TRÒ của câu chữ, không theo một cỡ chữ duy nhất.
 *
 * Ngày 28/10 video ra mang dòng "Conversion Video — Upload 28/10/2026": tên gói và
 * ngày tải lên, in giữa màn hình bằng cỡ chữ của câu hook. Chốt chặn `chuVoNghia`
 * trong worker đã bỏ được loại chữ đó, nhưng bỏ chữ không phải là làm đúng — chữ
 * trên video quảng cáo phải CÓ VIỆC: bắt mắt, nêu lợi ích, báo giá, hoặc gọi hành động.
 *
 * Mỗi vai trò có cỡ chữ và chỗ đứng riêng. Câu hook to và nằm trên; giá thì to nhất
 * vì đó là thứ người xem tìm; dòng chứng thực nhỏ và lùi xuống để không tranh chỗ.
 *
 * Cỡ chữ tính theo TỈ LỆ CHIỀU CAO, không phải pixel tuyệt đối. Bản cũ viết cứng 52px
 * cho mọi khung: ở 720p (cao 1280) thì 52px chiếm 4,1% chiều cao, ở 1080p (cao 1920)
 * chỉ còn 2,7% — cùng một video mà bản nháp chữ to hơn bản xuất gần một nửa.
 */
export type OverlayRole = 'hook' | 'benefit' | 'price' | 'proof' | 'cta' | 'none';

export interface OverlayStyle {
  /** Cỡ chữ theo tỉ lệ chiều cao khung hình. */
  sizeRatio: number;
  /** Chỗ đứng theo tỉ lệ chiều cao, tính từ trên. */
  positionY: number;
  fontStyle: string;
  animateIn: string;
}

export const OVERLAY_STYLES: Record<OverlayRole, OverlayStyle> = {
  // Câu hook: to nhất trong các dòng chữ thường, nằm trên 1/4 khung để không che sản phẩm.
  hook:    { sizeRatio: 0.046, positionY: 0.17, fontStyle: 'hook_bold',    animateIn: 'rise_fade' },
  benefit: { sizeRatio: 0.038, positionY: 0.20, fontStyle: 'headline_bold', animateIn: 'fade' },
  // Giá to nhất: đây là thứ người xem dừng lại để đọc.
  price:   { sizeRatio: 0.054, positionY: 0.24, fontStyle: 'price_heavy',   animateIn: 'pop' },
  // Dòng chứng thực nhỏ và lùi xuống — nó hậu thuẫn câu chính, không tranh chỗ.
  proof:   { sizeRatio: 0.030, positionY: 0.30, fontStyle: 'proof_light',   animateIn: 'fade' },
  cta:     { sizeRatio: 0.048, positionY: 0.46, fontStyle: 'cta_bold',      animateIn: 'rise_fade' },
  none:    { sizeRatio: 0,     positionY: 0.18, fontStyle: 'none',          animateIn: 'none' },
};

/** Cỡ chữ thật, theo pixel, cho một vai trò ở một chiều cao khung hình. */
export function overlayFontSize(fontStyle: string | null | undefined, height: number): number {
  const style = Object.values(OVERLAY_STYLES).find((s) => s.fontStyle === fontStyle);
  const ratio = style?.sizeRatio ?? OVERLAY_STYLES.benefit.sizeRatio;
  // Sàn 24px: nhỏ hơn thì trên điện thoại không đọc được dù đúng tỉ lệ.
  return Math.max(24, Math.round(ratio * height));
}

/**
 * Vai trò cho một cảnh khi model không nói rõ.
 *
 * Suy từ mục đích cảnh và loại hình, vì đó là thứ đã có sẵn trong đồ thị cảnh.
 */
export function inferRole(purpose: string, visualType: string, index: number, total: number): OverlayRole {
  const p = String(purpose || '').toLowerCase();
  if (visualType === 'cta_card' || index === total - 1) return 'cta';
  if (index === 0 || p.includes('hook')) return 'hook';
  if (p.includes('price') || p.includes('gia') || p.includes('offer')) return 'price';
  if (p.includes('proof') || p.includes('trust') || p.includes('review')) return 'proof';
  return 'benefit';
}

export interface RenderPlanOptions {
  /** Tỉ lệ khách chọn. Đây là nguồn duy nhất, không lấy từ đồ thị cảnh. */
  aspect?: string;
  /** 720 để render nháp cho nhanh, 1080 cho bản xuất. */
  quality?: 720 | 1080;
  fps?: number;
  hasVoice?: boolean;
  musicAssetId?: string | null;
}

/**
 * Số từ tối đa cho chữ trên màn hình.
 *
 * Người xem có khoảng nửa giây cho mỗi dòng chữ trước khi mắt quay lại sản phẩm.
 * Quá 6 từ là không đọc kịp — chữ có đó nhưng vô dụng, lại còn che mất hàng.
 */
const MAX_OVERLAY_WORDS = 6;
const MAX_OVERLAY_WORDS_CARD = 10;

function trimOverlay(text: string, role: OverlayRole): string {
  const t = String(text ?? '').trim().replace(/[.。]+$/, '');
  if (!t || role === 'none') return '';
  // Câu CTA và dòng giá được dài hơn: chúng là thứ người xem chủ động đọc, còn
  // câu hook chỉ có nửa giây trước khi mắt quay lại sản phẩm.
  const gioiHan = role === 'cta' || role === 'price' ? MAX_OVERLAY_WORDS_CARD : MAX_OVERLAY_WORDS;
  const tu = t.split(/\s+/);
  return tu.length <= gioiHan ? t : tu.slice(0, gioiHan).join(' ');
}

/**
 * Vị trí chữ theo lề an toàn, không theo con số model đưa.
 *
 * Model hay trả title_y = 0.9 cho cảnh CTA, rơi đúng vào vùng TikTok đặt caption
 * và tên tài khoản. Ép về trong lề.
 */
function safeY(y: number | undefined, fallback: number): number {
  const v = Number.isFinite(y) ? Number(y) : fallback;
  return Math.min(1 - SAFE_MARGIN_BOTTOM, Math.max(SAFE_MARGIN_TOP, v));
}

/**
 * Đồ thị cảnh → kế hoạch render. Thuần, không I/O, không ngẫu nhiên.
 *
 * Cùng một đầu vào luôn cho cùng một đầu ra — nghĩa là lỗi render tái hiện được,
 * điều mà bản gọi LLM không bao giờ làm nổi.
 */
export function buildRenderPlan(
  sceneGraph: Tier3SceneGraph,
  opts: RenderPlanOptions = {}
): Tier4RenderPlan {
  const aspect = opts.aspect && ASPECT_SIZE[opts.aspect] ? opts.aspect : '9:16';
  const fps = opts.fps ?? 30;
  const quality = opts.quality ?? 1080;

  const khungGoc = ASPECT_SIZE[aspect];
  // Hạ về 720p bằng cách chia theo cạnh ngắn, giữ đúng tỉ lệ. Số chẵn vì H.264
  // yêu cầu chiều chia hết cho 2.
  const canhNgan = Math.min(khungGoc.width, khungGoc.height);
  const tiLe = quality === 720 ? 720 / canhNgan : 1;
  const width = Math.round((khungGoc.width * tiLe) / 2) * 2;
  const height = Math.round((khungGoc.height * tiLe) / 2) * 2;

  const scenes = sceneGraph?.scenes ?? [];

  // Góc máy chọn một lượt cho cả video: phải nhìn cảnh trước mới biết có lặp không.
  const nhip = nhipChuyenCanh(scenes.length);

  const gocMay: CameraMove[] = diversify(
    scenes.map((s) => s?.camera_motion?.type)
  );

  // Mỗi ảnh một asset, không trùng. Thứ tự giữ nguyên để khớp thứ tự -i của ffmpeg.
  const assetIds: string[] = [];
  for (const s of scenes) {
    const ref = String(s?.asset_ref || 'image_1');
    if (!assetIds.includes(ref)) assetIds.push(ref);
  }
  if (assetIds.length === 0) assetIds.push('image_1');

  const assets: Tier4RenderPlan['assets'] = assetIds.map((id) => ({
    asset_id: id,
    type: 'image' as const,
    source: id,
  }));

  if (opts.musicAssetId) {
    assets.push({ asset_id: opts.musicAssetId, type: 'music' as const, source: opts.musicAssetId });
  }
  if (opts.hasVoice) {
    assets.push({ asset_id: 'voiceover', type: 'voiceover' as const, source: 'voiceover' });
  }

  // Rải ảnh ra các cảnh: model hay dồn một ảnh cho phần lớn cảnh (đo thật 29/10:
  // image_1 dùng ở 4/6 cảnh), và video thành một tấm ảnh tĩnh kéo dài.
  const anhTheoCanh = spreadAssets(scenes.map((s: any) => s?.asset_ref), assetIds);

  const timeline: Tier4RenderPlan['timeline'] = scenes.map((s, i) => {
    const start = Number(s?.start_sec ?? 0);
    const end = Number(s?.end_sec ?? start + 3);
    const soKhung = Math.max(1, Math.round((end - start) * fps));

    const move = resolveMove(gocMay[i], soKhung);
    const visualType = String(s?.visual_type || 'product_closeup');

    // Vai trò câu chữ: lấy thứ model nói rõ, không có thì suy từ mục đích cảnh.
    const role: OverlayRole =
      s?.overlay_role && s.overlay_role in OVERLAY_STYLES
        ? (s.overlay_role as OverlayRole)
        : inferRole(String(s?.purpose || ''), visualType, i, scenes.length);

    return {
      scene_id: String(s?.scene_id || `s${i + 1}`),
      start_sec: start,
      end_sec: end,
      asset_id: anhTheoCanh[i] || assetIds[0],
      // smart_pan chỉ có nghĩa khi góc máy thật sự dịch khung.
      crop_mode: (move.move === 'reveal_up' ? 'smart_pan' : 'simple_crop') as 'smart_pan' | 'simple_crop',
      motion: {
        type: move.move,
        zoom_start: move.zoomStart,
        zoom_end: move.zoomEnd,
      },
      overlay: {
        text: trimOverlay(s?.overlay_text ?? '', role),
        // Chỗ đứng theo VAI TRÒ, không theo con số model đưa. Model hay trả
        // title_y = 0.9 cho cảnh CTA — rơi đúng vùng TikTok đặt caption và tên
        // tài khoản, chữ bị che hoàn toàn.
        position_y: safeY(OVERLAY_STYLES[role].positionY, 0.18),
        font_style: OVERLAY_STYLES[role].fontStyle,
        animate_in: OVERLAY_STYLES[role].animateIn,
      },
      // Nhịp chuyển cảnh: cắt cứng làm chủ đạo, hoà mềm ở những chỗ đổi ý.
      //
      // Bản cũ viết cứng `cut` cho MỌI ranh giới bên trong, nên `transitions.ts`
      // biết dựng xfade mà chưa bao giờ được yêu cầu làm gì — đo trên render
      // `ea39bbcb`: sáu cảnh, năm ranh giới, cả năm đều cắt phựt.
      transition_in: nhip[i]?.transition_in ?? (i === 0 ? 'fade' : 'cut'),
      transition_out: nhip[i]?.transition_out ?? (i === scenes.length - 1 ? 'fade' : 'cut'),
    };
  });

  return {
    render_meta: {
      renderer: 'ffmpeg_nvenc',
      gpu_index: 0,
      aspect_ratio: aspect,
      fps,
    },
    assets,
    timeline,
    audio_plan: {
      voiceover_asset_id: opts.hasVoice ? 'voiceover' : null,
      music_asset_id: opts.musicAssetId ?? null,
      // Có lời đọc thì nhạc phải lùi xuống, không thì nghe như hai thứ tranh nhau.
      music_volume: opts.hasVoice ? 0.10 : 0.22,
      ducking: Boolean(opts.hasVoice),
    },
    subtitle_plan: {
      burn_in: true,
      style: 'clean_white_shadow',
      position_y: 1 - SAFE_MARGIN_BOTTOM - 0.06,
    },
    export: {
      format: 'mp4',
      // libx264 chứ không NVENC: đo thật ngày 28/10, với cùng mức bitrate thì
      // libx264 nhanh hơn NVENC 10 lần ở độ dài và độ phân giải Viprosell dùng.
      codec: 'libx264' as const,
      resolution: `${width}x${height}`,
      audio_codec: 'aac',
    },
  };
}
