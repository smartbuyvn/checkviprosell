# Phase 1 Test Plan — SceneGraph & QuickAds Template

## Scope
Test contract stability between:  
AI Layer (Gemini → JSON) ↔ Validator ↔ Remotion Template

**NOT in scope:** billing, auth, queue, face-replacement, production pipeline.

---

## Test Suite 1: Validator — Valid Input

### T1.1 — Valid Quick Ads 9:16 (5 scenes)
**Input:** `sample-scene-graph.quick-ads.json`  
**Expected:**
- `validation.valid === true`
- `validation.errors === []`
- `validation.data.meta.total_frames === 450`
- Last scene layout === `cta_card`

### T1.2 — Valid minimum (3 scenes)
**Input:** SceneGraph with exactly 3 scenes (hook + usp + cta_card), total 270 frames  
**Expected:**
- `valid === true`
- No errors

### T1.3 — Valid 1:1 aspect ratio
**Input:** Same product JSON but `meta.aspect_ratio = "1:1"`, `layout: "split_image_text"` used in some scenes  
**Expected:**
- `valid === true`
- Template renders at 1080×1080

### T1.4 — Missing optional fields (auto-normalized)
**Input:** Overlays without `entrance` or `delay_frames` fields  
**Expected:**
- `valid === true`
- `entrance` defaulted to `"fade_in"`
- `delay_frames` defaulted to `0`
- Warning (not error) logged

---

## Test Suite 2: Validator — Invalid Input → Must REJECT

### T2.1 — Invalid animation enum
**Input:** Scene with `animation: "particle_burst"`  
**Expected:**
- `valid === false`
- Error: `animation: "particle_burst" is not a valid AnimationType`
- No data returned

### T2.2 — Invalid layout enum
**Input:** Scene with `layout: "hero_banner"`  
**Expected:**
- `valid === false`
- Error: `layout: "hero_banner" is not a valid LayoutType`

### T2.3 — Missing required field: `scenes`
**Input:** `{ "schema_version": "1.0", "meta": {...} }` — no scenes array  
**Expected:**
- `valid === false`
- Error: `scenes: must be an array`

### T2.4 — Missing required field: `meta.brand_name`
**Input:** meta object without `brand_name`  
**Expected:**
- `valid === false`
- Error: `meta.brand_name: required non-empty string`

### T2.5 — Scene count out of range (< 3)
**Input:** Only 2 scenes  
**Expected:**
- `valid === false`
- Error: `scenes: must have 3–8 scenes, got 2`

### T2.6 — Scene count out of range (> 8)
**Input:** 9 scenes  
**Expected:**
- `valid === false`
- Error: `scenes: must have 3–8 scenes, got 9`

### T2.7 — duration_frames out of range
**Input:** Scene with `duration_frames: 200` (max is 150)  
**Expected:**
- `valid === false`
- Error: `duration_frames: must be 30–150`

### T2.8 — Overlay text exceeds limit for `headline`
**Input:** Overlay with `style: "headline"` and `text: "A".repeat(41)` (41 chars, max 40)  
**Expected:**
- `valid === false`
- Error: `exceeds max length for style="headline" (41 > 40 chars)`

### T2.9 — Overlay text exceeds limit for `badge`
**Input:** Overlay with `style: "badge"` and text of 21 chars  
**Expected:**
- `valid === false`
- Error: `exceeds max length for style="badge" (21 > 20 chars)`

### T2.10 — Overlay text exceeds limit for `cta`
**Input:** Overlay with `style: "cta"` and text of 26 chars  
**Expected:**
- `valid === false`
- Error: `exceeds max length for style="cta" (26 > 25 chars)`

### T2.11 — Invalid brand_color format
**Input:** `meta.brand_color: "red"` (not hex)  
**Expected:**
- `valid === true` (warning, not error — brand_color is optional)
- Warning: `brand_color: "red" is not a valid hex color. Will use default.`
- Normalized to `#FF4C61`

### T2.12 — total_frames out of valid range
**Input:** `meta.total_frames: 100` (less than 300 = 10s)  
**Expected:**
- `valid === false`
- Error: `meta.total_frames: must be 300–900`

### T2.13 — Null input
**Input:** `null`  
**Expected:**
- `valid === false`
- Error: `Root must be a JSON object`

### T2.14 — Empty JSON object
**Input:** `{}`  
**Expected:**
- `valid === false`
- Errors include: `schema_version`, `meta`

---

## Test Suite 3: Template Rendering — Remotion Preview

### T3.1 — Sample JSON renders in browser (9:16)
**Setup:** Load `VideoPreviewPlayer` in Vite dev server, pass sample-scene-graph.quick-ads.json  
**Expected:**
- Player renders at ~203×360 (preview scale)
- 5 scenes play sequentially at 30fps
- Text overlays visible with entrance animation
- Player controls work (play/pause/scrub)
- No React errors in console

### T3.2 — Same SceneGraph renders in 1:1
**Setup:** Change `meta.aspect_ratio` to `"1:1"` and pass to VideoPreviewPlayer  
**Expected:**
- Player renders at 1080×1080 composition (scaled to 360×360)
- Aspect ratio changes correctly
- Same scenes play correctly

### T3.3 — Invalid SceneGraph shows error UI (not crash)
**Setup:** Pass invalid SceneGraph (missing scenes) to `VideoPreviewPlayer`  
**Expected:**
- Error boundary UI shows validation errors
- No React crash
- No `undefined` errors

### T3.4 — All 5 scene layouts render without crash
**Setup:** Create a test JSON with one scene for each layout type:
  - `image_full`, `image_top_text_bottom`, `text_only`, `cta_card`, `split_image_text`  
**Expected:**
- Each scene renders without crash
- No missing asset errors

---

## Test Suite 4: AI Service (Manual E2E — Requires GEMINI_API_KEY)

### T4.1 — generateSceneGraph returns valid SceneGraph
**Setup:** Set `GEMINI_API_KEY` in backend `.env`. Run:  
```
npx tsx backend/src/services/scene-graph.service.ts
```
**Expected:**
- Console logs `✅ SceneGraph generated successfully`
- Output is valid JSON passing validator

### T4.2 — generateSceneGraph fails gracefully without API key
**Setup:** Unset `GEMINI_API_KEY`  
**Expected:**
- Error: `GEMINI_API_KEY is not configured`
- No crash, no unhandled exception

---

## How to Run Preview Locally

```bash
# Terminal 1: Start frontend dev server
cd d:\vidiosell
npm run dev

# Browser: http://localhost:8080
# Navigate to any page that mounts VideoPreviewPlayer with the sample JSON
```

**Quick smoke test:**
```typescript
// Add this temporarily to any existing page or create a quick test page:
import { VideoPreviewPlayer } from '../templates/VideoPreviewPlayer';
import sampleGraph from '../types/sample-scene-graph.quick-ads.json';

<VideoPreviewPlayer sceneGraph={sampleGraph as any} />
```

---

## What Remains for Phase 2

| Item | Status |
|------|--------|
| Gemini API key setup in production | ⬜ Not done |
| TTS integration (VoiceoverMode.TTS) | ⬜ Not done |
| Background music mixing | ⬜ Not done |
| Remotion Lambda serverless render | ⬜ Not done |
| Full video export flow (UI → Queue → Lambda) | ⬜ Not done |
| Multi-template (ReviewVideo, ConversionVideo) | ⬜ Not done |
| Shopee product image crawler | ⬜ Not done |
| Face replacement Premium lane (Fal.ai) | ⬜ Not done |
| `@google/genai` install in backend (`npm install @google/genai` in `/backend`) | ⬜ Pending |
| 16:9 template | ⬜ Skipped (Phase 2) |
