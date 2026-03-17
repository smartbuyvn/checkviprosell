-- Viprosell v1.2 Database Seed File
-- Execute this file via Supabase SQL Editor or `supabase db reset` locally to establish operational baselines.

-- ============================================================
-- 1. SYSTEM SETTINGS
-- Establishing safe default admin settings for execution.
-- ============================================================
INSERT INTO public.system_settings (key, value, description) VALUES
  ('LOCAL_ONLY_MODE', 'true', 'Disable all external cloud AI/render calls for local dev safety.'),
  ('PREMIUM_RENDER_ENABLED', 'true', 'Show/hide premium render (FaceFusion/Cloud GPU) options in UI.'),
  ('CLOUD_FALLBACK_ENABLED', 'false', 'Fallback to cloud when local render fails.'),
  ('ALLOW_EXTERNAL_AI_APIS', 'true', 'Permit external AI provider calls (OpenAI/Gemini).'),
  ('AFFILIATE_COMMISSION_RATE', '0.2', 'Affiliate commission rate (20%).')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================
-- 2. PLANS
-- Establishing the 3-tier monetisation plan.
-- ============================================================
INSERT INTO public.plans (code, name, credits, price, features, sort_order) VALUES
  ('free',     'Free',     3,  0,  '["3 credits/tháng","Quick Ads only","Watermark"]', 0),
  ('pro',      'Pro',     30, 19,  '["30 credits/tháng","All packages","No watermark","Priority render"]', 1),
  ('business', 'Business',100, 49, '["100 credits/tháng","All packages","No watermark","Priority render","API access","FaceFusion Review Config"]', 2)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  credits = EXCLUDED.credits, 
  price = EXCLUDED.price, 
  features = EXCLUDED.features;

-- ============================================================
-- 3. ADMIN ASSIGNMENT SCRIPT (GUIDANCE)
-- To bootstrap an admin user, register the user via the frontend,
-- retrieve their UUID from auth.users, and run the following replacing '<UUID>':
-- 
-- INSERT INTO public.user_roles (user_id, role) VALUES ('<UUID>', 'admin') ON CONFLICT DO NOTHING;
-- ============================================================
