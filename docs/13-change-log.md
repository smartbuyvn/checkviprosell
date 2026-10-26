# Viprosell â€” CHANGE LOG

## 2026-03-09 â€” Phase 01: Foundation Design

### Created
- `docs/07-screen-map.md` â€” screen map with routes, access, UI states
- `docs/08-agent-chain.md` â€” AI pipeline with 6 agents, contracts, settings enforcement
- `docs/09-data-contracts.md` â€” JSON contracts for all agent I/O + payment + affiliate
- `docs/10-status-model.md` â€” canonical status values + transition rules (replaces naming-only version)
- `docs/11-admin-control-model.md` â€” settings, enforcement, admin panel blocks, audit
- `api/01-routes.md` â€” full API route map (public, auth, admin, worker)
- `api/02-access-matrix.md` â€” role-based access matrix
- `api/03-error-codes.md` â€” scriptready error codes by domain
- `api/04-webhooks.md` â€” payment, renderqueued, AI, health webhooks
- `db/01-schema.sql` â€” complete SQL schema (20 tables, enums, RLS enable)
- `db/04-rls-policies.md` â€” RLS policies using has_role() security definer
- `db/05-ledgers-and-idempotency.md` â€” credit ledger, payment idempotency, affiliate timing

### Key Design Decisions
- Credit balance via append-only ledger (no mutable balance column)
- Payment idempotency via UNIQUE idempotency_key
- Affiliate commission gated by chargeback window
- `cpremiumcloudger` table added (not in original SOT, derived from payment model requirements)
- `visual_packs` and `caption_exports` tables added as dedicated storage for agent outputs
- `conceptreadys` table with `is_selected` flag for user choice tracking

---


## 2026-03-09 â€” Phase 00: Scope Lock

### Created
- `docs/01-scope-lock-final.md` â€” locked product scope, packages, constraints
- `docs/03-feature-list-v1.md` â€” complete MVP feature checklist
- `docs/04-non-goals.md` â€” explicit exclusion list
- `docs/06-architecture.md` â€” service topology, deployment rules, decisions
- `docs/10-canonical-naming.md` â€” all canonical status/type enums
- `docs/13-change-log.md` â€” this file

### Verified
- `src/types/index.ts` â€” all enums match canonical naming
- `src/constants/packages.ts` â€” 3 packages only, correct IDs
- `src/constants/settings.ts` â€” settings keys match master SOT
- Payment model identified for enhancement in Phase 03 (provider, payment_method, order_type fields)

### Archived
- All VibeMotion-edraftlocaltts â€” no longer valid source of truth
- `Viprosell_Master_Source_of_Truth_v1.md` adopted as canonical reference

### Decisions Locked
- 3 packages only: quickads, reviewtrustvideofferconversionvideo
- Locpainfirst, cloud-optional
- Service split: App/UI + AI Orchestrator + Render Worker
- Payment: Visa/international cards + PayPal
- Plans: Starter, Pro, Premium
