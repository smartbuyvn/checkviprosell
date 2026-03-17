# Viprosell â€” LEDGERS & IDEMPOTENCY

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## 1. Credit Ledger

### Purpose
Track every credit change with full audit trail. No direct balance column â€” balance is derived from ledger sum.

### Table: `credit_ledger`

| Column | Type | Description |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK â†’ auth.users |
| payment_id | uuid | FK â†’ payments (nullable, for purchases) |
| project_id | uuid | FK â†’ projects (nullable, for usage) |
| delta | integer | Positive = credit, negative = debit |
| reason | text | `plan_purchase`, `credit_pack`, `project_usage`, `refund`, `admin_adjustment` |
| balance_after | integer | Running balance after this entry |
| created_at | timestamptz | Timestamp |

### Balance Calculation

```sql
SELECT COALESCE(SUM(delta), 0) AS balance
FROM public.credit_ledger
WHERE user_id = $1;
```

Or use `balance_after` from the latest entry for performance.

### Rules
- Every credit change = 1 ledger entry
- No direct UPDATE to any "balance" column
- Refund = negative delta with `reason = 'refund'`
- Admin adjustment = entry with `reason = 'admin_adjustment'`

---

## 2. Payment Idempotency

### Mechanism
The `payments.idempotency_key` column is UNIQUE.

### Webhook Flow

```
1. Receive webhook
2. Extract idempotency_key (provider_txn_id or custom key)
3. SELECT FROM payments WHERE idempotency_key = $key
4. If exists AND status = 'paid':
   â†’ Return 200, no-op
5. If exists AND status = 'pending':
   â†’ Update to new status, process side effects
6. If not exists:
   â†’ INSERT payment, process side effects
```

### Side Effects (only on first successful processing)
- `paid` â†’ INSERT credit_ledger entry + update plan if subscription
- `paid` + referrer exists â†’ INSERT affiliate_events (status=`pending`)
- `refunded` â†’ INSERT negative credit_ledger entry + reject affiliate

### Guarantees
- âœ… No double credits on duplicate webhook
- âœ… No double affiliate commission
- âœ… No lost payment on first attempt failure (retry safe)
- âœ… Refund correctly reverses all side effects

---

## 3. Render Job Idempotency

### Mechanism
- Each render request creates a `renders` record with status=`queued`
- Render Worker picks up and transitions to `processing`
- Callback updates to `completed` or `failed`
- Duplicate callbacks for same render_id â†’ check current status, no-op if already terminal

### Terminal States
- `completed`, `failed`, `cancelled` â€” no further transitions allowed

---

## 4. Affiliate Commission Timing

```
Payment received (paid)
        â†“
affiliate_events created (status = pending)
        â†“
Chargeback window passes (configurable, e.g., 30 days)
        â†“
affiliate_events â†’ approved (commission available)
        â†“
Payout processed
        â†“
affiliate_events â†’ paid
```

If payment refunded during chargeback window:
```
affiliate_events â†’ rejected
```

---

## 5. AI Job Idempotency

- Each AI step logged in `usage_logs` with unique `trace_id`
- Duplicate callback for same `trace_id` + `step_name` â†’ no-op
- Credits deducted once per successful step completion
