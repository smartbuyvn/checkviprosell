# Viprosell â€” RLS POLICIES

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## Security Function

```sql
-- Already defined in schema
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
```

## Policies

### profiles
```sql
-- Users read own profile
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

-- Users update own profile
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Admins read all profiles
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### user_roles
```sql
-- Admins manage roles
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### plans
```sql
-- Anyone can read active plans
CREATE POLICY "Anyone reads plans" ON public.plans
  FOR SELECT USING (is_active = true);

-- Admins manage plans
CREATE POLICY "Admins manage plans" ON public.plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### projects
```sql
-- Users CRUD own projects
CREATE POLICY "Users read own projects" ON public.projects
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users create projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own projects" ON public.projects
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Admins read all
CREATE POLICY "Admins read all projects" ON public.projects
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### project_assets
```sql
-- Users manage own project assets (via project ownership)
CREATE POLICY "Users manage own assets" ON public.project_assets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));

-- Admins read all
CREATE POLICY "Admins read all assets" ON public.project_assets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### product_intelligence, concepts, scripts, visual_packs, caption_exports
```sql
-- Same pattern: users access via project ownership
-- Admins read all via has_role
```

### renders
```sql
-- Users read own renders via project
CREATE POLICY "Users read own renders" ON public.renders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));

-- Admins read all
CREATE POLICY "Admins read all renders" ON public.renders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### payments
```sql
-- Users read own payments
CREATE POLICY "Users read own payments" ON public.payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admins read all
CREATE POLICY "Admins read all payments" ON public.payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### credit_ledger
```sql
-- Users read own ledger
CREATE POLICY "Users read own ledger" ON public.credit_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

### affiliate_events
```sql
-- Users read own affiliate events (as referrer)
CREATE POLICY "Users read own affiliate" ON public.affiliate_events
  FOR SELECT TO authenticated USING (referrer_id = auth.uid());

-- Admins read all
CREATE POLICY "Admins read all affiliate" ON public.affiliate_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### system_settings
```sql
-- Admins only
CREATE POLICY "Admins manage settings" ON public.system_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Public read for non-sensitive settings (via edge function, not direct RLS)
```

### prompts
```sql
-- Admins manage
CREATE POLICY "Admins manage prompts" ON public.prompts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### admin_audit_logs, service_health_logs
```sql
-- Admin read only
CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read health logs" ON public.service_health_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### usage_logs
```sql
-- Users read own
CREATE POLICY "Users read own usage" ON public.usage_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admins read all
CREATE POLICY "Admins read all usage" ON public.usage_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```
