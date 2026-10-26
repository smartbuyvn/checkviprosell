<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Viprosell â€“ Product \& Technical Spec CHá»T CUá»I CÃ™NG v1.2

**AI Ads Video Generator cho Seller \& Affiliate**
*(TÃ­ch há»£p táº¥t cáº£ gÃ³p Ã½: scene-graph aspect-agnostic + 3 layer pipeline + FaceFusion + tá»‘i Æ°u chi phÃ­ <150Ä‘/video)*

**NgÃ y chá»‘t:** 15/03/2026
**Repo káº¿ thá»«a:** `https://github.com/smartbuyvn/Viprosell.git` (Ä‘á»•i hoÃ n toÃ n brand thÃ nh Viprosell)
**Äá»‹nh vá»‹:** **Assets-first + Template + AI + Face-replacement** cho ngÆ°á»i bÃ¡n Shopee \& affiliate, khÃ´ng pháº£i video editor chung.[^1][^2]

***

## 1. Executive Summary

**Viprosell** giÃºp seller táº¡o video quáº£ng cÃ¡o TikTok/Reels/Shorts chá»‰ trong 3â€“5 phÃºt tá»« link Shopee + 3â€“8 áº£nh sáº£n pháº©m.

**3 gÃ³i chÃ­nh:**

- **QUICK ADS** (15â€“20s): test ads nhanh, hook + USP + CTA.
- **REVIEW VIDEO** (20â€“30s): phong cÃ¡ch KOC, tÄƒng trust.
- **CONVERSION VIDEO** (20â€“30s): AIDA (painâ†’proofâ†’offerâ†’CTA).[^3]

**Äiá»ƒm khÃ¡c biá»‡t:**

- **Scene-graph báº¥t kháº£ tri aspect** â†’ render 9:16/16:9/1:1 khÃ´ng crop há»ng.
- **3 layer pipeline**: AI â†’ Layout â†’ Encode (Remotion + FFmpeg).
- **Face-replacement** thay vÃ¬ full motion (giáº£m 70â€“80% GPU).[^2]
- **Chi phÃ­**: <150Ä‘/video QUICK ADS â†’ bÃ¡n 2.000Ä‘/video váº«n lá»i 85%+.[^1]

**Target:** Seller nhá», agency, dropshipper â†’ cáº§n video cháº¡y ads hiá»‡u quáº£, giÃ¡ ráº».

***

## 2. Kiáº¿n trÃºc cá»‘t lÃµi â€“ 3 layer pipeline

```
SCENE GRAPH (JSON, aspect-agnostic)
       â†“
AI LAYER (LLM/script/scene)
       â†“
COMPOSITION LAYER (Remotion React)
       â†“ (multi-aspect)
ASPECT RENDERER (9:16/16:9/1:1)
       â†“
ENCODE LAYER (FFmpeg NVENC)
       â†“
MP4 FHD (4-6 Mbps, 30fps)
```


### 2.1 Scene Graph (master timeline Ä‘á»™c láº­p aspect)

Má»—i scene lÃ  má»™t node JSON:

```json
{
  "scene_id": "s1",
  "start_sec": 0,
  "end_sec": 3,
  "asset_ref": "product_1.jpg",
  "text_overlay": "Sáº£n pháº©m hot",
  "focus_elements": ["product_center", "text"],
  "priority_order": ["product", "face", "cta"],
  "safe_regions": {
    "9_16": {"top": 0.1, "bottom": 0.15, "left": 0.05, "right": 0.05},
    "16_9": {"top": 0.05, "bottom": 0.1, "left": 0.1, "right": 0.1},
    "1_1": {"top": 0.08, "bottom": 0.08, "left": 0.08, "right": 0.08}
  }
}
```

**Lá»£i Ã­ch:**

- KhÃ´ng bá»‹ â€œdÃ­nhâ€ crop theo 9:16.
- Layout engine tá»± tÃ­nh position theo aspect + safe zone.
- Giá»‘ng CapCut/Canva 2026.[^4][^5]


### 2.2 3 Export Modes

**Mode 1 â€“ Simple Crop** (QUICK ADS)

- Center crop + scale.
- Nhanh nháº¥t (~10â€“20s/video).

**Mode 2 â€“ Smart Pan** (REVIEW)

- AI detect bounding box sáº£n pháº©m/face/text.
- Pan/zoom camera Ä‘á»ƒ luÃ´n giá»¯ focus.
- Thá»i gian: ~20â€“40s/video.

**Mode 3 â€“ Relayout** (CONVERSION)

- Rebuild layout theo aspect má»›i:

```
9:16:  TEXT(top) + PRODUCT(mid) + CTA(bottom)
16:9:  PRODUCT(left) + TEXT(right) + CTA(bottom)
1:1:   PRODUCT(center) + TEXT(top/bottom)
```

- Äáº¹p nháº¥t, cháº­m nháº¥t (~40â€“70s/video).[^4]

***

## 3. 3 GÃ³i sáº£n pháº©m

### QUICK ADS (test ads nhanh)

- Thá»i lÆ°á»£ng: **15â€“20s**.
- Äáº·c Ä‘iá»ƒm: **hook máº¡nh + 1â€“2 USP + CTA rÃµ**.
- Pipeline:

```
Shopee link/áº£nh â†’ Product Intel â†’ Script ngáº¯n â†’ Scene graph â†’ Remotion (Simple Crop) â†’ FFmpeg
```

- Use case: **TikTok Ads / Reels Ads**.
- Render time: **10â€“20s/video** (RTX 3060).
- Cost: **80â€“150Ä‘/video**.[^6]


### REVIEW VIDEO (tÄƒng trust)

- Thá»i lÆ°á»£ng: **20â€“30s**.
- Äáº·c Ä‘iá»ƒm: **phong cÃ¡ch KOC / UGC**, chi tiáº¿t sáº£n pháº©m, CTA má»m.[^3]
- Pipeline:

```
Video máº«u user upload â†’ FaceFusion (thay máº·t) â†’ Scene graph â†’ Remotion (Smart Pan) â†’ FFmpeg
```

- Use case: **organic post / UGC ads**.
- Render time: **20â€“40s/video**.


### CONVERSION VIDEO (chá»‘t Ä‘Æ¡n)

- Thá»i lÆ°á»£ng: **20â€“30s**.
- Cáº¥u trÃºc: **pain â†’ proof â†’ offer â†’ urgency â†’ CTA**.[^3]
- Pipeline:

```
Link + áº£nh â†’ Product Intel â†’ Script AIDA â†’ Scene graph â†’ Remotion (Relayout) â†’ FFmpeg
```

- Use case: **landing page ads / retarget**.
- Render time: **40â€“70s/video**.

***

## 4. Face-replacement Pipeline (thay tháº¿ nhÃ¢n váº­t)

**Thay vÃ¬ full motion phá»©c táº¡p**, dÃ¹ng **FaceFusion 3.0 / InsightFace + ReActor**:

1. User upload:
    - **video máº«u** (KOC Ä‘ang nÃ³i/nháº£y).
    - **áº£nh nhÃ¢n váº­t má»›i** (máº·t muá»‘n thay).
    - TÃ¹y chá»n áº£nh ná»n má»›i.[^2]
2. Pipeline:

```
Video máº«u â†’ FaceFusion (swap face, giá»¯ pose/ná»n) â†’ Remotion (lÃ m asset) â†’ Scene graph â†’ Render
```

3. Lá»£i Ã­ch:
    - Giáº£m 70â€“80% GPU so vá»›i full motion AI.
    - Cháº¥t lÆ°á»£ng KOC cá»±c thá»±c.
    - Render time ~40â€“60s/video RTX 3060.[^6]

**á»¨ng dá»¥ng:** Chá»‰ báº­t á»Ÿ gÃ³i REVIEW VIDEO (premium feature).

***

## 5. Backend Spec (Node/Fastify)

### 5.1 Tech Stack Backend

```
Node 20+ / TypeScript 5.2+
Fastify 4+ (API server)
Supabase (Postgres + Auth + Storage)
Redis 7+ (cache + BullMQ queue)
Remotion 5+ (composition)
FFmpeg 6+ NVENC (encode)
FaceFusion 3.0 (character replacement)
Sentry (error monitoring)
```


### 5.2 Database Schema (cáº­p nháº­t scene graph + aspect)

```sql
-- Core tables (tá»« Viprosell, Ä‘á»•i brand)
users, plans, projects, project_assets (giá»¯ nguyÃªn logic)

-- Scenes (má»›i - scene graph)
CREATE TABLE scenes (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  scene_graph JSONB NOT NULL, -- scene list aspect-agnostic
  export_mode TEXT DEFAULT 'simple_crop' -- simple_crop | smart_pan | relayout
);

-- Renders (multi-aspect)
CREATE TABLE renders (
  id UUID PRIMARY KEY,
  project_id UUID,
  rendermode TEXT, -- quick_ads | review | conversion
  aspect_outputs JSONB, -- {"9_16": "s3://...", "16_9": null, "1_1": "s3://..."}
  status TEXT,
  cost_credits INTEGER,
  render_time_ms INTEGER,
  export_mode TEXT,
  error_details JSONB
);
```


### 5.3 API Endpoints chÃ­nh

```typescript
// AI Pipeline (JSON only)
POST /api/projects/:id/ai â†’ {product_summary, script, scene_graph}

// Render Pipeline
POST /api/projects/:id/compose â†’ queue composition job (Remotion)
POST /api/projects/:id/render â†’ queue encode job (FFmpeg)
GET /api/renders/:id/status â†’ real-time status

// Character Replacement
POST /api/projects/:id/face-replace â†’ FaceFusion job
```


***

## 6. Frontend Spec (React + Remotion preview)

### 6.1 Tech Stack

```
React 18.3 + Vite 5 + TypeScript
TailwindCSS 3.4 + shadcn/ui 0.9
React Query 5 + Zustand 4
Framer Motion 11 (animations)
Remotion 5 (client-side preview)
FFmpeg.wasm (preview encode)
Lucide React (icons)
```


### 6.2 Design System Viprosell

**Typography:** **Montserrat** (Regular/Medium/SemiBold/Bold)
**Colors:**

```
Primary: linear-gradient(135deg, #FF6B35 0%, #C44569 100%)
Secondary: #2D3748
Success: #48BB78
Bg: #F7FAFC
```

**Button CTA:**

```css
.btn-viprosell {
  background: linear-gradient(135deg, #FF6B35 0%, #C44569 100%);
  border-radius: 12px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(255, 107, 53, 0.4);
}
```


### 6.3 Core UI Flows

**Wizard 4 bÆ°á»›c:**

```
1. Chá»n gÃ³i: [QUICK ADS][REVIEW][CONVERSION]
2. Input: [Link Shopee] [Upload áº£nh] [Video máº«u cho REVIEW]
3. Aspect: â˜‘ 9:16 (miá»…n phÃ­) â–¡ 16:9 (+20%) â–¡ 1:1 (+20%)
4. Export mode: [Auto] [Simple Crop] [Smart Pan] [Relayout â˜…]
```

**Preview multi-aspect:**

```
[TikTok 9:16] [YouTube 16:9] [IG 1:1]
Safe zone overlay (xanh lÃ¡)
Toggle: Music/Text/Face-replace
```


***

## 7. Local Setup \& Performance

### 7.1 Local Dev Stack

```
Node 20+ | Docker | Redis 7 | FFmpeg 6 | FaceFusion 3.0
RTX 3060 x2 (24GB VRAM tá»•ng)
npm install â†’ dev server +30s
```


### 7.2 Render Performance (RTX 3060)

| GÃ³i | Thá»i gian | GPU usage | Cost Æ°á»›c tÃ­nh |
| :-- | :-- | :-- | :-- |
| QUICK ADS | 10â€“20s | 40% | 80â€“150Ä‘ |
| REVIEW | 20â€“40s | 60% | 200â€“300Ä‘ |
| CONVERSION | 40â€“70s | 80% | 350â€“500Ä‘ |

### 7.3 Docker Compose (dev)

```yaml
services:
  supabase: postgres:15
  redis: redis:7-alpine  
  render-worker:
    image: viprosell/render:latest
    devices: /dev/nvidia0:/dev/nvidia0
  facefusion:
    image: facefusion:latest
    devices: /dev/nvidia0:/dev/nvidia0
```


***

## 8. Unit Economics

**Cost breakdown/video QUICK ADS:**

```
AI JSON (Grok-mini): 20Ä‘
Remotion composition: 30Ä‘
FFmpeg encode: 20Ä‘
Storage + bandwidth: 30Ä‘
â†’ Tá»”NG: 100Ä‘/video
GiÃ¡ bÃ¡n: 2.000Ä‘ â†’ Lá»£i nhuáº­n 95%
```


***

## 9. Roadmap triá»ƒn khai Antigravity

**Phase 1 â€“ QUICK ADS + 9:16 (1 tuáº§n)**

```
Refactor Viprosell â†’ Viprosell branding
Scene graph + AI layer (JSON only)
Remotion composition 9:16
FFmpeg encode
Wizard + Dashboard
```

**Phase 2 â€“ Multi-aspect + REVIEW (tuáº§n 2)**

```
3 export modes
Smart Pan + Relayout
FaceFusion integration
REVIEW pipeline
```

**Phase 3 â€“ CONVERSION + Production (tuáº§n 3)**

```
CONVERSION script AIDA
Credit system + Billing
Queue + Monitoring
Beta launch
```


***

## 10. MASTER PROMPT cho Antigravity (copy-paste ngay)

```
Báº¡n lÃ  Principal Engineer. Build VIPROSELL v1.2 tá»« https://github.com/smartbuyvn/Viprosell.git

Äá»”I HOÃ€N TOÃ€N BRAND: "Viprosell" â†’ "Viprosell"
FONT: Montserrat | BUTTON: gradient #FF6B35â†’#C44569

3 GÃ“I: QUICK ADS(15-20s) | REVIEW(KOC) | CONVERSION(AIDA)
KIáº¾N TRÃšC: Scene Graph â†’ AI Layer â†’ Remotion Layout â†’ FFmpeg Encode

PHASE 1 (Báº®T Äáº¦U NGAY):
1. Refactor â†’ Viprosell (schema/projects/renders/scenes)
2. Scene graph JSON (aspect-agnostic)
3. QUICK ADS pipeline: Link Shopee â†’ Product Intel â†’ Script â†’ Remotion 9:16 â†’ FFmpeg
4. Wizard 4 bÆ°á»›c + Dashboard + Multi-aspect selector
5. Montserrat font + gradient buttons everywhere

BACKEND: Node+Fastify+Supabase+Redis+BullMQ
FRONTEND: React+Vite+Tailwind+shadcn+ReactQuery+Remotion

CRUCIAL:
- Scene graph KHÃ”NG dÃ­nh aspect (JSON logic only)
- Remotion render parallel 9:16/16:9/1:1
- Credits chá»‰ trá»« khi encode thÃ nh cÃ´ng
- FaceFusion prep cho REVIEW (Phase 2)

Báº®T Äáº¦U PHASE 1. Output full working skeleton.
```


***

**File nÃ y lÃ  spec CHá»T CUá»I CÃ™NG** cho má»i thÃ nh pháº§n tham gia xÃ¢y dá»±ng Viprosell:

- **Dev/Antigravity**: dÃ¹ng lÃ m blueprint chÃ­nh xÃ¡c.
- **PM/QA**: dÃ¹ng lÃ m acceptance criteria.
- **Ops**: dÃ¹ng Ä‘á»ƒ setup infra.
- **Seller**: dÃ¹ng Ä‘á»ƒ hiá»ƒu product (landing copy).

LÆ°u thÃ nh `Viprosell_Spec_CHOT_v1.2.md` vÃ  báº¯t Ä‘áº§u Phase 1 vá»›i Antigravity ngay.

<div align="center">â‚</div>

[^1]: https://www.perplexity.ai/search/daa8b3b7-9881-4dd7-833c-21109a879e08

[^2]: https://aidancing.net

[^3]: Viprosell_Unified_Audit_Pack_Final.md

[^4]: https://www.kapwing.com/tools/make/video-ad/tiktok

[^5]: https://zeely.ai/tiktok-ad-creator/

[^6]: https://www.perplexity.ai/search/5a71ff53-b009-40a3-bd5a-ac8a49edc678

