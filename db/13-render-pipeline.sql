-- ============================================================
-- Viprosell — Migration 13: Unified Local Render Pipeline
-- Adds JSONB columns used by the 4-tier Local AI pipeline and
-- the Realtime render worker (render.worker.ts).
-- Defensive enum values so both schema.sql & 01-schema.sql variants work.
-- ============================================================

ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS raw_input JSONB;
ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS scene_graph_json JSONB;
ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS product_brief_json JSONB;
ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS strategy_json JSONB;
ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS render_plan_json JSONB;

-- render_status: 'pending' must exist (canonical: pending/processing/completed/failed)
ALTER TYPE public.render_status ADD VALUE IF NOT EXISTS 'pending';

-- render_mode: accept both legacy spellings used across schema files
ALTER TYPE public.render_mode ADD VALUE IF NOT EXISTS 'draftlocaltts';
ALTER TYPE public.render_mode ADD VALUE IF NOT EXISTS 'draft_local_tts';