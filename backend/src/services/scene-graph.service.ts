/**
 * Viprosell — AI Pipeline Orchestration for the Render Worker
 * Uses the 4-tier Local AI pipeline (brief → strategy → scene_graph → render_plan)
 * with hybrid provider (Ollama-first, Gemini fallback per policy).
 */
import 'dotenv/config';
import { PipelineService, type Tier1Brief, type Tier2Strategy, type Tier3SceneGraph, type Tier4RenderPlan } from './pipeline.service';

export interface PipelineOutput {
  productBrief: Tier1Brief;
  strategy: Tier2Strategy;
  sceneGraph: Tier3SceneGraph;
  renderPlan: Tier4RenderPlan;
  provider: 'ollama' | 'gemini';
  fallbackUsed: boolean;
}

export const SceneGraphService = {
  /**
   * Full 4-tier pipeline from raw input.
   * Returns { productBrief, strategy, sceneGraph, renderPlan }.
   */
  async generatePipeline(input: any): Promise<PipelineOutput> {
    console.log('[Pipeline] Step 1: Normalizing product brief...');
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
        image_count: Array.isArray(input.image_urls) ? input.image_urls.length : 0,
        image_notes: Array.isArray(input.image_urls) ? input.image_urls.map((u: string) => u.split('/').pop()).join(', ') : '',
      },
      `worker-${Date.now()}`
    );

    console.log('[Pipeline] Step 2: Designing strategies...');
    const strategies = await PipelineService.generateStrategies(brief);
    const strategy = strategies[0];

    console.log('[Pipeline] Step 3: Generating scene graph...');
    const sceneGraph = await PipelineService.generateSceneGraph(brief, strategy);

    console.log('[Pipeline] Step 4: Building render plan...');
    const renderPlan = await PipelineService.generateRenderPlan(sceneGraph);

    const output: PipelineOutput = {
      productBrief: brief,
      strategy,
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
  async generateRenderPlanOnly(sceneGraph: Tier3SceneGraph): Promise<Tier4RenderPlan> {
    return PipelineService.generateRenderPlan(sceneGraph);
  },
};