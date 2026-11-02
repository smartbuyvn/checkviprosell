/**
 * Viprosell — 4-Tier AI Pipeline Orchestration (brief → strategy → scene_graph → render_plan)
 * Each tier: build prompt → llmChat (Ollama-first, Gemini fallback) → extractJSON → zod validate.
 * On schema failure: retry once with low temperature + repair prompt.
 * Cross-tier rules enforced via prompts/validators.
 */
import {
  Tier1BriefSchema,
  buildTier1Prompt,
  TIER1_SYSTEM_PROMPT,
  type Tier1Brief,
} from '../prompts/tiers/tier1-brief';
import {
  Tier2BatchSchema,
  Tier2StrategySchema,
  buildTier2Prompt,
  TIER2_SYSTEM_PROMPT,
  type Tier2Strategy,
} from '../prompts/tiers/tier2-strategy';
import {
  Tier3SceneGraphSchema,
  buildTier3Prompt,
  TIER3_SYSTEM_PROMPT,
  type Tier3SceneGraph,
} from '../prompts/tiers/tier3-scene-graph';
import {
  Tier4RenderPlanSchema,
  type Tier4RenderPlan,
} from '../prompts/tiers/tier4-render-plan';
import { buildRenderPlan, type RenderPlanOptions } from '../lib/render-plan';
import { llmChat, extractJSON , type LlmImage } from './llm.provider';
import { getPrompt } from './prompt-registry.service';
import { validateBriefTier, validateStrategyTier, validateSceneGraphTier, validateRenderPlanTier, clampSceneCount } from '../prompts/validators';

const REPAIR_PROMPT = `Kết quả trước không đúng JSON schema hoặc JSON không hợp lệ. Hãy sửa và trả về CHỈ valid JSON đúng schema yêu cầu. Không markdown, không giải thích.`;

type LooseSchema = { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: any } };

/**
 * Mot lan goi LLM co kiem schema, ghi log va bat loi.
 *
 * Xuat ra de luong dung clip (`video-edit.service.ts`) dung lai. Viet mot ban thu hai
 * cho luong do nghia la hai cho xu ly retry/parse JSON/log khac nhau, va chung se troi
 * khoi nhau ngay lan sua dau tien.
 */
export async function runTier<T>(
  tier: 'brief' | 'strategy' | 'scene_graph' | 'render_plan',
  system: string,
  user: string,
  schema: LooseSchema,
  traceId: string,
  /** Anh san pham cho tang nhin duoc; tang khac de trong. */
  images: LlmImage[] = []
): Promise<{ data: T; provider: 'ollama' | 'anthropic' | 'gemini'; fallbackUsed: boolean }> {
  const first = await llmChat({ tier, system, user, traceId, images });
  let parsed = extractJSON(first.text);
  let check = parsed ? schema.safeParse(parsed) : { success: false, error: null };

  /** Gom loi cua zod thanh mot dong doc duoc. */
  const describe = (c: { error?: any }, raw: string | null): string =>
    c.error?.issues
      ? c.error.issues.map((i: any) => `${i.path?.join('.') || 'root'}: ${i.message}`).join(', ').slice(0, 500)
      : raw === null
        ? 'khong tach duoc JSON tu cau tra loi'
        : 'Invalid JSON format';

  if (!check.success) {
    const firstErr = describe(check, parsed);
    console.warn(`[Pipeline] Tier ${tier} failed validation, retrying once (${traceId}): ${firstErr}`);

    const retry = await llmChat({
      tier,
      system,
      user: `${user}\n\n${REPAIR_PROMPT}\nErrors: ${firstErr}`,
      temperature: 0.1,
      traceId,
      images,
    });
    parsed = extractJSON(retry.text);
    check = parsed ? schema.safeParse(parsed) : { success: false, error: null };

    if (!check.success) {
      // Bao loi cua chinh lan THU LAI. Truoc day cho nay bao lai loi cua lan dau, nen
      // thong bao "after retry: ..." mo ta mot lan goi khac han - doc log khong lan ra.
      const retryErr = describe(check, parsed);
      const sameTwice = retryErr === firstErr;
      throw new Error(
        `TIER_${tier.toUpperCase()}_VALIDATION_FAILED after retry: ${retryErr}` +
        (sameTwice ? ' (lan dau hong y het)' : ` (lan dau: ${firstErr})`)
      );
    }
  }

  return {
    data: check.data as T,
    provider: first.provider,
    fallbackUsed: first.fallbackUsed,
  };
}

function normalizeSceneTiming(sceneGraph: Tier3SceneGraph): Tier3SceneGraph {
  const scenes = sceneGraph.scenes;
  if (!scenes.length) return sceneGraph;
  let cursor = 0;
  const normalized = scenes.map((s) => {
    const duration = Math.max(1, Math.round(((s.end_sec || cursor + 3) - s.start_sec) * 10) / 10);
    const scene = { ...s, start_sec: cursor, end_sec: Math.round((cursor + duration) * 10) / 10 };
    cursor = scene.end_sec;
    return scene;
  });
  return { ...sceneGraph, scenes: normalized };
}

export const PipelineService = {
  async generateBrief(
    input: Record<string, unknown>,
    traceId = 'pipeline',
    /** Anh san pham: spec V2 4.2 yeu cau tang dao dien phai NHIN duoc san pham. */
    images: LlmImage[] = []
  ): Promise<Tier1Brief> {
    const user = buildTier1Prompt(input);
    const { data } = await runTier<Tier1Brief>('brief', await getPrompt('tier1_brief_system', TIER1_SYSTEM_PROMPT), user, Tier1BriefSchema, traceId, images);
    const v = validateBriefTier(data);
    if (!v.valid) throw new Error(`TIER_BRIEF_INVALID: ${v.errors.join('; ')}`);
    return data;
  },

  async generateStrategies(brief: Tier1Brief, traceId = 'pipeline'): Promise<Tier2Strategy[]> {
    const user = buildTier2Prompt(brief);
    const { data } = await runTier<{ strategies: Tier2Strategy[] }>('strategy', await getPrompt('tier2_strategy_system', TIER2_SYSTEM_PROMPT), user, Tier2BatchSchema, traceId);
    const strategies = data.strategies;
    for (const s of strategies) {
      // Truyen brief xuong de cham duoc do cu the cua hook: hook co nhac toi san
      // pham khong, hay la cau dan len mat hang nao cung vua.
      const v = validateStrategyTier(s, brief);
      if (!v.valid) throw new Error(`TIER_STRATEGY_INVALID: ${v.errors.join('; ')}`);
      // Canh bao phai ra log. Tinh ra roi vut di thi khong khac gi khong tinh — va
      // do dung la ly do khong ai biet he thong da giao nam cau hook rong lien tiep.
      for (const w of v.warnings) {
        console.warn(`[Tier2] ${w} [${traceId}]`);
      }
    }
    return strategies;
  },

  async generateSceneGraph(
    brief: Tier1Brief,
    strategy: Tier2Strategy,
    traceId = 'pipeline'
  ): Promise<Tier3SceneGraph> {
    const user = buildTier3Prompt(brief, strategy);
    const { data } = await runTier<Tier3SceneGraph>('scene_graph', await getPrompt('tier3_scene_graph_system', TIER3_SYSTEM_PROMPT), user, Tier3SceneGraphSchema, traceId);
    const normalized = normalizeSceneTiming(data);
    const v = validateSceneGraphTier(normalized);
    if (!v.valid) throw new Error(`TIER_SCENE_GRAPH_INVALID: ${v.errors.join('; ')}`);
    return normalized;
  },

  /**
   * Tang 4 KHONG goi LLM nua — dung bang code trong lib/render-plan.ts.
   *
   * Viec cua tang 4 la doi ten truong va dien so: sao scene_id, dich ten goc may
   * thanh zoom_start/zoom_end, chon do phan giai. Khong co phan doan sang tao nao,
   * nhung tra gia bang mot lan goi LLM va mot lop loi JSON. Nang hon ca: model tu
   * dien `resolution`, khach chon 9:16 ma no tra "1080x1080" — video ra vuong.
   *
   * Van giu `await` va validateRenderPlanTier: ham nay la async trong moi noi goi,
   * va cong kiem tra o cuoi bat loi do chinh code nay sinh ra chu khong phai do model.
   */
  async generateRenderPlan(
    sceneGraph: Tier3SceneGraph,
    opts: RenderPlanOptions = {}
  ): Promise<Tier4RenderPlan> {
    const plan = buildRenderPlan(sceneGraph, opts);
    const v = validateRenderPlanTier(plan);
    if (!v.valid) throw new Error(`TIER_RENDER_PLAN_INVALID: ${v.errors.join('; ')}`);
    return plan;
  },

  /**
   * Full pipeline for the render worker (raw input → render plan).
   */
  async runFullPipeline(
    input: Record<string, unknown>,
    traceId = 'pipeline',
    opts: RenderPlanOptions = {}
  ): Promise<{
    brief: Tier1Brief;
    strategies: Tier2Strategy[];
    strategy: Tier2Strategy;
    sceneGraph: Tier3SceneGraph;
    renderPlan: Tier4RenderPlan;
  }> {
    const brief = await PipelineService.generateBrief(input, traceId);
    const strategies = await PipelineService.generateStrategies(brief, traceId);
    const strategy = strategies[0];
    const sceneCount = clampSceneCount(strategy);
    const sceneGraph = await PipelineService.generateSceneGraph(brief, strategy, traceId);
    const plan = await PipelineService.generateRenderPlan(sceneGraph, opts);
    return {
      brief,
      strategies,
      strategy,
      sceneGraph,
      renderPlan: plan,
      // Bo hai truong provider/fallbackUsed: chung ghi cung 'ollama'/false nen luon sai,
      // nhat la tu khi Ollama tat mac dinh. Moi tang co the chay tren nha cung cap khac
      // nhau, nen mot gia tri duy nhat khong mo ta duoc that. Can thi tra ve danh sach.
    };
  },
};

export { Tier1BriefSchema, Tier2StrategySchema, Tier3SceneGraphSchema, Tier4RenderPlanSchema };
export type { Tier1Brief, Tier2Strategy, Tier3SceneGraph, Tier4RenderPlan };