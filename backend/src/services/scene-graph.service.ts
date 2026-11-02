/**
 * Viprosell — AI Pipeline Orchestration for the Render Worker
 * Uses the 4-tier Local AI pipeline (brief → strategy → scene_graph → render_plan)
 * with hybrid provider (Ollama-first, Gemini fallback per policy).
 */
import 'dotenv/config';
import { napAnhSanPham, tuDanhSachUrl } from '../lib/product-vision';
import { Tier2StrategySchema } from '../prompts/tiers/tier2-strategy';
import { PipelineService, type Tier1Brief, type Tier2Strategy, type Tier3SceneGraph, type Tier4RenderPlan } from './pipeline.service';
import type { RenderPlanOptions } from '../lib/render-plan';

export interface PipelineOutput {
  productBrief: Tier1Brief;
  /** Phuong an da dung — khach chon, hoac mac dinh la cai dau tien. */
  strategy: Tier2Strategy;
  /** Ca ba phuong an tang 2 sinh ra, de man hinh chon hien duoc. */
  strategies?: Tier2Strategy[];
  sceneGraph: Tier3SceneGraph;
  renderPlan: Tier4RenderPlan;
  provider: 'ollama' | 'gemini';
  fallbackUsed: boolean;
}

/**
 * Doc phuong an khach da chon tu `raw_input.chien_luoc`.
 *
 * PHAI qua schema chu khong tin thang: du lieu nay di qua trinh duyet nen co the bi
 * sua. Schema bat moi truong ve dung kieu va dung mien gia tri, con cong QA o sau van
 * got cac khang dinh bi cam — nen khach co sua gi thi cung khong vuot duoc hai lop do.
 *
 * Hong thi tra null va de pipeline sinh lai nhu cu: mot phuong an hong khong duoc
 * phep giet ca lan dung video.
 */
function docChienLuocDaChon(tho: unknown, traceId: string): Tier2Strategy | null {
  if (!tho || typeof tho !== 'object') return null;
  const kq = Tier2StrategySchema.safeParse(tho);
  if (!kq.success) {
    console.warn(`[Pipeline] Phuong an khach gui khong hop le, sinh lai: ${kq.error.issues[0]?.message} [${traceId}]`);
    return null;
  }
  return kq.data as Tier2Strategy;
}

export const SceneGraphService = {
  /**
   * Full 4-tier pipeline from raw input.
   * Returns { productBrief, strategy, sceneGraph, renderPlan }.
   */
  async generatePipeline(input: any, opts: RenderPlanOptions = {}): Promise<PipelineOutput> {
    console.log('[Pipeline] Step 1: Normalizing product brief...');

    // Loc anh hop le MOT LAN, dung chung cho ca image_count va image_notes.
    //
    // Day la cho da lam hong render that: `image_urls.map((u) => u.split('/'))` chay
    // thang tren phan tu null va nem "Cannot read properties of null (reading 'split')".
    // Mang chua null den tu luong tao du an — no lay `assets.map((a) => a.url)`, va mot
    // ban ghi asset co url rong (upload do dang) bien thanh mot o null trong mang.
    //
    // Loi nay giet ca lan render ngay o buoc dau, truoc khi bat ky tang AI nao chay,
    // nen khach chi thay "Khong dung duoc video" ma khong hieu vi sao.
    const anhHopLe: string[] = Array.isArray(input.image_urls)
      ? input.image_urls.filter((u: unknown): u is string => typeof u === 'string' && u.trim() !== '')
      : [];

    const soAnhBoQua = (Array.isArray(input.image_urls) ? input.image_urls.length : 0) - anhHopLe.length;
    if (soAnhBoQua > 0) {
      console.warn(`[Pipeline] Bo qua ${soAnhBoQua} muc anh rong/null trong image_urls.`);
    }
    // Nap ANH THAT cho tang 1 nhin, khong chi gui ten tep.
    //
    // Day la doan tung bi dut: `ai.service.ts` (trang Phan tich) co truyen anh, con
    // duong NAY — duong dung video that — chi gui `image_notes` la danh sach ten tep.
    // Do tren render a7d667cc: brief tra ve "Chi nhan duoc ten tep anh", core_offer
    // null, key_benefits rong, needs_human_review true. Tang 2 viet hook tu brief rong
    // do, cho ra "Dang chon dong ho hay laptop?" — khong nhac san pham nao.
    const traceId = `worker-${Date.now()}`;
    const anhChoModel = await napAnhSanPham(tuDanhSachUrl(anhHopLe), traceId);

    const brief = await PipelineService.generateBrief(
      {
        title: input.product_title || input.product_summary || 'Sản phẩm',
        raw_description: input.product_summary || input.product_description || '',
        source_url: input.product_url || '',
        price_text: input.product_price || '',
        target_platform: 'tiktok',
        preferred_tone: input.preferred_tone || '',
        desired_duration_sec: input.duration_seconds || 20,
        audience_hint: input.target_audience || '',
        key_points_user: input.promo_text || '',
        // Điều người bán CẤM nói. Chặn trước ở tầng 1 thì mọi tầng sau đều thấy —
        // để cổng QA gột sau là đã tiêu tiền LLM cho một câu phải bỏ đi.
        do_not_say: input.do_not_say || '',
        // Dem anh THAT, khong dem o null: bao voi tang 1 rang co 4 anh trong khi chi
        // co 1 anh dung duoc se khien no viet kich ban 4 canh cho mot buc anh.
        image_count: anhHopLe.length,
        image_notes: anhHopLe.map((u) => u.split('/').pop()).join(', '),
      },
      traceId,
      anhChoModel
    );

    // Tang 1 noi ro no biet gi va khong biet gi. Truoc 29/10 khong ai doc nhung co
    // nay — ca `needs_human_review` lan `has_real_product_images` deu duoc tinh roi
    // vut di, nen he thong van dung video tu brief rong va giao cho khach.
    //
    // Chua chan render o day: chan la khach mat ca video, ma phan lon truong hop van
    // ra duoc thu dung duoc. Nhung no PHAI hien ra trong log, vi day la ly do goc cua
    // moi cau hook chung chung.
    if (brief.needs_human_review || !brief.visual_inputs?.has_real_product_images) {
      const thieu = (brief.missing_info ?? []).slice(0, 4).join(' | ') || 'khong ghi ro';
      console.warn(
        `[Pipeline] BRIEF YEU — hook se chung chung. ` +
        `anh_san_pham_that=${brief.visual_inputs?.has_real_product_images} ` +
        `can_nguoi_xem=${brief.needs_human_review} ` +
        `| thieu: ${thieu} [${traceId}]`
      );
      if (brief.visual_inputs?.has_real_product_images === false && anhHopLe.length > 0) {
        console.warn(
          `[Pipeline] ${anhHopLe.length} anh tai len khong phai anh san pham ` +
          `(logo, anh chup man hinh, hay anh mau cua app). Khach can tai anh san pham that. [${traceId}]`
        );
      }
    }

    // ── Tang 2: phuong an tiep can ──
    //
    // Tang 2 LUON sinh du ba phuong an — painfirst, reviewtrust, offerconversion —
    // va ban cu lay `strategies[0]` roi vut hai cai con lai. Ba lan goi LLM da tra
    // tien, hai phan ba ket qua di thang vao thung rac, va khach khong he biet minh
    // co lua chon nao.
    //
    // Khi khach da chon o man hinh truoc khi dung, `chien_luoc` mang NGUYEN phuong an
    // do xuong day. Dung lai nguyen van chu khong sinh lai: sinh lai thi hook se khac
    // cai khach vua tich, va do la cung mot kieu mat long tin voi viec bao mot gia
    // roi tru mot gia khac.
    let strategy: Tier2Strategy;
    let strategies: Tier2Strategy[] | undefined;

    const daChon = docChienLuocDaChon(input.chien_luoc, traceId);
    if (daChon) {
      console.log(`[Pipeline] Step 2: dung phuong an khach da chon (${daChon.angle_type}) — bo qua goi LLM`);
      strategy = daChon;
    } else {
      console.log('[Pipeline] Step 2: Designing strategies...');
      strategies = await PipelineService.generateStrategies(brief);
      strategy = strategies[0];
    }

    console.log('[Pipeline] Step 3: Generating scene graph...');
    const sceneGraph = await PipelineService.generateSceneGraph(brief, strategy);

    console.log('[Pipeline] Step 4: Building render plan...');
    const renderPlan = await PipelineService.generateRenderPlan(sceneGraph, opts);

    const output: PipelineOutput = {
      productBrief: brief,
      strategy,
      // Ca ba phuong an, de man hinh chon hien duoc va de lan dung lai khong phai
      // goi LLM them lan nua.
      strategies,
      sceneGraph,
      renderPlan,
      provider: 'ollama',
      fallbackUsed: false,
    };

    console.log(`[Pipeline] Done. ${sceneGraph.scenes.length} scenes, ${renderPlan.timeline.length} timeline items.`);
    return output;
  },

  /**
   * Generate a render plan from an existing scene graph (skip tiers 1-3).
   */
  async generateRenderPlanOnly(
    sceneGraph: Tier3SceneGraph,
    opts: RenderPlanOptions = {}
  ): Promise<Tier4RenderPlan> {
    return PipelineService.generateRenderPlan(sceneGraph, opts);
  },
};