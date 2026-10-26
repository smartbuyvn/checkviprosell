# Viprosell — BILLING RUNBOOK
**Scope:** Webhook Recon (SePay / Lemon Squeezy), Billing Summary, Backfills

## Incident: Duplicate Webhook Events (Double Charge / Double Credits)
**Symptom:** User complains they were granted credits multiple times for one transaction.
**Diagnosis:** Idempotency failure on `checkout.session.completed`.
**Action:** 
1. Check `idempotency_keys` table for `session.id`.
2. Delete duplicate `payments` rows based on exact `provider_txn_id` and timestamp.
3. Use manual ledger CLI/script to revert excess credits granted in `credit_ledger`.

## Incident: Missing Receipt / Invoice URL on Frontend
**Symptom:** Payment is paid, plan activated, but UI shows no invoice button.
**Diagnosis:** The `charge.succeeded` or equivalent webhook from payOS/Lemon Squeezy either didn't fire, arrived before the session checkout was parsed, or was silenced.
**Action:**
1. Wait 5 minutes for webhook retry.
2. If unresolved, check SePay Dashboard or Lemon Squeezy Merchant portal for the transaction payload.
3. Manually map via SQL: `UPDATE payments SET receipt_url = 'url_here' WHERE provider_txn_id = 'pi_xxx'`.

## Incident: Legacy Purchases Display as Free Plan (CurrentPlan Failure)
**Symptom:** A user who purchased 'starter' in development phase shows 'Free' on Dashboard.
**Diagnosis:** The purchase was created under `credit_pack` order_type before the Webhook structural migration.
**Action:**
1. Execute `db/05-backfill-billing.sql` to rectify `order_type`.
2. Wait 1 min for UI to refresh cache. 

## Incident: Refund Processed but UI shows Paid Package
**Symptom:** User cancels and refunds but the billing app gives them Pro benefits.
**Diagnosis:** The database `status` remains `'paid'` because `charge.refunded` webhook was missed. 
**Action:**
1. Locate payment via Email / ID. 
2. Change `status` to `'refunded'`. The UI's summary endpoint will instantly evict the plan in the next payload.
