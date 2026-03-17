# Viprosell v1.2 Deployment Environment Matrix

This document outlines every required environment variable across all operational boundaries for Viprosell v1.2, split by Local, Staging, and Production tiers.

## 1. Frontend Public Environment (.env)
These variables are bundled into the React/Vite application. They are public and safe to expose to the browser.

| Variable | Description | Local | Staging | Production |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase API URL | `https://[remote].supabase.co` | `https://[staging-ref].supabase.co` | `https://[prod-ref].supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Key | `ey...` (remote key) | `ey...` (staging key) | `ey...` (prod key) |
| `VITE_API_BASE_URL` | Fastify Backend URL | `http://localhost:3001` | `https://api.staging.viprosell.com` | `https://api.viprosell.com` |

## 2. Backend API Private Environment (backend/.env)
These are securely held by the Fastify orchestrator.

| Variable | Description | Local | Staging | Production |
|---|---|---|---|---|
| `API_PORT` | Fastify Listen Port | `3001` | `3001` | `3001` |
| `API_HOST` | Fastify Listen Host | `0.0.0.0` | `0.0.0.0` | `0.0.0.0` |
| `SUPABASE_URL` | Supabase API URL | `https://[remote].supabase.co` | `https://[staging-ref].supabase.co` | `https://[prod-ref].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin bypass key | `ey...` (remote) | `ey...` (staging) | `ey...` (prod) |
| `LOVABLE_API_KEY` | AI text completion key | `sk-...` (required) | `sk-...` | `sk-...` |

## 3. Queue & Worker Environment (backend/.env)
Used by the BullMQ processor daemons.

| Variable | Description | Local | Staging | Production |
|---|---|---|---|---|
| `REDIS_URL` | BullMQ Redis broker | `redis://localhost:6379` | `redis://:default_pass@redis:6379` (with auth) | `re...` |
| `FACEFUSION_API_URL` | Premium FaceFusion node | `http://localhost:7860/api` | `deferred_boundary_placeholder` | `http://gpu-worker-prod:7860/api` |

## 4. Payment Provider Integrations (backend/.env)
Secure secrets for receiving webhooks.

| Variable | Description | Local | Staging | Production |
|---|---|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe signatures | `whsec_mock` | `whsec_...` (test mode) | `whsec_...` (live mode) |
| `PAYPAL_WEBHOOK_ID` | Verifies PayPal signatures | `webhook_mock` | `WH-...` | `WH-...` |

## 5. Monitoring Environment (frontend & backend)

| Variable | Description | Local | Staging | Production |
|---|---|---|---|---|
| `VITE_SENTRY_DSN` | Frontend Trace (Public) | `""` (mock triggered) | `https://[public_key]@sentry.io/1` | `https://[public_key]@sentry.io/1` |
| `SENTRY_DSN` | Backend Trace (Private) | `""` | `https://[secret_key]@sentry.io/2` | `https://[secret_key]@sentry.io/2` |
| `ENV_NAME` | Sentry Env Tag | `local` | `staging` | `production` |

## 6. Supabase Admin Secrets
Configured inside Supabase dashboard or via `supabase secrets set`.
- `STRIPE_WEBHOOK_SECRET`: If edge functions handle webhooks.
- `LOVABLE_API_KEY`: If edge functions handle AI logic.

---

*Note: Staging is topologically aligned with Production boundary targets, but it is **not** runtime-equivalent. Staging currently runs heavily mocked bottlenecks (no physical FFmpeg binaries, no physical BullMQ processes, and Stripe webhooks structurally exist but are unverified).*
