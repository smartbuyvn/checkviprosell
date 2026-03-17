# Viprosell v1.2 Local Setup Guide

Follow this guide to get the Viprosell local development stack running on a clean machine, respecting the current dual-brain Lovable + Fastify mock dependencies.

## 1. Prerequisites
- **Node.js** (v20+): Core runtime.
- **Docker & Docker Compose**: Required for Redis and Postgres databases.
- **Git**: For source control.

## 2. Environment Configuration
Copy `.env.example` to `.env` in the root of the project:
```bash
cp .env.example .env
```
**CRITICAL:** You must securely obtain a valid `LOVABLE_API_KEY` to successfully test the AI script generation, as the system relies on `api.gateway.lovable.dev` under the hood via Supabase edge functions.
**NOTE:** The backend relies on a remote Supabase project URL (`VITE_SUPABASE_URL`) for Auth & API routing. The local docker cluster only provides DB caching. The variable `VITE_SUPABASE_PROJECT_ID` has been explicitly audited and safely removed as it is entirely unused by the application source.

## 3. Database & Caching Initialization
Viprosell v1.2 requires local infrastructure prior to launching nodes.
```bash
docker-compose -f docker-compose.dev.yml up -d db redis
```

## 4. Install Dependencies
Install packages for both the root frontend and the nested Fastify backend:
```bash
npm install
cd backend && npm install
cd ..
```
*(Alternatively, you can run `npm run local:bootstrap` on Linux/Bash).*

## 5. Starting the Stack
The application uses a separated architecture. You must run both explicitly:

### A. Frontend (React/Vite)
Runs the dashboard and Lovable Auth routes on `http://localhost:5173`.
```bash
npm run dev
```

### B. Backend API (Fastify)
Runs the Fastify API orchestrator on `http://localhost:3001`. This node is responsible for catching Render Queue requests and mocking their status timeouts.
```bash
npm run backend:dev
```

### C. All-in-One Shortcut
Boot both concurrently across all operating systems (Windows/macOS/Linux) via:
```bash
npm run dev:all
```

## 6. Verification Steps
1. Navigate to `http://localhost:5173` and authenticate.
2. Verify the Fastify backend is listening manually via a health check:
   ```bash
   npm run local:health
   # Expected output: {"status":"ok","service":"viprosell-backend-v1.2"}
   # Note: This command uses a cross-platform Node script, replacing environment-specific `curl`.
   ```

## 7. Known Local Limitations (Blockers)
- **Render Execution:** Running `npm run worker:dev` is currently not physically wired to a shell FFmpeg abstraction. It will only mock the process. Do not expect `.mp4` files to emit to your host directory.
- **Payment Toggles:** Stripe webhooks exist in the API router but lack full front-end token capture. The frontend uses `CheckoutService` placeholders.
