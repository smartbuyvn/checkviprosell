-- ============================================================
-- Bảng giá mới — chốt 28/10/2026
--
-- Đơn vị: 1 credit = 1 video chuẩn (15–20 giây, 720p, có watermark ở gói Free).
--
-- Vì sao đổi: bản cũ trừ 20 credit mỗi video trong khi gói Free chỉ có 5 — gói dùng
-- thử KHÔNG LÀM NỔI MỘT VIDEO NÀO, và gói Pro 130.000₫/50 credit chỉ ra 2,5 video,
-- tức 52.000₫ mỗi video. Đó là lỗi product-market fit, không phải lỗi kỹ thuật.
--
-- Giá mới bám theo giá trị thật khách nhận được, và số credit trừ nay tính bằng
-- creditsFor(spec) trong backend/src/lib/credit-cost.ts chứ không viết cứng.
--
-- Chạy lại nhiều lần đều an toàn.
-- ============================================================


-- ─── Free: 5 → 3 credit ───
-- 3 video đủ để khách thấy giá trị, rẻ hơn 40% chi phí thu hút khách.
-- Điều bắt buộc: Free phải tạo được ít nhất 1 video hoàn chỉnh ngay.

UPDATE public.plans
SET credits = 3,
    features = '["3 credits dùng thử", "Video có watermark", "Độ phân giải 720p", "Render bản nháp"]',
    is_active = true
WHERE code = 'free';


-- ─── Starter: gói mới, giữ giá vào cửa thấp ───

INSERT INTO public.plans (code, name, credits, price, currency, features, is_active)
SELECT 'starter', 'Starter', 30, 129000, 'VND',
       '["30 credits", "Tất cả loại video", "Xuất caption", "Hỗ trợ qua email"]', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE code = 'starter');

UPDATE public.plans
SET name = 'Starter', credits = 30, price = 129000, is_active = true,
    features = '["30 credits", "Tất cả loại video", "Xuất caption", "Hỗ trợ qua email"]'
WHERE code = 'starter';


-- ─── Pro: 130.000₫/50 → 249.000₫/80 ───

UPDATE public.plans
SET name = 'Pro', credits = 80, price = 249000, is_active = true,
    features = '["80 credits", "Tất cả loại video", "Xuất caption", "Hỗ trợ ưu tiên"]'
WHERE code = 'pro';


-- ─── Business: 250.000₫/110 → 499.000₫/180 ───

UPDATE public.plans
SET name = 'Business', credits = 180, price = 499000, is_active = true,
    features = '["180 credits", "Tất cả loại video", "Xuất caption", "Hỗ trợ ưu tiên"]'
WHERE code = 'business';


-- ─── Premium: TẮT, chưa mở bán ───
--
-- Ở giả định giá vốn đầy đủ 2.600₫/video thì 899.000₫/360 là âm biên 4,1%.
-- Chỉ mở lại khi một trong hai điều đúng:
--   1. Giá vốn đầy đủ (không chỉ chi phí render) xuống dưới 2.000₫/video, hoặc
--   2. Premium bán kèm giá trị phi render: bỏ watermark, brand kit, giọng cao cấp,
--      API, ưu tiên hàng đợi, nhiều kênh xuất bản.
--
-- Dùng is_active = false chứ KHÔNG xoá dòng: khách đã mua Premium trước đây vẫn cần
-- dòng này để đối soát lịch sử thanh toán.

UPDATE public.plans
SET is_active = false
WHERE code = 'premium';
