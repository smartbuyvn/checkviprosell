# Stripe Webhook Runtime Truth

## 1. RawBody Capture Safety
Node.js/Fastify environments notoriously mutate incoming payload streams out of the box when applying default JSON parsers (`JSON.parse` trims encodings, whitespaces). This is lethal for Stripe's `constructEvent` HMAC verification.
To solve this locally without global mutation:
- A custom `addContentTypeParser('application/json', { parseAs: 'string' })` is hooked strictly inside the `webhookRoutes` closure.
- It attaches `request.rawBody = body` preventing destructive parsing across other endpoints (`/ai`, `/render`) while fulfilling Stripe SDK payload prerequisites.

## 2. Replay Immunity
Multiple concurrent or replayed Stripe signals fall under hard bounds:
- **Ledger/DB Level**: PostgreSQL `idempotency_keys` table holds a unique constraint mapped permanently via `session.id`. Any replay attempts yield error `23505 (Unique Violation)` and Fastify gracefully returns `200 { received: true, idempotent_stop: true }` so Stripe halts retries without polluting user credits.
- **Affiliate Level**: `referrer_userId_paymentId_direct_recurring` constraint drops dual triggers natively without throwing global runtime crashes.

## 3. Webhook Event Rejection Logging
- **Missing Secrets**: Throws explicit runtime log `[Webhook] STRIPE_WEBHOOK_SECRET not set — bypassing`.
- **Bad HMAC Mismatch**: Trapped effectively returning `400 Webhook signature invalid: No signatures found matching the expected signature for payload`.
