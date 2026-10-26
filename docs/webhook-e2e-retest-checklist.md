# Stripe Webhook E2E Retest Checklist

Execute via `Stripe CLI` configured directly terminating to your local proxy port `:3001/api/v1/webhooks/stripe`.

- [ ] **Simulate Success Flow**:
  - Run: `stripe trigger checkout.session.completed --add checkout_session:client_reference_id="USER-UUID" --add checkout_session:metadata:credits="500"`
  - **Verdict**: Database captures `paid` transaction, adds 500 ledgers.
- [ ] **Idempotence Replay Attack**:
  - Resend the exact event frame executed above structurally.
  - **Verdict**: Warning logs "[Webhook] Idempotency block". Credits remain 500, no dual inflation occurs.
- [ ] **Simulate Fraud Refund**:
  - Copy the generated `payment_intent.id` from the payload success.
  - Run: `stripe trigger charge.refunded --override charge:payment_intent="pi_XXXXXX"`
  - **Verdict**: System updates parent row to `refunded`, cascading to nullify `affiliate_events`.
- [ ] **Simulate Asynchronous Payment Failure**:
  - Run: `stripe trigger checkout.session.async_payment_failed`
  - **Verdict**: Database state cleanly tracks the node transition to `failed`.
