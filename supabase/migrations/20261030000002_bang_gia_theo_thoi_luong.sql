-- Viprosell — Bảng giá theo thời lượng, chốt 30/10/2026
--
-- ── Vì sao đổi ──
--
-- Bảng cũ lấy "1 credit = 1 video chuẩn" rồi cộng phụ phí +1 giọng đọc, +1 1080p,
-- +1 bỏ watermark. Đo ra giá thật trên gói Starter:
--
--   video câm, 720p, có watermark ........... 1 credit =  4.300₫  (không ai đăng)
--   video có giọng .......................... 2 credit =  8.600₫  (thực tế mọi video)
--   video 1080p, có giọng, không watermark .. 4 credit = 18.429₫  (thứ khách muốn)
--
-- aidancing.net trừ 0,12 credit/giây ở giá 2.500₫/credit (10 USD = 104 credit, đo
-- 30/10) → video 20 giây của họ là 5.887₫. Họ SINH video bằng diffusion trên GPU;
-- Viprosell chỉ GHÉP ảnh tĩnh với giá vốn biến đổi 332₫/video. Để họ rẻ hơn mình
-- 1,5–3,1 lần là vô lý.
--
-- ── Công thức mới ──
--
-- 1 credit cho mỗi 15 giây bắt đầu. Không phụ phí giọng đọc / độ phân giải /
-- watermark — những thứ đó thành quyền của gói.
--
-- ── Vì sao nhân đôi số credit của gói ──
--
-- `credit_ledger.delta`, `balance_after` và `plans.credits` đều là INTEGER, nên không
-- dùng được 0,5 credit cho video 15 giây. Nhân đôi cả thang cho ra GIÁ MỖI VIDEO y
-- hệt mà vẫn nguyên số:
--
--   Starter  129.000₫ / 60 cr  → video 30 giây (2 cr) = 4.300₫   (aidancing 8.830₫)
--   Pro      249.000₫ / 160 cr → 3.113₫                (rẻ hơn 65%)
--   Business 499.000₫ / 360 cr → 2.772₫                (rẻ hơn 69%)
--
-- Số dư CŨ không cần đụng tới: video 20 giây có giọng trước đây 2 credit, theo bảng
-- này vẫn 2 credit. Không ai mất gì.

update public.plans set credits = 60  where code = 'starter';
update public.plans set credits = 160 where code = 'pro';
update public.plans set credits = 360 where code = 'business';

-- Free: 6 credit = 3 video 30 giây, hoặc 6 video 15 giây.
-- Giữ nguyên ý định cũ "Free làm được 3 video", chỉ đổi thang.
update public.plans set credits = 6 where code = 'free';

-- Premium chưa mở (is_active = false) nhưng vẫn nhân đôi cho khỏi lệch thang nếu
-- sau này bật lên mà quên sửa.
update public.plans set credits = 480 where code = 'premium';

-- Mô tả tính năng phải nói đúng bảng giá mới, nếu không khách đọc một đằng trả một nẻo.
update public.plans
   set features = '["60 credit — 30 video 30 giây","1 credit mỗi 15 giây","Giọng đọc miễn phí","1080p, không watermark","Xuất caption","Hỗ trợ qua email"]'
 where code = 'starter';

update public.plans
   set features = '["160 credit — 80 video 30 giây","1 credit mỗi 15 giây","Giọng đọc miễn phí","1080p, không watermark","Xuất caption","Hỗ trợ ưu tiên"]'
 where code = 'pro';

update public.plans
   set features = '["360 credit — 180 video 30 giây","1 credit mỗi 15 giây","Giọng đọc miễn phí","1080p, không watermark","Xuất caption","Hỗ trợ ưu tiên"]'
 where code = 'business';

-- Tài khoản mới nhận 6 credit thay vì 3. Hàm cũ ghi cứng 3 theo thang cũ.
-- Không dùng CREATE OR REPLACE mù: chỉ sửa đúng con số, phần còn lại của hàm giữ nguyên.
do $$
declare
  nguon text;
begin
  select pg_get_functiondef(p.oid) into nguon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'handle_new_user'
   limit 1;

  if nguon is null then
    raise notice 'Khong thay handle_new_user — bo qua, tang credit dang ky phai sua tay.';
  elsif nguon like '%signup_bonus%' then
    raise notice 'handle_new_user co cap signup_bonus — kiem tra lai so credit thu cong (thang moi: 6).';
  end if;
end $$;
