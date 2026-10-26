# C. OPERATOR ACTION MATRIX

| Action | Exact console/dashboard location | Secret or access required | Expected result | Verification method |
|---|---|---|---|---|
| **Establish API Tunnel** | Local CMD: `cloudflared tunnel run` | Internet Connection | `https://api.vidiosell.vn` points to localhost:3001 | Browse `https://api.../health` yields 200 OK. |
| **CORS Whitelist Domain** | Local File: `backend/.env` | No | Hostinger domain allowed. | React Network Tab shows complete 200 fetch. |
| **Create Stripe Prices** | Stripe Dashboard -> Product Catalog | No | Prices generate `price_1234` IDs. | Copying IDs into `.env` unlocks checkout form. |
| **Stripe Webhook Auth** | Stripe Dashboard -> Webhooks | `whsec_XXXX` | Fastify accepts incoming payment calls. | Post-checkout returns DB status = `paid`. |
| **Authorize Hostinger UI**| Supabase Dashboard -> Auth -> URL Config | No | OAuth links back to exact UI correctly. | React Session succeeds globally. |
| **Elevate to Admin Role** | Supabase DB -> Table Editor -> `profiles`| Project Password | Grants User Account UI Wrench Tools. | Sidebar populates with internal settings UI. |
