# Implementation Ledger

### 1. Verified in code
- The explicit 3-Package wizard constraints (`Quick Ads`, `Review`, `Conversion`).
- Auth Flow routing (Supabase JWT decoupled from proxy).
- Webhook deduplication and strict anti-fraud commission processing.
- Detached Background Workers (`worker:ai`, `worker:render`) tied directly to `BullMQ`.
- FFmpeg OS-level `execFileAsync` orchestration path.
- Strong Node-internal Stripe HMAC validation (`stripe-signature`).
- Cross-origin proxy boundaries enforced by `VITE_API_BASE_URL` and `ALLOWED_ORIGINS`.
- Local-first lockdown parameters blocking external cloud LLMs natively.

### 2. Documented but not implemented
- Stripe SDK Checkout Intent formulation (`POST /checkout` mock).
- `public/.htaccess` SPA fallback routing for Hostinger deployments.
- Exact Remotion React templates (Code exists for worker queue execution natively, but compositional TSX manifest bounds have not been formally audited).

### 3. Implemented but undocumented
- Developer mock logic explicitly granting Dev URLs on checkout click.

### 4. Conflicted
- *None detected within the core operational matrix.*

### 5. Out of scope
- Live production Payment gateway SDK bindings outside beta phase.
- Leaderboards, Sub-affiliate networking.
- Cloud-hosted generation rendering.
