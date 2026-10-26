# Live Ops Readiness

Trạng thái sẵn sàng cho Operations (Beta Release). Antigravity đã thẩm tra và khóa kín các nguy cơ tràn RAM/Queue và Leak doanh thu.

| Area | Current status | Evidence file | Action now | Done criteria |
|---|---|---|---|---|
| **Health Check Loadbalancer**| `verified` | `server.ts` | 503 Return | Cloudflare cuts traffic if Redis drops locally. |
| **Export Credit Leakage** | `verified` | `render.worker.ts`, `render.ts`| Patched | FFmpeg worker strictly signals `exported` to callback, firing strict -20 Credit deduction. |
| **Worker Retry Escalation** | `verified` | `queue.ts` | Hardened | Failed local generation delays 5s, 10s then kills gracefully instead of bootlooping hardware. |
| **Webhook Self-Referral** | `verified` | `webhooks.ts` | Blocked `id !== userId` | Fraud affiliations silently drop. No free credits. |
| **Unused Mock Vectors** | `verified` (Dead code) | `render.service.ts` | Ignored | Codebase routes correctly around it to Queue. |
| **Administrator Locks** | `verified` | `admin.ts`, `ai.service.ts`| Enforced | `LOCAL_ONLY_MODE` securely bypasses external token spends natively. |
