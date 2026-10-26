-- ╔══════════════════════════════════════════════════════════════╗
-- ║  VIPROSELL — Seed Plans + Lemon Squeezy IDs                ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New Query       ║
-- ║  Idempotent: Safe to re-run multiple times                 ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── Step 1: Add Lemon Squeezy columns if they don't exist ────
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS lemon_product_id TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS lemon_variant_id TEXT;

-- ─── Step 2: Clear old data and insert fresh plans ────────────
DELETE FROM public.plans;

INSERT INTO public.plans (
  code, name, credits, price, currency, features, is_active, sort_order,
  lemon_product_id, lemon_variant_id
)
VALUES
  -- Free tier: No payment needed
  ('free', 'Free', 5, 0, 'VND',
    '["5 credits miễn phí", "Draft local render", "3 loại video", "Overlay cơ bản"]',
    true, 1,
    NULL, NULL),

  -- Pro tier
  ('pro', 'Pro', 50, 130000, 'VND',
    '["50 credits/tháng", "Draft + Voice render", "Ưu tiên AI xử lý", "Tất cả loại video", "Xuất caption"]',
    true, 2,
    'test_product_pro_001', 'test_variant_pro_001'),

  -- Business tier (popular)
  ('business', 'Business', 110, 250000, 'VND',
    '["110 credits/tháng", "Premium cloud render", "Hỗ trợ ưu tiên", "Tất cả tính năng", "API access"]',
    true, 3,
    'test_product_biz_001', 'test_variant_biz_001'),

  -- Premium tier
  ('premium', 'Premium', 240, 520000, 'VND',
    '["240 credits/tháng", "Premium cloud render", "Dự án không giới hạn", "Không watermark", "Custom branding"]',
    true, 4,
    'test_product_prm_001', 'test_variant_prm_001');

-- ─── Step 3: Verify ──────────────────────────────────────────
SELECT code, name, credits, price, currency, lemon_variant_id, sort_order
FROM public.plans
ORDER BY sort_order;
