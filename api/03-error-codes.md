# Viprosell â€” ERROR CODES

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## Format

```json
{
  "error": true,
  "code": "ERR_CODE",
  "message": "Human-readable message",
  "details": {}
}
```

## Auth Errors

| Code | HTTP | Description |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTH_NOT_AUTHENTICATED` | 401 | No valid session |
| `AUTH_FORBIDDEN` | 403 | Insufficient role |
| `AUTH_EMAIL_TAKEN` | 409 | Email already registered |

## Project Errors

| Code | HTTP | Description |
|---|---|---|
| `PROJECT_NOT_FOUND` | 404 | Project does not exist |
| `PROJECT_NOT_OWNER` | 403 | User is not project owner |
| `PROJECT_INVALID_STATUS` | 400 | Action not allowed in current status |
| `PROJECT_MAX_ASSETS` | 400 | Exceeded MAX_ASSETS_PER_PROJECT |
| `PROJECT_INVALID_PACKAGE` | 400 | Unknown package_type |

## AI / Intel Errors

| Code | HTTP | Description |
|---|---|---|
| `INTEL_SERVICE_UNAVAILABLE` | 503 | Local LLM not reachable |
| `INTEL_PARSE_FAILED` | 422 | AI response not valid JSON |
| `INTEL_EXTERNAL_BLOCKED` | 403 | External AI blocked by LOCAL_ONLY_MODE |
| `INTEL_TIMEOUT` | 504 | AI request timed out |

## Render Errors

| Code | HTTP | Description |
|---|---|---|
| `RENDER_SERVICE_UNAVAILABLE` | 503 | Render worker not reachable |
| `RENDER_PREMIUM_DISABLED` | 403 | Premium render not enabled |
| `RENDER_JOB_FAILED` | 500 | Render execution failed |
| `RENDER_NOT_FOUND` | 404 | Render job not found |

## Billing Errors

| Code | HTTP | Description |
|---|---|---|
| `BILLING_INSUFFICIENT_CREDITS` | 402 | Not enough credits |
| `BILLING_PLAN_NOT_FOUND` | 404 | Plan does not exist |
| `BILLING_CHECKOUT_FAILED` | 500 | Checkout creation failed |
| `BILLING_WEBHOOK_DUPLICATE` | 200 | Idempotent duplicate (no-op) |
| `BILLING_PAYMENT_FAILED` | 400 | Payment rejected by provider |

## Settings Errors

| Code | HTTP | Description |
|---|---|---|
| `SETTINGS_CONTRADICTION` | 400 | Contradictory setting combination |
| `SETTINGS_ADMIN_ONLY` | 403 | Non-admin tried to update settings |

## System Errors

| Code | HTTP | Description |
|---|---|---|
| `SYSTEM_INTERNAL_ERROR` | 500 | Unexpected server error |
| `SYSTEM_RATE_LIMITED` | 429 | Too many requests |
| `SYSTEM_MAINTENANCE` | 503 | System under maintenance |
