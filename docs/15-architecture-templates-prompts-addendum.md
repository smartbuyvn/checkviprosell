# Viprosell_Architecture_Templates_Prompts_Addendum

Version: 1.0  
Status: Canonical Addendum  
Language: Vietnamese  
Purpose: Báº£n bá»• sung chÃ­nh thá»©c cho bá»™ tÃ i liá»‡u Viprosell nháº±m nÃ¢ng cáº¥p kiáº¿n trÃºc production, chuáº©n hÃ³a ná»n táº£ng AI local-first, bá»• sung thÆ° viá»‡n template TikTok Ads, Ä‘Ã³ng gÃ³i prompt cá»‘t lÃµi cáº¥p há»‡ thá»‘ng, vÃ  sáº¯p xáº¿p thá»© tá»± prompt chi tiáº¿t Ä‘á»ƒ Lovable thá»±c hiá»‡n Ä‘Ãºng hÆ°á»›ng, Ä‘Ãºng pha, Ä‘Ãºng scope.

---

## 1. Vai trÃ² cá»§a tÃ i liá»‡u nÃ y

TÃ i liá»‡u nÃ y lÃ  **addendum chuáº©n hÃ³a** Ä‘á»ƒ bá»• sung cho cÃ¡c tÃ i liá»‡u ná»n Ä‘Ã£ cÃ³, khÃ´ng thay tháº¿ tinh tháº§n scope lock Ä‘Ã£ chá»‘t.  
NÃ³ Ä‘Æ°á»£c táº¡o ra nháº±m giáº£i quyáº¿t cÃ¡c Ä‘iá»ƒm cÃ²n thiáº¿u hoáº·c cÃ²n phÃ¢n tÃ¡n trong bá»™ docs hiá»‡n táº¡i:
- sÆ¡ Ä‘á»“ kiáº¿n trÃºc production chi tiáº¿t hÆ¡n
- Ä‘á»“ng bá»™ má»i thÃ nh pháº§n local-first
- tÄƒng Ä‘á»™ rÃµ cho prompt system vÃ  prompt core
- thÃªm thÆ° viá»‡n template TikTok Ads theo package
- Ä‘Æ°a prompt vÃ o Ä‘Ãºng thá»© tá»± build thá»±c táº¿ cho Lovable

### 1.1 Vá»‹ trÃ­ trong há»‡ phÃ¢n cáº¥p tÃ i liá»‡u
Khi cÃ³ mÃ¢u thuáº«n, Æ°u tiÃªn theo thá»© tá»±:
1. `Viprosell_Vibe_Code_Master.md`
2. `Viprosell_Architecture_Templates_Prompts_Addendum.md`
3. `Viprosell_Unified_Source_of_Truth_Vibe_Coding.md`
4. `Viprosell_Unified_Audit_Pack_Final.md`
5. `Viprosell_Spec_Chot_Cuoi.md`
6. `Viprosell_Implementation_Plan.md`
7. code hiá»‡n táº¡i
8. Ã½ tÆ°á»Ÿng má»›i phÃ¡t sinh

### 1.2 Nhá»¯ng gÃ¬ tÃ i liá»‡u nÃ y KHÃ”NG lÃ m
- KhÃ´ng má»Ÿ rá»™ng scope sang AI video Ä‘a nÄƒng.
- KhÃ´ng báº­t máº·c Ä‘á»‹nh full generative video.
- KhÃ´ng Ä‘Æ°a WordPress plugin vÃ o MVP.
- KhÃ´ng táº¡o dependency cloud ngáº§m.
- KhÃ´ng thay Ä‘á»•i 3 package commerce Ä‘Ã£ khÃ³a.

---

## 2. Tinh tháº§n Ä‘iá»u hÃ nh bá»• sung

### 2.1 North Star nháº¯c láº¡i
Viprosell pháº£i tiáº¿p tá»¥c giá»¯ Ä‘Ãºng 6 nguyÃªn táº¯c:
1. Chá»‰ lÃ  cÃ´ng cá»¥ táº¡o video bÃ¡n hÃ ng ngáº¯n.
2. Chá»‰ phá»¥c vá»¥ 3 package commerce.
3. Asset-first lÃ  máº·c Ä‘á»‹nh.
4. Local-first lÃ  máº·c Ä‘á»‹nh.
5. Cloud chá»‰ lÃ  fallback hoáº·c premium cÃ³ kiá»ƒm soÃ¡t.
6. Má»i thÃ nh pháº§n má»›i pháº£i giÃºp user ra video usable nhanh hÆ¡n, ráº» hÆ¡n, dá»… hÆ¡n.

### 2.2 TiÃªu chÃ­ chá»n lá»c bá»• sung
Báº¥t ká»³ bá»• sung nÃ o trong tÃ i liá»‡u nÃ y Ä‘á»u pháº£i vÆ°á»£t qua 5 cÃ¢u há»i:
1. CÃ³ lÃ m rÃµ kiáº¿n trÃºc cho Lovable khÃ´ng?
2. CÃ³ giáº£m scope drift khÃ´ng?
3. CÃ³ tÄƒng kháº£ nÄƒng cháº¡y local end-to-end khÃ´ng?
4. CÃ³ tÄƒng kháº£ nÄƒng debug / retry / trace khÃ´ng?
5. CÃ³ giÃºp output video sÃ¡t video bÃ¡n hÃ ng tháº­t hÆ¡n khÃ´ng?

Náº¿u khÃ´ng vÆ°á»£t qua 5 cÃ¢u há»i trÃªn, khÃ´ng Ä‘Æ°á»£c Ä‘Æ°a vÃ o source-of-truth.

---

## 3. CÃ¡c Ä‘iá»ƒm Ä‘Æ°á»£c chá»‘t bá»• sung

### 3.1 Bá»• sung báº¯t buá»™c vÃ o source-of-truth
1. Production Architecture Diagram chi tiáº¿t.
2. Local AI Foundation Model Strategy.
3. AI Control Plane vÃ  Prompt Registry rÃµ rÃ ng.
4. Job tracing vÃ  observability rÃµ rÃ ng.
5. ThÆ° viá»‡n 30 template TikTok Ads.
6. Bá»™ prompt cá»‘t lÃµi cáº¥p há»‡ thá»‘ng.
7. Thá»© tá»± prompt chi tiáº¿t theo Ä‘Ãºng pha triá»ƒn khai.

### 3.2 Nhá»¯ng gÃ¬ bá»‹ loáº¡i sau pháº£n biá»‡n
- Kiáº¿n trÃºc microservices quÃ¡ vá»¥n cho MVP.
- Multi-provider orchestration phá»©c táº¡p tá»« Ä‘áº§u.
- Prompt quÃ¡ dÃ i nhÆ°ng khÃ´ng cÃ³ JSON contract rÃµ.
- Template chá»‰ Ä‘á»ƒ â€œÄ‘á»c hayâ€ mÃ  khÃ´ng dá»±ng Ä‘Æ°á»£c báº±ng asset tháº­t.
- Prompt táº¡o script nhÆ°ng thiáº¿u self-critique vÃ  buildability check.

---

## 4. Production Architecture chi tiáº¿t

### 4.1 Má»¥c tiÃªu cá»§a báº£n kiáº¿n trÃºc má»›i
Báº£n kiáº¿n trÃºc nÃ y pháº£i giÃºp Lovable hiá»ƒu Ä‘Æ°á»£c:
- Ä‘Ã¢u lÃ  UI layer
- Ä‘Ã¢u lÃ  business logic
- Ä‘Ã¢u lÃ  data layer
- Ä‘Ã¢u lÃ  AI orchestration layer
- Ä‘Ã¢u lÃ  render worker
- Ä‘Ã¢u lÃ  admin control plane
- Ä‘Ã¢u lÃ  logging / tracing / failed jobs
- Ä‘Ã¢u lÃ  Ä‘iá»ƒm cháº·n hidden cloud dependency

### 4.2 Kiáº¿n trÃºc production Ä‘Æ°á»£c chá»‘t

```mermaid
flowchart TD
    U[User]
    UI[Web App UI\nLanding / Dashboard / Wizard / Script-Render]
    AUTH[Auth + Session\nSupabase Auth]
    API[App Backend / API Layer\nGuards + Validation + Services]

    PROJ[Project Service]
    BILL[Billing Service]
    AFF[Affiliate Service]
    ADMIN[Admin Control Plane\nSettings / Prompt Admin / Health]

    AI[AI Orchestrator]
    REG[Prompt Registry]
    VAL[JSON Validator + Repair]
    ROUTER[Prompt Router / Model Router]

    LLM[Local LLM Service]
    TTS[Local TTS Service]
    RENDER[Render Orchestrator]
    WORKER[Local Render Worker\nFFmpeg / Remotion]

    DB[(Supabase DB)]
    STORE[(Object Storage)]
    LOGS[(Usage Logs / Trace IDs / Failed Jobs)]
    WEBHOOK[Payment Webhook Handler]
    CLOUD[Optional Cloud Providers\nDisabled by default]

    U --> UI
    UI --> AUTH
    UI --> API

    API --> PROJ
    API --> BILL
    API --> AFF
    API --> ADMIN
    API --> AI
    API --> RENDER

    PROJ --> DB
    PROJ --> STORE

    AI --> REG
    AI --> VAL
    AI --> ROUTER
    ROUTER --> LLM
    AI --> DB
    AI --> LOGS

    RENDER --> WORKER
    RENDER --> TTS
    RENDER --> STORE
    RENDER --> DB
    RENDER --> LOGS

    BILL --> WEBHOOK
    WEBHOOK --> DB
    WEBHOOK --> AFF

    ADMIN --> DB
    ADMIN --> LOGS
    ADMIN --> REG
    ADMIN --> LLM
    ADMIN --> WORKER

    AI -. only if allowed .-> CLOUD
    RENDER -. only if allowed .-> CLOUD
    ADMIN -. policy governs .-> CLOUD
```

### 4.3 Giáº£i thÃ­ch vai trÃ² tá»«ng lá»›p
#### UI layer
Chá»‰ phá»¥ trÃ¡ch:
- auth flow
- wizard flow
- render workspace
- billing screens
- affiliate screens
- admin screens

KhÃ´ng Ä‘Æ°á»£c:
- chá»©a business logic náº·ng
- query DB trá»±c tiáº¿p
- tá»± gá»i external provider

#### API / service layer
Phá»¥ trÃ¡ch:
- route guards
- validation
- orchestration
- gá»i services domain
- chuáº©n hÃ³a responses
- enforce policy backend

#### AI Orchestrator
Phá»¥ trÃ¡ch:
- nháº­n context sáº£n pháº©m
- chá»n prompt Ä‘Ãºng package
- gá»i local model
- validate JSON
- repair JSON khi cáº§n
- lÆ°u trace / raw / normalized output

#### Prompt Registry
Phá»¥ trÃ¡ch:
- version hÃ³a prompt
- prompt scope
- prompt package mapping
- admin prompt management
- rollback prompt version khi output giáº£m cháº¥t lÆ°á»£ng

#### Model Router
Phá»¥ trÃ¡ch:
- chá»n model local theo task type
- trÃ¡nh dÃ¹ng cÃ¹ng má»™t model cho má»i viá»‡c náº¿u gÃ¢y lÃ£ng phÃ­
- Æ°u tiÃªn route nháº¹ cho task nháº¹, route máº¡nh cho task khÃ³

#### Render Orchestrator
Phá»¥ trÃ¡ch:
- xÃ¡c Ä‘á»‹nh render mode
- kiá»ƒm tra settings local/cloud
- queue render local
- cháº·n premium cloud trÃ¡i policy
- cáº­p nháº­t render status vÃ  lá»—i

#### Admin Control Plane
Phá»¥ trÃ¡ch:
- settings local/cloud
- prompt management
- health check local services
- failed jobs
- audit usage
- cháº·n cáº¥u hÃ¬nh mÃ¢u thuáº«n

#### Logs / Trace Layer
Phá»¥ trÃ¡ch:
- trace_id cho má»—i flow
- step_name cho má»—i task
- latency
- error_code
- error_message
- failed jobs list

### 4.4 Kiáº¿n trÃºc khÃ´ng Ä‘Æ°á»£c phÃ©p thÃªm vÃ o MVP
- event bus lá»›n
- job orchestration phÃ¢n tÃ¡n phá»©c táº¡p
- analytics warehouse riÃªng
- nhiá» u render provider cÃ¹ng lÃºc
- nhiá» u model vendor cÃ¹ng lÃºc náº¿u khÃ´ng cáº§n thiáº¿t
- microservices chia quÃ¡ nhá»  gÃ¢y khÃ³ debug

---

## 5. Chiáº¿n lÆ°á»£c ná» n táº£ng AI local-first

### 5.1 Má»¥c tiÃªu tá»‘i Æ°u AI platform
Ná» n táº£ng AI cá»§a Viprosell khÃ´ng cáº§n trá»Ÿ thÃ nh â€œAI labâ€ .  
Má»¥c tiÃªu Ä‘Ãºng lÃ :
- nhanh
- á»•n Ä‘á»‹nh
- dá»… kiá»ƒm soÃ¡t chi phÃ­
- dá»… trace lá»—i
- Ä‘á»§ cháº¥t lÆ°á»£ng cho commerce scripts tháº­t
- khÃ´ng phá»¥ thuá»™c cloud á»Ÿ core flow

### 5.2 Vai trÃ² AI theo task
TÃ¡ch AI thÃ nh 5 nhÃ³m nhiá»‡m vá»¥:
1. Product intelligence.
2. Commerce angles.
3. Script generation.
4. JSON repair / compliance.
5. Caption / thumbnail / overlay refinement.

### 5.3 Rule Ä‘á»‹nh tuyáº¿n local model
- Task cáº§n cáº¥u trÃºc cháº·t: Æ°u tiÃªn model á»•n Ä‘á»‹nh JSON.
- Task cáº§n ngÃ´n ngá»¯ tá»± nhiÃªn: Æ°u tiÃªn model máº¡nh hÆ¡n vá»  viáº¿t thoáº¡i ngáº¯n.
- Task sá»­a lá»—i JSON: Æ°u tiÃªn model nháº¹, deterministic hÆ¡n.
- KhÃ´ng dÃ¹ng model náº·ng nháº¥t cho má» i task.
- KhÃ´ng render assembly báº±ng LLM; render thuá»™c worker template assembly.

### 5.4 Cáº¥u hÃ¬nh AI tá»‘i Æ°u vá»  nguyÃªn táº¯c
- `LOCAL_ONLY_MODE=true` lÃ  máº·c Ä‘á»‹nh.
- `ALLOW_EXTERNAL_AI_APIS=false` lÃ  máº·c Ä‘á»‹nh.
- `CLOUD_FALLBACK_ENABLED=false` lÃ  máº·c Ä‘á»‹nh.
- Chá»‰ báº­t fallback sau khi admin cáº¥u hÃ¬nh provider há»£p lá»‡.
- Script vÃ  concept váº«n pháº£i usable ngay cáº£ khi cloud táº¯t hoÃ n toÃ n.

### 5.5 Lá»›p AI tá»‘i thiá»ƒu nÃªn cÃ³
- Local LLM endpoint.
- Prompt Registry.
- Model Router.
- Schema Validator.
- JSON Repair Path.
- Usage Logging.
- Failed Job Store.
- Manual Retry Flow.

### 5.6 Quy táº¯c cháº¥t lÆ°á»£ng AI output
Má» i AI output pháº£i qua 4 cá»•ng:
1. Schema valid.
2. Ná»™i dung Ä‘Ãºng package.
3. Scene buildable tá»« asset tháº­t.
4. KhÃ´ng overclaim / khÃ´ng TVC hÃ³a / khÃ´ng quÃ¡ generic.

---

## 6. Local services vÃ  settings chuáº©n

### 6.1 Settings ná» n báº¯t buá»™c
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

### 6.2 Settings bá»• sung nÃªn cÃ³
```json
{
  "LOCAL_TTS_URL": "http://localhost:5002",
  "AI_JSON_REPAIR_ENABLED": true,
  "AI_MAX_RETRY_PER_STEP": 1,
  "AI_LOG_RAW_OUTPUT": true,
  "MAX_RENDER_RETRY": 1,
  "PROMPT_VERSION_PINNING": true,
  "FAILED_JOB_RETENTION_DAYS": 14,
  "TRACE_LOG_ENABLED": true,
  "SAFE_MODE_ON_LOCAL_FAILURE": true
}
```

### 6.3 Rules mÃ¢u thuáº«n cáº¥u hÃ¬nh
- Náº¿u `LOCAL_ONLY_MODE=true` thÃ¬ `ALLOW_EXTERNAL_AI_APIS=false`.
- Náº¿u `CLOUD_FALLBACK_ENABLED=true` nhÆ°ng khÃ´ng cÃ³ provider config há»£p lá»‡ thÃ¬ khÃ´ng cho save.
- Náº¿u `PROMPT_VERSION_PINNING=false` thÃ¬ admin pháº£i Ä‘Æ°á»£c cáº£nh bÃ¡o rollout prompt cÃ³ thá»ƒ gÃ¢y drift.
- Náº¿u `AI_JSON_REPAIR_ENABLED=false` thÃ¬ há»‡ thá»‘ng pháº£i bÃ¡o giáº£m Ä‘á»™ bá» n cá»§a pipeline.

---

## 7. Data vÃ  observability bá»• sung

### 7.1 TrÆ°á» ng nÃªn khÃ³a thÃªm trong schema
BÃªn cáº¡nh schema hiá»‡n cÃ³, cáº§n báº£o Ä‘áº£m cÃ¡c field sau Ä‘Ã£ cÃ³ hoáº·c sáº½ thÃªm báº±ng migration final:
- `users.updated_at`
- `projects.language`
- `renders.error_code`
- `renders.error_message`
- `usage_logs.trace_id`
- `usage_logs.step_name`
- `usage_logs.request_id`
- `affiliate_events.meta`
- `payments.updated_at`
- `idempotency_keys`

### 7.2 Traceability chain chuáº©n
Má»—i luá»“ng pháº£i truy Ä‘Æ°á»£c:
`user -> project -> intel -> concepts -> script -> render -> usage_log -> payment -> affiliate_event`

### 7.3 Error taxonomy gá»£i Ã½
- `AI_SCHEMA_INVALID`
- `AI_OUTPUT_UNUSABLE`
- `LOCAL_LLM_UNREACHABLE`
- `RENDER_WORKER_UNREACHABLE`
- `RENDER_ASSET_MISSING`
- `PAYMENT_WEBHOOK_DUPLICATE`
- `CLOUD_CALL_BLOCKED_BY_POLICY`
- `PREMIUM_FEATURE_DISABLED`

---

## 8. TikTok Ads Template Library â€” 30 template

### 8.1 NguyÃªn táº¯c dÃ¹ng template
Template khÃ´ng pháº£i lÃ  script cá»‘ Ä‘á»‹nh.  
Template lÃ  cáº¥u trÃºc chuyá»ƒn Ä‘á»•i Ä‘á»ƒ AI láº¥p ná»™i dung theo sáº£n pháº©m, package vÃ  asset cÃ³ sáºµn.

### 8.2 Structure chuáº©n cho má» i template
Má»—i template nÃªn chá»©a:
- template_id
- package_type
- intent
- opening pattern
- scene flow
- proof pattern
- CTA pattern
- fit products
- risk notes

---

### 8.3 `quickads` â€” 10 template

#### QA-01 â€” Pain Hook Fast Fix
- Intent: cháº·n lÆ°á»›t báº±ng pain rÃµ rá»“i Ä‘Æ°a giáº£i phÃ¡p nhanh.
- Flow: pain -> product reveal -> USP -> CTA.
- Fit: beauty, home, daily-use.

#### QA-02 â€” One USP Hero
- Intent: bÃ¡n Ä‘Ãºng 1 USP máº¡nh nháº¥t.
- Flow: hook -> USP demo -> CTA.
- Fit: sáº£n pháº©m dá»… hiá»ƒu, lá»£i Ã­ch Ä‘Æ¡n.

#### QA-03 â€” Before / After Glimpse
- Intent: táº¡o khÃ¡c biá»‡t trÆ°á»›c-sau má»©c nháº¹, khÃ´ng overclaim.
- Flow: before -> after -> reason -> CTA.
- Fit: beauty, organizer, cleaning.

#### QA-04 â€” Three Reasons to Try
- Intent: gÃ³i nhanh 3 lÃ½ do mua.
- Flow: hook -> reason1 -> reason2 -> reason3 -> CTA.
- Fit: sáº£n pháº©m nhiá» u Ä‘iá»ƒm cá»™ng ngáº¯n gá» n.

#### QA-05 â€” Price to Value Snap
- Intent: Ä‘Ã¡nh vÃ o cáº£m giÃ¡c â€œgiÃ¡ nÃ y mÃ  Ä‘Æ°á»£c váº­yâ€ .
- Flow: price anchor -> value -> proof detail -> CTA.
- Fit: mass market, deal-driven.

#### QA-06 â€” Daily Problem Demo
- Intent: mÃ´ táº£ tÃ¬nh huá»‘ng thÆ°á» ng ngÃ y ráº¥t Ä‘á» i.
- Flow: problem scene -> product use -> result -> CTA.
- Fit: tiá»‡n Ã­ch, beauty, home.

#### QA-07 â€” Demo in 3 Scenes
- Intent: nhanh, rÃµ, dá»±ng cá»±c dá»… tá»« asset Ã­t.
- Flow: hook -> demo -> result -> CTA.
- Fit: khi asset háº¡n cháº¿.

#### QA-08 â€” Offer Lite Push
- Intent: giá»¯ nhá»‹p ads ngáº¯n nhÆ°ng váº«n cÃ i offer.
- Flow: hook -> USP -> offer -> CTA.
- Fit: sale ngáº¯n háº¡n, freeship, combo.

#### QA-09 â€” Myth vs Reality
- Intent: sá»­a hiá»ƒu láº§m phá»• biáº¿n.
- Flow: myth -> reality -> product reason -> CTA.
- Fit: sáº£n pháº©m hay bá»‹ hiá»ƒu sai.

#### QA-10 â€” Scroll Stop Question
- Intent: dÃ¹ng cÃ¢u há» i Ä‘Ãºng pain Ä‘á»ƒ cháº·n lÆ°á»›t.
- Flow: question -> answer -> USP -> CTA.
- Fit: sáº£n pháº©m solve-problem.

---

### 8.4 `reviewvideo` â€” 10 template

#### RV-01 â€” Bestie Recommends
- Intent: nhÆ° báº¡n thÃ¢n chia sáº».
- Flow: hook má» m -> tráº£i nghiá»‡m/quan sÃ¡t -> 2 Ä‘iá»ƒm thÃ­ch -> CTA má» m.

#### RV-02 â€” KOC Mini Review
- Intent: review kiá»ƒu ngáº¯n, tin Ä‘Æ°á»£c.
- Flow: first impression -> detail -> ai há»£p -> CTA.

#### RV-03 â€” Shop Owner Honest Talk
- Intent: chá»§ shop nÃ³i tháº­t, giáº£m cáº£m giÃ¡c quáº£ng cÃ¡o.
- Flow: pain khÃ¡ch hay gáº·p -> vÃ¬ sao mÃ¬nh chá» n mÃ³n nÃ y -> ai há»£p -> CTA má» m.

#### RV-04 â€” First Impression Review
- Intent: review ngay láº§n Ä‘áº§u cáº§m/xem/dÃ¹ng.
- Flow: hook -> cáº£m nháº­n Ä‘áº§u tiÃªn -> detail cá»¥ thá»ƒ -> CTA.

#### RV-05 â€” Day in Life Use Case
- Intent: Ä‘áº·t sáº£n pháº©m vÃ o context dÃ¹ng háº±ng ngÃ y.
- Flow: tÃ¬nh huá»‘ng -> dÃ¹ng sáº£n pháº©m -> cáº£m nháº­n -> CTA má» m.

#### RV-06 â€” What I Like / What to Note
- Intent: tÄƒng trust báº±ng cÃ¢n báº±ng thÃ­ch vÃ  lÆ°u Ã½.
- Flow: Ä‘iá»ƒm thÃ­ch -> lÆ°u Ã½ -> ai há»£p -> CTA.

#### RV-07 â€” Who Should Buy This
- Intent: chá»‘t rÃµ Ä‘á»‘i tÆ°á»£ng phÃ¹ há»£p.
- Flow: hook -> mÃ´ táº£ user fit -> lá»£i Ã­ch -> CTA.

#### RV-08 â€” Review After Time
- Intent: táº¡o cáº£m giÃ¡c review Ä‘Ã£ cÃ³ quan sÃ¡t, nhÆ°ng khÃ´ng bá»‹a káº¿t quáº£.
- Flow: sau má»™t thá» i gian quan sÃ¡t -> tháº¥y gÃ¬ -> cÃ³ Ä‘Ã¡ng tiá» n khÃ´ng -> CTA.

#### RV-09 â€” Compare with Previous Option
- Intent: cho tháº¥y khÃ¡c biá»‡t vá»›i mÃ³n cÅ©/cÃ¡ch cÅ©.
- Flow: Ä‘iá» u chÆ°a á»•n trÆ°á»›c Ä‘Ã¢y -> sáº£n pháº©m má»›i cáº£i thiá»‡n gÃ¬ -> CTA má» m.

#### RV-10 â€” FAQ Review Format
- Intent: review báº±ng cÃ¡ch tráº£ lá» i cÃ¢u há» i user hay há» i.
- Flow: 3 cÃ¢u há» i -> 3 cÃ¢u tráº£ lá» i ngáº¯n -> CTA.

---

### 8.5 `conversionvideo` â€” 10 template

#### CV-01 â€” Pain -> Proof -> Offer
- Intent: cÃ´ng thá»©c chá»‘t Ä‘Æ¡n cá»• Ä‘iá»ƒn vÃ  hiá»‡u quáº£.
- Flow: pain -> proof -> offer -> CTA.

#### CV-02 â€” Objection Killer
- Intent: xá»­ lÃ½ pháº£n Ä‘á»‘i lá»›n nháº¥t.
- Flow: objection -> proof -> reassurance -> CTA.

#### CV-03 â€” Why You Still Delay
- Intent: táº¥n cÃ´ng lÃ½ do trÃ¬ hoÃ£n.
- Flow: common delay -> consequence -> solution -> offer -> CTA.

#### CV-04 â€” Bad Choice vs Smart Choice
- Intent: contrast rÃµ Ä‘á»ƒ Ä‘áº©y quyáº¿t Ä‘á»‹nh mua.
- Flow: sai cÃ¡ch -> Ä‘Ãºng cÃ¡ch -> product fit -> CTA.

#### CV-05 â€” Proof First Conversion
- Intent: báº±ng chá»©ng ra sá»›m.
- Flow: proof -> pain -> USP -> offer -> CTA.

#### CV-06 â€” Bundle Saver
- Intent: combo táº¡o cáº£m giÃ¡c value tá»‘t hÆ¡n.
- Flow: nhu cáº§u -> combo value -> price logic -> CTA.

#### CV-07 â€” Limited Offer Push
- Intent: urgency cÃ³ kiá»ƒm soÃ¡t.
- Flow: hook -> proof -> limited offer -> CTA.

#### CV-08 â€” Common Mistake Fix
- Intent: chá»‰ ra lá»—i hay gáº·p rá»“i sá»­a báº±ng sáº£n pháº©m.
- Flow: mistake -> consequence -> better option -> CTA.

#### CV-09 â€” Fast Decision CTA
- Intent: Ã©p vá»  hÃ nh Ä‘á»™ng rÃµ mÃ  váº«n tá»± nhiÃªn.
- Flow: why now -> what user gets -> how to act -> CTA.

#### CV-10 â€” UGC Hard Sell Hybrid
- Intent: bá»  ngoÃ i nhÆ° UGC/review, lÃµi lÃ  conversion.
- Flow: review-like hook -> proof -> offer -> CTA.

---

## 9. Template schema chuáº©n Ä‘á»ƒ lÆ°u vÃ o há»‡ thá»‘ng

```json
{
  "template_id": "QA-01",
  "package_type": "quickads",
  "template_name": "Pain Hook Fast Fix",
  "intent": "scroll-stop + fast solution",
  "opening_pattern": "pain first",
  "scene_flow": ["pain", "product reveal", "usp", "cta"],
  "proof_pattern": "detail close-up or quick result",
  "cta_pattern": "direct short CTA",
  "fit_products": ["beauty", "home", "daily-use"],
  "risk_notes": ["avoid medical claims", "avoid exaggerated before-after"]
}
```

---

## 10. Prompt hierarchy tá»•ng thá»ƒ

### 10.1 Táº¡i sao pháº£i phÃ¢n táº§ng prompt
Lovable vÃ  AI generation dá»… lá»‡ch náº¿u khÃ´ng phÃ¢n biá»‡t rÃµ:
- prompt há»‡ thá»‘ng toÃ n cá»¥c
- prompt Ä‘iá» u phá»‘i build phase
- prompt domain
- prompt package
- prompt validator / repair
- prompt audit / refactor / hardening

### 10.2 CÃ¢y prompt chuáº©n
1. Master System Prompt.
2. Build Governance Prompt.
3. Local Policy Prompt.
4. Domain Prompts.
5. Package Prompts.
6. Validator / Repair Prompts.
7. Audit / Refactor / Hardening Prompts.

---

## 11. CÃ¡c prompt cá»‘t lÃµi cáº¥p há»‡ thá»‘ng

### 11.1 Master System Prompt â€” Lovable toÃ n dá»± Ã¡n
```text
You are the principal AI Architect, Product Strategist, QA Governor, and Senior Staff Engineer for Viprosell.

Your task is to build, audit, refine, and complete Viprosell without changing its locked MVP scope.

LOCKED PRODUCT TRUTH
- Viprosell is a web app SaaS for short commerce video creation.
- It only supports 3 packages: quickads, reviewvideo, conversionvideo.
- It is local-first, cloud-optional, asset-first.
- AI is used for product intelligence, commerce angles, scripts, overlays, captions, subtitles, CTA, and scene plans.
- Video output is assembled from real assets by template-based rendering.
- The app must still work end-to-end when cloud is fully disabled.

STRICT NON-GOALS
Do not add:
- AI dancing
- motion clone
- virtual try-on
- face swap
- full avatar presenter
- full text-to-video default flow
- WordPress plugin
- trend hunter complex module
- large batch generation
- unrelated entertainment features

ARCHITECTURE RULES
- Separate UI, service/business logic, data/repository, AI orchestration, and render worker layers.
- Do not place business logic inside page components.
- Do not query DB directly from page components.
- Do not introduce hidden cloud dependencies.
- Enforce settings and access at backend, not only in UI.

DELIVERY RULES
- Work in phases only.
- Audit before changing.
- Fix blockers before enhancements.
- Preserve canonical naming.
- Add loading, empty, error, and retry states.
- End each phase with findings, changes made, risks, and retest checklist.
```

### 11.2 Build Governance Prompt
```text
Follow a scientific and cautious workflow.
For every requested phase:
1. Restate the phase goal.
2. Identify scope allowed in this phase.
3. Identify what must not be changed.
4. Implement only what is necessary.
5. Review the result for scope creep, hidden cloud dependencies, weak validation, duplicate logic, and poor UX states.
6. Return findings, changes, risks, and a retest checklist.

Never expand scope just because it is technically possible.
```

### 11.3 Local Execution Policy Prompt
```text
Infrastructure policy for Viprosell:
- LOCAL_ONLY_MODE=true means no external AI or render provider calls.
- CLOUD_FALLBACK_ENABLED=false means local failures must fail explicitly.
- PREMIUM_RENDER_ENABLED=false means premium render options must be hidden in UI and rejected in backend.
- ALLOW_EXTERNAL_AI_APIS=false means third-party AI providers cannot be called.

You must enforce these policies in UI, services, and backend validation.
```

### 11.4 JSON Contract Enforcement Prompt
```text
All agent outputs must return valid JSON only.
No markdown, no code fences, no prose before or after JSON.
If schema validation fails, run a JSON repair pass once.
If it still fails, save the failure, return a retryable error state, and do not silently continue.
```

### 11.5 Script Realism Guard Prompt
```text
All generated sales scripts must sound like real TikTok commerce content in spoken Vietnamese.
Do not sound like TV commercials, brochures, or generic AI writing.
Every scene must be realistically buildable from the available product assets.
Avoid overclaiming, fake testimonials, fake metrics, or unsupported trust signals.
```

### 11.6 Output Critique Prompt
```text
Before returning any final script, concept, or video plan, review it internally for:
- weak hook
- repetitive lines
- scenes not buildable from real assets
- overclaiming
- CTA weakness
- poor fit to package goal
Correct the output before finalizing.
```

---

## 12. Prompt domain cá»‘t lÃµi

### 12.1 Product Intelligence Prompt
```text
SYSTEM:
Báº¡n lÃ  Product Intelligence Agent cho social commerce Viá»‡t Nam.
PhÃ¢n tÃ­ch sáº£n pháº©m Ä‘áº§u vÃ o Ä‘á»ƒ phá»¥c vá»¥ video bÃ¡n hÃ ng.
Tráº£ vá»  JSON ngáº¯n gá» n, thá»±c dá»¥ng, khÃ´ng hoa má»¹, khÃ´ng suy diá»…n quÃ¡ má»©c.
Æ¯u tiÃªn ngÃ´n ngá»¯ ngÆ°á» i mua Viá»‡t Nam.
Báº¯t buá»™c tráº£ Ä‘Ãºng schema JSON.

USER:
INPUT SOURCE:
- url: {source_url}
- assets_summary: {assets_summary}
- manual_notes: {manual_notes}

TASK:
PhÃ¢n tÃ­ch sáº£n pháº©m vÃ  tráº£ vá» :
- product_name
- category
- target_buyer
- price_band
- usp_list
- pain_points
- objections
- trust_signals
- use_context
- recommended_package_fit
- confidence_score
```

### 12.2 Commerce Angle Prompt
```text
SYSTEM:
Báº¡n lÃ  Commerce Angle Agent.
Dá»±a vÃ o Product Intelligence, hÃ£y táº¡o 3 gÃ³c bÃ¡n cÃ³ kháº£ nÄƒng chuyá»ƒn Ä‘á»•i cao nháº¥t trÃªn short video táº¡i Viá»‡t Nam.
Æ¯u tiÃªn pain rÃµ, dá»… hiá»ƒu, dá»… quay, dá»… chá»‘t Ä‘Æ¡n.
Má»—i gÃ³c pháº£i khÃ¡c nhau, khÃ´ng trÃ¹ng Ã½.
Báº¯t buá»™c tráº£ Ä‘Ãºng JSON schema.

USER:
PACKAGE: {package_type}
PRODUCT_INTEL:
{product_intel_json}

TASK:
Táº¡o 3 selling angles:
1. painfirst
2. reviewtrust
3. offerconversion

Má»—i angle gá»“m:
- title
- big_idea
- hook
- cta
- why_it_works
- score
```

### 12.3 JSON Repair Prompt
```text
Your previous response did not match the required JSON schema.
Return only valid JSON.
Do not include markdown, explanations, code fences, or extra text.
Preserve the original intent while fixing schema compliance, missing fields, wrong enums, and malformed arrays.
```

### 12.4 Script Critique Prompt
```text
Review the generated commerce script.
Check for:
- weak hook
- generic sales language
- lines that sound unnatural in spoken Vietnamese
- scenes that cannot be built from available assets
- overclaiming or unsupported proof
- repetitive overlays
Return a corrected version in the same JSON schema.
```

---

## 13. Prompt package máº¡nh cho script generation

### 13.1 `quickads`
```text
SYSTEM:
Báº¡n lÃ  TikTok Commerce Script Engine cho thá»‹ trÆ°á» ng Viá»‡t Nam.
Báº¡n chuyÃªn viáº¿t video quáº£ng cÃ¡o ngáº¯n 15-20 giÃ¢y cho seller/shop online.
Má»¥c tiêu khÃ´ng pháº£i viáº¿t TVC Ä‘áº¹p, mÃ  lÃ  viáº¿t script giá»‘ng video bÃ¡n hÃ ng tháº­t trÃªn TikTok:
- nÃ³i ngáº¯n
- tá»± nhiÃªn
- dá»… hiá»ƒu trong 1 láº§n nghe
- hook máº¡nh trong 2-3 giÃ¢y Ä‘áº§u
- chá»‰ bÃ¡n 1 gÃ³c chÃ­nh + tá»‘i Ä‘a 2 USP
- dá»±ng Ä‘Æ°á»£c tá»« áº£nh/video sáº£n pháº©m cÃ³ sáºµn

RULES:
- tiáº¿ng Viá»‡t spoken, ngáº¯n, tháº­t miá»‡ng
- má»—i voice line tá»‘i Ä‘a 14 tá»« náº¿u lÃ  cáº£nh 2-3 giÃ¢y
- overlay text tá»‘i Ä‘a 7 tá»«
- khÃ´ng bá»‹a review, sá»‘ lÆ°á»£ng bÃ¡n, chá»©ng nháº­n hay hiá»‡u quáº£ y táº¿
- structure Æ°u tiÃªn: Hook -> USP -> USP/mini demo -> Offer/CTA
- khÃ´ng Ä‘Æ°á»£c nghe nhÆ° brochure hoáº·c content AI quÃ¡ trÆ¡n tru

OUTPUT:
Tráº£ vá»  JSON há»£p lá»‡ gá»“m:
- package_type
- angle
- duration_sec
- hooks
- selected_hook
- script_text
- scene_cards
- cta
- caption_tiktok
- hashtags
- thumbnail_text
- self_check

INTERNAL SELF-CHECK:
- hook cÃ³ scroll-stop khÃ´ng?
- cÃ¢u cÃ³ tá»± nhiÃªn khi Ä‘á» c lá»›n khÃ´ng?
- scene cÃ³ build Ä‘Æ°á»£c tá»« asset tháº­t khÃ´ng?
- cÃ³ overclaim khÃ´ng?
- náº¿u cÃ³, tá»± sá»­a rá»“i má»›i tráº£ JSON.

USER:
PRODUCT_NAME: {product_name}
CATEGORY: {category}
PRICE: {price}
USP_LIST: {usp_list}
TARGET_BUYER: {target_buyer}
PAIN_POINTS: {pain_points}
OBJECTIONS: {objections}
TRUST_SIGNALS: {trust_signals}
OFFER: {offer}
ASSETS_AVAILABLE: {assets_available}
MANUAL_NOTES: {manual_notes}
```

### 13.2 `reviewvideo`
```text
SYSTEM:
Báº¡n lÃ  TikTok Review Script Engine cho social commerce Viá»‡t Nam.
Báº¡n viáº¿t video review bÃ¡n hÃ ng 20-30 giÃ¢y theo kiá»ƒu:
- bestie
- KOC má» m
- chá»§ shop chia sáº» tháº­t
- soft expert

Má»¥c tiêu:
- tÄƒng trust
- táº¡o cáº£m giÃ¡c chÃ¢n tháº­t
- khÃ´ng nÃ³i nhÆ° TVC
- cÃ³ chi tiáº¿t cá»¥ thá»ƒ khiáº¿n ngÆ°á» i xem tin
- váº«n bÃ¡n Ä‘Æ°á»£c hÃ ng nhÆ°ng CTA pháº£i má» m

RULES:
- spoken Vietnamese Ä‘á» i thÆ°á» ng
- cÃ¢u ngáº¯n, cÃ³ nhá»‹p nÃ³i tháº­t
- nÃªn cÃ³ Ã­t nháº¥t 1 chi tiáº¿t cá»¥ thá»ƒ vá»  texture, form, cáº£m giÃ¡c dÃ¹ng, Ä‘á»™ tiá»‡n, hoáº·c tÃ¬nh huá»‘ng dÃ¹ng
- structure Æ°u tiÃªn: Hook review -> cáº£m nháº­n/quan sÃ¡t tháº­t -> 1-2 Ä‘iá»ƒm Ä‘Ã¡ng tiá» n -> ai nÃªn mua -> CTA má» m
- khÃ´ng bá»‹a tráº£i nghiá»‡m máº¡nh náº¿u input khÃ´ng há»— trá»£
- khÃ´ng kháº³ng Ä‘á»‹nh tuyá»‡t Ä‘á»‘i

OUTPUT:
Tráº£ vá»  JSON há»£p lá»‡ gá»“m:
- package_type
- persona
- duration_sec
- hooks
- selected_hook
- script_text
- scene_cards
- cta
- caption_tiktok
- hashtags
- thumbnail_text
- self_check

INTERNAL SELF-CHECK:
- cÃ³ nghe nhÆ° ngÆ°á» i tháº­t Ä‘ang chia sáº» khÃ´ng?
- cÃ³ chi tiáº¿t cá»¥ thá»ƒ tÄƒng trust chÆ°a?
- cÃ³ quÃ¡ PR hay khÃ´ng?
- cÃ³ nÃ³i rÃµ ai há»£p / khÃ´ng há»£p chÆ°a?
- scene cÃ³ build Ä‘Æ°á»£c tá»« asset tháº­t khÃ´ng?
- náº¿u cÃ³ váº¥n Ä‘á» , tá»± sá»­a rá»“i má»›i tráº£ JSON.

USER:
PRODUCT_NAME: {product_name}
CATEGORY: {category}
PRICE: {price}
USP_LIST: {usp_list}
TARGET_BUYER: {target_buyer}
PAIN_POINTS: {pain_points}
OBJECTIONS: {objections}
TRUST_SIGNALS: {trust_signals}
PERSONA: {persona}
ASSETS_AVAILABLE: {assets_available}
MANUAL_NOTES: {manual_notes}
```

### 13.3 `conversionvideo`
```text
SYSTEM:
Báº¡n lÃ  TikTok Conversion Script Engine cho social commerce Viá»‡t Nam.
Báº¡n chuyÃªn viáº¿t video 20-30 giÃ¢y Ä‘á»ƒ chá»‘t Ä‘Æ¡n.
Má»¥c tiêu lÃ  tÄƒng hÃ nh Ä‘á»™ng mua báº±ng:
- pain
- objection handling
- proof
- offer
- urgency
- CTA rÃµ

RULES:
- hook pháº£i cháº¡m pain hoáº·c sai láº§m phá»• biáº¿n
- proof pháº£i xuáº¥t hiá»‡n sá»›m
- pháº£i xá»­ lÃ½ Ã­t nháº¥t 1 objection lá»›n nháº¥t
- CTA pháº£i trá»±c tiáº¿p nhÆ°ng khÃ´ng thÃ´
- chá»‰ dÃ¹ng scene dá»±ng Ä‘Æ°á»£c tá»« áº£nh/video sáº£n pháº©m tháº­t
- khÃ´ng bá»‹a review, sá»‘ lÆ°á»£ng bÃ¡n, claim y táº¿, hoáº·c hiá»‡u quáº£ tuyá»‡t Ä‘á»‘i
- structure Æ°u tiÃªn: Pain -> Proof -> Objection -> Offer -> CTA

OUTPUT:
Tráº£ vá»  JSON há»£p lá»‡ gá»“m:
- package_type
- duration_sec
- hooks
- selected_hook
- main_objection_handled
- proof_used
- script_text
- scene_cards
- cta
- caption_tiktok
- hashtags
- thumbnail_text
- self_check

INTERNAL SELF-CHECK:
- hook cÃ³ Ä‘áº­p trÃºng pain khÃ´ng?
- proof cÃ³ ra sá»›m khÃ´ng?
- objection lá»›n nháº¥t Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½ chÆ°a?
- CTA cÃ³ rÃµ hÃ nh Ä‘á»™ng khÃ´ng?
- scene cÃ³ build Ä‘Æ°á»£c tá»« asset tháº­t khÃ´ng?
- cÃ³ cÃ¢u nÃ o quÃ¡ lá»‘ khÃ´ng?
- náº¿u cÃ³, tá»± sá»­a rá»“i má»›i tráº£ JSON.

USER:
PRODUCT_NAME: {product_name}
CATEGORY: {category}
PRICE: {price}
USP_LIST: {usp_list}
TARGET_BUYER: {target_buyer}
MAIN_PAIN: {main_pain}
PRIMARY_OBJECTION: {primary_objection}
TRUST_SIGNALS: {trust_signals}
OFFER: {offer}
ASSETS_AVAILABLE: {assets_available}
MANUAL_NOTES: {manual_notes}
```

---

## 14. Thá»© tá»± prompt chi tiáº¿t Ä‘á»ƒ Lovable thá»±c hiá»‡n

### 14.1 Pha ná» n â€” prompts há»‡ thá»‘ng
1. Master System Prompt.
2. Build Governance Prompt.
3. Local Execution Policy Prompt.
4. JSON Contract Enforcement Prompt.
5. Script Realism Guard Prompt.
6. Output Critique Prompt.

Rule: 6 prompt nÃ y pháº£i Ä‘Æ°á»£c náº¡p trÆ°á»›c khi cháº¡y báº¥t ká»³ prompt phase nÃ o.

### 14.2 Pha build á»©ng dá»¥ng
#### Prompt 01 â€” Skeleton
- landing
- auth
- dashboard shell
- navigation
- admin guard

#### Prompt 02 â€” DB + Services
- migrations
- seeds
- RLS
- type-safe services
- status canon
- idempotency base

#### Prompt 03 â€” Wizard
- 4-step wizard
- upload
- draft save
- validation

#### Prompt 04 â€” Product Intel
- local LLM
- JSON validator
- raw output log
- retry 1 láº§n

#### Prompt 05 â€” Commerce Angle
- 3 concepts
- scoring
- selection persistence

#### Prompt 06 â€” Scripts Workspace
- script panel
- scene cards
- overlay
- caption
- thumbnail text

#### Prompt 07 â€” Quick Ads Script Engine
- package-specific prompt
- 10 template binding

#### Prompt 08 â€” Review Script Engine
- package-specific prompt
- persona-aware logic
- 10 template binding

#### Prompt 09 â€” Conversion Script Engine
- package-specific prompt
- proof / objection / offer logic
- 10 template binding

#### Prompt 10 â€” Visual Pack Builder
- asset plan
- overlay plan
- subtitle plan
- CTA card plan

#### Prompt 11 â€” Local Render Flow
- render orchestrator
- local worker
- preview
- export

#### Prompt 12 â€” Admin Control Plane
- settings
- prompt admin
- health checks
- failed jobs

#### Prompt 13 â€” Billing + Affiliate
- checkout
- credits
- idempotency webhook
- affiliate events

#### Prompt 14 â€” Audit Scope
- scope drift
- hidden cloud calls
- off-scope modules

#### Prompt 15 â€” Clean Architecture Refactor
- UI/service/data split
- duplicated logic cleanup
- validation layer hardening

#### Prompt 16 â€” Production Hardening
- loading/empty/error states
- retry
- logs
- usage dashboard
- safer failures

### 14.3 Pha QA / launch
#### Prompt 17 â€” Test Matrix Execution
- 9 products
- URL/image/video/mixed
- local-only / fallback cases

#### Prompt 18 â€” Launch Readiness Audit
- blockers
- major issues
- rollback readiness
- docs freeze

---

## 15. Prompt máº«u theo phase cho Lovable

### 15.1 Prompt 01 â€” Skeleton
```text
Build the production-minded skeleton of Viprosell.

Scope for this phase only:
- landing
- login
- signup
- dashboard shell
- navigation
- role guards
- admin settings route placeholder

Rules:
- keep scope minimal
- use modular architecture
- no direct DB queries in page components
- create loading, empty, and error placeholders
- responsive desktop and mobile
- do not add unrelated modules

Output:
- route structure
- layouts
- page components
- shared navigation
- guard scaffolding
- service placeholders

Stop after this phase and return:
1. findings
2. changes made
3. risks
4. retest checklist
```

### 15.2 Prompt 02 â€” DB + Services
```text
Implement the data layer for Viprosell.

Create migrations, policies, seeds, types, and services for:
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
- payments
- idempotency_keys

Requirements:
- add row-level security
- cloud fully disabled by default
- add updated_at where needed
- add error fields for renders
- add webhook-safe idempotency
- create service files instead of direct DB access in UI

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.3 Prompt 03 â€” Wizard
```text
Build the New Project Wizard for Viprosell.

Steps:
1. Select package: quickads, reviewvideo, conversionvideo
2. Input source: product URL or upload 3-8 images/videos
3. Select category: beauty, fashion, home, other
4. Optional flags: local voice, premium cloud render only if admin enables it

Requirements:
- strong validation
- clear error messages
- file upload progress
- save draft project
- hide premium option when premium render is disabled

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.4 Prompt 04 â€” Product Intel
```text
Implement the Product Intelligence flow for Viprosell.

Requirements:
- create /intel endpoint
- integrate local LLM service
- validate JSON output against schema
- store raw response and normalized fields
- retry once if schema validation fails
- never call external AI when LOCAL_ONLY_MODE=true

Also build the Product Analysis screen with:
- product name
- buyer
- pain points
- USP
- objections
- trust signals
- edit and regenerate actions

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.5 Prompt 05 â€” Concepts
```text
Implement the Commerce Angle flow for Viprosell.

Requirements:
- create /concepts endpoint
- generate exactly 3 concepts
- persist selected concept
- include score, hook, big idea, CTA, why it works
- keep concepts meaningfully different

Build the Concept Selection screen with selection persistence.

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.6 Prompt 06 â€” Scripts Workspace
```text
Implement the script workspace for Viprosell.

Requirements:
- left side: script, scene cards, overlays, caption, hashtags, thumbnail text
- right side: preview placeholder, render status, retry, export actions
- prepare the workspace to accept output from quickads, reviewvideo, conversionvideo script engines
- do not implement final render in this phase

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.7 Prompt 07 â€” Quick Ads Script Engine
```text
Implement the quickads script engine for Viprosell.
Use the quickads package prompt, JSON schema validation, self-critique loop, and the following template library IDs:
- QA-01 to QA-10

Rules:
- return 3 hooks and select the best one
- output must sound like real TikTok commerce content
- keep scenes buildable from available assets
- avoid overclaiming

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.8 Prompt 08 â€” Review Script Engine
```text
Implement the reviewvideo script engine for Viprosell.
Use the reviewvideo package prompt, JSON schema validation, self-critique loop, persona awareness, and template library IDs:
- RV-01 to RV-10

Rules:
- output must feel honest and specific
- avoid TVC style
- include at least one concrete detail that increases trust
- keep scenes buildable from available assets

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.9 Prompt 09 â€” Conversion Script Engine
```text
Implement the conversionvideo script engine for Viprosell.
Use the conversionvideo package prompt, JSON schema validation, self-critique loop, and template library IDs:
- CV-01 to CV-10

Rules:
- pain must be clear
- proof must appear early
- at least one major objection must be handled
- CTA must be direct but natural
- keep scenes buildable from available assets

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.10 Prompt 10 â€” Visual Pack Builder
```text
Implement the Visual Pack Builder for Viprosell.
Convert the final script output into:
- subtitle_text
- overlay_list
- asset_plan
- CTA card content
- music hint

Rules:
- only use real uploaded assets
- no full generative video steps
- preserve safe areas for text
- reduce overlay density if readability is poor

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.11 Prompt 11 â€” Local Render Flow
```text
Implement the local render flow for Viprosell.

Requirements:
- draft local render only by default
- use uploaded images/videos as primary assets
- support 9:16 layout
- support overlay text, subtitle text, CTA card
- support optional local voice mode
- create render jobs with statuses
- do not call cloud render when LOCAL_ONLY_MODE=true
- fail explicitly when local fails and cloud fallback is off

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.12 Prompt 12 â€” Admin Control Plane
```text
Build the Admin Control Plane for Viprosell.
Include:
- LOCAL_ONLY_MODE toggle
- CLOUD_FALLBACK_ENABLED toggle
- PREMIUM_RENDER_ENABLED toggle
- ALLOW_EXTERNAL_AI_APIS toggle
- local service URLs
- health check buttons
- logs for failed jobs
- prompt registry management
- contradiction validation

Rules:
- backend enforcement is mandatory
- UI hiding alone is not enough

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.13 Prompt 13 â€” Billing + Affiliate
```text
Implement the business layer for Viprosell.
Include:
- pricing page
- credit balance UI
- checkout flow
- usage deduction on successful render only
- affiliate code generation per user
- referral tracking from signup to first paid order
- affiliate dashboard with pending, approved, paid commissions
- idempotent payment webhook handling

Stop after this phase and return findings, changes, risks, retest checklist.
```

### 15.14 Prompt 14 â€” Audit Scope
```text
Audit the current implementation against the locked Viprosell MVP scope.
Check for:
- scope creep
- hidden cloud dependencies
- modules unrelated to the 3 commerce packages
- local-first violations
- asset-first violations
Return only deviations, risks, removals, and retest checklist.
```

### 15.15 Prompt 15 â€” Clean Architecture Refactor
```text
Review this codebase for clean architecture.
Check whether UI, business logic, and data access are separated correctly.
Identify duplicated logic, direct DB access inside UI, weak validation, and missing service abstractions.
Return a concrete refactor plan file by file, then apply the refactor.
```

### 15.16 Prompt 16 â€” Production Hardening
```text
Audit the current Viprosell app for production readiness.
Add or improve:
- consistent loading states
- empty states
- error states
- retry actions for failed jobs
- structured logging for AI tasks and render jobs
- useful user-facing error messages
- admin usage dashboard with counts, failures, and average latency
- protection against duplicate credits deduction

Return:
1. critical issues
2. medium issues
3. low-priority cleanup
4. concrete fix plan
5. retest checklist
```

---

## 16. Prompt váº­n hÃ nh pháº£n biá»‡n sau má»—i phase

```text
Audit this phase against the Viprosell source-of-truth.
Check for:
- scope drift
- hidden cloud dependency
- business logic inside UI
- direct DB access in page components
- missing loading/empty/error states
- weak validation
- weak retry and logging coverage
- output not aligned with package goals
Return:
1. blockers
2. majors
3. minors
4. must-fix actions before next phase
5. retest checklist
```

---

## 17. Lá»‡nh Ä‘iá»u hÃ nh cuá»‘i cÃ¹ng cho Lovable

1. LuÃ´n báº¯t Ä‘áº§u báº±ng prompt há»‡ thá»‘ng vÃ  prompt governance.  
2. Chá»‰ lÃ m Ä‘Ãºng má»™t phase trong má»™t láº§n thá»±c thi.  
3. KhÃ´ng má»Ÿ rá»™ng feature ngoÃ i scope Ä‘Ã£ khÃ³a.  
4. KhÃ´ng táº¡o hidden cloud dependency.  
5. Má»i AI output pháº£i qua JSON + realism + buildability check.  
6. Má»i render máº·c Ä‘á»‹nh pháº£i local draft trÆ°á»›c.  
7. Má»i phase pháº£i tráº£ findings, changes, risks, retest checklist.  
8. Chá»‰ sang phase tiáº¿p theo sau khi phase hiá»‡n táº¡i pass QA gate.  

---

## 18. Káº¿t luáº­n váº­n hÃ nh

Báº£n addendum nÃ y tá»“n táº¡i Ä‘á»ƒ lÃ m cho Viprosell:
- rÃµ kiáº¿n trÃºc hÆ¡n
- cháº·t policy hÆ¡n
- máº¡nh prompt hÆ¡n
- tháº­t TikTok commerce hÆ¡n
- local-first hÆ¡n
- dá»… debug hÆ¡n
- dá»… build báº±ng Lovable hÆ¡n

Náº¿u thá»±c hiá»‡n Ä‘Ãºng theo tÃ i liá»‡u nÃ y, Lovable sáº½ cÃ³ Ä‘á»§:
- production diagram Ä‘á»ƒ build Ä‘Ãºng layer
- template library Ä‘á»ƒ táº¡o output nháº¥t quÃ¡n
- prompt system Ä‘á»ƒ giá»¯ Ä‘Ãºng product truth
- prompt package Ä‘á»ƒ táº¡o script usable
- prompt phase Ä‘á»ƒ build theo trÃ¬nh tá»± an toÃ n
- prompt audit Ä‘á»ƒ tá»± pháº£n biá»‡n trÆ°á»›c khi Ä‘i tiáº¿p
