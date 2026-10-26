# Stripe Webhook E2E Truth

## Core Execution Flow
The `POST /api/v1/webhooks/stripe` endpoint consumes events entirely isolated from the frontend runtime. It now uses the robust, physical `stripe.webhooks.constructEvent()` abstraction preventing pure-Node signature inaccuracies. Mocks via crypto-timing hooks have been excised.

## Idempotency Engine
- Transactions map to the global `idempotency_keys` dictionary targeting Stripe's native `session.id` or `payment_intent.id`.
- Duplicate Stripe Delivery retries will cleanly bounce via PostgreSQL Unique Constraint (`23505`) skipping the credit-grant loop safely without corrupting ledger logs.
- `affiliate_events` duplicate bounds leverage a custom composite identifier (`referrerId_userId_paymentId_direct_recurring`) resolving edge conditions unconditionally.

## Event Subscriptions
- `checkout.session.completed`: Evaluates only if `status === paid`, provisions credits, maps intent ID natively, and logs `pending` payouts to an affiliated referrer.
- `checkout.session.async_payment_failed`: Marks tracking as `failed` immediately.
- `charge.refunded`: Triggers exact DB sweeps dropping the parent sequence (`refunded`) and aggressively killing tethered affiliations (`status=rejected`).

### Disclaimer
This system relies inherently on `STRIPE_WEBHOOK_SECRET` provided at startup. Operating with a blank credential invokes an insecure bypass intended exclusively for local Dev-UX verification testing.
