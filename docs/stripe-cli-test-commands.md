# Stripe CLI Testing Commands

Use the Official Stripe CLI tool mapping `localhost` to Stripe routing structures to violently attack the system locally and ensure production readiness.

## 1. Boot Local Listener
Starts forwarding events from your account to local Fastify:
```bash
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
```
*(Copy the `whsec_XXX` key emitted by this command into backend/.env as STRIPE_WEBHOOK_SECRET)*

## 2. Trigger Standard Paid Success
```bash
stripe trigger checkout.session.completed --add checkout_session:client_reference_id="USER-UUID" --add checkout_session:metadata:credits="500" --add checkout_session:metadata:package="pro"
```
**Expected Outcome**: User granted 500 Credits, Affiliate (if any) generated pending log, row status = 'paid'.

## 3. Trigger Duplicate Event (Idempotency Bomb)
Run the exact `stripe trigger` command above matching the intent.
**Expected Outcome**: Fastify terminal outputs `[Webhook] Idempotency block — already processed...`. No database mutations. Returns HTTP 200 to Stripe (stops future retries).

## 4. Trigger Refund (Rollback Test)
Must pass the specific Payment Intent ID manually intercepted from the SQL DB (`provider_txn_id` field):
```bash
stripe trigger charge.refunded --override charge:payment_intent="pi_3Qxxxxxxxxx"
```
**Expected Outcome**: Payment status mutates from `paid` to `refunded`. Affiliate commission transitions from `pending` to `rejected` instantly.

## 5. Trigger Async Payment Failure
```bash
stripe trigger checkout.session.async_payment_failed
```
**Expected Outcome**: Row transitions accurately to `failed` terminating processing.
