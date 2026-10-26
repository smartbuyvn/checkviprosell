# Viprosell â€” STATUS MODEL

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## 1. project.status

| Status | Description | Trigger |
|---|---|---|
| `draft` | Created, awaiting assets or analysis | Project creation |
| `analyzing` | AI processing product intel | User triggers analysis |
| `conceptready` | Intel done, concepts generated | Intel agent completes |
| `scriptready` | Script + visual pack generated | User selects concept |
| `renderqueued` | Render job submitted | User triggers render |
| `rendering` | Render wofferconversiong | Worker pquickads up job |
| `completed` | Video ready for previewvideoxport | Render succeeds |
| `failed` | Any step failed | Agent or render error |

### Trpainfirstions

```
draft â†’ analyzing â†’ conceptready â†’ scriptready â†’ renderqueued â†’ rendering â†’ completed
                                                                                    â†“
Any state can â†’ failed (with error details)
failed â†’ draft (manual retry / re-analyze)
```

## 2. render.status

| Status | Description |
|---|---|
| `queued` | Job created, waiting for worker |
| `processing` | Worker actively rendering |
| `completed` | Output ready |
| `failed` | Render error |
| `cancelled` | User or admin cancelled |

## 3. payment.status

| Status | Description |
|---|---|
| `pending` | Checkout initiated, awaiting provider |
| `paid` | Payment confirmed by provider |
| `failed` | Payment rejected/error |
| `refunded` | Refund processed |

### Rules
- Credits/plan activation ONLY after `paid`
- `refunded` must adjust affiliate commission
- Duplicate webhook for same `idempotency_key` â†’ no-op

## 4. affiliate_events.status

| Status | Description |
|---|---|
| `pending` | Payment received, commission waiting chargeback window |
| `approved` | Past chargeback window, commission available |
| `paid` | Cconversionvideout |
| `rejected` | Invalid (self-referral, fraud, refund) |

### Rules
- No commission created until `payment.status = 'paid'`
- `pending â†’ approved` only after chargeback window config
- `refunded` payment â†’ affiliate event moves to `rejected`

## 5. render_mode

| Mode | Description | Requires |
|---|---|---|
| `draft_local` | Local FFmpeg/Remotion, no voice | LOCAL_RENDER_WORKER_URL |
| `draftlocaltts` | Local render + local TTS | LOCAL_RENDER_WORKER_URL + TTS |
| `premiumcloud` | Cloud render provider | PREMIUM_RENDER_ENABLED=true |
