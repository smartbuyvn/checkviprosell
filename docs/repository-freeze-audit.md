# Repository Freeze Audit Matrix

## A. Repo Truth Matrix

| Area | Verified in code | Verified by runtime evidence | Documented target only | Conflict level | Action now |
|---|---|---|---|---|---|
| **Product Scope Lock** | Yes (3 Packages strictly defined in DB/API) | Yes (Only quickads, review, conversion exist) | None | Zero | Keep |
| **Architecture Truth** | Yes (BullMQ + Redis FFmpeg local execution) | Yes (Code blocks cloud gateway natively) | SPA Rewrite | Resolved | Keep |
| **Runtime Truth** | Yes (`ai.worker.ts` & `render.worker.ts`) | Yes (FFmpeg OS exec calls physical) | None | Zero | Keep |
| **Billing Webhook** | Yes (Stripe SDK `constructEvent` in logic) | Yes (Idempotency bounces replay duals) | None | Zero | Keep |
| **Launch Pack** | Yes (Docs strictly reflect Fastify configs) | Frontend Upload | None | Setup Env | Keep |
| **Prompt Pack** | Yes (Refined intel/script prompts coded in) | None (Tied to local Ollama) | AI fallback | High (Old files) | Archived old templates |
| **Repo Docs** | Yes (Rewritten Truth vs Mismatch deltas) | N/A | None | Moderate (Root clutter) | Swept root legacy |
| **File Redundancy** | Resolved by Archival Sweep | Checked | None | Resolved | Cleaned |

## C. GO WITH CONSTRAINTS MATRIX

| Constraint | Affected area | Operator impact | Mitigation | Can still launch? |
|---|---|---|---|---|
| **Local FFmpeg Compute Limit** | Render Queue Speed | Hardware dependency; Cannot scale x10k users. | Scale CPU/GPU physically at local node. | **Yes** |
| **Stripe Hosted Sandbox** | Billing Checkouts | Operator must supply live Stripe Secret Keys. | Follow `stripe-production-checklist.md` precisely. | **Yes** |
| **Cloudflare Ingress Vulnerability**| Webhook API | If Tunnel drops, Stripe retries fail 72hrs. | Keep PC 24/7 online & Cloudflared active. | **Yes** |
| **SPA SEO Limitation** | Frontend Indexing | Shared host prevents robust Next.js SSR SEO. | Focus initial beta marketing on Paid Ads. | **Yes** |
