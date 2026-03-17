# Viprosell â€” CANONICAL NAMING TABLE

**Status:** LOCKED  
**Date:** 2026-03-09

---

## package_type
```
quick_ads | review_video | conversion_video
```

## project.status
```
draft | analyzing | concept_ready | script_ready | render_queued | rendering | completed | failed
```

## render.status
```
queued | processing | completed | failed | cancelled
```

## render_mode
```
draft_local | draft_local_tts | premium_cloud
```

## payment.status
```
pending | paid | failed | refunded
```

## affiliate_events.status
```
pending | approved | paid | rejected
```

## user_role
```
guest | user | admin
```

## product_category
```
beauty | fashion | home | other
```

## price_band
```
low | mid | high
```

## angle_type
```
pain_first | review_trust | offer_conversion
```

## overlay_style
```
headline | price | badge | cta
```

## review_persona
```
bestie | koc | shop_owner | soft_expert
```

## tts_mode
```
local | cloud
```

## aspect_ratio
```
9:16 | 16:9 | 1:1
```

## System Setting Keys
```
LOCAL_ONLY_MODE (boolean)
CLOUD_FALLBACK_ENABLED (boolean)
PREMIUM_RENDER_ENABLED (boolean)
ALLOW_EXTERNAL_AI_APIS (boolean)
LOCAL_LLM_URL (string)
LOCAL_RENDER_WORKER_URL (string)
DEFAULT_TTS_MODE (tts_mode)
MAX_ASSETS_PER_PROJECT (number)
DEFAULT_ASPECT_RATIO (aspect_ratio)
```
