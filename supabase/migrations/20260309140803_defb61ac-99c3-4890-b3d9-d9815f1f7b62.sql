
-- ============================================================
-- Fix: Drop ALL restrictive RLS policies and recreate as PERMISSIVE
-- Fix: Add missing triggers
-- ============================================================

-- 1) profiles
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 2) user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) projects
DROP POLICY IF EXISTS "Users read own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins read all projects" ON public.projects;
DROP POLICY IF EXISTS "Users create projects" ON public.projects;
DROP POLICY IF EXISTS "Users update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users delete own projects" ON public.projects;

CREATE POLICY "Users read own projects" ON public.projects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all projects" ON public.projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own projects" ON public.projects FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4) project_assets
DROP POLICY IF EXISTS "Users manage own assets" ON public.project_assets;
DROP POLICY IF EXISTS "Admins read all assets" ON public.project_assets;

CREATE POLICY "Users manage own assets" ON public.project_assets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_assets.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_assets.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Admins read all assets" ON public.project_assets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5) product_intelligence
DROP POLICY IF EXISTS "Users read own intel" ON public.product_intelligence;
DROP POLICY IF EXISTS "Admins read all intel" ON public.product_intelligence;

CREATE POLICY "Users read own intel" ON public.product_intelligence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = product_intelligence.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Admins read all intel" ON public.product_intelligence FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) concepts
DROP POLICY IF EXISTS "Users read own concepts" ON public.concepts;
DROP POLICY IF EXISTS "Admins read all concepts" ON public.concepts;
DROP POLICY IF EXISTS "Users update own concepts" ON public.concepts;

CREATE POLICY "Users read own concepts" ON public.concepts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = concepts.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Admins read all concepts" ON public.concepts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own concepts" ON public.concepts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = concepts.project_id AND projects.user_id = auth.uid()));

-- 7) scripts
DROP POLICY IF EXISTS "Users read own scripts" ON public.scripts;
DROP POLICY IF EXISTS "Admins read all scripts" ON public.scripts;

CREATE POLICY "Users read own scripts" ON public.scripts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = scripts.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Admins read all scripts" ON public.scripts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8) visual_packs
DROP POLICY IF EXISTS "Users read own visual packs" ON public.visual_packs;
DROP POLICY IF EXISTS "Admins read all visual packs" ON public.visual_packs;

CREATE POLICY "Users read own visual packs" ON public.visual_packs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = visual_packs.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Admins read all visual packs" ON public.visual_packs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9) caption_exports
DROP POLICY IF EXISTS "Users read own captions" ON public.caption_exports;
DROP POLICY IF EXISTS "Admins read all captions" ON public.caption_exports;

CREATE POLICY "Users read own captions" ON public.caption_exports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = caption_exports.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Admins read all captions" ON public.caption_exports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 10) renders
DROP POLICY IF EXISTS "Users read own renders" ON public.renders;
DROP POLICY IF EXISTS "Admins read all renders" ON public.renders;

CREATE POLICY "Users read own renders" ON public.renders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = renders.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Admins read all renders" ON public.renders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 11) payments
DROP POLICY IF EXISTS "Users read own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins read all payments" ON public.payments;

CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 12) credit_ledger
DROP POLICY IF EXISTS "Users read own ledger" ON public.credit_ledger;
DROP POLICY IF EXISTS "Admins read all ledger" ON public.credit_ledger;

CREATE POLICY "Users read own ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 13) affiliate_events
DROP POLICY IF EXISTS "Users read own affiliate" ON public.affiliate_events;
DROP POLICY IF EXISTS "Admins read all affiliate" ON public.affiliate_events;

CREATE POLICY "Users read own affiliate" ON public.affiliate_events FOR SELECT TO authenticated USING (referrer_id = auth.uid());
CREATE POLICY "Admins read all affiliate" ON public.affiliate_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 14) usage_logs
DROP POLICY IF EXISTS "Users read own usage" ON public.usage_logs;
DROP POLICY IF EXISTS "Admins read all usage" ON public.usage_logs;

CREATE POLICY "Users read own usage" ON public.usage_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all usage" ON public.usage_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 15) prompts
DROP POLICY IF EXISTS "Admins manage prompts" ON public.prompts;

CREATE POLICY "Admins manage prompts" ON public.prompts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read active prompts" ON public.prompts FOR SELECT TO authenticated USING (is_active = true);

-- 16) system_settings
DROP POLICY IF EXISTS "Admins manage settings" ON public.system_settings;

CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);

-- 17) plans
DROP POLICY IF EXISTS "Anyone reads active plans" ON public.plans;
DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;

CREATE POLICY "Anyone reads active plans" ON public.plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 18) admin_audit_logs
DROP POLICY IF EXISTS "Admins read audit logs" ON public.admin_audit_logs;

CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert audit logs" ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 19) service_health_logs
DROP POLICY IF EXISTS "Admins read health logs" ON public.service_health_logs;

CREATE POLICY "Admins read health logs" ON public.service_health_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Triggers
-- ============================================================

-- handle_new_user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_renders BEFORE UPDATE ON public.renders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_affiliate_events BEFORE UPDATE ON public.affiliate_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_system_settings BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_prompts BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
