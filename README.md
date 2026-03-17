# Viprosell v1.2

AI-powered short commerce video creation platform for online sellers. Upload product images, get scroll-stopping TikTok/Reels/Shorts ads.
**Assets-first, template-driven, AI-assisted.**

## Current Repository Reality (Dual-Brain Architecture)
Viprosell v1.2 relies on a transitional dual-brain architecture that developers must respect when spinning up boundaries:

1. **Frontend & Auth (React + Vite):** 
   - Powered by `@lovable.dev/cloud-auth-js` overriding standard Supabase sessions for Google sign-in.
2. **AI Layer (Deno Edge Functions):** 
   - Housed in `supabase/functions/` and directly utilizes `api.gateway.lovable.dev` to generate aspect-agnostic Scene Graph JSONs.
3. **Composition & Encode Layer (Fastify Node Mocks):** 
   - `backend/src/server.ts` handles `/api/v1/render` requests.
   - *Note:* Currently, BullMQ and FFmpeg executions are natively mocked via Javascript timeouts (`mockEncodeDb`). Physical MP4s are not compiled.

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend API:** Node.js 20+ + Fastify (Mock Render States)
- **AI & DB Functions:** Supabase Deno Edge Functions + Lovable Gateway
- **Queue / Caching:** Redis 7 (Configured, but Mocked in Logic)

## Setup Instructions
Please refer to `LOCAL_SETUP.md` for exact local machine bootstrap procedures bridging the Lovable integrations with the Fastify API.

## Supported Developer Scripts (`package.json`)
- `npm run dev`: Boots the Vite frontend.
- `npm run backend:dev`: Boots the Fastify Node Mock Orchestrator.
- `npm run dev:all`: Boots both the frontend and Fastify locally.
- `npm run verify`: Runs standard build, lint, and vitest sweeps.
