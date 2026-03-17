# Viprosell â€” ARCHITECTURE DECISIONS

**Status:** LOCKED  
**Date:** 2026-03-09

---

## 1. Service Topology

```
[ Client Browser ]
        |
        v
[ App/UI Service ]
  - Auth, Dashboard, Billing
  - Affiliate, Admin UI
  - Project CRUD
  - API gateway / route guards
        |
        +-------------------+
        |                   |
        v                   v
[ AI Orchestrator ]    [ Render Worker ]
  - Product Intel        - FFmpeg/Remotion
  - Commerce Angle       - Subtitle burn-in
  - Script Composer      - Overlay/CTA assembly
  - Caption Exporter     - Preview/export
  - JSON validation      - Render callbacks
        |                   |
        +--------+----------+
                 |
                 v
        [ Supabase / DB / Storage ]
```

## 2. Deployment Rules

| Rule | Detail |
|---|---|
| App/UI | Cloud-hosted for stable auth, dashboard, billing |
| AI Orchestrator | Local-first / self-hosted preferred |
| Render Worker | Local-first / self-hosted preferred |
| Co-located deployment | Allowed (same physical server) |
| Single code blob | NOT allowed â€” must be 3 separate processes |
| Render in UI runtime | NOT allowed |
| Business policy client-only | NOT allowed |

## 3. Local-First Decision

- Default: all AI + render runs locally
- Cloud is fallback/premium only, never a silent dependency
- App must complete full workflow with `LOCAL_ONLY_MODE=true`
- No hidden external API calls

## 4. Cloud-Optional Decision

- Cloud providers configurable by admin
- `CLOUD_FALLBACK_ENABLED` controls fallback behavior
- `PREMIUM_RENDER_ENABLED` controls premium cloud render
- Provider config must be valid before cloud features activate
- All cloud features gated at both UI and API level

## 5. Payment Architecture

- Single payment abstraction for plans + credit packs
- Providers: Visa/international cards + PayPal
- Idempotent webhooks (idempotency_key on every payment)
- Credits/plan activation only after `status = 'paid'`
- Affiliate commission gated by valid payment + chargeback window
- No double charge on retry

## 6. Queue & Callback Model

- All AI and render jobs tracked via job records with explicit status
- Render Worker sends internal callbacks (not UI polling)
- Web app reads status via standardized API
- Failed jobs must have: error_code, error_message, last_fail_reason
- Retry policy defined per job type

## 7. Database

Supabase for: auth, database, storage, webhooks.

Core tables:
- users, user_roles, plans
- projects, project_assets
- product_intelligence, concepts, scripts
- renders, payments, affiliate_events
- usage_logs, prompts
- system_settings, service_health_logs, admin_audit_logs

## 8. Access Matrix

| Route | Guest | User | Admin | Worker |
|---|---|---|---|---|
| Public (settings, plans) | âœ“ | âœ“ | âœ“ | âœ— |
| Auth | âœ“ | âœ“ | âœ“ | âœ— |
| Projects/assets/render | âœ— | Own | Audit | âœ— |
| Affiliate | âœ— | Own | Audit | âœ— |
| Billing | âœ— | Own | Audit | âœ— |
| Admin settings/logs | âœ— | âœ— | âœ“ | âœ— |
| Internal callbacks | âœ— | âœ— | âœ— | âœ“ (signed) |
