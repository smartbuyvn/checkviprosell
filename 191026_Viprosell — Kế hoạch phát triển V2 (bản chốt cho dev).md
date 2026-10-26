# Viprosell — Kế hoạch phát triển V2 (bản chốt cho dev)

Oct 19, 2026 · @Someone

## Bối cảnh & quyết định đã chốt

Viprosell V2 phục vụ affiliate TikTok Shop và shop nhỏ bán đa sàn ở Việt Nam, bán gói nạp qua VietQR, render bằng CPU. Chưa có khách trả tiền, nên dev được đổi schema, giá và API mà không cần di trú dữ liệu thanh toán.

| Chủ đề | Quyết định | Lý do |
| --- | --- | --- |
| Thị trường | Việt Nam trước (tháng 0–6). Quốc tế thử song song qua plugin WooCommerce. Đông Nam Á chỉ mở khi đạt cổng ở mục Kiểm thử thị trường | Lợi thế tiếng Việt, VietQR, cộng đồng; Mỹ/EU chi phí kéo khách quá cao |
| Khách đầu | Affiliate TikTok Shop đăng ≥ 1 video/ngày; shop nhỏ bán Shopee + TikTok + FB/Zalo | Nhà sáng tạo affiliate tăng 140% năm 2025; công cụ AI của TikTok nằm trong Seller Center |
| Định vị | "Video ra đơn, an toàn cho tài khoản": nội dung gốc, đúng luật quảng cáo, xuất đa nền tảng | "Ảnh → video có giọng" đã có công cụ miễn phí |
| Phạm vi v1 | Ảnh + clip quay theo hướng dẫn → 10 biến thể khác nhau thật → giọng Việt + phụ đề → tải / trang chia sẻ → gói nạp VietQR | Đủ để đo tỷ lệ video được đăng và tỷ lệ trả tiền |
| Không làm ở v1 | Face-swap, avatar AI, cảnh AI motion, đăng thẳng lên TikTok, Stripe / PayPal / Lemon Squeezy, Redis / BullMQ, render canvas trên trình duyệt, Remotion | Tốn công, rủi ro pháp lý, chưa có tín hiệu trả tiền |
| Giới thiệu bạn bè | v1 thưởng bằng credit, không trả tiền mặt. Hoa hồng tiền mặt chỉ cho đối tác được duyệt tay, mở lại sau tuần 6 | Chưa có doanh thu; credit giả mạo chỉ tốn giá vốn \~300đ/video, tiền mặt thì mất thật |
| Tương thích | Được reset schema, bảng giá, API. Trước khi reset: xuất CSV danh sách user hiện có | Chưa có giao dịch thật cần giữ |

Điều chỉnh so với bản đề xuất ngày 19/10: kiểm thử thị trường chạy song song với sprint 1, không chờ build xong; chương trình hoa hồng tiền mặt bị hoãn.

## Kết quả kiểm tra hạ tầng & bảo mật (19/10/2026)

Webhook Stripe trên prod đang mở: một sự kiện không chữ ký được trả `200 {"received":true}`. Ai cũng có thể giả `checkout.session.completed` với `client_reference_id` và `metadata.credits` tùy ý để cộng credit cho bất kỳ tài khoản nào. Mọi hạng mục khác đã kiểm đều kín.

| Hạng mục | Kết quả | Cách kiểm |
| --- | --- | --- |
| v.ninhle.com | Hostinger **VPS** `srv1625540.hstgr.cloud` (76.13.210.71, Kuala Lumpur). Nginx: `/` → `/srv/viprosell/dist`, `/api/v1/` → `127.0.0.1:3001` | DNS, ipinfo, `nginx.tmp.conf` |
| ninhle.com (tên miền gốc) | Hostinger web hosting (shared), dùng bởi `deploy-to-hostinger.ps1` qua `ftp.ninhle.com` | DNS (IPv6 2a02:4780… của Hostinger) |
| api.ninhle.com | Cloudflare Tunnel (`*.cfargotunnel.com`) về máy local; còn được tham chiếu ở `server.ts:73`, `render.ts:195` | DNS CNAME |
| Webhook Stripe (prod) | **MỞ** — HTTP 200 | POST sự kiện `probe.noop`, không ghi DB |
| Webhook SePay (prod) | Kín — HTTP 401 | POST `transferType=out`, không ghi DB |
| Callback render (prod) | Kín — HTTP 403 | POST `renderId` không tồn tại |
| `backend/.env` (máy local) | Có `SEPAY_WEBHOOK_SECRET`, `INTERNAL_CALLBACK_SECRET` (64 ký tự), `SUPABASE_SERVICE_ROLE_KEY`; **thiếu** `STRIPE_WEBHOOK_SECRET`, `NODE_ENV` | Script chỉ in trạng thái, không in giá trị |
| `.env`, `.env.local` (frontend) | Chỉ có biến `VITE_*` (khóa anon) | Như trên |
| File nhạy cảm trên web | Không lộ. v.ninhle.com trả trang SPA cho mọi đường dẫn lạ; ninhle.com trả 403/404; `/local-renders/` trả 403, không liệt kê | Thử `.env`, `.git/config`, 4 archive, khóa SSH |
| Script deploy local | `add-ssh-key-to-vps.ps1`, `hostinger_ssh_api.py`, `setup_ssh_paramiko.py` có dòng giống mật khẩu/token viết cứng. Không nằm trong git | Đếm dòng, không đọc giá trị |
| Repo GitHub `checkviprosell` | Công khai | GitHub API không đăng nhập trả 200 |

### Chủ dự án làm ngay hôm nay (\~20 phút)

- [ ] Chặn route Stripe/PayPal và khóa \`/api/v1/admin/\` (chỉ cho IP của bạn) trên nginx của VPS, đặt **trước** `location /api/v1/`, rồi `sudo nginx -t && sudo systemctl reload nginx`. Kiểm lại: POST vào route phải ra 410.
- [ ] Chạy SQL kiểm tra giao dịch giả bên dưới trong Supabase SQL Editor. Chưa có khách trả tiền nên **mọi** dòng `provider = 'stripe'` đều là test hoặc giả mạo.
- [ ] Có dòng giả: ghi bút toán âm vào `credit_ledger` để thu hồi credit, chuyển `affiliate_events` liên quan sang trạng thái hủy.
- [ ] Chuyển repo GitHub sang Private.
- [ ] Đổi mật khẩu root VPS và thu hồi token Hostinger API đang nằm trong 3 script trên. Bật `PasswordAuthentication no` trong SSH, chỉ đăng nhập bằng khóa.
- [ ] Chuyển `id_ed25519_admin`, `*.zip`, `*.tar.gz` ra khỏi thư mục dự án (vào thư mục riêng có mã hóa).

```nginx
location = /api/v1/webhooks/stripe { return 410; }
location = /api/v1/webhooks/paypal { return 410; }
# Tạm khóa admin tới khi deploy bản vá P0-1 (thay <IP-của-bạn>)
location /api/v1/admin/ { allow <IP-của-bạn>; deny all; proxy_pass http://127.0.0.1:3001; }
```

```sql
-- 1. Mọi thanh toán Stripe
select id, user_id, amount, currency, status, provider_txn_id, created_at
from public.payments where provider = 'stripe' order by created_at desc;

-- 2. Credit đã cộng từ các thanh toán đó, theo user
select l.user_id, sum(l.delta) as credits_from_stripe, count(*) as entries
from public.credit_ledger l join public.payments p on p.id = l.payment_id
where p.provider = 'stripe' group by l.user_id order by 2 desc;

-- 3. Hoa hồng affiliate phát sinh từ các thanh toán đó
select e.id, e.referrer_id, e.commission_amount, e.status, e.created_at
from public.affiliate_events e join public.payments p on p.id = e.payment_id
where p.provider = 'stripe';
```

## Giai đoạn 0 — Vá bảo mật P0 (hôm nay → 2 ngày)

Prod đang có hai lỗ hổng khai thác được ngay: giả danh bất kỳ user nào (kể cả admin, nếu biết UUID) bằng JWT không chữ ký, và cộng credit bằng webhook Stripe giả. Cả hai đã xác nhận trên v.ninhle.com bằng request không gây thay đổi dữ liệu. Việc vận hành (nginx, SQL, đổi mật khẩu) nằm ở mục trên; mục này là thay đổi code.

| # | Lỗi | Bằng chứng | Sửa | File |
| --- | --- | --- | --- | --- |
| P0-1 | Backend đọc `sub` từ JWT mà không kiểm chữ ký; `supabase/seed.sql` chỉ có chữ giữ chỗ, không lộ UUID thật (đã kiểm lại); RLS chỉ cho đọc quyền của chính mình. Rủi ro: UUID lộ qua log, link, dashboard affiliate → giả danh user đó | Token `alg:none` với UUID ngẫu nhiên nhận 403 "Admin role required" thay vì 401 | Helper `getVerifiedUserId()` dùng `supabase.auth.getUser(token)`; thay mọi chỗ tự giải mã | `lib/auth.ts` (mới), `routes/admin.ts`, `projects.ts`, `ai.ts`, `billing.ts`, `affiliate.ts` |
| P0-2 | `projects/:id/trash` và `/restore` bỏ qua kiểm tra chủ sở hữu khi không gửi token; route AI chạy trên `project_id` bất kỳ | Đọc code (`if (userId && …)`) | Bắt buộc đăng nhập; kiểm `project.user_id === userId` | `routes/projects.ts`, `routes/ai.ts` |
| P0-3 | Webhook Stripe nhận sự kiện không chữ ký khi thiếu `STRIPE_WEBHOOK_SECRET` | Prod trả 200 | Thiếu secret → 503, không xử lý | `routes/webhooks.ts` |
| P0-4 | SePay: thiếu secret thì cho qua; mã `VIPRO` 1 ký tự cũng khớp; thiếu bảng idempotency thì bỏ kiểm trùng | Đọc code (prod hiện có secret) | Thiếu secret → 503; chỉ nhận đúng 8 ký tự hex và đúng 1 user khớp; lỗi idempotency → 500 để SePay gửi lại | `routes/webhooks.ts` |
| P0-5 | Callback render cho qua khi secret trống hoặc `CHANGE_ME`; so sánh chuỗi không chống timing | Đọc code (prod hiện có secret) | Thiếu secret → 503; so sánh `timingSafeEqual` | `routes/render.ts` |
| P0-6 | Server khởi động bình thường khi thiếu secret | Đọc code | `NODE_ENV=production` mà thiếu secret bắt buộc → thoát; môi trường khác → cảnh báo | `server.ts` |
| P0-7 | `idempotency_keys` không bật RLS trong `db/01-schema.sql` | So khớp bảng và lệnh RLS | Migration bật RLS (service role không bị ảnh hưởng) | `supabase/migrations/20261019000001_*.sql`, `db/01-schema.sql` |
| P0-8 | (Rút lại) UUID admin trong seed — kiểm lại chỉ là chữ giữ chỗ | `supabase/seed.sql:35` | Không cần sửa | `supabase/seed.sql` |

**Test:** thêm `backend/tests/p0-security.test.ts` (node:test qua `tsx --test`, không cần mạng hay DB): webhook Stripe/SePay, callback, route admin với token giả, bộ đọc mã chuyển khoản. Chạy `npm test` và `npx tsc --noEmit` trong `backend/`.

**Triển khai:** chặn nginx trước (mục trên) → deploy code → áp migration → chạy lại 4 lệnh thử: Stripe phải ra 503 hoặc 410, admin với token giả phải ra 401.

### Kết quả sửa code (19/10/2026) — chờ duyệt, chưa commit

Trong lúc sửa, tôi tìm thêm 3 route tốn tiền không có xác thực nào và đã vá luôn. 8/8 test đạt, `tsc --noEmit` 0 lỗi (trước khi sửa cũng 0).

| # | Lỗi tìm thêm | Sửa | File |
| --- | --- | --- | --- |
| P0-9 | `POST /render/start` không xác thực: ai cũng tạo render cho project bất kỳ với `sceneGraph` tùy ý | `requireProjectOwner` | `routes/render.ts` |
| P0-10 | `quick-ads` (4 route, gồm `/cost-log`) không xác thực; nhận `image_urls` / `product_url` tùy ý | Hook `preHandler` bắt buộc user đã xác minh | `routes/quick-ads.ts` |
| P0-11 | `face-replace` (2 route) không xác thực | `/queue` kiểm chủ project, `/status` bắt buộc đăng nhập | `routes/face-replace.ts` |

**File thay đổi:** `backend/src/lib/auth.ts` và `lib/security.ts` (mới); `routes/` admin, ai, affiliate, billing, projects, render, webhooks, quick-ads, face-replace; `server.ts`; `package.json` (script `test`); `backend/tests/p0-security.test.ts` (mới); `db/01-schema.sql`; migration `20261019000001_enforce_rls_idempotency_keys.sql` (mới). Frontend không đổi: các trang đã gửi `Authorization: Bearer <access_token>`.

**Đính chính:** bản trên GitHub không chứa các đoạn code lỗi này. Rủi ro đến từ việc dò endpoint từ bên ngoài (rất dễ), không phải từ repo công khai.

**Vấn đề quy trình:** 33 file trong `backend/src` chưa từng được commit (gồm `admin.ts`, `billing.ts`, `projects.ts`) nhưng đang chạy trên prod. Prod được deploy từ thư mục làm việc, nên git không phải nguồn sự thật. Sprint 1 phải sửa việc này (deploy chỉ từ commit đã gắn tag).

**Còn để P1 (Sprint 1):** SSRF qua `image_urls` / `product_url` / `sourceImageUrl` (chặn IP nội bộ, chỉ cho tải từ Storage); `/quick-ads/cost-log` chỉ cho admin; xác minh JWT cục bộ bằng JWKS để bớt 1 lần gọi Supabase Auth mỗi request.

## Kiến trúc mục tiêu V2

&#91;embedded content: kiến trúc V2 · 7 thành phần, worker kéo việc\]

Worker không chấp nhận kết nối vào — nó tự gọi ra để nhận việc, nên không cần Cloudflare Tunnel về máy nhà và có thể chuyển chỗ mà không sửa code.

### Chín quyết định công nghệ

| Quyết định | Chọn | Thay cho | Lý do |
| --- | --- | --- | --- |
| Hàng đợi | Bảng Postgres + `claim_job` | Redis + BullMQ | Bỏ được 1 dịch vụ; hàng đợi giữ việc khi worker tắt; `lease_until` thu hồi việc của worker chết |
| Render | FFmpeg CPU (libx264) | NVENC trên GPU máy nhà | Đo được 13,8 giây CPU mỗi video — không cần GPU; worker chạy được ở bất kỳ đâu |
| Kết nối worker | Worker gọi ra, kéo việc | Cloudflare Tunnel vào máy nhà | Không mở cổng vào máy cá nhân; bớt một điểm chết |
| Phụ đề | File ASS (libass) | `drawtext` | `drawtext` làm mất chữ có `%` và cắt ở 60 ký tự; ASS xuống dòng đúng và giữ dấu |
| Thanh toán | SePay / VietQR | Stripe, PayPal, Lemon Squeezy | Phí \~0% so với \~18% trên đơn 99k; khách Việt ít có thẻ quốc tế |
| Lưu video | Cloudflare R2 | Supabase Storage | Không phí tải — tiết \~53đ mỗi video |
| Pipeline AI | 2 lần gọi + code biên dịch timeline | 4 lần gọi LLM tuần tự | Tầng render plan là việc máy móc, không cần token |
| TTS | FPT.AI chính, Google dự phòng | (chưa có gì) | Rẻ hơn 4–7 lần và không chuyển dữ liệu ra nước ngoài |
| Hosting | Một đích: Hostinger VPS | 5 hướng deploy cùng tồn tại | Đã xác nhận `v.ninhle.com` chạy trên VPS này |

## Mô hình dữ liệu & API V2

Nguồn duy nhất: `supabase/migrations`. Chưa có khách trả tiền nên làm migration mới, không di trú dữ liệu. Xóa `db/schema.sql` và `db/01-schema.sql` sau khi migration chạy được trên máy sạch.

**Giữ:** `profiles, user_roles, plans, system_settings, projects, project_assets, credit_ledger, payments, idempotency_keys, affiliate_events, usage_logs, admin_audit_logs`. **Bỏ:** `face_replace_jobs`, `scenes`, mọi cột Redis/BullMQ.

### Bảng mới

| Bảng | Vai trò | Vì sao cần |
| --- | --- | --- |
| `credit_balances` | Số dư 1 dòng mỗi user, có `check (balance >= 0)` | Khóa dòng này khi trừ → hai render xong cùng lúc không trừ trùng |
| `credit_holds` | Giữ chỗ credit trước khi render, `unique (ref_type, ref_id)` | Trừ trước → không render miễn phí khi hết xu; render lỗi thì hoàn lại |
| `payment_intents` | Mã chuyển khoản ngẫu nhiên 10 ký tự, số tiền kỳ vọng, hạn 24h | Thay việc lấy 8 ký tự đầu user id làm mã (P0-4) |
| `variants` | 1 dự án → nhiều biến thể, mỗi biến thể 1 `timeline_json` | Đúng hợp đồng "AI sinh timeline, code render timeline" |
| `renders` | 1 biến thể × 1 preset → 1 file | Xuất nhiều nền tảng từ cùng biến thể |
| `jobs` | Hàng đợi bằng Postgres, có `lease_until` | Thay Redis/BullMQ; worker chết thì việc được thu hồi, không treo mãi |
| `platform_presets` | Kích thước, fps, vùng an toàn, bitrate từng nền tảng | Chữ không đè giao diện TikTok/Reels |
| `asset_fingerprints` | pHash ảnh đã dùng, theo user | Cảnh báo trùng ảnh giữa các user — dữ liệu đối thủ không có |
| `video_metrics` | Luợt xem / đơn do user nhập hoặc đọc từ ảnh chụp | Xếp hạng hook thắng |

### DDL cốt lõi

```sql
create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount > 0),
  ref_type text not null,                     -- 'render'
  ref_id uuid not null,
  status text not null default 'held' check (status in ('held','committed','released')),
  expires_at timestamptz not null default now() + interval '2 hours',
  created_at timestamptz not null default now(),
  unique (ref_type, ref_id)                   -- 1 render = 1 lần giữ chỗ
);

-- Mã chuyển khoản KHÔNG dần xuất từ user id: không đoán được, không trùng tiền tố
create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,                  -- 10 ký tự base32 (bỏ I,L,O,U), sinh bằng CSPRNG
  plan_code text not null,
  expected_amount_vnd int not null,
  credits int not null,
  status text not null default 'pending'
    check (status in ('pending','paid','expired','amount_mismatch')),
  expires_at timestamptz not null default now() + interval '24 hours',
  paid_at timestamptz,
  sepay_ref text,
  created_at timestamptz not null default now()
);
create index payment_intents_pending_idx on public.payment_intents (code) where status = 'pending';

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  goal text not null check (goal in ('test_ads','review','conversion')),
  hook_text text,
  template_code text not null,
  voice_id text,
  music_id text,
  timeline_json jsonb not null,               -- scene graph v2, code render thẳng từ đây
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table public.renders (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  preset text not null references public.platform_presets(code),
  status text not null default 'queued'
    check (status in ('queued','rendering','done','failed','canceled')),
  output_url text, thumbnail_url text, duration_ms int,
  credits_charged int, cost_estimate_vnd int,
  qa_report jsonb,                            -- chữ vượt vùng, ảnh mờ, âm lượng
  share_slug text unique,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('plan','tts','render')),
  project_id uuid references public.projects(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete cascade,
  render_id uuid references public.renders(id) on delete cascade,
  payload jsonb not null default '{}',
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','canceled')),
  priority int not null default 100,
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  lease_until timestamptz,                    -- worker gia hạn mỗi 30s
  locked_by text,
  error_code text, error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_claim_idx on public.jobs (kind, priority, run_after)
  where status = 'queued';
create index jobs_lease_idx on public.jobs (lease_until) where status = 'running';

create table public.asset_fingerprints (
  id bigserial primary key,
  phash text not null,                        -- 16 ký tự hex (pHash 64-bit)
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (phash, user_id)
);
create index asset_fingerprints_phash_idx on public.asset_fingerprints (phash);
```

Mọi bảng bật RLS. `jobs`, `credit_holds`, `payment_intents`, `asset_fingerprints`, `idempotency_keys`: **không policy nào** — chỉ service role đọc/ghi. `variants`, `renders`, `video_metrics`: policy `select`/`update` theo chủ dự án.

### Hàm Postgres (thay logic rải trong TypeScript)

```sql
-- Giữ chỗ credit. Khóa dòng số dư → không trừ trùng, không âm.
create or replace function public.hold_credits(
  p_user uuid, p_amount int, p_ref_type text, p_ref_id uuid
) returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  insert into public.credit_balances (user_id) values (p_user)
    on conflict (user_id) do nothing;

  select balance into v_balance from public.credit_balances
   where user_id = p_user for update;

  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  -- unique(ref_type, ref_id) chặn giữ chỗ hai lần cho cùng một render
  insert into public.credit_holds (user_id, amount, ref_type, ref_id)
    values (p_user, p_amount, p_ref_type, p_ref_id);

  update public.credit_balances
     set balance = balance - p_amount, updated_at = now()
   where user_id = p_user;

  insert into public.credit_ledger (user_id, delta, reason, balance_after)
    values (p_user, -p_amount, 'hold_' || p_ref_type, v_balance - p_amount);

  return v_balance - p_amount;
end $$;

-- Worker nhận việc. Thu hồi việc của worker đã chết trước khi nhận việc mới.
create or replace function public.claim_job(
  p_worker text, p_kinds text[], p_lease_seconds int default 180
) returns public.jobs language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  update public.jobs
     set status = case when attempts + 1 >= max_attempts then 'failed' else 'queued' end,
         attempts = attempts + 1,
         error_code = coalesce(error_code, 'LEASE_EXPIRED'),
         locked_by = null, lease_until = null, updated_at = now()
   where status = 'running' and lease_until < now();

  select * into j from public.jobs
   where status = 'queued' and run_after <= now() and kind = any(p_kinds)
   order by priority, run_after
   for update skip locked
   limit 1;

  if not found then return null; end if;

  update public.jobs
     set status = 'running', locked_by = p_worker,
         lease_until = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   where id = j.id
   returning * into j;

  return j;
end $$;
```

Cần thêm `commit_credits` (đánh dấu `committed`, số dư đã trừ từ lúc giữ chỗ), `release_credits` (hoàn lại khi render lỗi hoặc hết hạn giữ chỗ), `grant_credits` (webhook thanh toán). Cả bốn đều ghi `credit_ledger` — sổ cái vẫn là nguồn đối chiếu.

### API V2

Mặc định: mọi `/v1/*` **bắt buộc** token đã xác minh qua Supabase Auth (helper `getVerifiedUserId` đã làm ở P0) và kiểm quyền sở hứu dự án.

| Method | Đường dẫn | Quyền | Việc |
| --- | --- | --- | --- |
| POST | `/v1/projects` | user | Tạo dự án, trả signed URL để tải ảnh |
| POST | `/v1/projects/:id/plan` | chủ dự án | `{goal, count<=10}` → job `plan` → sinh `variants` |
| GET | `/v1/projects/:id/variants` | chủ dự án | Danh sách biến thể + trạng thái |
| PATCH | `/v1/variants/:id` | chủ dự án | Sửa chữ, đổi thứ tự cảnh, đổi template |
| POST | `/v1/variants/:id/render` | chủ dự án | `{presets[]}` → `hold_credits` → job `render` |
| GET | `/v1/renders/:id` | chủ dự án | Trạng thái, link, `qa_report` |
| POST | `/v1/renders/:id/metrics` | chủ dự án | Nhập lượt xem / đơn |
| GET | `/s/:slug` | công khai | Trang xem/tải, không cần đăng nhập |
| POST | `/v1/billing/intents` | user | Tạo `payment_intent`, trả mã + VietQR |
| POST | `/v1/webhooks/sepay` | HMAC | Bắt buộc chữ ký; idempotent; khớp `code` **và** số tiền |
| POST | `/internal/jobs/claim` | HMAC worker | Gọi `claim_job` |
| POST | `/internal/jobs/:id/heartbeat` | HMAC worker | Gia hạn `lease_until` |
| POST | `/internal/jobs/:id/complete` | HMAC worker | Kết quả + `commit_credits` / `release_credits` |

Xóa khỏi API: `/api/v1/face-replace/*`, `/api/v1/webhooks/stripe`, `/api/v1/webhooks/paypal`, `/api/v1/ai/*` (gọi LLM đồng bộ trong request). `/api/v1/quick-ads/*` gộp vào `/v1/projects` + `/v1/variants`.

## Backlog theo sprint

Mỗi sprint 1 tuần cho 1 dev (trừ Sprint 2 và 4 là 2 tuần). Điều kiện vào Sprint 1: nhóm P0 đã duyệt và deploy xong. Mỗi ticket phải có test đi kèm; `npm test` và `npx tsc --noEmit` xanh mới được merge.

### Sprint 1 — Nền móng & P1 bảo mật (tuần 1)

| Mã | Việc | File chính | Xong khi |
| --- | --- | --- | --- |
| S1-1 | Chặn SSRF ở mọi đầu vào URL: chỉ cho domain Storage/R2 được phép; giải DNS rồi chặn IP riêng (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`); không theo redirect; giới hạn dung lượng và timeout | `lib/fetch-guard.ts` (mới), `routes/quick-ads.ts`, `render.worker.ts` | Test: `169.254.169.254`, `127.0.0.1:3001`, domain lạ, redirect về IP nội bộ — cả 4 bị từ chối |
| S1-2 | `/quick-ads/cost-log` chỉ admin | `routes/quick-ads.ts` | User thường nhận 403 |
| S1-3 | Ảnh user tải lên: mã hóa lại bằng sharp, xóa EXIF/GPS, giới hạn số pixel; worker chạy không dùng root, có timeout; FFmpeg đặt `-protocol_whitelist file` | `lib/image-sanitize.ts` (mới), `render.worker.ts`, `Dockerfile.worker` | Ảnh có GPS → output không còn EXIF; ảnh 100 MP bị từ chối |
| S1-4 | Sửa lỗi chữ `%` biến mất (vá tối thiểu: `expansion=none`, bỏ cắt 60 ký tự). ASS đầy đủ ở S3-2 | `render.worker.ts` | Render "Giảm 50% hôm nay" → chụp frame thấy đủ chữ |
| S1-5 | Hạn mức theo user + ngân sách AI theo ngày + công tắc ngắt khẩn cấp trong `system_settings` | `lib/rate-limit.ts` (mới), `routes/*` | Vượt hạn mức → 429; bật công tắc → mọi job AI dừng |
| S1-6 | Deploy chỉ từ commit đã gắn tag. Đưa 33 file chưa commit vào git. Thêm gitleaks vào pre-commit | `.github/workflows/`, `scripts/deploy.sh` | `git status` sạch; deploy từ thư mục làm việc bị chặn |
| S1-7 | Dọn repo: `docs/` còn ≤ 10 file, phần còn lại vào `docs/archive/`; sửa mojibake một lần rồi xóa `fix-encoding*.cjs`; xóa `dist/`, `deploy_staging/`, `*.zip`, `*.tar.gz`, mp4 benchmark; chọn 1 đích deploy (Hostinger VPS) | toàn repo | Repo < 50 MB; chỉ còn 1 script deploy |

### Sprint 2 — Hàng đợi, credit & hạ tầng (tuần 2–3)

| Mã | Việc | File chính | Xong khi |
| --- | --- | --- | --- |
| S2-1 | Migration V2: bảng mới + 4 hàm Postgres + RLS cho mọi bảng | `supabase/migrations/2026102*` | `supabase db reset` trên máy sạch chạy hết, không lỗi |
| S2-2 | Thay `CreditService` bằng `hold` / `commit` / `release` gọi hàm Postgres. Bỏ số 20 cứng, tính theo gói | `services/credit.service.ts`, `routes/render.ts` | Test đồng thời: 20 render song song cho user có 10 xu → đúng 10 thành công, số dư = 0, không âm |
| S2-3 | `payment_intents`: sinh mã 10 ký tự bằng CSPRNG; webhook SePay khớp **cả** mã và số tiền, số tiền lệch → `amount_mismatch` chốt tay | `routes/billing.ts`, `routes/webhooks.ts` | Mã sai, hết hạn, lệch tiền, gửi lại 2 lần — đều có test |
| S2-4 | Worker nhận việc qua `claim_job`, heartbeat 30s, tắt mềm (nhận SIGTERM → trả việc về `queued`) | `src/worker/` (mới) | Giết worker giữa lúc render → việc được worker khác nhận trong 3 phút, credit không mất |
| S2-5 | Xóa Redis/BullMQ, face-replace, Stripe, PayPal, Lemon Squeezy, `src/engine/renderEngine.ts`, Remotion Player | `routes/`, `services/`, `package.json` | `grep -r bullmq\|ioredis\|stripe src` không ra kết quả; bundle nhỏ hơn |
| S2-6 | Docker hóa API + worker, deploy lên Hostinger VPS; `api.ninhle.com` trỏ về VPS, bỏ Cloudflare Tunnel về máy local | `docker-compose.prod.yml`, `Dockerfile.*` | Tắt máy ở nhà → hệ thống vẫn render được |
| S2-7 | Benchmark 100 video trên VPS thật, ghi số đo vào tài liệu này | `scripts/bench.ts` | Có số: giây/video, số worker song song tối đa, RAM đỉnh |

### Sprint 3 — Chất lượng video (tuần 3–4)

| Mã | Việc | File chính | Xong khi |
| --- | --- | --- | --- |
| S3-1 | Lớp TTS: FPT.AI chính, Google Chirp 3 HD dự phòng; cache theo hash văn bản + giọng; lưu timing từng từ nếu nhà cung cấp trả | `services/tts/` (mới) | 1 câu gọi 2 lần → lần 2 lấy từ cache, không tốn tiền. Nhà chính lỗi → tự chuyển dự phòng |
| S3-2 | Phụ đề ASS (libass): font Be Vietnam Pro, tự xuống dòng theo độ rộng, viền, highlight từng từ khi có timing | `lib/ass.ts` (mới), `render.worker.ts` | Câu 80 ký tự có dấu → 2 dòng, không tràn, không mất dấu |
| S3-3 | Chuẩn âm lượng −14 LUFS (`loudnorm`) + nhạc tự hạ dưới giọng (ducking). Xuất thêm bản không nhạc | `render.worker.ts` | `ffmpeg -af loudnorm=print_format=json` đo lại: trong khoảng −14 ±1 LUFS |
| S3-4 | 10 template theo mã (mỹ phẩm / thời trang / gia dụng): mỗi template là 1 hàm → danh sách lớp (nền, chuyển động, chữ, huy hiệu giá, CTA) | `templates/` (mới) | 10 template render được từ cùng 1 bộ ảnh, nhìn khác nhau rõ |
| S3-5 | `platform_presets` + kiểm vùng an toàn; `qa_report` tự động (chữ vượt vùng, ảnh dưới ngưỡng, thời lượng, âm lượng) + 3 frame xem lại do hệ thống tự chụp | `lib/qa.ts` (mới) | Video có chữ đè vùng CTA của TikTok → `qa_report` báo lỗi trước khi trả cho user |
| S3-6 | Pipeline AI 4 lần gọi → 2; tầng 4 (render plan) chuyển sang code biên dịch timeline → lệnh FFmpeg; sửa lỗi luôn ghi `provider:'ollama'` | `services/pipeline.service.ts`, `lib/compile-timeline.ts` (mới) | Token mỗi dự án giảm ≥ 40%; `usage_logs` ghi đúng provider thực tế |

### Sprint 4 — Giá trị bán hàng (tuần 4–6)

| Mã | Việc | File chính | Xong khi |
| --- | --- | --- | --- |
| S4-1 | 10 biến thể khác hook / thứ tự cảnh / giọng / template / nhạc, dùng Batch API để giảm \~50% chi phí LLM | `services/pipeline.service.ts` | 1 bộ ảnh → 10 biến thể trong < 5 phút; hook không trùng nhau |
| S4-2 | Quay theo hướng dẫn 20 giây trên điện thoại: 5 cảnh 3–4s (cận cảnh, cầm tay, dùng thử, trước/sau, kêu gọi mua) | `src/pages/Capture.tsx` (mới) | Quay xong trên điện thoại thật → ra 10 biến thể, không cần chỉnh tay |
| S4-3 | Bộ kiểm trùng lặp: pHash ảnh, đếm số user khác đã dùng, cảnh báo, tự đổi bố cục / nền / kịch bản. v1 khớp chính xác; gần giống (Hamming ≤ 6) để sau | `lib/phash.ts` (mới) | Tải cùng 1 ảnh từ 2 tài khoản → tài khoản thứ 2 thấy cảnh báo |
| S4-4 | Bộ kiểm tuân thủ VN: chặn "tốt nhất / số 1 / rẻ nhất", cam kết y tế, "link trong bio"; thêm nhãn quảng cáo và nhãn AI dạng máy đọc được | `lib/compliance.ts` (mới) | 20 câu mẫu vi phạm đều bị chặn hoặc cảnh báo; metadata video có nhãn AI |
| S4-5 | Trang chia sẻ `/s/:slug` (không cần đăng nhập) + QR + tải ZIP cả lô + watermark gói Free | `src/pages/Share.tsx` (mới) | Mở link ở cửa sổ ẩn danh → xem và tải được, không lộ dự án khác |
| S4-6 | Gói nạp VietQR hoàn chỉnh + trang lịch sử giao dịch | `src/pages/Billing.tsx` | Nạp thật 1 lần với số tiền nhỏ → credit vào đúng, lịch sử đúng |
| S4-7 | Sentry thật (thay `MockSentry`), sao lưu PITR, tự xóa video gói Free sau 30 ngày | `services/sentry.service.ts`, cron | Lỗi prod hiện trong Sentry < 1 phút; job xóa chạy đúng lịch |

### Việc đợi tín hiệu thị trường, chưa lên lịch

Nhập số liệu tự động và xếp hạng hook · cảnh AI motion · đăng thẳng lên TikTok (cần TikTok duyệt ứng dụng, 2–6 tuần) · chế độ tự động qua Zalo · nhập hàng loạt từ Sapo / Haravan / KiotViet / WooCommerce · ngách bất động sản · đa ngôn ngữ cho Đông Nam Á.

## Kiểm thử thị trường song song & cổng quyết định

Chạy từ tuần 1, **không chờ build xong**. Đây là việc của chủ dự án, không cần dev. Lý do: giả thuyết rủi ro nhất không phải kỹ thuật mà là "seller Việt có trả tiền khi CapCut và Pippit miễn phí, và TikTok đã có công cụ trong Seller Center không". Nếu câu trả lời là không thì Sprint 3–4 phải đổi hướng, và biết sớm 5 tuần là rẻ hơn nhiều.

**Cách làm (concierge, làm tay):** chọn 10–20 affiliate TikTok Shop đang đăng từ 1 video/ngày. Với mỗi người, dùng pipeline hiện có (hoặc làm tay hoàn toàn) tạo 3 sản phẩm × 10 biến thể, gửi qua Zalo. Không nói đó là sản phẩm, chỉ nói "thử giúp em". Sau 7 ngày, xin 99.000đ cho tháng tiếp theo.

**Đo 5 chỉ số:** tỷ lệ video được đăng thật · số lần họ sửa trước khi đăng · bao nhiêu người trả 99k · lý do từ chối (ghi nguyên văn) · họ có bị giảm luợt hiển thị hay điểm vi phạm nào không.

Song song, thử quốc tế bằng kênh rẻ nhất: đóng tính năng tạo video vào plugin WooCommerce đã có, tiếng Anh, thu bằng USD. Khách tự tìm thấy qua marketplace nên không đốt tiền quảng cáo.

### Cổng tuần 6 — sau concierge test

| Chỉ số | Mở rộng | Sửa sản phẩm | Dừng hoặc đổi ngách |
| --- | --- | --- | --- |
| Tỷ lệ video xuất ra được đăng thật | ≥ 50% | 30–50% | < 30% |
| Số người trả 99k trong 10–20 người | ≥ 3 | 2 | ≤ 1 |
| Số lần sửa tay mỗi video | ≤ 1 | 2–3 | > 3 |

*Các ngưỡng này do tôi đề xuất, không phải chuẩn ngành. Bạn nên điều chỉnh trước khi chạy, không phải sau khi có kết quả.*

"Sửa sản phẩm" nghĩa là đọc lại lý do từ chối rồi đổi Sprint 4, không phải làm tiếp như cũ. "Dừng" nghĩa là thử ngách khác (shop WooCommerce nhiều mã hàng, hoặc bất động sản) trước khi đầu tư thêm vào kỹ thuật.

### Cổng tuần 12 — sau khi có sản phẩm thật

| Chỉ số | Mở rộng Đông Nam Á | Giữ ở Việt Nam | Xét lại toàn bộ |
| --- | --- | --- | --- |
| Khách trả phí còn ở lại tháng thứ 2 | ≥ 40% | 25–40% | < 25% |
| Tỷ lệ chuyển từ miễn phí sang trả phí trong 30 ngày | ≥ 5% | 2–5% | < 2% |
| Chi phí kéo 1 khách so với doanh thu 1 tháng của khách đó | ≤ 1 | 1–3 | > 3 |
| Biên lợi nhuận gói rẻ nhất | ≥ 60% | 40–60% | < 40% |

Cần đủ **cả bốn** mục cột "mở rộng" mới mở Đông Nam Á. Chỉ đạt một hai mục thì mở sớm sẽ nhân lên cái chưa chạy được, ở thị trường bạn không có lợi thế ngôn ngữ và cộng đồng.

## Chi phí mỗi video & bảng giá v1

Giá vốn một video 25s giao cho khách là **\~100đ (stack rẻ) đến \~700đ (stack đắt)**. Tiền không nằm ở render — render gần như miễn phí — mà nằm ở **giọng đọc, phí cổng thanh toán và hoa hồng**.

Giả định: video 25s, 1 preset, giọng đọc \~450 ký tự, mỗi lô sinh 10 biến thể nên chi phí LLM chia đều cho 10. Tỷ giá 26.100đ/USD.

| Khoản | Stack rẻ | Stack đắt | Ghi chú |
| --- | --- | --- | --- |
| LLM, 2 lần gọi (có nhìn ảnh) | \~10đ | \~40đ | [Claude Haiku 5.5](https://apidog.com/blog/claude-haiku-5-5-pricing/) 0,10/0,50 USD mỗi 1 triệu token so với [Gemini 2.5 Flash](https://anotherwrapper.com/llm-pricing/gemini-2.5-flash) 0,30/2,50. Batch API giảm thêm \~50% |
| Giọng đọc (TTS) | 85đ | 590đ | [FPT.AI](https://docs.fpt.ai/docs/vi/speech/documentation/tts-pricing/) 0,185–0,333đ/ký tự (miễn phí 100k ký tự/tháng) · [Google Chirp 3 HD](https://cloud.google.com/text-to-speech/pricing?hl=fr) 30 USD/1M ≈ 350đ · [ElevenLabs Flash](https://www.activepieces.com/blog/elevenlabs-pricing-2026-plans-credits-and-costs.md) 0,05 USD/1k ≈ 590đ |
| Render CPU | \~2đ | \~10đ | **Đo thật:** 13,8 giây CPU cho video 25s 1080×1920 (5 cảnh, zoom, chuyển cảnh, phụ đề ASS, chuẩn âm lượng) trên i9-13900K, 2 luồng. VPS chậm hơn 2–3 lần |
| Lưu trữ + tải xuống (\~8 MB) | \~3đ | \~56đ | Cloudflare R2 không tính phí tải; [Supabase](https://makerkit.dev/blog/saas/supabase-pricing) 0,09 USD/GB |
| **Tổng giao cho khách** | **\~100đ** | **\~700đ** |  |
| **× 2 cho phần lãng phí** | **\~200đ** | **\~1.400đ** | Tạo lại, biến thể bị bỏ, bản xem trước |
| Cảnh AI motion 5s (tùy chọn) | \~2.900đ | \~13.000đ | [Seedance 2.0 Fast](https://www.atlascloud.ai/blog/cheapest-ai-video-generation-api-2026) \~0,022 USD/s so với [Veo 3.1](https://fal.ai/learn/tools/best-image-to-video-apis-2026) \~0,10 USD/s |

Để so sánh: công cụ AI trong TikTok Seller Center bán gói token 29,40 USD cho \~20 video 15s, tức **\~38.000đ/video**.

### Bảng giá v1 — gói nạp, không thuê bao

Khách Việt ít có thẻ quốc tế và SePay là chuyển khoản, nên **không có thuê bao tự gia hạn**. Gói nạp cũng tránh được việc phải xử lý hủy, hoàn tiền, thất bại khi gia hạn — bớt hẳn một mảng code.

| Gói | Giá | Credit | Đơn giá | Biên (stack rẻ) |
| --- | --- | --- | --- | --- |
| Dùng thử | 0đ | 5 video, có watermark | — | — |
| Seller | 99.000đ | 60 | 1.650đ | \~88% |
| Pro | 249.000đ | 200 | 1.245đ | \~84% |
| Agency | 599.000đ | 600 | 998đ | \~80% |

1 credit = 1 video 15–30s, 1 preset. Thêm preset cùng biến thể = 0,5 credit. Tạo lại kế hoạch (không render) = 0, giới hạn 3 lần mỗi dự án. Credit hạn 12 tháng. Cảnh AI motion bán riêng theo chi phí thực cộng 50%, chỉ mở khi giá API ổn định.

### Bốn quy tắc giữ biên (bắt buộc, code phải cưỡng chế)

1. **Việt Nam chỉ thu qua VietQR.** Cổng quyền tề ([Paddle / Lemon Squeezy 5% + 0,5 USD](https://fungies.io/paddle-vs-lemon-squeezy)) là **\~18% của đơn 99k** — riêng khoản này ăn hết biên. Chỉ dùng cho gói USD từ 15 USD trở lên.
2. **Gói rẻ nhất không cộng dồn hoa hồng.** Hoa hồng 15% + thưởng người mua 10% trên gói Seller là \~410đ/video; cộng với stack đắt thì **lỗ**. v1 chỉ thưởng credit.
3. **TTS phải có cache theo hash.** Khách sửa chữ rồi render lại là việc thường xuyên; không cache thì trả tiền giọng đọc nhiều lần cho cùng một câu.
4. **Bản xem trước chỉ 540p, giới hạn số lần tạo lại miễn phí.** Đây là chỗ phần lãng phí ×2 có thể thành ×5 nếu không chặn.

**Chi phí cố định** khoảng 2,5 triệu đồng/tháng (Supabase Pro, VPS, dịch vụ phụ). Với biên 88% trên gói Seller, cần **\~30 gói 99k mỗi tháng để hòa vốn**. Lưu ý [Hetzner đã tăng giá dòng CPX 2,4–2,75 lần từ 15/06/2026](https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/) — so giá lại trước khi đổi nhà cung cấp.

**S1-7 và S2-7 sẽ thay ước tính bằng số đo thật.** Chỉ chốt bảng giá sau khi render 100 video trên VPS thật và biết giá TTS theo hợp đồng thật.

## Tuân thủ

Ba luật mới đều đã có hiệu lực trước thời điểm này, nên không còn là việc "để sau". Hai trong ba luật biến tuân thủ thành **tính năng bán được**: khách trả tiền vì không muốn mất tài khoản hoặc bị phạt.

| Quy định | Hiệu lực | Phải làm gì trong sản phẩm | Ticket |
| --- | --- | --- | --- |
| [Luật Trí tuệ nhân tạo 134/2025](https://apolatlegal.com/vi/laws/luat-tri-tue-nhan-tao-2025-so-134-2025-qh15/) | 01/03/2026 | Nội dung mô phỏng ngoại hình hoặc giọng nói người thật phải gắn nhãn dễ nhận biết, **có dấu hiệu ở định dạng máy đọc được**. Giọng TTS = giọng tổng hợp → cần nhãn. Slideshow từ ảnh thật thì rủi ro thấp | S4-4 |
| [Luật Quảng cáo sửa đổi 75/2025](https://plo.vn/luat-quang-cao-moi-xac-dinh-ro-trach-nhiem-cua-nguoi-noi-tieng-khi-tham-gia-quang-cao-post880812.html) | 01/01/2026 | Thêm "người chuyển tải quảng cáo" (Điều 15a): phải công khai đây là quảng cáo và đã kiểm tài liệu sản phẩm. Siết quảng cáo ngầm. → Tự thêm nhãn quảng cáo vào kịch bản và phần mô tả; chặn lời chứng thực bịa, cam kết y tế, số liệu không nguồn | S4-4 |
| [Luật Bảo vệ dữ liệu cá nhân 91/2025](https://luatvietnam.vn/dan-su/luat-bao-ve-du-lieu-ca-nhan-2025-co-hieu-luc-khi-nao-568-103652-article.html) + [NĐ 356/2025](https://www.ey.com/content/dam/ey-unified-site/ey-com/vi-vn/technical/tax/documents/ey-vietnam-legal-alert-march-2026-decree-no356-2025-nd-cp-providing-detailed-guidance-for-implementation-of-personal-data-protection-law-viet.pdf) | 01/01/2026 | Gửi ảnh hoặc giọng sang LLM/TTS ở nước ngoài là **chuyển dữ liệu xuyên biên giới** (Điều 20) → cần hồ sơ đánh giá tác động, gửi trong 60 ngày. Cần điều khoản đồng ý rõ ràng khi đăng ký | S4-4, việc giấy tờ |
| [TikTok — nội dung không nguyên bản](https://www.bigseller.pro/blog/articleDetails/3778/tiktok-unoriginal-content.htm) | 15/09/2025 | Điểm vi phạm, đóng băng hoa hồng, giảm lượt hiển thị. Slideshow bị nhắm nhiều nhất vì dễ đăng lại → bộ kiểm trùng lặp giữa các user + quay theo hướng dẫn | S4-2, S4-3 |
| [Hướng dẫn của TikTok Shop VN](https://seller-vn.tiktok.com/university/essay?knowledge_id=2533343863097105&lang=vi-VN) | 21/09/2026 | Nội dung bị cấm, ghi thẳng trong tài liệu của họ: "link trong bio", tuyên bố y tế, từ tuyệt đối ("tốt nhất", "số 1", "rẻ nhất"), giá gây hiểu lầm. 1 video chỉ đăng 1 tài khoản | S4-4 |
| Shopee Video | đang áp dụng | Có nhãn AI; người bán tự chịu trách nhiệm gắn → nhắc người dùng bật nhãn khi xuất preset Shopee | S3-5 |

### Hai điểm cần luật sư xem, không tự quyết

1. **Miễn trừ 5 năm cho doanh nghiệp nhỏ có áp dụng cho Viprosell không?** Luật cho doanh nghiệp nhỏ và khởi nghiệp chọn không thực hiện Điều 21, 22 và khoản 2 Điều 33 trong 5 năm — **trừ trường hợp kinh doanh dịch vụ xử lý dữ liệu cá nhân hoặc xử lý dữ liệu nhạy cảm**. Viprosell xử lý ảnh người dùng tải lên (có thể có mặt người) và đó chính là dịch vụ đang bán → khả năng cao **không được miễn trừ**. Đây là khác biệt lớn về khối lượng giấy tờ.
2. **Giọng TTS có bị coi là "mô phỏng giọng nói người thật" không?** Giọng tổng hợp chung (không nhân bản từ một người cụ thể) có lẽ khác với giọng nhân bản, nhưng tôi không chắc. Nếu bị coi là có thì mọi video đều cần nhãn máy đọc được.

### Cách làm an toàn, rẻ

- Gắn nhãn AI dạng máy đọc được vào **mọi** video xuất ra (metadata `comment` hoặc C2PA), không chọn lọc — rẻ hơn việc phân loại từng video và đoán sai.
- Ghi nhận người dùng đã xác nhận có quyền dùng ảnh (checkbox có lưu thời điểm và phiên bản điều khoản).
- Xóa ảnh gốc sau 30 ngày, xóa EXIF/GPS ngay khi tải lên (S1-3) — giảm đúng phần dữ liệu phải báo cáo.
- Chọn nhà cung cấp TTS trong nước (FPT.AI) làm mặc định — vừa rẻ hơn 4–7 lần, vừa không phải chuyển dữ liệu ra ngoài.
- Lưu `prompt_version` và bản kịch bản cuối cho mọi video: khi có khiếu nại quảng cáo, đây là bằng chứng.

*Nhắc: phần này tôi đọc từ báo và trang tư vấn pháp lý, **chưa đối chiếu công báo**. Số hiệu luật và ngày hiệu lực khá nhất quán giữa các nguồn, nhưng cách áp dụng cho từng trường hợp thì không. Thuê luật sư đọc 2 điểm trên trước khi thu tiền thật.*

## Rủi ro, việc chưa biết & lịch sử quyết định

Rủi ro lớn nhất không phải kỹ thuật: **TikTok đang phạt đúng kiểu nội dung mà sản phẩm này sinh ra hàng loạt.** Nếu không giải được việc "10 biến thể nhưng vẫn là nội dung gốc", mọi thứ còn lại không có ý nghĩa.

| Rủi ro | Mức | Dấu hiệu sớm | Cách giảm |
| --- | --- | --- | --- |
| Nội dung bị coi là không nguyên bản → giảm lượt hiển thị, đóng băng hoa hồng | Cao | Người dùng concierge báo video không ai xem | S4-2 (quay theo hướng dẫn, nội dung gốc) + S4-3 (kiểm trùng giữa user). Đo ngay ở concierge test |
| TikTok mở công cụ AI trong Seller Center cho cả affiliate | Cao | TikTok công bố cập nhật | Không phụ thuộc 1 nền tảng: xuất đa preset, giữ dữ liệu hook riêng (thứ họ không có) |
| Khách không trả tiền vì có công cụ miễn phí | Cao | < 2/10 trả 99k ở cổng tuần 6 | Chạy concierge test từ tuần 1, không chờ build. Đổi ngách sớm còn rẻ |
| Biên mỏng ở gói 99k | Trung bình | Giá vốn thật > 500đ/video sau S2-7 | 4 quy tắc giữ biên; hoãn hoa hồng tiền mặt |
| Lại ra lỗi bảo mật kiểu P0 | Trung bình | PR không có test bảo mật | Chạy `/security-review` mỗi PR; gitleaks pre-commit; test P0 làm mẫu |
| VPS 1 máy là điểm chết đơn | Trung bình | — | Hàng đợi Postgres giữ việc; worker chạy được ở nhiều nơi (VPS, máy nhà, cloud) không cần sửa code |
| Đối chiếu thanh toán sai (chuyển khoản thiếu tiền, sai mã) | Thấp | Khách khiếu nại | `payment_intents` có số tiền kỳ vọng; lệch → `amount_mismatch` chốt tay, không tự cộng |

### Việc chưa biết — cần bạn trả lời

- [ ] `deploy_final.tar.gz`, `backend.zip`, `deploy_frontend_updated.zip` đã từng upload lên đâu chưa (FTP tới `ninhle.com`, Google Drive, Zalo)? Tôi đã kiểm: **không tải được từ web**, nhưng chúng có thể nằm ngoài webroot. Nếu từng upload → xoay mọi khóa trong `backend/.env`.
- [ ] Token Hostinger API trong `hostinger_ssh_api.py` và `setup_ssh_paramiko.py` còn hiệu lực không? Nếu còn thì thu hồi.
- [ ] VPS Hostinger cấu hình thế nào (số vCPU, RAM)? Cần cho S2-7 để biết chạy song song được bao nhiêu worker.
- [ ] Ngân sách AI mỗi tháng cho giai đoạn thử? Quyết định chọn Claude Haiku hay Gemini Flash làm mặc định.
- [ ] Trong thời gian repo công khai, có ai ngoài bạn từng clone không (xem Insights → Traffic trên GitHub, dữ liệu giữ 14 ngày)?
- [ ] Ai là dev? 1 người full-time hay part-time? Lịch sprint ở trên tính cho 1 dev full-time.

### Lịch sử quyết định

| Ngày | Phạm vi | Quyết định | Trạng thái | Xét lại khi |
| --- | --- | --- | --- | --- |
| 19/10/2026 | Thị trường | Việt Nam trước; quốc tế thử qua plugin WooCommerce; Đông Nam Á sau cổng tuần 12 | Đã chốt | Cổng tuần 12 không đạt đủ 4 chỉ số |
| 19/10/2026 | Khách đầu | Affiliate TikTok Shop + shop nhỏ đa sàn | Đã chốt | Cổng tuần 6 |
| 19/10/2026 | Bảo mật | Sửa 11 lỗi P0; fail-closed toàn bộ; xác minh token thật | Code xong, chờ duyệt | — |
| 19/10/2026 | Kiến trúc | API + worker lên Hostinger VPS; hàng đợi Postgres; render CPU; bỏ Cloudflare Tunnel | Đề xuất | S2-7 cho thấy CPU không đủ |
| 19/10/2026 | Sản phẩm | Bỏ face-swap, Stripe, PayPal, Lemon Squeezy, Redis/BullMQ, Remotion, render canvas | Đề xuất | Có khách trả tiền cho tính năng đó |
| 19/10/2026 | Giá | Gói nạp VietQR, không thuê bao; hoãn hoa hồng tiền mặt | Đề xuất | Sau S2-7 có giá vốn thật |
| 19/10/2026 | Định vị | "Video ra đơn, an toàn cho tài khoản" thay vì "công cụ tạo video" | Đề xuất | Concierge test cho lý do từ chối khác |

### Nguồn & giới hạn

**Số đo tự làm (tin được):** thời gian render 13,8 giây CPU · lỗi chữ `%` · trạng thái webhook trên prod · nhà cung cấp của `v.ninhle.com` · các lỗi trong code · 8/8 test đạt.

**Đã mở đọc trực tiếp:** [hướng dẫn công cụ tạo video AI của TikTok Shop VN](https://seller-vn.tiktok.com/university/essay?knowledge_id=2533343863097105&lang=vi-VN) (21/09/2026) — nguồn duy nhất tôi mở nguyên trang.

**Lấy từ kết quả tìm kiếm, chưa mở từng trang:** mọi giá dịch vụ (LLM, TTS, API video, VPS, Supabase, cổng thanh toán), số liệu thị trường, và phần pháp lý. Nhiều nguồn là trang tổng hợp hoặc blog của đối thủ, có chỗ mâu thuẫn nhau (ví dụ Metric 429.700 tỷ so với YouNet 458.160 tỷ; giá Pippit mỗi trang một con số). **Trước khi đưa vào tài liệu bán hàng hoặc hợp đồng, mở lại trang chính thức của từng nhà cung cấp.**

**Chưa làm:** chưa đọc 82 tài liệu còn lại trong `docs/`, chưa đọc `supabase/functions/*`, chưa chạy thử toàn bộ ứng dụng, chưa đọc nội dung các script SSH/deploy (chỉ đếm dòng giống mật khẩu), chưa benchmark trên VPS thật, chưa đối chiếu luật với công báo.
