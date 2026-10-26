/**
 * Viprosell — SceneGraph Validator Unit Tests (Phase 1)
 * Maps directly to docs/phase1-test-plan.md
 *
 * Run: npm test
 * Or:  npx vitest run src/test/scene-graph.validator.test.ts
 */

import { describe, it, expect } from 'vitest';
import { validateSceneGraph } from '../types/scene-graph.validator';
import sampleJsonRaw from '../types/sample-scene-graph.quick-ads.json';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeMeta(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Video',
    package_type: 'quick_ads',
    aspect_ratio: '9:16',
    total_frames: 450,
    fps: 30,
    brand_name: 'TestBrand',
    brand_color: '#FF4C61',
    voiceover_mode: 'placeholder',
    bg_music_id: null,
    generated_at: '2026-06-04T00:00:00.000Z',
    generated_by_model: 'test',
    ...overrides,
  };
}

function makeScene(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    start_frame: 0,
    duration_frames: 90,
    layout: 'image_full',
    animation: 'zoom_in',
    asset: { src: 'https://example.com/img.jpg', fit: 'cover' },
    overlays: [],
    ...overrides,
  };
}

function makeOverlay(overrides: Record<string, unknown> = {}) {
  return {
    text: 'Hello World',
    style: 'headline',
    position_y: 0.12,
    align: 'center',
    entrance: 'fade_in',
    delay_frames: 0,
    ...overrides,
  };
}

/** Minimal valid 3-scene SceneGraph */
function makeValidGraph(metaOverrides = {}, scenesOverride?: unknown[]) {
  const scenes = scenesOverride ?? [
    makeScene('hook', { start_frame: 0, duration_frames: 120 }),
    makeScene('usp', { start_frame: 120, duration_frames: 120 }),
    makeScene('cta', {
      start_frame: 240,
      duration_frames: 90,
      layout: 'cta_card',
      animation: 'fade_in',
    }),
  ];

  return {
    schema_version: '1.0',
    meta: makeMeta({ total_frames: 330, ...metaOverrides }),
    scenes,
  };
}

// ─── Suite 1: Valid Input ──────────────────────────────────────────────────────

describe('Suite 1 — Valid Input', () => {
  // T1.1
  it('T1.1 — validates sample quick_ads 9:16 (5 scenes)', () => {
    const result = validateSceneGraph(sampleJsonRaw);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data?.meta.total_frames).toBe(450);
    expect(result.data?.scenes.at(-1)?.layout).toBe('cta_card');
  });

  // T1.2
  it('T1.2 — valid minimum: 3 scenes', () => {
    const graph = makeValidGraph();
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // T1.3
  it('T1.3 — valid 1:1 aspect ratio', () => {
    const graph = makeValidGraph({ aspect_ratio: '1:1' });
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(true);
  });

  // T1.4
  it('T1.4 — missing optional overlay fields are normalized with defaults', () => {
    const scene = makeScene('hook', {
      start_frame: 0,
      duration_frames: 150,
      overlays: [{ text: 'Test', style: 'body', position_y: 0.5 }],
    });
    const graph = {
      schema_version: '1.0',
      meta: makeMeta({ total_frames: 330 }),
      scenes: [
        scene,
        makeScene('usp', { start_frame: 150, duration_frames: 90 }),
        makeScene('cta', { start_frame: 240, duration_frames: 90, layout: 'cta_card', animation: 'fade_in' }),
      ],
    };
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.data?.scenes[0].overlays[0].entrance).toBe('fade_in');
    expect(result.data?.scenes[0].overlays[0].delay_frames).toBe(0);
  });
});

// ─── Suite 2: Invalid Input — Must REJECT ─────────────────────────────────────

describe('Suite 2 — Invalid Input → Must REJECT', () => {
  // T2.1
  it('T2.1 — invalid animation enum → reject', () => {
    const graph = makeValidGraph({}, [
      makeScene('hook', { animation: 'particle_burst' }),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('particle_burst'))).toBe(true);
    expect(result.errors.some(e => e.includes('AnimationType'))).toBe(true);
  });

  // T2.2
  it('T2.2 — invalid layout enum → reject', () => {
    const graph = makeValidGraph({}, [
      makeScene('hook', { layout: 'hero_banner' }),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('hero_banner'))).toBe(true);
  });

  // T2.3
  it('T2.3 — missing scenes array → reject', () => {
    const graph = { schema_version: '1.0', meta: makeMeta() };
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scenes'))).toBe(true);
  });

  // T2.4
  it('T2.4 — missing meta.brand_name → reject', () => {
    const meta = makeMeta();
    delete (meta as any).brand_name;
    const graph = makeValidGraph();
    (graph.meta as any).brand_name = undefined;
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('brand_name'))).toBe(true);
  });

  // T2.5
  it('T2.5 — scene count < 3 → reject', () => {
    const graph = {
      schema_version: '1.0',
      meta: makeMeta({ total_frames: 180 }),
      scenes: [
        makeScene('scene1'),
        makeScene('scene2', { start_frame: 90 }),
      ],
    };
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('3–8 scenes') && e.includes('2'))).toBe(true);
  });

  // T2.6
  it('T2.6 — scene count > 8 → reject', () => {
    const scenes = Array.from({ length: 9 }, (_, i) =>
      makeScene(`scene_${i}`, { start_frame: i * 50, duration_frames: 50 })
    );
    const graph = {
      schema_version: '1.0',
      meta: makeMeta({ total_frames: 450 }),
      scenes,
    };
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('3–8 scenes') && e.includes('9'))).toBe(true);
  });

  // T2.7
  it('T2.7 — duration_frames > 150 → reject', () => {
    const graph = makeValidGraph({}, [
      makeScene('hook', { duration_frames: 200 }),
      makeScene('usp', { start_frame: 200 }),
      makeScene('cta', { start_frame: 290, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duration_frames') && e.includes('200'))).toBe(true);
  });

  // T2.8
  it('T2.8 — headline text > 40 chars → reject', () => {
    const longText = 'A'.repeat(41); // 41 chars, max 40
    const graph = makeValidGraph({}, [
      makeScene('hook', {
        overlays: [makeOverlay({ text: longText, style: 'headline' })],
      }),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('headline') && e.includes('41') && e.includes('40'))).toBe(true);
  });

  // T2.9
  it('T2.9 — badge text > 20 chars → reject', () => {
    const longText = 'B'.repeat(21); // 21 chars, max 20
    const graph = makeValidGraph({}, [
      makeScene('hook', {
        overlays: [makeOverlay({ text: longText, style: 'badge' })],
      }),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('badge') && e.includes('21') && e.includes('20'))).toBe(true);
  });

  // T2.10
  it('T2.10 — cta text > 25 chars → reject', () => {
    const longText = 'C'.repeat(26); // 26 chars, max 25
    const graph = makeValidGraph({}, [
      makeScene('hook'),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', {
        start_frame: 180,
        layout: 'cta_card',
        animation: 'fade_in',
        overlays: [makeOverlay({ text: longText, style: 'cta' })],
      }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cta') && e.includes('26') && e.includes('25'))).toBe(true);
  });

  // T2.11
  it('T2.11 — invalid brand_color format → warning, not error (normalized to default)', () => {
    const graph = makeValidGraph({ brand_color: 'red' });
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(true); // brand_color is optional, soft error
    expect(result.warnings.some(w => w.includes('brand_color'))).toBe(true);
    expect(result.data?.meta.brand_color).toBe('#FF4C61');
  });

  // T2.12
  it('T2.12 — total_frames < 300 (< 10s) → reject', () => {
    const graph = makeValidGraph({ total_frames: 100 });
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('total_frames') && e.includes('300'))).toBe(true);
  });

  // T2.13
  it('T2.13 — null input → reject', () => {
    const result = validateSceneGraph(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Root must be a JSON object');
  });

  // T2.14
  it('T2.14 — empty object {} → reject with multiple errors', () => {
    const result = validateSceneGraph({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors.some(e => e.includes('schema_version'))).toBe(true);
    expect(result.errors.some(e => e.includes('meta'))).toBe(true);
  });
});

// ─── Suite 3: Edge Cases ───────────────────────────────────────────────────────

describe('Suite 3 — Edge Cases', () => {
  it('T3.E1 — max 3 overlays per scene (4th rejected)', () => {
    const overlays = [
      makeOverlay({ position_y: 0.1 }),
      makeOverlay({ text: 'Second', position_y: 0.3, style: 'body' }),
      makeOverlay({ text: 'Third', position_y: 0.5, style: 'body' }),
      makeOverlay({ text: 'Fourth', position_y: 0.7, style: 'body' }),
    ];
    const graph = makeValidGraph({}, [
      makeScene('hook', { overlays }),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('max 3 overlays'))).toBe(true);
  });

  it('T3.E2 — text_only layout does NOT require asset', () => {
    const graph = {
      schema_version: '1.0',
      meta: makeMeta({ total_frames: 330 }),
      scenes: [
        {
          id: 'text_only_scene',
          start_frame: 0,
          duration_frames: 120,
          layout: 'text_only',
          animation: 'static',
          overlays: [makeOverlay()],
          bg_color: '#000000',
        },
        makeScene('usp', { start_frame: 120 }),
        makeScene('cta', { start_frame: 210, layout: 'cta_card', animation: 'fade_in' }),
      ],
    };
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(true);
  });

  it('T3.E3 — non-text_only layout without asset → reject', () => {
    const scene = makeScene('hook');
    delete (scene as any).asset;
    const graph = makeValidGraph({}, [
      scene,
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('asset') && e.includes('required'))).toBe(true);
  });

  it('T3.E4 — voiceover_text > 200 chars → reject', () => {
    const longVoiceover = 'Nội dung voiceover '.repeat(15); // ~270 chars
    const graph = makeValidGraph({}, [
      makeScene('hook', { voiceover_text: longVoiceover }),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('voiceover_text') && e.includes('200'))).toBe(true);
  });

  it('T3.E5 — split_image_text layout is valid for 1:1 aspect ratio', () => {
    const graph = {
      schema_version: '1.0',
      meta: makeMeta({ aspect_ratio: '1:1', total_frames: 330 }),
      scenes: [
        {
          id: 'split_scene',
          start_frame: 0,
          duration_frames: 120,
          layout: 'split_image_text',
          animation: 'static',
          asset: { src: 'https://example.com/img.jpg', fit: 'contain' },
          overlays: [makeOverlay()],
        },
        makeScene('usp', { start_frame: 120 }),
        makeScene('cta', { start_frame: 210, layout: 'cta_card', animation: 'fade_in' }),
      ],
    };
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(true);
  });

  it('T3.E6 — schema_version !== "1.0" → reject', () => {
    const graph = makeValidGraph();
    (graph as any).schema_version = '2.0';
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('schema_version'))).toBe(true);
  });

  it('T3.E7 — meta.fps !== 30 → reject', () => {
    const graph = makeValidGraph({ fps: 60 } as any);
    (graph.meta as any).fps = 60;
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('fps'))).toBe(true);
  });

  it('T3.E8 — overlay position_y out of 0–1 range → reject', () => {
    const graph = makeValidGraph({}, [
      makeScene('hook', {
        overlays: [makeOverlay({ position_y: 1.5 })],
      }),
      makeScene('usp', { start_frame: 90 }),
      makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
    ]);
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('position_y'))).toBe(true);
  });

  it('T3.E9 — total_frames > 900 (> 30s) → reject', () => {
    const graph = makeValidGraph({ total_frames: 1000 });
    const result = validateSceneGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('total_frames') && e.includes('900'))).toBe(true);
  });

  it('T3.E10 — all 7 valid animation types pass through', () => {
    const validAnimations = ['pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'static', 'fade_in', 'wipe_left'];
    for (const animation of validAnimations) {
      const graph = makeValidGraph({}, [
        makeScene('hook', { animation }),
        makeScene('usp', { start_frame: 90 }),
        makeScene('cta', { start_frame: 180, layout: 'cta_card', animation: 'fade_in' }),
      ]);
      const result = validateSceneGraph(graph);
      expect(result.valid).toBe(true, `animation "${animation}" should be valid`);
    }
  });
});
