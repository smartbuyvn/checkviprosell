# A. TASK OWNERSHIP MATRIX

| Task | Repo-only or external | Antigravity can execute | Operator required | Dependencies | Blocking risk |
|---|---|---|---|---|---|
| **Harden Retry Queues** | Repo-only | **yes** (Done via `queue.ts`) | no | BullMQ / Redis | Low |
| **Add `rawBody` parser** | Repo-only | **yes** (Done via `webhooks.ts`) | no | Stripe SDK | Low |
| **Verify FFmpeg mock drops**| Repo-only | **yes** (Verified dead `render.service`) | no | `render.worker.ts` | Low |
| **Create Stripe Accounts** | External | no | **yes** | Business incorporation | **High (Blocker)** |
| **Config Live Stripe Keys** | Server-Level | no | **yes** | `backend/.env` secret injection | **High (Blocker)** |
| **Supabase Redirect Config** | External | no | **yes** | Supabase Auth Settings UI | **High (Blocker)** |
| **Frontend `npm build`** | Local Desktop| no | **yes** | Vite / NPM locally | Moderate |
| **Upload to Hostinger** | External | no | **yes** | hPanel File Manager -> `public_html`| **High (Blocker)** |
| **Boot Local Services** | Local Desktop| no | **yes** | Terminals (3 windows), Docker | **High (Blocker)** |
| **Set up API Tunneling** | Local Desktop| no | **yes** | Ngrok / Cloudflare Tunnel | **High (Blocker)** |
