-- Security definer function to look up a profile ID by affiliate_code
-- This bypasses RLS so any authenticated user can resolve an affiliate code
-- without needing SELECT access to other users' profiles.
CREATE OR REPLACE FUNCTION public.lookup_affiliate_referrer(ref_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.profiles WHERE affiliate_code = ref_code LIMIT 1;
$$;