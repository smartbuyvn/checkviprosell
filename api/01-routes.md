# Viprosell â€” API ROUTES

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## Public

| Method | Route | Description |
|---|---|---|
| GET | `/api/settings/public` | Public system settings (feature flags) |
| GET | `/api/plans` | Available plans and pricing |

## Authenticated (User)

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register with email/password |
| POST | `/api/auth/login` | Login |
| GET | `/api/me` | Current user profile |
| POST | `/api/projects` | Create project |
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/:id` | Get project detail |
| POST | `/api/projects/:id/assets/upload` | Upload assets to project |
| POST | `/api/projects/:id/intel` | Trigger product intelligence |
| POST | `/api/projects/:id/concepts` | Generate commerce angles |
| POST | `/api/projects/:id/select-concept` | Select a concept |
| POST | `/api/projects/:id/scripts` | Generate script |
| POST | `/api/projects/:id/render` | Create render job |
| GET | `/api/renders/:id/status` | Check render status |
| POST | `/api/projects/:id/export` | Export final video |
| GET | `/api/affiliate/me` | Affiliate dashboard data |
| GET | `/api/billing/summary` | Billing summary & payment history |
| POST | `/api/billing/checkout` | Initiate checkout |
| GET | `/api/billing/credits` | Current credits balance |

## Admin Only

| Method | Route | Description |
|---|---|---|
| GET | `/api/settings/admin` | Full system settings |
| POST | `/api/settings/admin` | Update system settings |
| GET | `/api/admin/usage` | Usage dashboard data |
| GET | `/api/admin/logs/failed-jobs` | Failed jobs log |
| GET | `/api/admin/service-health` | Service health status |
| POST | `/api/admin/service-health/check` | Trigger health check |
| GET | `/api/prompts` | List prompts |
| POST | `/api/prompts` | Create/update prompt |
| GET | `/api/admin/audit-logs` | Admin audit log |

## Worker / Internal / Webhooks

| Method | Route | Description |
|---|---|---|
| POST | `/api/webhooks/payment` | Payment provider webhook |
| POST | `/api/internal/render-callback` | Render worker completion callback |
| POST | `/api/internal/health-check` | Service heartbeat |
| POST | `/api/internal/ai-job-callback` | AI orchestrator completion callback |
