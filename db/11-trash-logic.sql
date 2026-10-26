-- Migration for Dashboard Delete/Trash Logic
-- Phase: 11

ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_deleted_at TIMESTAMPTZ;

ALTER TABLE public.renders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
