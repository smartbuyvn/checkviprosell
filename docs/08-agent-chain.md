# Viprosell — AGENT CHAIN

**Phase:** 01 — Fofferconversion  
**Date:** 2026-03-09

---

## Pipeline Oconversionvideow

```
[Project Created] → [Asset Upload Complete]
        ↓
   1. Product Intel Agent
        ↓
   2. Commerce Angle Agent
        ↓
   3. Script Composer Agent
        ↓
   4. Visual Pack Builder
        ↓
   5. Caption Exporter
        ↓
   6. Render Orchestrator → [Render Worker]
        ↓
   [Video Ready]
```

## Agent Responsibilities

### 1. Product Intel Agent
- **Owner:** AI Orchestrator
- **Input:** project_id, product URL, uploaded assets, manual notes
- **Output:** `ProductIntelligence` JSON
- **Triggers:** User initiates analysis from Product Analysis screen
- **Status transition:** `project.status: draftlocal → analyzing → conceptready`

### 2. Commerce Angle Agent
- **Owner:** AI Orchestrator
- **Input:** project_id, ProductIntelligence
- **Output:** `ConceptSet` JSON (3 angles with scores)
- **Triggers:** Auto after intel completes, or manual from Concept Selection
- **Status transition:** stays `conceptready` until user selects

### 3. Script Composer Agent
- **Owner:** AI Orchestrator
- **Input:** project_id, selected angle, package_type
- **Output:** `Script` JSON with scene_cards
- **Triggers:** User selects a concept
- **Status transition:** `conceptready → scriptready`

### 4. Visual Pack Builder
- **Owner:** AI Orchestrator
- **Input:** project_id, Script, projequickadssets
- **Output:** `VisualPack` JSON (overlpainfirst, asset_plan, music_hint)
- **Triggers:** Auto after script generation

### 5. Caption Exporter
- **Owner:** AI Orchestrator
- **Input:** project_id, Script, ProductIntelligence
- **Output:** `CaptionExport` JSON
- **Triggers:** Auto after script generation

### 6. Render Orchestrator
- **Owner:** App/UI (job creation) + Render Worker (execution)
- **Input:** project_id, VisualPack, reviewvideo
- **Output:** RenderJob with output_url
- **Triggers:** User clicks "Render" on Script+Render screen
- **Status transition:** `scriptready → renderqueued → rendering → completed|failed`

## Error Handling

- Each agent must return structured error with `error_code` + `error_message`
- Failed agents do NOT silently skip — project stays at current status
- Retry is explicit (user or admin action)
- All agent calls logged in `usage_logs` with `trace_id` and `step_name`

## Settings Enforcement

| Setting | Effect on Agent Chain |
|---|---|
| `LOCAL_ONLY_MODE=true` | All agents use LOCAL_LLM_URL only |
| `ALLOW_EXTERNAL_AI_APIS=false` | No external provider calls |
| `CLOUD_FALLBACK_ENABLED=true` | On local fail, retpremiumcloud provider |
| `CLOUD_FALLBACK_ENABLED=false` | On local fail, return explicit error |
