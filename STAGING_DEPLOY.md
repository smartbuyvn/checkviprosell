# Viprosell v1.2 Staging Deployment Guide

This document defines the exact topology, environment ownership, and rollout commands for the `api.staging.viprosell.com` boundary.

**CRITICAL DISCLAIMER:** Staging currently deploys a *mocked architecture*. The Redis queue, Fastify worker, and Webhook receivers are operational in memory but do *not* execute physical BullMQ tasks, do *not* invoke system FFmpeg, and do *not* verify Stripe/PayPal crypto signatures. Do not treat Staging as Production ready.

## 1. Exact Staging Topology

### Frontend (Static Edge)
- **Host:** Vercel, Netlify, or AWS CloudFront/S3
- **Domain:** `staging.viprosell.com` (or `viprosell-staging.vercel.app`)
- **Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` (points to `https://api.staging.viprosell.com`)

### Backend Orchestrator & Mocks (Virtual Machine)
- **Host:** Dedicated Linux VM (e.g., DigitalOcean Droplet, AWS EC2, Hetzner)
- **Domain:** `api.staging.viprosell.com`
- **Container Strategy:** Defined in `docker-compose.staging.yml`
- **Units:**
  - `api` (Port 3001): Fastify Node Orchestrator receiving `/api/v1/*`
  - `mock-worker` (Internal): Fastify Node Daemon simulating render execution timeouts
  - `redis` (Port 6379): BullMQ Message Broker (Currently idle/mocked in code)
  - `nginx` (Port 80/443): Reverse Proxy terminating SSL and routing to `api`

### Database & Auth (SaaS)
- **Host:** Supabase Cloud (Staging Project Reference)
- **URL:** `https://[staging-ref].supabase.co`

## 2. Exact Environment Ownership

To deploy staging, you must securely create `.env.staging.backend` on the virtual machine alongside the `docker-compose.staging.yml`.

**`backend/.env.staging.backend` (Strictly Private)**
```env
NODE_ENV="staging"
API_PORT="3001"
API_HOST="0.0.0.0"

# --- Remote Supabase Map ---
SUPABASE_URL="https://[staging-ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="ey[staging-admin-key]"

# --- AI Integration ---
LOVABLE_API_KEY="sk-[production-capable-key]"

# --- Mocked Internal State ---
REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="staging_mock_pass"

# --- Mocked Webhooks ---
STRIPE_WEBHOOK_SECRET="whsec_staging_test_mode"
PAYPAL_WEBHOOK_ID="WH-staging_test_mode"

# --- Monitoring ---
SENTRY_DSN="https://[staging_backend_key]@sentry.io/123"
```

## 3. Explicit Blockers (Not Production Ready)
- **Mocked Queue:** Backend instances do not use Redis pub/sub. Memory will leak/wipe internally.
- **Mocked Render Engine:** `worker.ts` simulates async completion delays via Javascript. No NVENC bindings.
- **Incomplete Webhooks:** The Stripe/PayPal listener parses objects but blindly returns HTTP 200s. No signature cryptographic integrity check is implemented to stop credit injection fraud.

## 4. Exact Service Start Order & Deployment
Execute these exact commands on the remote Linux Virtual Machine.

```bash
# 1. Pull latest repository
git pull origin main

# 2. Ensure environment exists
cat backend/.env.staging.backend

# 3. Mount the staging composition natively (Installs and runs inside node:20-alpine)
docker-compose -f docker-compose.staging.yml up -d

# 4. Verify mock worker is actively looping
docker logs vidiosell-mock-worker-1 -f
```

## 5. Exact Healthcheck Commands

Once Nginx is up, ping external ingress:

```bash
# 1. Test Nginx -> Fastify Pass-through
curl -s http://api.staging.viprosell.com/health
# Expected: {"status":"ok","service":"viprosell-backend-v1.2"}

# 2. Test Reverse Proxy Ingress
curl -s http://api.staging.viprosell.com/nginx-health
# Expected: healthy
```

## 6. Exact Rollback Steps

If Staging API crashes immediately or environment variables corrupt:

```bash
# 1. Stop all staging containers
docker-compose -f docker-compose.staging.yml down

# 2. Revert Git state
git checkout HEAD~1

# 3. Restart and force recreate (forcing `npm install` to re-eval)
docker-compose -f docker-compose.staging.yml up -d --force-recreate

# 4. Flush mock Redis queue data (optional, resets BullMQ caches)
docker exec -it vidiosell-redis-1 sh -c "redis-cli -a \"\${REDIS_PASSWORD:-staging_mock_pass}\" FLUSHALL"
```
