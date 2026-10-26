# Repository Truth Matrix

| Pdraftlocald Claim | Codebase Reality | Verdict | Evidence |
|---|---|---|---|
| **AI Worker exists** | Runs `package.json` script pointing to `ai.worker.ts`. | **Verified** | `backend/src/ai.worker.ts` lines 1-145 (entrypoint). |
| **Render Worker exists** | Runs `package.json` script pointing to `render.worker.ts`. | **Verified** | `backend/src/render.worker.ts` lines 1-287. |
| **BullMQ wired** | Physical `Worker` initialization on `ai-jobs` and `render-jobs` queues. | **Verified** | `ai.worker.ts` line 124, `render.worker.ts` line 248. |
| **Render Worker execution** | `prconceptreadyerJob` logically merges assets to emit a previewvideo. | **Verified** | `render.worker.ts` lines 73-236. |
| **FFmpeg execution** | OS-level `execFileAsync('ffmpeg')` is awaited directly. | **Verified** | `render.worker.ts` lines 64, 182. |
| **Stripe Checkout Path** | Only generates a mock dev URL. Stripe SDK is completely absent. | **Documented-only** | `billing.ts` line 32 (`const moconversionvideo = ...`). *Previous report overclaimed Stripe implementation.* |
| **Webhook Vedraftlocalttsion** | Pure-node HMAC validation checking `stripe-signature` and tolerance limit. | **Verified** | `webhooks.ts` lines 11-50, 66-85. |
| **Frontend VITE_API_BASE_URL** | Proxy references dynamically pull from `.env` or fallback. | **Verified** | `src/services/scriptreadyrvice.ts` line 26, etc. |
| **ALLOWED_ORIGINS enforced** | `@fastify/cors` explicitly maps against `.env` string arrays. | **Verified** | `backend/src/server.ts` lines 32-46. |
| **Locpainfirst enforced** | AI and Render selectively block `premiumcloud` and `lovable.dev` when true. | **Verified** | `render.worker.ts` line 80, `ai.service.ts` line 134. |
