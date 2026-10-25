import { createClient } from '@supabase/supabase-js';
import { PipelineService, type Tier2Strategy } from './pipeline.service';
import { llmChat } from './llm.provider';

const CATEGORY_MAP: Record<string, string> = {
  beauty: 'beauty',
  skincare: 'beauty',
  makeup: 'beauty',
  cosmetics: 'beauty',
  fashion: 'fashion',
  clothing: 'fashion',
  apparel: 'fashion',
  home: 'home',
  household: 'home',
  furniture: 'home',
  kitchen: 'home',
};

const PRICE_BAND_MAP: Record<string, string> = {
  budget: 'low',
  midrange: 'mid',
  premium: 'high',
  unknown: 'mid',
};

function mapCategory(category: string | null | undefined): string {
  if (!category) return 'other';
  return CATEGORY_MAP[category.toLowerCase()] || 'other';
}

function toPricePositioning(priceBand: string | null | undefined): 'budget' | 'midrange' | 'premium' | 'unknown' {
  if (priceBand === 'low') return 'budget';
  if (priceBand === 'high') return 'premium';
  return 'midrange';
}

function dbStrategyToTier2(row: any): Tier2Strategy {
  const angleMap: Record<string, string> = {
    pain_first: 'painfirst',
    review_trust: 'reviewtrust',
    offer_conversion: 'offerconversion',
  };
  return {
    angle_type: (angleMap[row.angle_type] || 'painfirst') as Tier2Strategy['angle_type'],
    creative_angle: row.big_idea || row.title || 'Góc tiếp cận',
    primary_hook: row.hook || 'Bạn có đang gặp vấn đề này?',
    secondary_hooks: [],
    emotional_frame: row.why_it_works || '',
    audience_focus: '',
    cta: row.cta || 'Mua ngay hôm nay!',
    pacing: 'fast_medium',
    visual_style: { look: '', camera_language: '', text_style: '' },
    music_direction: '',
    narration_style: '',
    scene_count_target: 6,
    safety_notes: [],
  };
}

export const AIService = {
  async runProductIntel(projectId: string, userId: string, traceId: string, _accessToken: string) {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { data: project } = await supabaseClient.from('projects').select('*').eq('id', projectId).eq('user_id', userId).single();
    if (!project) throw new Error('PROJECT_NOT_FOUND');

    const { data: assets } = await supabaseClient.from('project_assets').select('file_name, asset_type').eq('project_id', projectId);
    const imageNotes = assets?.length
      ? assets.map((a: any) => `${a.asset_type}: ${a.file_name}`).join(', ')
      : '';

    await supabaseClient.from('projects').update({ status: 'analyzing' }).eq('id', projectId);

    const brief = await PipelineService.generateBrief(
      {
        title: project.title || project.manual_notes || 'Sản phẩm',
        raw_description: project.manual_notes || '',
        source_url: project.source_url || '',
        price_text: project.price_text || '',
        target_platform: 'tiktok',
        preferred_tone: project.preferred_tone || '',
        desired_duration_sec: project.duration_sec || 20,
        audience_hint: project.target_audience || '',
        key_points_user: project.manual_notes || '',
        image_count: assets?.length || 0,
        image_notes: imageNotes,
      },
      traceId
    );

    const { error: upsertError } = await supabaseClient.from('product_intelligence').upsert({
      project_id: projectId,
      product_name: brief.product_title,
      category: mapCategory(brief.category),
      target_buyer: (brief.target_audience || []).join(', ') || 'Khách hàng mục tiêu chung',
      price_band: PRICE_BAND_MAP[brief.price_positioning],
      usp_list: brief.key_benefits || [],
      pain_points: [],
      objections: [],
      trust_signals: brief.proof_points || [],
      use_context: brief.visual_inputs?.notes || [],
      recommended_package_fit: ['quickads'],
      confidence_score: brief.needs_human_review ? 0.5 : 0.8,
      raw_response: { text: '', parsed: brief, needs_human_review: brief.needs_human_review, missing_info: brief.missing_info },
    }, { onConflict: 'project_id' });

    if (upsertError) throw new Error(`DB_UPSERT_FAILED: ${upsertError.message}`);

    const { error: updateError } = await supabaseClient.from('projects').update({ status: 'concept_ready' }).eq('id', projectId);
    if (updateError) throw new Error(`DB_UPDATE_STATUS_FAILED: ${updateError.message}`);

    return brief;
  },

  async runCommerceConcepts(projectId: string, _userId: string, traceId: string, _accessToken: string) {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { data: intel } = await supabaseClient.from('product_intelligence').select('*').eq('project_id', projectId).single();
    if (!intel) throw new Error('INTEL_NOT_FOUND');

    const brief = {
      product_title: intel.product_name || 'Sản phẩm',
      category: intel.category,
      core_offer: (intel.usp_list || [])[0] || null,
      target_audience: intel.target_buyer ? [intel.target_buyer] : [],
      primary_use_case: null,
      key_benefits: intel.usp_list || [],
      proof_points: intel.trust_signals || [],
      price_positioning: toPricePositioning(intel.price_band),
      tone: 'tin cậy, tinh gọn',
      target_platform: 'tiktok',
      desired_duration_sec: 20,
      visual_inputs: { image_count: 0, has_real_product_images: true, notes: [] },
      constraints: [],
      missing_info: [],
      needs_human_review: false,
    };

    const strategies = await PipelineService.generateStrategies(brief, traceId);

    await supabaseClient.from('concepts').delete().eq('project_id', projectId);

    const dbAngleMap: Record<string, string> = {
      painfirst: 'pain_first',
      reviewtrust: 'review_trust',
      offerconversion: 'offer_conversion',
    };

    const insertions = strategies.map((s) => ({
      project_id: projectId,
      angle_type: dbAngleMap[s.angle_type] || 'pain_first',
      title: s.creative_angle.slice(0, 120),
      big_idea: s.creative_angle,
      hook: s.primary_hook,
      cta: s.cta,
      why_it_works: s.emotional_frame,
      is_selected: false,
    }));

    const { data: insertedConcepts, error: insertError } = await supabaseClient.from('concepts').insert(insertions).select();
    if (insertError) throw new Error(`DB Insert Error: ${insertError.message}`);

    const { error: updateError } = await supabaseClient.from('projects').update({ status: 'concept_ready' }).eq('id', projectId);
    if (updateError) console.error('[AI Service] Supabase update project status error in concepts:', updateError);

    return insertedConcepts;
  },

  async runScriptComposer(projectId: string, userId: string, traceId: string, _accessToken: string, packageType: string) {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { data: project } = await supabaseClient.from('projects').select('*').eq('id', projectId).eq('user_id', userId).single();
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    const { data: intel } = await supabaseClient.from('product_intelligence').select('*').eq('project_id', projectId).single();

    const { data: selectedConcept } = await supabaseClient
      .from('concepts')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_selected', true)
      .single();

    const strategy = selectedConcept
      ? dbStrategyToTier2(selectedConcept)
      : {
          angle_type: 'painfirst' as const,
          creative_angle: intel?.product_name || 'Sản phẩm',
          primary_hook: (intel?.usp_list || [])[0] || 'Khám phá ngay!',
          secondary_hooks: [],
          emotional_frame: '',
          audience_focus: intel?.target_buyer || '',
          cta: 'Xem chi tiết ngay!',
          pacing: 'fast_medium' as const,
          visual_style: { look: '', camera_language: '', text_style: '' },
          music_direction: '',
          narration_style: '',
          scene_count_target: 6,
          safety_notes: [],
        };

    const brief = {
      product_title: intel?.product_name || 'Sản phẩm',
      category: intel?.category,
      core_offer: (intel?.usp_list || [])[0] || null,
      target_audience: intel?.target_buyer ? [intel.target_buyer] : [],
      primary_use_case: null,
      key_benefits: intel?.usp_list || [],
      proof_points: intel?.trust_signals || [],
      price_positioning: toPricePositioning(intel?.price_band),
      tone: 'tin cậy, tinh gọn',
      target_platform: 'tiktok',
      desired_duration_sec: project.duration_sec || 20,
      visual_inputs: { image_count: 0, has_real_product_images: true, notes: [] },
      constraints: [],
      missing_info: [],
      needs_human_review: false,
    };

    const sceneGraph = await PipelineService.generateSceneGraph(brief, strategy, traceId);

    const dbPackageType = packageType === 'reviewvideo' ? 'review_video' : packageType === 'conversionvideo' ? 'conversion_video' : 'quick_ads';

    const scriptText = (sceneGraph.scenes || []).map((s: any) => s.voice_line).filter(Boolean).join('\n');
    const sceneCards = (sceneGraph.scenes || []).map((s: any, i: number) => ({
      scene_no: i + 1,
      duration_sec: Math.round(((s.end_sec || 0) - (s.start_sec || 0)) * 10) / 10,
      visual_instruction: s.purpose || s.visual_type || '',
      overlay_text: s.overlay_text || '',
      voice_line: s.voice_line || '',
    }));

    const { error: scriptErr } = await supabaseClient.from('scripts').upsert({
      project_id: projectId,
      package_type: dbPackageType,
      script_text: scriptText,
      duration_sec: sceneGraph.video_meta?.duration_sec || 20,
      scene_cards: sceneCards,
      cta: strategy.cta || '',
    }, { onConflict: 'project_id' });
    if (scriptErr) throw new Error(`Script DB Error: ${scriptErr.message}`);

    const overlayList = sceneCards.map((s: any) => ({
      start_sec: (s.scene_no - 1) * s.duration_sec,
      end_sec: s.scene_no * s.duration_sec,
      text: s.overlay_text,
      style: 'headline',
    }));

    const { error: vpErr } = await supabaseClient.from('visual_packs').upsert({
      project_id: projectId,
      overlay_list: overlayList,
      subtitle_text: scriptText,
    }, { onConflict: 'project_id' });
    if (vpErr) throw new Error(`VisualPack DB Error: ${vpErr.message}`);

    const { error: capErr } = await supabaseClient.from('captions').upsert({
      project_id: projectId,
      caption_tiktok: `${strategy.primary_hook}\n${strategy.cta}`,
      caption_reels: `${strategy.primary_hook}\n${strategy.cta}`,
      hashtags: [],
      thumbnail_text: strategy.primary_hook,
    }, { onConflict: 'project_id' });
    if (capErr) throw new Error(`Caption DB Error: ${capErr.message}`);

    await supabaseClient.from('projects').update({ status: 'script_ready' }).eq('id', projectId);

    console.log(`[${traceId}] Script generation completed.`);
    return { script_text: scriptText, duration_sec: sceneGraph.video_meta?.duration_sec || 20, scene_cards: sceneCards, cta: strategy.cta };
  },
};

export { llmChat };