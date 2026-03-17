-- Safely attach updated_at triggers (drop if exists first)
DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects;
DROP TRIGGER IF EXISTS set_updated_at_payments ON public.payments;
DROP TRIGGER IF EXISTS set_updated_at_affiliate_events ON public.affiliate_events;
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at_prompts ON public.prompts;
DROP TRIGGER IF EXISTS set_updated_at_renders ON public.renders;
DROP TRIGGER IF EXISTS set_updated_at_system_settings ON public.system_settings;

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_payments
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_affiliate_events
  BEFORE UPDATE ON public.affiliate_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_prompts
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_renders
  BEFORE UPDATE ON public.renders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_system_settings
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();