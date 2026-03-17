# Viprosell v1.2 QA Matrix & Test Cases

This document maps all execution combinatorics across packages, aspects, export modes, and explicit manual tests for QA hardening.

## 1. The Rendering Combinatorics Matrix

QA Engineers must verify all 18 permutations before a general release.

| Package | Aspect Ratio | Export Mode | FaceFusion | Complexity |
|---|---|---|---|---|
| Quick Ads | 9:16 | Simple Crop | False | Low |
| Quick Ads | 16:9 | Simple Crop | False | Low |
| Quick Ads | 1:1 | Simple Crop | False | Low |
| Quick Ads | 9:16 | Smart Pan | False | Mid |
| Quick Ads | 16:9 | Smart Pan | False | Mid |
| Quick Ads | 1:1 | Smart Pan | False | Mid |
| Review Video | 9:16 | Smart Pan | False | Mid |
| Review Video | 16:9 | Smart Pan | False | Mid |
| Review Video | 1:1 | Smart Pan | False | Mid |
| Review Video | 9:16 | Smart Pan | True | High |
| Review Video | 16:9 | Smart Pan | True | High |
| Review Video | 1:1 | Smart Pan | True | High |
| Conversion Video | 9:16 | Relayout | False | High |
| Conversion Video | 16:9 | Relayout | False | High |
| Conversion Video | 1:1 | Relayout | False | High |
| Conversion Video | 9:16 | Simple Crop | False | Mid |
| Conversion Video | 16:9 | Simple Crop | False | Mid |
| Conversion Video | 1:1 | Simple Crop | False | Mid |

## 2. Core Operational Tests (Manual)

### A. Authentication & Onboarding
- **[A-01]** Register a new account. Verify Supabase trigger creates `profiles` record.
- **[A-02]** Login successfully.
- **[A-03]** Verify Admin Account toggle (Requires direct SQL flip in `user_roles`). Validates settings page access.

### B. Wizard Input Validations
- **[B-01]** **Project Creation:** Start a new Quick Ad project. Verify default inputs.
- **[B-02]** **Shopee Link Input:** Provide a valid link. Assert the `Lovable_API` proxy correctly fetches title and price metadata.
- **[B-03]** **Image Upload:** Upload exactly 3 images. Verify proceed is allowed. Upload 9 images, verify blocked. Upload 1 image, verify blocked.
- **[B-04]** **Sample Video Upload:** Attempt uploading an mp4 side-car in the Review Video flow.

### C. Backend Pipeline Integrity
- **[C-01]** **AI JSON Validity:** Intercept the `POST /api/v1/ai/generate` request. Assert the returned `scene_graph` acts aspect-agnostic (no hardcoded dimensions).
- **[C-02]** **Compose Queue:** Verify Remotion hits `status: "processing"`.
- **[C-03]** **Render Queue:** Verify FFmpeg triggers and generates a valid MP4 container.
- **[C-04]** **Output Download:** Test downloading the final artifact from Supabase buckets.

### D. Billing & Admin Toggles
- **[D-01]** **Credit Deduction:** Check `credit_ledger` prior to render. Wait for `status: completed`. Verify exactly `1` credit was removed.
- **[D-02]** **Payment Flow:** Hit the `/api/v1/webhooks/stripe` with a mock signature. Assert credits jump according to mock payload.
- **[D-03]** **Affiliate Flow:** Register an account using `?ref=XYZ`. Trigger a mock payment for that user. Check `affiliate_events` for commissions.
- **[D-04]** **Admin Setting:** Toggle `PREMIUM_RENDER_ENABLED` to `false`. Ensure FaceFusion dropdowns disappear immediately from the wizard.

## 3. Catastrophic Failure Injections (Edge Cases)

Inject these failures intentionally on staging limits.

- **[F-01] Missing Assets:** Drop internet mid-upload. Verify UI gracefully halts and preserves existing progress.
- **[F-02] Invalid URL:** Submit a Facebook URL instead of Shopee. Assert scraping service throws a controlled 400 error.
- **[F-03] AI Malformed JSON:** Hardcode the AI response to return broken JSON `{ "scene_1":`. Verify Fastify catches, logs to Sentry, and alerts the user gracefully.
- **[F-04] Queue Timeout:** Pause the BullMQ Redis container physically. Submit a job. Wait 15 minutes. Verify the Frontend polls until explicitly handled timeout. Ensure **zero credits dropped**.
- **[F-05] FFmpeg Failure:** Inject an invalid flag into the worker shell executor (`-c:v broken_encoder`). Verify Job fails. Ensure **zero credits dropped**.
- **[F-06] FaceFusion Unavailable:** Stop the port 7860 container. Request a Premium Review Video. Verify gracefully falls back or halts the render.
- **[F-07] Duplicate Webhook:** Fire the exact same POST payload to the Stripe hook twice. Ensure Postgres `idempotency_key` rejects the second request (500/409) preventing double-crediting.
