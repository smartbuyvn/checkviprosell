-- Migration: Billing Backfill script for fixing incorrect metadata and legacy order_type
-- Date: 2026-04-02
-- Purpose: Rectify old checkout sessions that stored subscription plans under 'credit_pack' 
--          and move them functionally to 'plan_subscription' so `currentPlan` derivation works.

-- 1. Rectify legacy 'starter', 'pro', 'premium' being stored incorrectly
UPDATE public.payments 
SET 
  order_type = 'plan_subscription',
  plan_code = credit_pack_code,
  credit_pack_code = NULL
WHERE order_type = 'credit_pack'
  AND credit_pack_code IN ('starter', 'pro', 'premium');

-- NOTES ON MANUAL BACKFILLS:
-- - receipt_url: Cannot be trivially backfilled because Stripe only provides it via the charge API,
--                which is not retrievable without external sync script via Stripe CLI. Keep NULL for legacy data.
-- - invoice_url: Same as above.
-- - payment_method: May be partially inferable from meta, but safest to leave NULL unless parsed explicitly via script.
