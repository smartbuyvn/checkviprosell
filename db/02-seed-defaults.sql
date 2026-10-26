-- ============================================================
-- VIPROSELL — SEED DEFAULTS
-- Phase: 02 — Runtime Defaults
-- Run AFTER 01-schema.sql
-- ============================================================

-- ─── System Settings ─────────────────────────────────────────
INSERT INTO public.system_settings (key, value, description) VALUES
  ('LOCAL_ONLY_MODE',          'true',                              'Block all external AI API calls'),
  ('ALLOW_EXTERNAL_AI_APIS',   'false',                             'Allow Gemini / OpenAI fallback when LOCAL_ONLY_MODE is off'),
  ('PREMIUM_RENDER_ENABLED',   'false',                             'Enable cloud render paths'),
  ('LOCAL_LLM_URL',            '"http://localhost:11434/v1/chat/completions"', 'Ollama OpenAI-compatible endpoint'),
  ('OLLAMA_MODEL',             '"qwen2.5:7b"',                      'Ollama model to use for all AI tasks'),
  ('LOCAL_RENDER_WORKER_URL',  '"http://127.0.0.1:3002"',           'Physical FFmpeg worker base URL'),
  ('DEFAULT_TTS_MODE',         '"local"',                           'TTS engine: local | cloud'),
  ('INTERNAL_CALLBACK_SECRET', '"CHANGE_ME_IN_PRODUCTION"',         'HMAC secret for render worker callbacks')
ON CONFLICT (key) DO NOTHING;

-- ─── Default Plans ────────────────────────────────────────────
INSERT INTO public.plans (code, name, credits, price, currency, features, sort_order) VALUES
  ('free',    'Miễn phí',  50,   0,      'VND', '["3 lần dùng QuickAds"]',                                        0),
  ('basic',   'Cơ bản',    250,  250000, 'VND', '["250 credits", "QuickAds + Review"]',                           1),
  ('pro',     'Pro',       600,  500000, 'VND', '["600 credits", "Tất cả gói", "Ưu tiên hàng đợi"]',              2),
  ('premium', 'Premium',   1500, 1000000,'VND', '["1500 credits", "Tất cả gói", "Render ưu tiên", "Export HD"]',  3)
ON CONFLICT (code) DO NOTHING;

-- ─── Admin Role Seed (replace UUID with actual Supabase auth user ID) ─────
-- Uncomment and fill in your admin user UUID before running:
--
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('YOUR-ADMIN-USER-UUID-HERE', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;
