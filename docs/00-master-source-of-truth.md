# Viprosell â€” MASTER SOURCE OF TRUTH V1

## 0. Má»¥c Ä‘Ã­ch tÃ i liá»‡u
TÃ i liá»‡u nÃ y lÃ  báº£n mÃ´ táº£ thá»‘ng nháº¥t duy nháº¥t Ä‘á»ƒ Lovable triá»ƒn khai Viprosell theo Ä‘Ãºng trÃ¬nh tá»±, Ä‘Ãºng scope vÃ  Ä‘Ãºng cÃ¡c rÃ ng buá»™c kiáº¿n trÃºc Ä‘Ã£ chá»‘t.
Má»i tÃ i liá»‡u cÅ© chá»‰ cÃ²n giÃ¡ trá»‹ tham chiáº¿u hoáº·c archive náº¿u cÃ³ ná»™i dung mÃ¢u thuáº«n vá»›i tÃ i liá»‡u nÃ y.

---

## 1. Executive lock

### 1.1 TuyÃªn bá»‘ chá»‘t
Viprosell lÃ  web app SaaS táº¡o video bÃ¡n hÃ ng ngáº¯n cho seller/shop online tá»« link sáº£n pháº©m, 3â€“8 áº£nh hoáº·c 1 video máº«u.
MVP chá»‰ cÃ³ 3 package:
- `quick_ads`
- `review_video`
- `conversion_video`

### 1.2 North Star
1. Viprosell lÃ  cÃ´ng cá»¥ táº¡o video bÃ¡n hÃ ng ngáº¯n, khÃ´ng pháº£i ná»n táº£ng AI video Ä‘a nÄƒng.
2. AI lÃ m pháº§n â€œnÃ£oâ€: product intelligence, commerce angle, script, caption, subtitle, CTA, scene plan.
3. Video Ä‘áº§u ra máº·c Ä‘á»‹nh pháº£i dá»±ng tá»« asset tháº­t: áº£nh sáº£n pháº©m, video máº«u, text overlay, nháº¡c, CTA.
4. Cloud lÃ  tÃ¹y chá»n, khÃ´ng pháº£i Ä‘iá»u kiá»‡n báº¯t buá»™c Ä‘á»ƒ app cháº¡y.
5. Má»i tÃ­nh nÄƒng má»›i pháº£i tráº£ lá»i Ä‘Æ°á»£c cÃ¢u há»i: nÃ³ cÃ³ giÃºp seller táº¡o video bÃ¡n hÃ ng nhanh hÆ¡n, ráº» hÆ¡n, dá»… hÆ¡n khÃ´ng?

### 1.3 Nhá»¯ng gÃ¬ khÃ´ng thuá»™c MVP
KhÃ´ng build trong MVP:
- WordPress plugin
- motion clone
- AI dancing
- virtual try-on
- face swap
- full avatar presenter
- full text-to-video máº·c Ä‘á»‹nh
- trend hunter phá»©c táº¡p
- batch 10â€“50 video
- LiveFlow core

---

## 2. Quyáº¿t Ä‘á»‹nh bá»• sung má»›i nháº¥t

### 2.1 Thanh toÃ¡n
Giáº£i phÃ¡p thanh toÃ¡n chÃ­nh thá»©c cho beta vÃ  v1 lÃ  thanh toÃ¡n trá»±c tuyáº¿n trá»±c tiáº¿p báº±ng:
- tháº» ngÃ¢n hÃ ng quá»‘c táº¿ Visa hoáº·c tÆ°Æ¡ng Ä‘Æ°Æ¡ng
- PayPal

Trong UI pricing vÃ  checkout pháº£i cÃ³ thumbnail/icon tÆ°Æ¡ng á»©ng vá»›i phÆ°Æ¡ng thá»©c thanh toÃ¡n kháº£ dá»¥ng cá»§a tá»«ng gÃ³i Viprosell.
KhÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ payment UI lÃ  text khÃ´; pháº£i cÃ³ vÃ¹ng hiá»ƒn thá»‹ trá»±c quan cho logo/thumbnails cá»§a Visa-compatible cards vÃ  PayPal.

Quy táº¯c triá»ƒn khai payment:
- checkout cho plan vÃ  credit pack Ä‘i qua má»™t payment abstraction duy nháº¥t
- webhook payment pháº£i idempotent
- chá»‰ cá»™ng credits hoáº·c kÃ­ch hoáº¡t plan sau khi payment Ä‘Æ°á»£c xÃ¡c nháº­n thÃ nh cÃ´ng
- khÃ´ng táº¡o commission affiliate náº¿u thanh toÃ¡n chÆ°a paid há»£p lá»‡
- retry webhook khÃ´ng Ä‘Æ°á»£c gÃ¢y double charge hoáº·c double commission

### 2.2 Kiáº¿n trÃºc local stack
Quyáº¿t Ä‘á»‹nh chÃ­nh thá»©c cho production khÃ´ng dÃ¹ng kiáº¿n trÃºc all-in-one nhÆ° máº·c Ä‘á»‹nh, mÃ  dÃ¹ng kiáº¿n trÃºc tÃ¡ch lá»›p theo 3 khá»‘i váº­n hÃ nh chÃ­nh:
1. App/UI service
2. AI Orchestrator service
3. Render Worker service

LÃ½ do:
- phÃ¹ há»£p vá»›i hÆ°á»›ng hybrid local + cloud Ä‘Ã£ chá»‘t
- tÃ¡ch rÃµ UI/business flow vá»›i AI orchestration vÃ  video assembly
- dá»… scale, dá»… debug, dá»… thay worker, dá»… cÃ´ láº­p lá»—i queue/render
- giáº£m rá»§i ro Lovable trá»™n business logic vÃ o UI hoáº·c trá»™n render logic vÃ o web app

Quy Æ°á»›c mÃ´i trÆ°á»ng:
- dev mode: cÃ³ thá»ƒ cháº¡y all-in-one trÃªn 1 mÃ¡y Ä‘á»ƒ test nhanh
- staging/prod chuáº©n: váº«n giá»¯ tÃ¡ch service logic, dÃ¹ cÃ³ thá»ƒ cÃ¹ng náº±m trÃªn 1 server váº­t lÃ½ giai Ä‘oáº¡n Ä‘áº§u
- nghÄ©a lÃ  â€œco-located deploymentâ€ Ä‘Æ°á»£c phÃ©p, nhÆ°ng â€œsingle code blobâ€ thÃ¬ khÃ´ng Ä‘Æ°á»£c phÃ©p

### 2.3 Káº¿t luáº­n lá»±a chá»n kiáº¿n trÃºc
MÃ´ hÃ¬nh Ä‘Ãºng cho Viprosell lÃ :
- App/UI: cloud experience á»•n Ä‘á»‹nh cho auth, dashboard, billing, storage orchestration
- AI Orchestrator: local-first, xá»­ lÃ½ product intel, angle, script, caption, subtitle, JSON agents
- Render Worker: local-first cho FFmpeg/Remotion render draft 9:16, subtitle, overlay, CTA, preview/export
- Cloud: chá»‰ lÃ  fallback hoáº·c premium, khÃ´ng lÃ  dependency máº·c Ä‘á»‹nh cá»§a core flow

---

## 3. Product definition

### 3.1 Ba gÃ³i sáº£n pháº©m
| Package | Má»¥c tiÃªu | Input | Output |
|---|---|---|---|
| `quick_ads` | Test sáº£n pháº©m nhanh | Link sáº£n pháº©m hoáº·c 3â€“8 áº£nh | Video 15â€“20s + hook + overlay + caption + CTA |
| `review_video` | TÄƒng trust nhÆ° KOC/chá»§ shop | áº¢nh/video máº«u + persona review | Video 20â€“30s + script review + overlay + caption |
| `conversion_video` | Äáº©y chuyá»ƒn Ä‘á»•i | Link/áº£nh + pain point + offer | Video 20â€“30s + script conversion + CTA máº¡nh + caption |

### 3.2 Äáº§u vÃ o há»£p lá»‡
- product URL
- 3â€“8 áº£nh
- 1 video máº«u
- mixed images + video
- manual notes há»— trá»£ cho AI parse

### 3.3 Äáº§u ra cá»‘t lÃµi
- video 9:16 draft MP4
- preview video
- script
- scene cards
- overlay list
- subtitle
- caption TikTok/Reels
- hashtags
- thumbnail text

---

## 4. Kiáº¿n trÃºc há»‡ thá»‘ng chá»‘t

### 4.1 Service topology
```text
[ Client Web / Mobile Browser ]
           |
           v
[ App/UI Service ]
  - Auth
  - Dashboard
  - Billing
  - Affiliate
  - Project CRUD
  - Admin UI
  - API gateway / route guards
           |
           +----------------------+
           |                      |
           v                      v
[ AI Orchestrator ]         [ Render Worker ]
  - Product Intel             - FFmpeg/Remotion render
  - Commerce Angle            - subtitle burn-in
  - Script Composer           - overlay/CTA assembly
  - Caption Exporter          - preview/export
  - JSON validation           - render callbacks
           |                      |
           +----------+-----------+
                      |
                      v
              [ Supabase / DB / Storage / Queue / Webhooks ]
```

### 4.2 Quy táº¯c deploy
- App/UI cÃ³ thá»ƒ cháº¡y cloud Ä‘á»ƒ á»•n Ä‘á»‹nh auth, storage, billing vÃ  dashboard.
- AI Orchestrator Æ°u tiÃªn local/self-host.
- Render Worker Æ°u tiÃªn local/self-host.
- Náº¿u giai Ä‘oáº¡n Ä‘áº§u chá»‰ cÃ³ 1 mÃ¡y chá»§ váº­t lÃ½, váº«n pháº£i tÃ¡ch thÃ nh 3 process/service Ä‘á»™c láº­p: web app, orchestrator, render worker.
- KhÃ´ng Ä‘Æ°á»£c nhÃºng render engine trá»±c tiáº¿p vÃ o UI runtime.
- KhÃ´ng Ä‘Æ°á»£c Ä‘áº·t business policy cá»‘t lÃµi chá»‰ á»Ÿ client-side.

### 4.3 Queue vÃ  callback
- Má»i job AI vÃ  render pháº£i Ä‘i qua job record cÃ³ status rÃµ rÃ ng.
- Render Worker tráº£ callback ná»™i bá»™ thay vÃ¬ web app polling trá»±c tiáº¿p worker báº±ng logic ráº£i rÃ¡c trong UI.
- Web app chá»‰ Ä‘á»c tráº¡ng thÃ¡i qua API chuáº©n hÃ³a.
- Failed jobs pháº£i cÃ³ log, error_code, error_message, fail_reason gáº§n nháº¥t vÃ  retry policy.

---

## 5. Admin control model

### 5.1 Vai trÃ² admin
Admin khÃ´ng pháº£i chá»‰ lÃ  trang Settings; admin lÃ  trung tÃ¢m Ä‘iá»u phá»‘i policy cho:
- AI mode
- render mode
- external API permission
- local service health
- prompt management
- usage/cost visibility
- incident handling
- rollback readiness

### 5.2 System settings báº¯t buá»™c
```json
{
  "LOCAL_ONLY_MODE": true,
  "CLOUD_FALLBACK_ENABLED": false,
  "PREMIUM_RENDER_ENABLED": false,
  "ALLOW_EXTERNAL_AI_APIS": false,
  "LOCAL_LLM_URL": "http://localhost:11434",
  "LOCAL_RENDER_WORKER_URL": "http://localhost:5001",
  "DEFAULT_TTS_MODE": "local",
  "MAX_ASSETS_PER_PROJECT": 8,
  "DEFAULT_ASPECT_RATIO": "9:16"
}
```

### 5.3 Khá»‘i admin báº¯t buá»™c cÃ³
1. AI policy
   - `LOCAL_ONLY_MODE`
   - `CLOUD_FALLBACK_ENABLED`
   - `PREMIUM_RENDER_ENABLED`
   - `ALLOW_EXTERNAL_AI_APIS`
2. Local services
   - `LOCAL_LLM_URL`
   - `LOCAL_RENDER_WORKER_URL`
   - `DEFAULT_TTS_MODE`
   - health check
   - last heartbeat
   - status
   - fail reason gáº§n nháº¥t
3. Cloud providers
   - provider config
   - credential status
   - allowed features
   - cost policy
   - rate limit policy
4. Prompt control
   - system
   - category
   - package
   - campaign
   - safety
   - version
   - active flag
5. Audit/Ops
   - failed jobs log
   - usage dashboard
   - structured logs
   - retry policy
   - runbook
   - rollback plan
6. Access control
   - access matrix public/authenticated/admin-only/worker-only

### 5.4 State rules báº¯t buá»™c
- Náº¿u `LOCAL_ONLY_MODE=true` thÃ¬ má»i external AI call pháº£i bá»‹ cháº·n á»Ÿ backend.
- Náº¿u `CLOUD_FALLBACK_ENABLED=false` thÃ¬ local fail pháº£i fail rÃµ rÃ ng, khÃ´ng fallback ngáº§m.
- Náº¿u `PREMIUM_RENDER_ENABLED=false` thÃ¬ premium option bá»‹ áº©n khá»i UI vÃ  bá»‹ reject á»Ÿ API layer.
- Náº¿u `ALLOW_EXTERNAL_AI_APIS=false` thÃ¬ khÃ´ng provider ngoÃ i nÃ o Ä‘Æ°á»£c gá»i cho AI/render/TTS ngoÃ i local services Ä‘Ã£ khai bÃ¡o.
- Náº¿u `CLOUD_FALLBACK_ENABLED=true` thÃ¬ báº¯t buá»™c pháº£i cÃ³ provider config há»£p lá»‡ trÆ°á»›c khi báº­t.

### 5.5 Validation mÃ¢u thuáº«n cáº¥u hÃ¬nh
- `LOCAL_ONLY_MODE=true` => `ALLOW_EXTERNAL_AI_APIS=false`
- `CLOUD_FALLBACK_ENABLED=true` => pháº£i cÃ³ provider config, credential status=valid
- `PREMIUM_RENDER_ENABLED=true` vÃ  `ALLOW_EXTERNAL_AI_APIS=false` => chá»‰ cho premium local features, khÃ´ng cho premium cloud routes
- setting thay Ä‘á»•i pháº£i Ä‘Æ°á»£c audit log Ä‘áº§y Ä‘á»§ vá»›i actor, timestamp, old_value, new_value

---

## 6. Pricing, plans vÃ  payment UX

### 6.1 Plans
CÃ¡c plan hiá»ƒn thá»‹ theo 3 cáº¥p:
- Starter
- Pro
- Premium

NgoÃ i ra cÃ³ thá»ƒ cÃ³ credit packs náº¿u muá»‘n náº¡p thÃªm credits ngoÃ i plan chÃ­nh.

### 6.2 Payment methods hiá»ƒn thá»‹
Pricing page vÃ  checkout page pháº£i hiá»ƒn thá»‹ thumbnail/icon cho:
- Visa
- Mastercard hoáº·c tháº» quá»‘c táº¿ tÆ°Æ¡ng Ä‘Æ°Æ¡ng
- PayPal

Náº¿u má»™t gÃ³i chá»‰ cho má»™t sá»‘ payment methods nháº¥t Ä‘á»‹nh, UI pháº£i hiá»ƒn thá»‹ Ä‘Ãºng methods Ä‘Æ°á»£c phÃ©p ngay dÆ°á»›i CTA cá»§a gÃ³i Ä‘Ã³.

### 6.3 Quy táº¯c UI payment
- Má»—i card gÃ³i cÃ³ CTA rÃµ rÃ ng: â€œMua gÃ³iâ€ hoáº·c â€œNÃ¢ng cáº¥pâ€.
- Ngay dÆ°á»›i CTA pháº£i cÃ³ vÃ¹ng payment badges/thumbnails.
- Checkout modal/page pháº£i láº·p láº¡i selected plan, benefits, sá»‘ credits hoáº·c tÃ­nh nÄƒng tÆ°Æ¡ng á»©ng.
- KhÃ´ng cho phÃ©p user vÃ o bÆ°á»›c xÃ¡c nháº­n thanh toÃ¡n mÃ  khÃ´ng biáº¿t mÃ¬nh Ä‘ang mua gÃ³i nÃ o.
- Billing history pháº£i lÆ°u payment_method, provider_txn_id, status, amount, currency, plan_code hoáº·c credit_pack_code.

### 6.4 Báº£ng dá»¯ liá»‡u cáº§n cÃ³ cho payment
Cáº§n bá»• sung báº£ng `payments` tá»‘i thiá»ƒu:
- `id`
- `user_id`
- `provider`
- `payment_method`
- `provider_txn_id`
- `order_type` (`plan_subscription|credit_pack`)
- `plan_code`
- `credit_pack_code`
- `amount`
- `currency`
- `status`
- `idempotency_key`
- `meta`
- `created_at`
- `updated_at`

### 6.5 Quy táº¯c nghiá»‡p vá»¥ payment
- Chá»‰ cá»™ng credits hoáº·c Ä‘á»•i plan sau `payment.status='paid'`.
- Payment webhook pháº£i idempotent.
- Duplicate webhook khÃ´ng Ä‘Æ°á»£c táº¡o thÃªm credits.
- Refund pháº£i ghi log vÃ  Ä‘iá»u chá»‰nh affiliate náº¿u cáº§n.
- Affiliate commission chá»‰ Ä‘Æ°á»£c approve sau thanh toÃ¡n paid há»£p lá»‡ vÃ  qua cá»­a sá»• chá»‘ng chargeback theo config.

---

## 7. Affiliate model

### 7.1 Core rules
- User cÃ³ `affiliate_code` riÃªng.
- Link giá»›i thiá»‡u dáº¡ng `?ref=`.
- Affiliate Ã¡p dá»¥ng theo Ä‘Æ¡n Ä‘áº§u hoáº·c theo campaign config.
- CÃ³ chá»‘ng self-referral.
- CÃ³ wallet tráº¡ng thÃ¡i `pending_commission`, `available_commission`, `paid_commission`.

### 7.2 Event model
`affiliate_events.status` gá»“m:
- `pending`
- `approved`
- `paid`
- `rejected`

### 7.3 Guardrails
- KhÃ´ng táº¡o commission náº¿u payment chÆ°a há»£p lá»‡.
- KhÃ´ng táº¡o duplicate event khi webhook báº¯n láº¡i.
- KhÃ´ng máº¥t affiliate_code khi user cáº­p nháº­t email hoáº·c há»“ sÆ¡.

---

## 8. Canonical naming vÃ  statuses

### 8.1 package_type
- `quick_ads`
- `review_video`
- `conversion_video`

### 8.2 project.status
- `draft`
- `analyzing`
- `concept_ready`
- `script_ready`
- `render_queued`
- `rendering`
- `completed`
- `failed`

### 8.3 render.status
- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

### 8.4 payment.status
- `pending`
- `paid`
- `failed`
- `refunded`

### 8.5 affiliate_events.status
- `pending`
- `approved`
- `paid`
- `rejected`

### 8.6 render_mode
- `draft_local`
- `draft_local_tts`
- `premium_cloud`

---

## 9. Database final

### 9.1 Giá»¯ schema ná»n
Giá»¯ schema cá»‘t lÃµi hiá»‡n táº¡i cho:
- users
- plans
- system_settings
- projects
- project_assets
- product_intelligence
- concepts
- scripts
- renders
- prompts
- affiliate_events
- usage_logs

### 9.2 Bá»• sung báº¯t buá»™c
Bá»• sung migration cuá»‘i cho cÃ¡c trÆ°á»ng sau:
- `users.updated_at`
- `projects.language default 'vi'`
- `renders.provider`
- `renders.error_code`
- `renders.error_message`
- `renders.last_fail_reason`
- `usage_logs.trace_id`
- `usage_logs.step_name`
- `affiliate_events.meta jsonb`
- `payments` table
- `idempotency_keys` table hoáº·c cÆ¡ cháº¿ tÆ°Æ¡ng Ä‘Æ°Æ¡ng
- `service_health_logs` table
- `admin_audit_logs` table

### 9.3 Gá»£i Ã½ báº£ng service_health_logs
- `id`
- `service_name`
- `service_url`
- `status`
- `response_time_ms`
- `checked_at`
- `meta`

### 9.4 Gá»£i Ã½ báº£ng admin_audit_logs
- `id`
- `actor_user_id`
- `action`
- `target_type`
- `target_key`
- `old_value`
- `new_value`
- `created_at`

---

## 10. API map final

### 10.1 Public
- `GET /api/settings/public`
- `GET /api/plans`

### 10.2 Authenticated
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/assets/upload`
- `POST /api/projects/:id/intel`
- `POST /api/projects/:id/concepts`
- `POST /api/projects/:id/select-concept`
- `POST /api/projects/:id/scripts`
- `POST /api/projects/:id/render`
- `GET /api/renders/:id/status`
- `POST /api/projects/:id/export`
- `GET /api/affiliate/me`
- `GET /api/billing/history`
- `POST /api/billing/checkout`

### 10.3 Admin only
- `GET /api/settings/admin`
- `POST /api/settings/admin`
- `GET /api/admin/usage`
- `GET /api/admin/logs/failed-jobs`
- `GET /api/admin/service-health`
- `POST /api/admin/service-health/check`
- `GET /api/prompts`
- `POST /api/prompts`

### 10.4 Worker/Internal/Webhooks
- `POST /api/webhooks/payment`
- `POST /api/internal/render-callback`
- `POST /api/internal/health-check`
- `POST /api/internal/ai-job-callback`

---

## 11. Access matrix

| Route group | Guest | User | Admin | Worker/Internal |
|---|---|---|---|---|
| Public settings, plans | Allow | Allow | Allow | Deny |
| Auth routes | Allow | Allow | Allow | Deny |
| User projects/assets/render/export | Deny | Allow own resources | Allow audit/admin override | Deny |
| Affiliate dashboard | Deny | Allow own data | Allow audit | Deny |
| Billing checkout/history | Deny | Allow own data | Allow audit | Deny |
| Admin settings/prompts/usage/logs | Deny | Deny | Allow | Deny |
| Internal callbacks/webhooks | Deny | Deny | Deny | Allow signed/internal only |

---

## 12. Core screens
1. Landing
2. Auth pages
3. Dashboard
4. New Project Wizard
5. Product Analysis
6. Concept Selection
7. Script + Render
8. Billing
9. Affiliate Dashboard
10. Admin Settings

### 12.1 Pricing page requirements
Pricing page pháº£i cÃ³:
- 3 plan cards: Starter, Pro, Premium
- tá»«ng card hiá»ƒn thá»‹ benefits chÃ­nh, credits hoáº·c giá»›i háº¡n liÃªn quan
- CTA mua gÃ³i
- payment thumbnails cho Visa-equivalent cards vÃ  PayPal
- tráº¡ng thÃ¡i gÃ³i hiá»‡n táº¡i cá»§a user
- FAQ ngáº¯n cho billing/refund

### 12.2 Billing page requirements
Billing page pháº£i cÃ³:
- current plan
- credits balance
- payment history
- invoices/receipts náº¿u cÃ³
- upgrade/downgrade actions
- checkout status feedback
- failed payment retry CTA

---

## 13. Agent chain
1. Product Intel Agent
2. Commerce Angle Agent
3. Script Composer Agent
4. Visual Pack Builder
5. Caption Exporter
6. Render Orchestrator

### 13.1 Product Intel contract
```json
{
  "project_id": "uuid",
  "product_name": "string",
  "category": "beauty|fashion|home|other",
  "target_buyer": "string",
  "price_band": "low|mid|high",
  "usp_list": ["string"],
  "pain_points": ["string"],
  "objections": ["string"],
  "trust_signals": ["string"],
  "use_context": ["string"],
  "recommended_package_fit": ["quick_ads", "review_video", "conversion_video"],
  "confidence_score": 0.0
}
```

### 13.2 Commerce Angle contract
```json
{
  "project_id": "uuid",
  "angles": [
    {
      "angle_type": "pain_first|review_trust|offer_conversion",
      "title": "string",
      "big_idea": "string",
      "hook": "string",
      "cta": "string",
      "why_it_works": "string",
      "score": 0.0
    }
  ],
  "best_angle_type": "string"
}
```

### 13.3 Script Composer contract
```json
{
  "project_id": "uuid",
  "package_type": "quick_ads|review_video|conversion_video",
  "duration_sec": 20,
  "script_text": "string",
  "scene_cards": [
    {
      "scene_no": 1,
      "duration_sec": 3,
      "visual_instruction": "string",
      "overlay_text": "string",
      "voice_line": "string"
    }
  ],
  "cta": "string"
}
```

### 13.4 Visual Pack Builder contract
```json
{
  "project_id": "uuid",
  "render_mode": "draft_local|draft_local_tts|premium_cloud",
  "aspect_ratio": "9:16",
  "subtitle_text": "string",
  "overlay_list": [
    {
      "start_sec": 0,
      "end_sec": 3,
      "text": "string",
      "style": "headline|price|badge|cta"
    }
  ],
  "asset_plan": [
    {
      "asset_type": "image|video",
      "source_ref": "string",
      "scene_no": 1
    }
  ],
  "music_hint": "string"
}
```

### 13.5 Caption Exporter contract
```json
{
  "project_id": "uuid",
  "caption_tiktok": "string",
  "caption_reels": "string",
  "hashtags": ["string"],
  "thumbnail_text": "string",
  "short_description": "string"
}
```

---

## 14. Repo docs structure
```text
docs/
  00-executive-review.md
  01-scope-lock-final.md
  02-product-brief.md
  03-feature-list-v1.md
  04-non-goals.md
  05-unified-product-spec.md
  06-architecture.md
  07-screen-map.md
  08-agent-chain.md
  09-data-contracts.md
  10-status-model.md
  11-admin-control-model.md
  12-ui-system-spec.md
  13-change-log.md

api/
  01-routes.md
  02-access-matrix.md
  03-error-codes.md
  04-webhooks.md

db/
  01-schema.sql
  02-migrations/
  03-seed.sql
  04-rls-policies.md
  05-ledgers-and-idempotency.md

prompts/
  00-master-system-prompt.md
  01-audit-scope.md
  02-refactor-clean-architecture.md
  03-production-hardening.md
  agents/
    product-intel.md
    commerce-angle.md
    script-quick-ads.md
    script-review-video.md
    script-conversion-video.md
    json-repair.md
  lovable/
    phase-00-scope-lock.md
    phase-01-foundation-design.md
    phase-02-skeleton-ui.md
    phase-03-db-services.md
    phase-04-auth-and-billing-core.md
    phase-05-intake-wizard.md
    phase-06-product-intel.md
    phase-07-concepts.md
    phase-08-scripts.md
    phase-09-render-local.md
    phase-10-admin-controls.md
    phase-11-affiliate-and-qa.md
    phase-12-launch-freeze.md

qa/
  01-test-matrix.md
  02-acceptance-checklist.md
  03-launch-readiness.md
  04-manual-test-cases.md

ops/
  01-runbook.md
  02-rollback-plan.md
  03-local-services-checklist.md
  04-provider-config-checklist.md
```

---

## 15. Build order cho Lovable

### Phase 00 â€” Scope Lock
Má»¥c tiÃªu:
- khÃ³a scope
- khÃ³a non-goals
- khÃ³a naming
- khÃ³a source-of-truth

Deliverables:
- scope lock final
- canonical naming
- architecture decision
- repo docs structure

Gate:
- khÃ´ng cÃ²n dÃ¹ng file cÅ© lÃ m source-of-truth

### Phase 01 â€” Foundation Design
Má»¥c tiÃªu:
- chá»‘t ERD
- route map
- access matrix
- status model
- admin control model
- payment model

Gate:
- PM/Tech/QA review chÃ©o xong

### Phase 02 â€” Skeleton UI
Má»¥c tiÃªu:
- landing
- auth pages
- dashboard shell
- sidebar
- billing screen placeholder
- affiliate screen placeholder
- admin guard
- reusable UI system

Gate:
- routes Ä‘Ãºng, auth Ä‘Ãºng, mobile á»•n

### Phase 03 â€” DB + Services
Má»¥c tiÃªu:
- migrations
- seed
- RLS
- typed services
- payments table
- audit logs table
- health logs table
- idempotency layer

Gate:
- khÃ´ng cÃ²n query trá»±c tiáº¿p DB trong page components

### Phase 04 â€” Auth + Billing Core
Má»¥c tiÃªu:
- email/password auth
- account area
- pricing page
- checkout abstraction
- payment methods badges
- billing history
- webhook safety

Gate:
- thanh toÃ¡n test pass vá»›i paid/failed/refunded flows

### Phase 05 â€” Intake Wizard
Má»¥c tiÃªu:
- 4-step wizard
- upload validation
- package-aware flow
- premium hidden logic

Gate:
- pass URL only, image only, video only, mixed assets

### Phase 06 â€” Product Intel
Má»¥c tiÃªu:
- local LLM integration
- JSON validation
- raw logging
- retry policy

Gate:
- 8/9 test cases usable

### Phase 07 â€” Concepts
Má»¥c tiÃªu:
- 3 concepts
- scoring
- selection persistence

Gate:
- concepts Ä‘á»§ khÃ¡c nhau, reload váº«n giá»¯ lá»±a chá»n

### Phase 08 â€” Scripts
Má»¥c tiÃªu:
- package-specific scripts
- overlay plan
- caption exporter
- thumbnail text

Gate:
- 80% script usable sau sá»­a nhá»

### Phase 09 â€” Render Local
Má»¥c tiÃªu:
- local render worker
- preview/export
- subtitle/overlay/CTA
- strict no-cloud behavior

Gate:
- LOCAL_ONLY_MODE=true váº«n cháº¡y end-to-end

### Phase 10 â€” Admin Controls
Má»¥c tiÃªu:
- settings UI
- health checks
- logs
- contradictory-setting validation
- backend enforcement

Gate:
- khÃ´ng cÃ²n external call trÃ¡i policy

### Phase 11 â€” Affiliate + QA
Má»¥c tiÃªu:
- affiliate dashboard
- usage dashboard
- retry-safe payment
- acceptance checklist
- 9 test cases

Gate:
- khÃ´ng duplicate charge, khÃ´ng duplicate commission

### Phase 12 â€” Launch Freeze
Má»¥c tiÃªu:
- docs freeze
- prompt freeze
- rollback plan
- launch readiness
- blocker closure

Gate:
- pass full QA vÃ  freeze version MVP

---

## 16. Prompt xÆ°Æ¡ng sá»‘ng

### 16.1 audit-scope.md
DÃ¹ng Ä‘á»ƒ kiá»ƒm tra:
- scope creep
- hidden cloud dependency
- module lá»‡ch khá»i 3 package commerce
- removal list

### 16.2 refactor-clean-architecture.md
DÃ¹ng Ä‘á»ƒ kiá»ƒm tra:
- UI/business/data separation
- service abstraction
- duplicated logic
- file-by-file refactor plan

### 16.3 phase-10-admin-controls.md
Báº¯t buá»™c Lovable dá»±ng:
- admin panel
- toggles
- health checks
- failed jobs logs
- contradictory-setting validation
- backend enforcement

### 16.4 production-hardening.md
Báº¯t buá»™c há»‡ thá»‘ng cÃ³:
- loading/empty/error states
- retry
- structured logs
- admin usage dashboard
- webhook/payment safety

---

## 17. QA and runbook

### 17.1 Test matrix báº¯t buá»™c
Theo package:
- Quick Ads: 3 sáº£n pháº©m
- Review Video: 3 sáº£n pháº©m
- Conversion Video: 3 sáº£n pháº©m

Theo input:
- URL only
- 3 images
- 8 images
- 1 video máº«u
- mixed assets

Theo mode háº¡ táº§ng:
- Local only
- Local with local voice
- Local fail + cloud disabled
- Local fail + cloud fallback enabled

Theo role:
- Guest
- User
- Admin
- Affiliate referrer

### 17.2 Runbook máº«u theo symptom -> diagnosis -> action -> rollback
Báº¯t buá»™c cÃ³ tá»‘i thiá»ƒu cho:
- local LLM down
- JSON schema fail
- render fail
- payment duplicate
- affiliate mismatch
- provider credentials invalid
- health check timeout

---

## 18. Chá»‰ thá»‹ cuá»‘i cho Lovable
1. Chá»‰ dÃ¹ng tÃ i liá»‡u nÃ y lÃ m source-of-truth.
2. KhÃ´ng build ngoÃ i 3 package.
3. KhÃ´ng nhÃºng business logic vÃ o page components.
4. KhÃ´ng thÃªm hidden cloud dependency.
5. KhÃ´ng build full generative video máº·c Ä‘á»‹nh.
6. KhÃ´ng coi payment lÃ  pháº§n phá»¥; pháº£i build billing an toÃ n, trá»±c quan vÃ  idempotent.
7. KhÃ´ng dÃ¹ng kiáº¿n trÃºc single code blob; pháº£i tÃ¡ch App/UI, AI Orchestrator vÃ  Render Worker.
8. Má»—i phase pháº£i tá»± audit, test, fix blocker rá»“i má»›i qua phase tiáº¿p theo.
9. Náº¿u phÃ¡t hiá»‡n mÃ¢u thuáº«n tÃ i liá»‡u, Æ°u tiÃªn tÃ i liá»‡u nÃ y.
10. Má»i má»Ÿ rá»™ng ngoÃ i tÃ i liá»‡u nÃ y pháº£i Ä‘Æ°a vÃ o backlog, khÃ´ng tá»± Ä‘á»™ng build vÃ o MVP.
