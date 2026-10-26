-- Add 'pending' to render_status
ALTER TYPE public.render_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'queued';

-- Set default status to pending
ALTER TABLE public.renders ALTER COLUMN status SET DEFAULT 'pending';

-- Add progress column
ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS progress NUMERIC(5,2) DEFAULT 0;

-- Make project_id nullable
ALTER TABLE public.renders ALTER COLUMN project_id DROP NOT NULL;
