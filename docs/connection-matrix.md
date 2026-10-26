# Connection Matrix

Hardware and process routing maps based exclusively on the locked `.env` and `package.json` specifications.

| Service | Exposes To | Target/Port | Protocol | Auth Boundary |
|---|---|---|---|---|
| **Vite SPA** (localhost:8080) | User Browser | `localhost:3001/api/v1` | REST (fetch) | Supabase JWT (Bearer) |
| **Vite SPA** (localhost:8080) | Supabase Engine | `localhost:54321` | REST (PostgREST) | `ANON_KEY` / RLS |
| **Fastify API** (localhost:3001) | Frontend / Webhooks | Exposed | REST | JWT / HMAC Signature |
| **Fastify API** (localhost:3001) | Redis Queue | `localhost:6379` | RESP (Redis) | None (Localnet) |
| **Fastify API** (localhost:3001) | Supabase Admin | `localhost:54321` | REST / DB | `SERVICE_ROLE_KEY` |
| **AI Worker** (Detached Process) | Fastify API | `localhost:6379` | RESP (Polling) | None |
| **AI Worker** (Detached Process) | Ollama Host | `localhost:11434` | REST | None (Local AI) |
| **Render Worker** (Detached Process) | Fastify API | `localhost:6379` | RESP (Polling) | None |

### Matrix Guardrails
- **Frontend** *never* communicates directly with `Redis` or `Workers`.
- **Workers** *never* expose an HTTP listener (they are pure polling consumers tied to memory queues).
- **Billing Webhooks** map from the Cloudflare Ingress directly to Fastify `:3001`, completely bypassing local UI state changes.
