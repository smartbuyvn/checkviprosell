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
  buildTier4Prompt,
  TIER4_SYSTEM_PROMPT,
  type Tier4RenderPlan,
} from '../prompts/tiers/tier4-render-plan';
import { llmChat, extractJSON } from './llm.provider';
import { validateBriefTier, validateStrategyTier, validateSceneGraphTier, validateRenderPlanTier, clampSceneCount } from '../prompts/validators';

const REPAIR_PROMPT = `Kết quả trước không đúng JSON schema hoặc JSON không hợp lệ. Hãy sửa và trả về CHỈ valid JSON đúng schema yêu cầu. Không markdown, không giải thích.`;

type LooseSchema = { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: any } };

async function runTier<T>(
  tier: 'brief' | 'strategy' | 'scene_graph' | 'render_plan',
  system: string,
  user: string,
  schema: LooseSchema,
  traceId: string
): Promise<{ data: T; provider: 'ollama' | 'gemini'; fallbackUsed: boolean }> {
  const first = await llmChat({ tier, system, user, traceId });
  let parsed = extractJSON(first.text);
  let check = parsed ? schema.safeParse(parsed) : { success: false, error: null };

  if (!check.success) {
    const errStrs = check.error?.issues
      ? check.error.issues.map((i: any) => `${i.path?.join('.') || 'root'}: ${i.message}`).join(', ').slice(0, 500)
      : 'Invalid JSON format';
    console.warn(`[Pipeline] Tier ${tier} failed validation, retrying once (${traceId}): ${errStrs}`);
    const retry = await llmChat({ tier, system, user: `${user}\n\n${REPAIR_PROMPT}\nErrors: ${errStrs}`, temperature: 0.1, traceId });
    parsed = extractJSON(retry.text);
    check = parsed ? schema.safeParse(parsed) : { success: false, error: null };
    if (!check.success) {
      throw new Error(`TIER_${tier.toUpperCase()}_VALIDATION_FAILED after retry: ${errStrs}`);
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
  async generateBrief(input: Record<string, unknown>, traceId = 'pipeline'): Promise<Tier1Brief> {
    const user = buildTier1Prompt(input);
    const { data } = await runTier<Tier1Brief>('brief', TIER1_SYSTEM_PROMPT, user, Tier1BriefSchema, traceId);
    const v = validateBriefTier(data);
    if (!v.valid) throw new Error(`TIER_BRIEF_INVALID: ${v.errors.join('; ')}`);
    return data;
  },

  async generateStrategies(brief: Tier1Brief, traceId = 'pipeline'): Promise<Tier2Strategy[]> {
    const user = buildTier2Prompt(brief);
    const { data } = await runTier<{ strategies: Tier2Strategy[] }>('strategy', TIER2_SYSTEM_PROMPT, user, Tier2BatchSchema, traceId);
    const strategies = data.strategies;
    for (const s of strategies) {
      const v = validateStrategyTier(s);
      if (!v.valid) throw new Error(`TIER_STRATEGY_INVALID: ${v.errors.join('; ')}`);
    }
    return strategies;
  },

  async generateSceneGraph(
    brief: Tier1Brief,
    strategy: Tier2Strategy,
    traceId = 'pipeline'
  ): Promise<Tier3SceneGraph> {
    const user = buildTier3Prompt(brief, strategy);
    const { data } = await runTier<Tier3SceneGraph>('scene_graph', TIER3_SYSTEM_PROMPT, user, Tier3SceneGraphSchema, traceId);
    const normalized = normalizeSceneTiming(data);
    const v = validateSceneGraphTier(normalized);
    if (!v.valid) throw new Error(`TIER_SCENE_GRAPH_INVALID: ${v.errors.join('; ')}`);
    return normalized;
  },

  async generateRenderPlan(
    sceneGraph: Tier3SceneGraph,
    traceId = 'pipeline'
  ): Promise<Tier4RenderPlan> {
    const user = buildTier4Prompt(sceneGraph);
    const { data } = await runTier<Tier4RenderPlan>('render_plan', TIER4_SYSTEM_PROMPT, user, Tier4RenderPlanSchema, traceId);
    const v = validateRenderPlanTier(data);
    if (!v.valid) throw new Error(`TIER_RENDER_PLAN_INVALID: ${v.errors.join('; ')}`);
    return data;
  },

  /**
   * Full pipeline for the render worker (raw input → render plan).
   */
  async runFullPipeline(
    input: Record<string, unknown>,
    traceId = 'pipeline'
  ): Promise<{
    brief: Tier1Brief;
    strategies: Tier2Strategy[];
    strategy: Tier2Strategy;
    sceneGraph: Tier3SceneGraph;
    renderPlan: Tier4RenderPlan;
    provider: 'ollama' | 'gemini';
    fallbackUsed: boolean;
  }> {
    const brief = await PipelineService.generateBrief(input, traceId);
    const strategies = await PipelineService.generateStrategies(brief, traceId);
    const strategy = strategies[0];
    const sceneCount = clampSceneCount(strategy);
    const sceneGraph = await PipelineService.generateSceneGraph(brief, strategy, traceId);
    const plan = await PipelineService.generateRenderPlan(sceneGraph, traceId);
    return {
      brief,
      strategies,
      strategy,
      sceneGraph,
      renderPlan: plan,
      provider: 'ollama',
      fallbackUsed: false,
    };
  },
};

export { Tier1BriefSchema, Tier2StrategySchema, Tier3SceneGraphSchema, Tier4RenderPlanSchema };
export type { Tier1Brief, Tier2Strategy, Tier3SceneGraph, Tier4RenderPlan };