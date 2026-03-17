# Viprosell â€” QA TEST MATRIX

**Phase:** 11 â€” Affiliate + QA Hardening  
**Date:** 2026-03-09

---

## 1. Package Test Matrix

| Test Case | quick_ads | review_video | conversion_video |
|---|---|---|---|
| URL only input | â˜ | â˜ | â˜ |
| 3 images | â˜ | â˜ | â˜ |
| 8 images | â˜ | â˜ | â˜ |
| 1 sample video | â˜ | â˜ | â˜ |
| Mixed assets (img+vid) | â˜ | â˜ | â˜ |

---

## 2. Render Mode Matrix

| Test Case | Expected Result |
|---|---|
| Local only (LOCAL_ONLY_MODE=true) | Renders locally, no cloud calls |
| Local with local voice (draft_local_tts) | Renders with TTS, no cloud calls |
| Local fail + cloud disabled | Explicit failure message, no cloud fallback |
| Local fail + cloud fallback enabled | Falls back to cloud provider |
| Premium cloud disabled | Option hidden in UI, rejected at API |

---

## 3. Role-Based Access Matrix

| Feature | Guest | User | Admin | Affiliate Referrer |
|---|---|---|---|---|
| View landing/pricing | âœ… | âœ… | âœ… | âœ… |
| Create project | âŒ | âœ… | âœ… | âœ… |
| View own projects | âŒ | âœ… | âœ… | âœ… |
| View all projects | âŒ | âŒ | âœ… | âŒ |
| Admin settings | âŒ | âŒ | âœ… | âŒ |
| Affiliate dashboard | âŒ | âœ… | âœ… | âœ… |
| View own commissions | âŒ | âœ… | âœ… | âœ… |
| View all commissions | âŒ | âŒ | âœ… | âŒ |

---

## 4. Credit & Payment Safety

| Test Case | Expected Result |
|---|---|
| Successful render | Credits deducted once |
| Failed render retry | No duplicate deduction |
| Duplicate webhook (same idempotency_key) | No-op, 200 response |
| Payment â†’ affiliate event | Single commission event created |
| Self-referral attempt | Blocked with error message |
| Refund after payment | Credits reversed, affiliate rejected |
| Failed intel/concept/script step | No credit deduction |

---

## 5. UI State Coverage

| Screen | Loading | Empty | Error | Retry |
|---|---|---|---|---|
| Dashboard | âœ… | âœ… | â˜ | â˜ |
| Product Analysis | âœ… | âœ… | âœ… | âœ… |
| Concept Selection | âœ… | âœ… | âœ… | âœ… |
| Script & Render | âœ… | âœ… | âœ… | âœ… |
| Affiliate | âœ… | âœ… | âœ… | âœ… |
| Billing | âœ… | âœ… | â˜ | â˜ |
| Admin Settings | âœ… | âœ… | âœ… | âœ… |

---

## 6. Affiliate Flow

| Test Case | Expected Result |
|---|---|
| Generate affiliate code | Unique code created, persisted in profiles |
| Copy referral link | URL includes ?ref=CODE |
| Signup with ?ref=CODE | referred_by saved on profile |
| Self-referral (own code) | Blocked: "KhÃ´ng thá»ƒ tá»± giá»›i thiá»‡u" |
| Duplicate affiliate event (same payment) | Blocked by idempotency |
| Referrer views commissions | Only own events visible |
| Admin views all commissions | All events visible |
| Refund reverses commission | Event status â†’ rejected |

---

## 7. Structured Logging Checklist

| Component | trace_id | step_name | error_code | credits_used |
|---|---|---|---|---|
| Product Intel | âœ… | product_intel | âœ… | âœ… |
| Commerce Concepts | âœ… | commerce_concepts | âœ… | âœ… |
| Script Composer | âœ… | script_composer | âœ… | âœ… |
| Render Worker | âœ… | render_create / render_complete | âœ… | âœ… |
| Payment Webhook | âœ… (idempotency_key) | webhook.* | N/A | N/A |

---

## 8. Audit Guard Summary

### âœ… Verified
- No business logic in UI page components (all via services)
- No direct database queries in pages (all via service layer)
- Roles enforced via `has_role()` security definer function
- RLS policies on all tables (RESTRICTIVE)
- Credit ledger is append-only
- Payment webhook is idempotent
- Affiliate events protected against duplicates
- LOCAL_ONLY_MODE enforced in render-worker and admin-settings
- No hidden cloud dependencies when LOCAL_ONLY_MODE=true
- All settings changes create audit logs

### âš  Known Limitations (Accepted for Beta)
- Premium cloud render: placeholder only (not implemented)
- Cloud fallback: policy enforced but no cloud provider integrated yet
- TTS: local browser SpeechSynthesis only (no cloud TTS provider)
- Affiliate payout: manual process (no automated payout system)
- Commission rate: hardcoded 20% (should be configurable via system_settings)

### ðŸš« No Scope Creep
- No post-MVP features added
- No social auth
- No real-time collaboration
- No video editor
- No template marketplace
