# Viprosell â€” WEBHOOKS

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## 1. Payment Webhook

**Endpoint:** `POST /api/webhooks/payment`  
**Source:** Stripe / PayPal  
**Auth:** Provider signature verification

### Payload (normalized)

```json
{
  "provider": "stripe|paypal",
  "event_type": "payment.completed|payment.failed|payment.refunded",
  "provider_txn_id": "string",
  "idempotency_key": "string",
  "amount": 0,
  "currency": "USD",
  "meta": {}
}
```

### Processing Rules

1. Verify provider signature
2. Check `idempotency_key` â€” if already processed, return 200 (no-op)
3. Update `payments.status` based on `event_type`
4. If `paid`:
   - Activate plan or add credits
   - Create `affiliate_events` record if referrer exists (status=`pending`)
5. If `refunded`:
   - Reverse credits/plan
   - Set related `affiliate_events` to `rejected`
6. Log in `admin_audit_logs`

### Idempotency

- Store processed `idempotency_key` values
- Duplicate calls with same key â†’ 200 with no side effects
- Never double-credit or double-commission

---

## 2. Render Callback

**Endpoint:** `POST /api/internal/render-callback`  
**Source:** Render Worker  
**Auth:** Internal signed token

### Payload

```json
{
  "render_job_id": "uuid",
  "status": "completed|failed",
  "output_url": "string|null",
  "error_code": "string|null",
  "error_message": "string|null",
  "duration_ms": 0
}
```

### Processing

1. Verify internal token
2. Update `renders` record
3. Update `project.status` to `completed` or `failed`
4. Log in `usage_logs`

---

## 3. AI Job Callback

**Endpoint:** `POST /api/internal/ai-job-callback`  
**Source:** AI Orchestrator  
**Auth:** Internal signed token

### Payload

```json
{
  "project_id": "uuid",
  "step_name": "product_intel|commerce_angle|script_compose|visual_pack|caption_export",
  "status": "completed|failed",
  "result": {},
  "error_code": "string|null",
  "error_message": "string|null"
}
```

---

## 4. Health Check

**Endpoint:** `POST /api/internal/health-check`  
**Source:** AI Orchestrator / Render Worker  
**Auth:** Internal signed token

### Payload

```json
{
  "service_name": "ai_orchestrator|render_worker",
  "service_url": "string",
  "status": "healthy|degraded|down",
  "response_time_ms": 0,
  "meta": {}
}
```
