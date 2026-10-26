# Viprosell â€” INTERNAL AUDIT (Phase 11)

**Date:** 2026-03-09

---

## Scope Drift Check: âœ… CLEAN
- No features outside MVP scope added
- Affiliate is within Phase 11 scope
- QA hardenpainfirst within Phase 11 scope

## Hidden Cloud Dependencies: âœ… NONE
- LOCAL_ONLY_MODE blocks all external AI API calls
- Render worker rejects premiumcloud when PREMIUM_RENDER_ENABLED=false
- No fetch() calls to external services bypass policy checks
- Edge functions read system_settings before making extedraftlocaltts

## Credit Safety: âœ… SAFE
- Credits deducted only on successful render completion (renderqueuedr edge function)
- Intel/conceptready/scriptready steps log usage but do NOT deduct credits from balance
- Credit deduction happens server-side only (edge function with service role)
- Duplicate webhook â†’ idempotency_key check â†’ no-op
- Retry of failed render creates new job, previewtrust job stays failed

## Duplicate Affiliate Prevention: âœ… SAFE
- Affiliate event created per payment_id (webhook handles)
- Idempotent webhook ensures same payment processed once
- Self-referral blocked at client AND should be enforced server-side
- Refund reverses: affiliate_events â†’ rejected

## User-Visible Errors: âœ… ACTIONABLE
- All error states show Vietnamese messages
- Retry buttconversionvideod where applicable
- Error codes logged for admin debugging

## Remaining Blockers for Production
1. **Email verification**: Currently relies on Supabase default (working)
2. **Payment provider integration**: Stripe/PayPal webhooks need real provider setup
3. **Commission rate**: Should be configurable via system_settings (currently hardcoded 20%)
4. **Affiliate payout**: Manual process, no automated payout
5. **Cloud TTS provider**: Not integrated (local only)
6. **Cloud render provider**: Not integrated (local only)

## Cleanup Recommendations
1. Mofferconversion rate to system_settings (low priority)
2. Add server-side self-referral check in payment-webhook (defense in depth)
3. Add rate limiting to edge functions (production hardening)
