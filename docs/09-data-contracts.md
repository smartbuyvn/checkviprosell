# Viprosell â€” DATA CONTRACTS

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## 1. ProductIntelligence

```json
{
  "project_id": "uuid",
  "product_name": "string",
  "category": "beauty|fashion|home|other",
  "target_buyer": "string",
  "price_band": "low|mid|high",
  "usp_list": ["string"],
  "pain_points": ["string"],
  "objections": ["string"],
  "trust_signals": ["string"],
  "use_context": ["string"],
  "recommended_package_fit": ["quickads|reviewvideo|conversionvideo"],
  "confidence_score": 0.0
}
```

## 2. ConceptReady

```json
{
  "project_id": "uuid",
  "angles": [
    {
      "angle_type": "painfirst|reviewtrust|offerconversion",
      "title": "string",
      "big_idea": "string",
      "hook": "string",
      "cta": "string",
      "why_it_works": "string",
      "score": 0.0
    }
  ],
  "best_angle_type": "string"
}
```

## 3. Script

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "package_type": "quickads|reviewvideo|conversionvideo",
  "duration_sec": 20,
  "script_text": "string",
  "scene_cards": [
    {
      "scene_no": 1,
      "duration_sec": 3,
      "visual_instruction": "string",
      "overlay_text": "string",
      "voice_line": "string"
    }
  ],
  "cta": "string"
}
```

## 4. VisualPack

```json
{
  "project_id": "uuid",
  "render_mode": "draft_local|draftlocaltts|premiumcloud",
  "aspect_ratio": "9:16",
  "subtitle_text": "string",
  "overlay_list": [
    {
      "start_sec": 0,
      "end_sec": 3,
      "text": "string",
      "style": "headline|price|badge|cta"
    }
  ],
  "asset_plan": [
    {
      "asset_type": "image|video",
      "source_ref": "string",
      "scene_no": 1
    }
  ],
  "music_hint": "string"
}
```

## 5. CaptionExport

```json
{
  "project_id": "uuid",
  "caption_tiktok": "string",
  "caption_reels": "string",
  "hashtags": ["string"],
  "thumbnail_text": "string",
  "short_description": "string"
}
```

## 6. RenderJob

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "render_mode": "draft_local|draftlocaltts|premiumcloud",
  "status": "queued|processing|completed|failed|cancelled",
  "provider": "string|null",
  "output_url": "string|null",
  "error_code": "string|null",
  "error_message": "string|null",
  "last_fail_reason": "string|null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

## 7. Payment

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "provider": "stripe|paypal",
  "payment_method": "visa|mastercard|paypal",
  "provider_txn_id": "string",
  "order_type": "plan_subscription|credit_pack",
  "plan_code": "string|null",
  "credit_pack_code": "string|null",
  "amount": 0,
  "currency": "USD",
  "status": "pending|paid|failed|refunded",
  "idempotency_key": "string",
  "meta": {},
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

## 8. AffiliateEvent

```json
{
  "id": "uuid",
  "referrer_id": "uuid",
  "referred_id": "uuid",
  "status": "pending|approved|paid|rejected",
  "commission_amount": 0,
  "meta": {},
  "created_at": "timestamp"
}
```
