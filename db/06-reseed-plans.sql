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
  ('free', 'Free', 5, 0, 'VND', '["5 credits dùng thử", "Render bản nháp", "3 loại video", "Overlay chữ"]', true, 1),
  
  ('pro', 'Pro', 50, 130000, 'VND', '["50 credits", "Tất cả loại video", "Xuất caption", "Hỗ trợ qua email"]', true, 2),
  
  ('business', 'Business', 110, 250000, 'VND', '["110 credits", "Tất cả loại video", "Xuất caption", "Hỗ trợ ưu tiên"]', true, 3),
  
  ('premium', 'Premium', 240, 520000, 'VND', '["240 credits", "Tất cả loại video", "Xuất caption", "Hỗ trợ ưu tiên"]', true, 4);
