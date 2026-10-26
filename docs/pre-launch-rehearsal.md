# Pre-Launch Rehearsal: Architectural Gate Verification

## 1. Scope Constraint Gates
| Gate | Status | Evidence Verification |
|---|---|---|
| **3 Package Only** | Passed | Database & API `job-types.ts` strictly map `quickads`, `reviewvideo`, `conversionvideo`. Face-swap & Motion features blocked natively. |
| **Local-First** | Passed | Ollama (`ai.worker.ts`) and FFmpeg (`render.worker.ts`) explicitly compute on localhost. Zero cloud inference required. |
| **Cloud Optional** | Passed | Remote APIs are supported but locked behind `LOCAL_ONLY_MODE=true` toggle inside Admin panel. |
| **Asset-First** | Passed | Users must upload assets first. FFmpeg worker maps `project_assets` physically. |

## 2. Security & Policy Gates
| Gate | Status | Evidence Verification |
|---|---|---|
| **Billing Safe** | Passed | Real `stripe.webhooks.constructEvent()` verified in `webhooks.ts`. Mocks removed. Credit subtraction is delayed until `status='exported'` callback. |
| **Affiliate Safe**| Passed | Self-referral explicitly tested `referrer.id !== userId` before tracking commission. Deduped dedupe keys drop spam loops. |
| **Admin Enforced**| Passed | System variables bypass user attempts to hack payload variables. |
| **Logs & Retry** | Passed | BullMQ handles 3x exponential backoffs before giving up safely. Output spans log explicitly to CLI arrays. |
