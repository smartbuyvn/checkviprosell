CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_unique ON public.payments (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_affiliate_code_unique ON public.profiles (affiliate_code) WHERE affiliate_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_events_payment_id_unique ON public.affiliate_events (payment_id) WHERE payment_id IS NOT NULL;