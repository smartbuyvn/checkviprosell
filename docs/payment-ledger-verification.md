# Payment Ledger Verification Truth

Ledger accuracy defines business survivability. The following rules confirm absolute truth against the database layers following Payment Intents:

## 1. Credit Ledger Rules (`payments` & `profiles`)
- Credits are parsed natively off the Checkout Session Metadata (`session.metadata.credits`).
- Credits only hit the actual user bound inside `session.client_reference_id`.
- The `provider_txn_id` captures exact correlation via `stripe.payment_intent.id` instead of locking rigidly only to Checkout Sessions. This guarantees a refund sweep works flawlessly. For transactions without an intent, it falls back to `idempotencyKey` natively.

## 2. Affiliate Rollback Sweep
- Payout models inherently operate asynchronously.
- Event `charge.refunded` sweeps the database where `provider_txn_id == charge.payment_intent`.
- Fastify surgically updates `affiliate_events.status` to `'rejected'` along with the tag `reason: payment_refunded_reversal`. This ensures end-of-month reconciliations natively disregard chargebacked accounts completely automatically.
