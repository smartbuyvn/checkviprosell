-- ============================================================
-- VIPROSELL — FULL DATABASE SCHEMA
-- Phase 02B — Real Supabase Wiring
-- ============================================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.package_type AS ENUM ('quick_ads', 'review_video', 'conversion_video');
CREATE TYPE public.product_category AS ENUM ('beauty', 'fashion', 'home', 'other');
CREATE TYPE public.project_status AS ENUM ('draft', 'analyzing', 'concept_ready', 'script_ready', 'render_queued', 'rendering', 'completed', 'failed');
CREATE TYPE public.render_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE public.render_mode AS ENUM ('draft_local', 'draft_local_tts', 'premium_cloud');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.affiliate_event_status AS ENUM ('pending', 'approved', 'paid', 'rejected');
CREATE TYPE public.tts_mode AS ENUM ('local', 'cloud');
CREATE TYPE public.order_type AS ENUM ('plan_subscription', 'credit_pack');
CREATE TYPE public.overlay_style AS ENUM ('headline', 'price', 'badge', 'cta');
CREATE TYPE public.angle_type AS ENUM ('pain_first', 'review_trust', 'offer_conversion');
CREATE TYPE public.price_band AS ENUM ('low', 'mid', 'high');

-- ============================================================
-- USERS & ROLES
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  affiliate_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ============================================================
-- PLANS
-- ============================================================

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================

CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  package_type package_type NOT NULL,
  category product_category NOT NULL DEFAULT 'other',
  source_url TEXT,
  manual_notes TEXT,
  status project_status NOT NULL DEFAULT 'draft',
  language TEXT NOT NULL DEFAULT 'vi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AI PIPELINE DATA
-- ============================================================

CREATE TABLE public.product_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  product_name TEXT,
  category product_category,
  target_buyer TEXT,
  price_band price_band,
  usp_list JSONB DEFAULT '[]',
  pain_points JSONB DEFAULT '[]',
  objections JSONB DEFAULT '[]',
  trust_signals JSONB DEFAULT '[]',
  use_context JSONB DEFAULT '[]',
  recommended_package_fit JSONB DEFAULT '[]',
  confidence_score NUMERIC(3,2) DEFAULT 0,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  angle_type angle_type NOT NULL,
  title TEXT NOT NULL,
  big_idea TEXT,
  hook TEXT,
  cta TEXT,
  why_it_works TEXT,
  score NUMERIC(3,2) DEFAULT 0,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_type package_type NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  script_text TEXT,
  scene_cards JSONB DEFAULT '[]',
  cta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.visual_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  render_mode render_mode NOT NULL DEFAULT 'draft_local',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  subtitle_text TEXT,
  overlay_list JSONB DEFAULT '[]',
  asset_plan JSONB DEFAULT '[]',
  music_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.caption_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  caption_tiktok TEXT,
  caption_reels TEXT,
  hashtags JSONB DEFAULT '[]',
  thumbnail_text TEXT,
  short_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RENDERS
-- ============================================================

CREATE TABLE public.renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  render_mode render_mode NOT NULL DEFAULT 'draft_local',
  status render_status NOT NULL DEFAULT 'queued',
  provider TEXT,
  output_url TEXT,
  error_code TEXT,
  error_message TEXT,
  last_fail_reason TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PAYMENTS & BILLING
-- ============================================================

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  payment_method TEXT,
  provider_txn_id TEXT,
  order_type order_type NOT NULL,
  plan_code TEXT,
  credit_pack_code TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id),
  project_id UUID REFERENCES public.projects(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AFFILIATE
-- ============================================================

CREATE TABLE public.affiliate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_id UUID NOT NULL REFERENCES auth.users(id),
  payment_id UUID REFERENCES public.payments(id),
  status affiliate_event_status NOT NULL DEFAULT 'pending',
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROMPTS
-- ============================================================

CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  package_type package_type,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USAGE & LOGS
-- ============================================================

CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID REFERENCES public.projects(id),
  step_name TEXT NOT NULL,
  trace_id TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.service_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  service_url TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  meta JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_key TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_renders_updated_at BEFORE UPDATE ON public.renders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_affiliate_events_updated_at BEFORE UPDATE ON public.affiliate_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON public.prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS ENABLE
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caption_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- plans (public read for active)
CREATE POLICY "Anyone reads active plans" ON public.plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- projects
CREATE POLICY "Users read own projects" ON public.projects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own projects" ON public.projects FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all projects" ON public.projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- project_assets
CREATE POLICY "Users manage own assets" ON public.project_assets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Admins read all assets" ON public.project_assets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- product_intelligence
CREATE POLICY "Users read own intel" ON public.product_intelligence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Admins read all intel" ON public.product_intelligence FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- concepts
CREATE POLICY "Users read own concepts" ON public.concepts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Users update own concepts" ON public.concepts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Admins read all concepts" ON public.concepts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- scripts
CREATE POLICY "Users read own scripts" ON public.scripts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Admins read all scripts" ON public.scripts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- visual_packs
CREATE POLICY "Users read own visual packs" ON public.visual_packs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Admins read all visual packs" ON public.visual_packs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- caption_exports
CREATE POLICY "Users read own captions" ON public.caption_exports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Admins read all captions" ON public.caption_exports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- renders
CREATE POLICY "Users read own renders" ON public.renders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "Admins read all renders" ON public.renders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- payments
CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- credit_ledger
CREATE POLICY "Users read own ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- affiliate_events
CREATE POLICY "Users read own affiliate" ON public.affiliate_events FOR SELECT TO authenticated USING (referrer_id = auth.uid());
CREATE POLICY "Admins read all affiliate" ON public.affiliate_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- usage_logs
CREATE POLICY "Users read own usage" ON public.usage_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all usage" ON public.usage_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- system_settings
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- prompts
CREATE POLICY "Admins manage prompts" ON public.prompts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- admin_audit_logs
CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- service_health_logs
CREATE POLICY "Admins read health logs" ON public.service_health_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- STORAGE BUCKET for project assets
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('project-assets', 'project-assets', false);

CREATE POLICY "Users upload own assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);