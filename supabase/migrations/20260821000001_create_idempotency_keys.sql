-- Idempotency keys table for webhook deduplication
-- Used by Stripe and SePay webhooks to prevent duplicate processing

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/select (webhooks use service role key)
CREATE POLICY "Service role full access" ON public.idempotency_keys 
  FOR ALL TO authenticated 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for cleanup of old keys (optional, run via cron)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at 
  ON public.idempotency_keys (created_at);