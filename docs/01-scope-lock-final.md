# Viprosell â€” SCOPE LOCK FINAL

**Status:** LOCKED  
**Version:** 1.0  
**Date:** 2026-03-09  
**Authority:** Viprosell_Master_Source_of_Truth_v1.md

---

## 1. Product Definition

Viprosell is a **focused SaaS web app** for short commerce video creation for online sellers.

**Input:** Product URL, 3â€“8 images, or 1 sample video (+ optional manual notes).  
**Output:** Draft 9:16 MP4 video + script + scene cards + overlay + subtitle + caption + hashtags + thumbnail text.

---

## 2. MVP Package Scope â€” LOCKED TO 3

| Package | Purpose | Duration | Output |
|---|---|---|---|
| `quickads` | Test sáº£n pháº©m nhanh trÃªn TikTok/Reels/Shorts | 15â€“20s | 1 script + 6 scene cards + overlay + caption + CTA |
| `reviewtrustvideo` | TÄƒng trust kiá»ƒu KOC/bestie/chá»§ shop | 20â€“30s | 3 hooks + 1 script + 6â€“8 scene cards + CTA má» m + caption |
| `offerconversionvideo` | Tá»‘i Æ°u chuyá»ƒn Ä‘á»•i: pain â†’ proof â†’ offer â†’ urgency | 20â€“30s | 3 hooks + 1 script + 6â€“8 scene cards + CTA trá»±c tiáº¿p + caption |

**No other packages are permitted in MVP.**

---

## 3. Architecture Constraints â€” LOCKED

| Constraint | Value |
|---|---|
| Default mode | locpainfirst |
| Cloud | optional fallback / premium only |
| Asset strategy | asset-first (real uploaded images/video) |
| Video generation | template assembly by default |
| Full text-to-video | NOT default flow |
| Service split | App/UI + AI Orchestrator + Render Worker |
| Single code blob | NOT permitted in staging/prod |

---

## 4. Payment Methods â€” LOCKED

| Method | Status |
|---|---|
| Visa / international cards | Required |
| PayPal | Required |
| Other | Not in MVP |

Payment rules:
- Checkout via single payment abstraction
- Webhook must be idempotent
- Credits/plan activation only after `payment.status = 'paid'`
- No affiliate commission before valid payment
- No double charge on retry

---

## 5. System Settings â€” LOCKED

| Key | Default | Description |
|---|---|---|
| `LOCAL_ONLY_MODE` | `true` | Block all external AI calls |
| `CLOUD_FALLBACK_ENABLED` | `false` | Allow cloud fallback on local failure |
| `PREMIUM_RENDER_ENABLED` | `false` | Show premium render options |
| `ALLOW_EXTERNAL_AI_APIS` | `false` | Allow external AI providers |
| `LOCAL_LLM_URL` | `http://localhost:11434` | Local LLM endpoint |
| `LOCAL_RENDER_WORKER_URL` | `http://localhost:5001` | Local renderqueuedr |
| `DEFAULT_TTS_MODE` | `local` | TTS mode |
| `MAX_ASSETS_PER_PROJECT` | `8` | Max assets per project |
| `DEFAULT_ASPECT_RATIO` | `9:16` | Default video ratio |

---

## 6. Enforcement Rules

1. `LOCAL_ONLY_MODE=true` â†’ all external AI calls BLOCKED at backend
2. `CLOUD_FALLBACK_ENABLED=false` â†’ local fail = explicit fail, no silent fallback
3. `PREMIUM_RENDER_ENABLED=false` â†’ premium options hidden from UI AND rejected at API
4. `ALLOW_EXTERNAL_AI_APIS=false` â†’ no external provider calls for AI/render/TTS
5. `CLOUD_FALLBACK_ENABLED=true` â†’ requires valid provider config before enabling

---

## 7. Plans â€” LOCKED

3 tiers: **Starter**, **Pro**, **Premium**  
Optional: credit packs for top-up outside main plan.

---

## 8. Core Screens â€” LOCKED

1. Landing
2. Auth (Login / Signup)
3. Dashboard
4. New Project Wizard (4-step)
5. Product Analysis
6. Cconceptreadylection
7. Script + Render
8. Billing
9. Affiliate Dashboard
10. Admin Settings

---

## 9. Source of Truth

This document and `Viprosell_Master_Source_of_Truth_v1.md` are the only valid references.  
All prior documents (VibeMotion, earlier drafts) are **ARCHIVED** and must not be used for implementation decisions.
