# Viprosell â€” BILLING QA CHECKLIST
**Phase:** 12 â€” Launch Freeze
**Context:** Billing Summary Contract Canonical & Webhook Recon

## 1. Checkout & Payment Integrity
- [ ] **Case A1:** Trigger checkout session. Verify `payments` table creates row with `status='paid'`, `amount`, `currency`, `provider_txn_id`, and exact `plan_code` via `checkout.session.completed`. 
    - *Expected:* Row created. Credit granted if credit pack.
- [ ] **Case A2:** Trigger Stripe `charge.succeeded` event manually for same `payment_intent`.
    - *Expected:* Database record is enriched with `receipt_url` and `payment_method` WITHOUT duplicating the row.
- [ ] **Case A3:** Send an exact duplicate `checkout.session.completed` payload.
    - *Expected:* Handled by `idempotency_keys` block. 0 new rows. 0 new credits. 0 new affiliate commission.

## 2. Refund & Downgrade
- [ ] **Case B1:** Trigger `charge.refunded` webhook for a subscription payment.
    - *Expected:* Payment `status` changes from `paid` to `refunded`. Affiliate commission shifts to `rejected`.
- [ ] **Case B2:** Check UI `BillingSummary` payload after full refund.
    - *Expected:* `currentPlan` ignores the refunded transaction and falls back to `null` (Free) or the previous active subscription. No false entitlement allowed.

## 3. Data Exposure & Contract Shape
- [ ] **Case C1:** Retrieve `/api/billing/summary` via generic User JWT.
    - *Expected:* `invoices` array correctly mapped using `receipt_url` from enriched DB logic. If no receipt exists, array is strictly `[]`. NO fake data. `currentPlan` resolves package intelligently.
- [ ] **Case C2:** Multi-tenant leakage check.
    - *Expected:* User A token solely exposes User A's `payments` arrays.
