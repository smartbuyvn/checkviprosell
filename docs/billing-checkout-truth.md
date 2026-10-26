# Billing Checkout Truth

## Architecture Update Phase
The mocked Checkout API (`cs_test_randomUUID()`) has been permanently extracted and replaced by a highly rigid **Stripe SDK** flow.

## 1. Plan-to-Price Mapping
Instead of manipulating base amounts purely via backend arrays, Stripe physical Price IDs now dictate exact cart value. The `server` isolates Stripe logic directly.
- **`basic`** = `process.env.STRIPE_PRICE_ID_BASIC`
- **`pro`** = `process.env.STRIPE_PRICE_ID_PRO`
- **`premium`** = `process.env.STRIPE_PRICE_ID_PREMIUM`

## 2. Frontend Contract
- **Request**: `POST /api/v1/billing/checkout` sending `{ packageId, successUrl, cancelUrl }`.
- **Response API**: `{ url: "https://checkout.stripe.com/..." }`
- **Rejection Cases**:
  - `400`: Price ID not found in env (operator failure).
  - `500`: `STRIPE_SECRET_KEY` is completely missing.
  - `401`: Token parsing failure.

## 3. Webhook Fulfillment (Unchanged)
The existing webhook perfectly handles `checkout.session.completed` because it natively parses `session.client_reference_id` (userId) and `session.metadata.credits`, assigning them strictly to the database while enforcing local table anti-collision (Idempotency). No duplicate side effects enter the system.
