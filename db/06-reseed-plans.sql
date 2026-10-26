-- ============================================================
-- VIPROSELL — Reseed Plans
-- Date: 2026-04-14
-- Purpose: Replace old plan catalog with 4 new plans matching 
--          the updated UI design. No FK references exist to 
--          plans table, so DELETE is safe.
-- ============================================================

-- Step 1: Clear old plans
DELETE FROM public.plans;

-- Step 2: Insert new plans matching UI design
INSERT INTO public.plans (code, name, credits, price, currency, features, is_active, sort_order)
VALUES 
  ('free', 'Free', 5, 0, 'VND', '["5 credits miễn phí", "Draft local render", "3 loại video", "Overlay cơ bản"]', true, 1),
  
  ('pro', 'Pro', 50, 130000, 'VND', '["50 credits/tháng", "Draft + Voice render", "Ưu tiên AI xử lý", "Tất cả loại video", "Xuất caption"]', true, 2),
  
  ('business', 'Business', 110, 250000, 'VND', '["110 credits/tháng", "Premium cloud render", "Hỗ trợ ưu tiên", "Tất cả tính năng", "API access"]', true, 3),
  
  ('premium', 'Premium', 240, 520000, 'VND', '["240 credits/tháng", "Premium cloud render", "Dự án không giới hạn", "Không watermark", "Custom branding"]', true, 4);
