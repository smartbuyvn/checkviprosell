# Viprosell — Rà soát hiện trạng & Spec V2

Ngày: 19/10/2026 · Người soạn: Ninh Research · Trạng thái: **BẢN ĐỀ XUẤT, chờ anh Ninh duyệt** (chưa thay đổi dòng code nào)

Phạm vi đã đọc trong `D:\vidiosell`: README, package.json (frontend + backend), 5.600 dòng backend (`render.worker.ts`, `pipeline.service.ts`, `llm.provider.ts`, `credit.service.ts`, routes, webhooks), `db/*.sql`, `docs/` (83 tệp, đọc master-source-of-truth, architecture, hybrid-architecture-spec), kế hoạch `260824_Sua_implementation_plan.md`, `Che độ hoa hồng`, git status. **Chưa đọc:** toàn bộ 82 tài liệu trong docs, các tệp frontend `src/pages/*`, nội dung các script SSH/deploy (`*.py`, `*.ps1`), `supabase/functions/*`. Chưa chạy thử ứng dụng nên mọi nhận định về hiệu năng là suy ra từ code, chưa đo.

---

## 1. Kết luận quyết định

1. **Giữ hướng sản phẩm** (video bán hàng từ ảnh thật, tiếng Việt, 3 gói) nhưng **đổi nền móng vận hành**: bỏ phụ thuộc máy local/Cloudflare Tunnel, đưa API + worker lên VPS, render bằng FFmpeg CPU.
2. **Việc phải làm trước mọi thứ khác: xử lý lộ bí mật.** `.env` (chứa khóa dịch vụ) **đang được git theo dõi** trong commit duy nhất `0690a49`, kho từ xa là `github.com/smartbuyvn/checkviprosell`. Tôi không biết kho đó công khai hay riêng tư. Ngoài ra `deploy_final.tar.gz` chứa `backend/.env`, và khóa SSH riêng `id_ed25519_admin` nằm ngay thư mục gốc dự án. Coi như mọi khóa trong `.env` đã lộ: xoay khóa (Supabase service role, Gemini, SePay, Lemon Squeezy/Stripe, Redis…).
3. **Lỗi chặn doanh thu:** mỗi lần render xong bị trừ **cứng 20 credit** (`routes/render.ts`), trong khi gói Free chỉ có 5 credit và gói Pro 50 credit/130.000đ. Nghĩa là Free không tạo nổi 1 video, Pro tạo được 2,5 video (~52.000đ/video). Bảng giá hiện tại và logic trừ xu mâu thuẫn nhau.
4. **Bỏ:** face-swap, Redis/BullMQ, Stripe, PayPal, đường render bằng canvas trong trình duyệt, Ollama 7B làm đường chính, 4 lần gọi LLM tuần tự.
5. **Thêm (đây là thứ khách trả tiền):** giọng đọc tiếng Việt (TTS) – hiện chưa có; phụ đề đẹp; thư viện template thật; **"1 link/bộ ảnh → 10 biến thể"**; trang chia sẻ; xuất chuẩn từng nền tảng; vòng phản hồi số liệu.

---

## 2. Bảng bằng chứng: code đang có gì

| # | Phát hiện | Nguồn trong dự án | Mức chắc chắn |
|---|---|---|---|
| 1 | `.env` được git theo dõi; `.gitignore` có chặn nhưng đã muộn (tệp được commit trước/qua `git add -f`) | `git ls-files` | Đã kiểm tra |
| 2 | `deploy_final.tar.gz` chứa `backend/.env` | liệt kê tar | Đã kiểm tra |
| 3 | Khóa SSH riêng trong thư mục gốc | `id_ed25519_admin` (399 byte) | Đã thấy tệp, chưa mở |
| 4 | Trừ cứng 20 credit/render, không phân biệt gói/thời lượng | `routes/render.ts` dòng ~65 | Đã đọc code |
| 5 | Gói: Free 5 xu, Pro 50 xu/130k, Business 110/250k, Premium 240/520k | `db/06-reseed-plans.sql` | Đã đọc |
| 6 | Trừ xu = đọc tổng ledger rồi insert (không khóa) → hai render hoàn tất cùng lúc có thể trừ trùng/âm số dư | `services/credit.service.ts` | Suy ra từ code |
| 7 | Webhook SePay bỏ qua kiểm tra nếu chưa đặt `SEPAY_WEBHOOK_SECRET`; callback render cũng bỏ qua nếu secret trống/`CHANGE_ME_IN_PRODUCTION`; Stripe có nhánh "bỏ xác thực khi dev" | `routes/webhooks.ts`, `routes/render.ts` | Đã đọc code |
| 8 | Khớp người dùng theo 8 ký tự đầu UUID trong nội dung chuyển khoản (`VIPRO xxxxxxxx`) | `routes/webhooks.ts` ~dòng 250 | Đã đọc; rủi ro nhầm/lừa người dùng |
| 9 | Worker render **không có giọng đọc**; chỉ có nhạc nền + chữ `drawtext` (Arial, cắt 60 ký tự, 1 dòng) | `render.worker.ts` | Đã đọc |
| 10 | Template `QA-01…10`, `RV-xx` tồn tại dưới dạng mô tả dữ liệu ở `src/constants/templates.ts` (410 dòng), nhưng `render.worker.ts` chỉ có zoom/pan chung và chữ `drawtext`, chưa thấy mã dựng riêng cho từng template | `templates.ts` vs `render.worker.ts` | Đã đọc phần đầu `templates.ts`; chưa đọc toàn bộ worker từng template |
| 11 | Pipeline 4 lần gọi LLM nối tiếp; tầng 4 (render plan) là phần máy móc nhưng vẫn nhờ LLM sinh | `pipeline.service.ts` | Đã đọc |
| 12 | `runFullPipeline` luôn ghi `provider:'ollama', fallbackUsed:false` dù thực tế có thể dùng Gemini | `pipeline.service.ts` cuối tệp | Đã đọc (lỗi ghi nhận) |
| 13 | Ollama `qwen2.5:7b` trên GPU 1; FFmpeg NVENC GPU 0; hệ thống gắn với RTX 3060 + 3060 Ti trong máy anh | `llm.provider.ts`, `render.worker.ts` | Đã đọc; chất lượng tiếng Việt của 7B **chưa được đo** |
| 14 | Redis/BullMQ vẫn còn trong backend (`ai.ts`, `server.ts`, `composition.service.ts`) dù kế hoạch muốn bỏ | grep | Đã kiểm tra |
| 15 | 3 đường render song song: FFmpeg worker, `src/engine/renderEngine.ts` (canvas + MediaRecorder, 574 dòng), Remotion Player ở frontend | cấu trúc thư mục | Đã thấy |
| 16 | 2 tệp schema (`db/schema.sql` và `db/01-schema.sql`) + `supabase/migrations` + migration "defensive enum" | `db/` | Đã thấy |
| 17 | Logic AI nhân đôi: `backend/src/routes/ai.ts` và `supabase/functions/{product-intel,script-composer,commerce-concepts}` | cấu trúc | Chưa đọc nội dung functions |
| 18 | 5 hướng deploy cùng tồn tại: Hostinger, Cloudflare Pages, VPS, docker-compose staging, Cloudflare Tunnel về máy local | gốc dự án | Đã thấy tên tệp |
| 19 | 83 tệp tài liệu, nhiều tệp nói chính mình là "source of truth"; tài liệu bị lỗi mã hóa (mojibake) và có nhiều script `fix-encoding*.cjs` | `docs/`, gốc | Đã thấy |
| 20 | README ghi "Not in MVP: face swap" trong khi spec v1.2 coi FaceFusion là tính năng gói Review | README vs spec | Mâu thuẫn tài liệu |
| 21 | Thanh toán: master doc chọn Visa+PayPal; code thực có SePay, Stripe, Lemon Squeezy; PayPal chỉ là route rỗng | `webhooks.ts`, docs | Đã đọc |

**Điểm tốt nên giữ:** ghi sổ credit theo ledger, chỉ trừ xu sau khi render thành công, idempotency key cho webhook, chính sách `LOCAL_ONLY/ALLOW_EXTERNAL`, schema Zod cho từng tầng AI, thư mục `scene-graph` có validator, hệ affiliate trọn đời (đã có `Che độ hoa hồng`).

---

## 3. Định vị thị trường (dựa trên nghiên cứu cùng phiên trước; **chưa kiểm chứng lại** hôm nay)

- Đối thủ: LayerProof (quản lý mạng xã hội rộng, giá rẻ), AiDancing (hiệu ứng/nhảy/ghép mặt), CapCut (miễn phí), Creatify/Arcads/Topview (quốc tế, đắt hơn). Giá và tính năng của họ có thể đã đổi, anh nên mở lại từng trang trước khi đưa vào tài liệu bán hàng.
- Khoảng trống đề xuất: **"Dán link/ảnh sản phẩm → 10 video bán hàng chuẩn TikTok Shop/Reels, giọng Việt, không cần dựng"** cho seller + affiliate không lộ mặt.
- Ngách đầu: mỹ phẩm, thời trang, gia dụng trên TikTok Shop/Shopee. Ngách sau: bất động sản (tour từ ảnh), tích hợp plugin WooCommerce của anh.
- Không đua với AiDancing ở hiệu ứng AI/face-swap: tốn GPU, phải gắn nhãn AIGC, rủi ro pháp lý (deepfake), không khớp "ảnh thật".

**Giả thuyết rủi ro nhất cần thử (ngoài kỹ thuật):** seller Việt có chịu trả tiền cho công cụ này khi CapCut miễn phí không? Thử bằng 10–20 seller thật trước khi làm tính năng nặng (xem mục 8).

---

## 4. Kiến trúc V2

```
[Trình duyệt, ưu tiên điện thoại]  ──►  Frontend (Vite/React, Cloudflare Pages hoặc Hostinger)
                                          │  Supabase Auth + REST
                                          ▼
                              API (Fastify, VPS Docker)  ── Supabase Postgres + Storage
                                          │   enqueue (bảng jobs)
                       ┌──────────────────┼───────────────────┐
                       ▼                  ▼                   ▼
                 AI Director        Render Worker(s)      Billing/Webhook
              (Claude/Gemini API)   (FFmpeg CPU, Docker)  (SePay, Lemon Squeezy)
                                          ▲
                        Worker GPU tại nhà (tùy chọn, chỉ kéo job ra, không cần tunnel)
```

### 4.1 Nguyên tắc
1. **Một hợp đồng duy nhất:** `Timeline JSON` (scene graph v2). AI sinh nó; mã code render nó. Không còn "render plan do LLM sinh".
2. **Hàng đợi = bảng Postgres**, worker tự "nhận việc" bằng `SELECT … FOR UPDATE SKIP LOCKED` (hoặc pg-boss). Supabase Realtime chỉ dùng để đẩy tiến độ lên giao diện. Lý do: Realtime không giữ sự kiện khi worker đang tắt; hàng đợi thì phải giữ việc.
3. **Worker không biết gì về phần còn lại:** nhận `job_id`, tải ảnh, render, tải lên, báo kết quả bằng chữ ký HMAC. Chạy được trên VPS, trên máy ở nhà (chỉ kết nối ra ngoài), hoặc dịch vụ cloud sau này.
4. **Mặc định CPU (libx264).** NVENC chỉ là tối ưu tùy chọn cho worker tại nhà. Video ảnh tĩnh + chữ 20–30s không cần GPU. *Con số thời gian render CPU chưa đo; phải benchmark trên VPS thật trước khi cam kết.*
5. **AI qua một lớp provider:** thứ tự mặc định API trả phí (Claude Haiku/Sonnet hoặc Gemini Flash) → dự phòng provider kia. Ollama chỉ là chế độ dev/offline. Cần thử A/B chất lượng tiếng Việt trước khi chốt model.
6. **Một nơi cho logic AI** (backend Fastify); xóa bản nhân đôi trong `supabase/functions` sau khi xác nhận không dùng.

### 4.2 Pipeline AI: từ 4 lần gọi còn 2
| Bước | Trước | Sau |
|---|---|---|
| 1 | Brief (LLM) | **Director call #1** (có nhìn ảnh): brief + 3 góc bán + chọn góc → JSON |
| 2 | Strategy (LLM) | gộp vào #1 |
| 3 | Scene graph (LLM) | **Director call #2**: script + timeline theo template đã chọn → JSON |
| 4 | Render plan (LLM) | **Mã code** biên dịch timeline → lệnh FFmpeg (xác định, không tốn token) |
Kiểm tra bằng Zod + một lần tự sửa lỗi giữ nguyên. Lưu `prompt_version`, token, chi phí vào `usage_logs`.

### 4.3 Bộ render
- **Template theo mã** (nâng cấp từ `src/constants/templates.ts` hiện có — `QA-01…10`, `RV-xx`, `CV-xx`): mỗi template là một hàm → danh sách lớp (nền ảnh, chuyển động, chữ, huy hiệu giá, CTA, điểm dừng). Đây là chỗ anh (Mỹ thuật) tạo khác biệt.
- **Phụ đề ASS** (libass) thay `drawtext`: xuống dòng, font Việt (Be Vietnam Pro/Montserrat), viền, highlight từng từ nếu có thời gian từ TTS.
- **TTS tiếng Việt** (mới): lớp provider (FPT.AI hoặc nhà cung cấp tương đương); lưu cache theo hash văn bản; giọng nền + nhạc ducking; chuẩn hóa -14 LUFS (`loudnorm`).
- **Vùng an toàn** cho từng nền tảng trong `platform_presets` (không để chữ đè giao diện TikTok/Reels).
- **Kiểm tra trước khi xuất:** chữ vượt vùng, ảnh quá nhỏ/mờ, thời lượng, âm lượng. Cho phép xem lại 3 khung hình do chính hệ thống chụp.
- Remotion: **hoãn**. Cần đọc kỹ điều khoản bản quyền (SaaS thương mại có điều kiện trả phí) trước khi dùng cho dịch vụ thu tiền; FFmpeg đã đủ cho slideshow/overlay. Nếu sau này cần Remotion, kiểm tra trang license hiện hành.

### 4.4 Chuỗi giá trị sản phẩm
1. **Nhập liệu:** tải ảnh (chính) + dán mô tả/giá; nhập từ link Shopee/TikTok Shop là *best-effort* (có thể bị chặn, vi phạm điều khoản nền tảng — cần kiểm tra trước khi hứa).
2. **Chọn mục tiêu:** test ads / review / chốt đơn.
3. **Sinh 10 biến thể:** khác hook, thứ tự cảnh, giọng, template, nhạc. Dùng API batch/caching của nhà cung cấp LLM để giảm chi phí.
4. **Sửa nhanh:** chạm vào chữ để đổi, kéo đổi thứ tự cảnh; không có timeline dựng phức tạp.
5. **Chia sẻ:** `/s/{slug}` trang xem/tải không cần đăng nhập, QR, nút gửi Zalo/Messenger; tải ZIP cả lô; watermark nhỏ ở gói Free.
6. **Đăng thẳng** TikTok/Facebook/YouTube: giai đoạn sau (cần được duyệt ứng dụng, mất thời gian).
7. **Vòng phản hồi:** người dùng nhập tay lượt xem/CTR/đơn cho từng video → hệ thống xếp hạng hook thắng → gợi ý đợt tiếp theo. Nhập tay trước, API ads sau.

### 4.5 Tuân thủ
- Slideshow từ ảnh thật: ít rủi ro; cảnh AI trông như thật hoặc giọng nhân bản phải nhắc người dùng bật nhãn AIGC của nền tảng. *Quy định của TikTok thay đổi; kiểm tra trang chính sách hiện hành khi build.*
- Chặn/cảnh báo trong script: lời chứng thực giả, cam kết y tế, số liệu bịa, so sánh tuyệt đối (prompt hiện đã có phần này – giữ và thêm bộ kiểm tra bằng từ khóa sau khi sinh).
- Ghi nhận người dùng đã xác nhận có quyền dùng ảnh.

---

## 5. Mô hình dữ liệu V2 (hợp nhất, dùng `supabase/migrations` làm nguồn duy nhất)

Giữ: `profiles, user_roles, plans, system_settings, projects, project_assets, credit_ledger, payments, idempotency_keys, affiliate_events, usage_logs, admin_audit_logs`.

Đổi/Thêm:
```sql
-- Hàng đợi việc (thay BullMQ/Redis)
create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- 'plan' | 'render' | 'tts'
  project_id uuid references projects(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'queued',   -- queued|running|done|failed|canceled
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  locked_by text, locked_at timestamptz,
  error_code text, error_message text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index on jobs (status, run_after);

-- Biến thể video của một dự án
create table variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  goal text,            -- test_ads | review | conversion
  hook_text text, template_code text, voice_id text, music_id text,
  timeline_json jsonb not null,       -- scene graph v2
  prompt_version text,
  created_at timestamptz default now()
);

-- Kết quả xuất cho từng nền tảng
create table renders (            -- thay bảng cũ, bỏ cột JSON rải rác
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references variants(id) on delete cascade,
  preset text not null,           -- tiktok_9x16 | reels_9x16 | shorts_9x16 | shopee_video | zalo
  status text not null default 'queued',
  output_url text, thumbnail_url text, duration_ms int,
  credits_charged int, cost_estimate_vnd int,
  qa_report jsonb,                -- kết quả kiểm tra tự động
  share_slug text unique,
  created_at timestamptz default now()
);

create table video_metrics (      -- vòng phản hồi
  render_id uuid references renders(id) on delete cascade,
  platform text, views int, ctr numeric, orders int,
  entered_by uuid, entered_at timestamptz default now()
);

create table platform_presets (
  code text primary key, width int, height int, fps int, max_sec int,
  safe_area jsonb, bitrate_kbps int
);
```
Credit: hàm Postgres `spend_credits(user_id, amount, ref)` dùng `SELECT … FOR UPDATE` trên dòng số dư (hoặc bảng `credit_balance` cập nhật cùng giao dịch) để chặn trừ trùng. `credit_ledger` vẫn là sổ cái, `balance_after` do hàm này tính.

---

## 6. API V2 (tối giản)

```
POST /v1/projects                       tạo dự án + tải ảnh (signed URL)
POST /v1/projects/:id/plan              {goal, count<=10}  → tạo job 'plan' → variants
GET  /v1/projects/:id/variants          danh sách biến thể + trạng thái
PATCH /v1/variants/:id                  sửa chữ / đổi thứ tự cảnh / đổi template
POST /v1/variants/:id/render            {preset[]} → giữ chỗ credit → job 'render'
GET  /v1/renders/:id                    trạng thái, link, qa_report
GET  /s/:slug                           trang chia sẻ công khai
POST /v1/renders/:id/metrics            nhập số liệu
POST /v1/webhooks/sepay | /lemon        chữ ký bắt buộc, idempotent
POST /internal/jobs/claim | /complete   worker, HMAC, không bao giờ bỏ qua khi thiếu secret
```
Quy tắc cứng: **thiếu secret = từ chối khởi động** (không còn nhánh "bỏ xác thực khi dev" trên production).

---

## 7. Credit & giá (đề xuất — con số chi phí là ƯỚC TÍNH, chưa đo)

**Đơn vị:** 1 credit = 1 video thường 15–30s, 1 preset. Tính theo gói thay vì cứng 20.

| Hạng mục | Credit |
|---|---|
| Video thường (ảnh + giọng + phụ đề) | 1 |
| Thêm preset khác cùng biến thể | +0,5 |
| Cảnh AI motion 3–5s (image-to-video, gọi API ngoài) | 5–10 |
| Tạo kế hoạch lại (không render) | 0 (giới hạn 3 lần/dự án) |

| Gói | Giá/tháng | Nội dung đề xuất |
|---|---|---|
| Free | 0đ | 5 video, watermark |
| Seller | 99.000đ | 60 video |
| Pro | 249.000đ | 200 video, brand kit |
| Agency | 599.000đ | 600 video (trần hợp lý thay "không giới hạn"), nhiều thương hiệu, tải ZIP, API sau |

Ước tính chi phí biên/video thường: LLM vài trăm đồng + TTS (cần xác nhận bảng giá hiện hành của nhà cung cấp) + CPU render + lưu trữ ≈ **~1.000–2.000đ** → giá bán/video 1.650đ (Seller) đến ~3.000đ (Pro) còn dư biên, nhưng **biên mỏng ở gói Seller nếu TTS đắt hoặc người dùng tạo lại nhiều**. Cần đo thật 50–100 video trước khi chốt giá.
AI motion chỉ bán khi giá API ngoài ổn định; mỗi cảnh có thể đắt hơn cả video thường nhiều lần, nên đặt giá credit theo chi phí thực tế + biên.
Giữ hệ affiliate trọn đời 10%/15% như tài liệu `Che độ hoa hồng`; **kiểm tra lại biên lợi nhuận**: hoa hồng 10–15% + thưởng người mua 10% + chi phí biên phải còn dương ở gói Seller.

---

## 8. Ba hướng đáng thử (và thử nghiệm rẻ)

1. **Affiliate/KOC TikTok Shop không lộ mặt** (khách đầu: người đang đăng ≥1 video/ngày). Kết quả họ mua: "10 video mỗi sản phẩm trong 5 phút". *Giả thuyết rủi ro nhất:* họ chịu trả tiền khi CapCut miễn phí. *Thử:* làm tay 3 sản phẩm × 10 biến thể bằng pipeline hiện có cho 10 người, xin trả 99k thử. *Tiếp tục nếu* ≥3/10 trả tiền hoặc ≥5/10 dùng ≥ 5 video trong tuần đầu; *dừng/đổi ngách nếu* <2/10 đăng video đã tạo. Thu: tỷ lệ đăng, chỉnh sửa/video, lý do bỏ.
2. **Seller nhiều mã hàng (WooCommerce)** — ghép với plugin AI Sales Assistant của anh: mỗi sản phẩm tự sinh video. Thử với 3 shop WooCommerce đang chạy; đo số video được dùng thật.
3. **Môi giới bất động sản** (từ ảnh căn hộ + giá/vị trí). Thử nhóm cư dân anh quản trị: 5 môi giới, 1 tuần. Đo: số tin đăng có video, phản hồi môi giới.

Chưa nên làm: cắt livestream, face-swap, agency white-label — để sau khi có tín hiệu trả tiền.

---

## 9. Lộ trình chuyển đổi (từng bước, mỗi bước kiểm chứng được)

**Tuần 0 – Dọn an toàn (1–2 ngày):** xoay khóa; `git rm --cached .env`; xóa `.env` khỏi lịch sử hoặc đổi kho sang riêng tư/tạo kho mới; di chuyển `id_ed25519_admin` ra ngoài dự án và tạo khóa mới; xóa `*.tar.gz/*.zip` chứa `.env`; chuyển bản sao lưu DB ra ngoài kho; lưu `.env.vault`/trình quản lý bí mật.
**Tuần 1 – Sửa lõi doanh thu:** hàm `spend_credits` có khóa; credit theo gói; thiếu secret = không khởi động; sửa ghi `provider` sai; hợp nhất schema; xóa Redis/BullMQ.
**Tuần 2–3 – Hạ tầng:** bảng `jobs` + worker nhận việc; Docker hóa API + worker lên VPS; worker CPU; benchmark 100 video; bỏ Cloudflare Tunnel về máy local.
**Tuần 3–4 – Chất lượng video:** TTS tiếng Việt, phụ đề ASS, 10 template đầu (mỹ phẩm/thời trang/gia dụng), kiểm tra tự động, chuẩn âm lượng.
**Tuần 4–6 – Giá trị bán hàng:** 10 biến thể, trang chia sẻ, preset nền tảng, ZIP, SePay/VietQR hoàn chỉnh, đưa 10 người dùng thử (mục 8).
**Sau đó (theo tín hiệu):** nhập số liệu và xếp hạng hook, AI motion, đăng thẳng, ngách bất động sản/WooCommerce.

**Dọn repo:** gom `docs/` còn ≤10 tệp (README, ARCHITECTURE, DATA, API, BILLING, RUNBOOK, DECISIONS, SECURITY); chuyển phần còn lại vào `docs/archive/`; sửa lỗi mã hóa UTF-8 một lần rồi xóa các script `fix-encoding*`; chọn **một** đích deploy; xóa `dist/`, `deploy_staging/`, zip, mp4 benchmark khỏi kho.

---

## 10. Việc chưa biết / cần anh xác nhận

- Kho GitHub `checkviprosell` công khai hay riêng tư? Có bao nhiêu người từng truy cập?
- Dịch vụ AI nào anh sẵn sàng trả phí (Claude/Gemini) và ngân sách thử/tháng?
- VPS hiện tại cấu hình thế nào (số CPU, RAM)? Cần đo thời gian render thật.
- Có người dùng thật/đã trả tiền chưa? (README ghi nhiều bước "Operator-dependent", chưa thấy dấu hiệu go-live.)
- Xác nhận hệ thống affiliate hiện hành còn áp dụng sau khi đổi gói giá.

## 11. Lịch sử quyết định (đề xuất ghi lại)

| Ngày | Phạm vi | Quyết định đề xuất | Người xác nhận | Xem lại khi |
|---|---|---|---|---|
| 19/10/2026 | Kiến trúc | Chuyển API+worker lên VPS, hàng đợi Postgres, render CPU | _chờ anh Ninh_ | Benchmark CPU không đạt |
| 19/10/2026 | Sản phẩm | Bỏ face-swap; thêm TTS + 10 biến thể + trang chia sẻ | _chờ anh Ninh_ | Có tín hiệu khách trả tiền cho face-swap |
| 19/10/2026 | Bảo mật | Xoay toàn bộ khóa; gỡ `.env` khỏi git | _chờ anh Ninh_ | — |

## 12. Nguồn & giới hạn
Mọi dữ kiện về hiện trạng lấy từ tệp trong `D:\vidiosell` (đọc ngày 19/10/2026). Dữ kiện thị trường/giá/đối thủ lấy từ phiên nghiên cứu trước (nguồn: Creatify, CapCut Commerce Pro, TikTok AI policy 2026, TikTok Shop Vietnam 2026, FPT.AI, Remotion license) và **chưa được kiểm chứng lại trong phiên này**. Chi phí/video và thời gian render là ước tính từ cấu trúc code, chưa có số đo.
