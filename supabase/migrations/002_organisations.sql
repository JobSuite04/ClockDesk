-- ============================================================
-- ClockDesk — Multi-tenancy: Organisations
-- Run this AFTER 001_initial_schema.sql
-- ============================================================

-- Organisations table
CREATE TABLE IF NOT EXISTS public.organisations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Add organisation_id to all data tables
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.clock_events
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.holiday_requests
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS profiles_org_idx           ON public.profiles (organisation_id);
CREATE INDEX IF NOT EXISTS clock_events_org_idx        ON public.clock_events (organisation_id);
CREATE INDEX IF NOT EXISTS holiday_requests_org_idx    ON public.holiday_requests (organisation_id);
CREATE INDEX IF NOT EXISTS notifications_org_idx       ON public.notifications (organisation_id);

-- ============================================================
-- Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organisation_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- Drop old RLS policies and replace with org-scoped ones
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "users can read own profile"       ON public.profiles;
DROP POLICY IF EXISTS "admins can read all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "admins can update profiles"       ON public.profiles;
DROP POLICY IF EXISTS "admins can insert profiles"       ON public.profiles;

CREATE POLICY "users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users can read org profiles"
  ON public.profiles FOR SELECT
  USING (organisation_id = public.get_my_org_id());

CREATE POLICY "admins can update org profiles"
  ON public.profiles FOR UPDATE
  USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

CREATE POLICY "admins can insert org profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

-- clock_events
DROP POLICY IF EXISTS "staff can insert own clock events"   ON public.clock_events;
DROP POLICY IF EXISTS "staff can read own clock events"     ON public.clock_events;
DROP POLICY IF EXISTS "admins can read all clock events"    ON public.clock_events;
DROP POLICY IF EXISTS "admins can update clock events"      ON public.clock_events;

CREATE POLICY "staff can insert own clock events"
  ON public.clock_events FOR INSERT
  WITH CHECK (user_id = auth.uid() AND organisation_id = public.get_my_org_id());

CREATE POLICY "staff can read own clock events"
  ON public.clock_events FOR SELECT
  USING (user_id = auth.uid() AND organisation_id = public.get_my_org_id());

CREATE POLICY "admins can read org clock events"
  ON public.clock_events FOR SELECT
  USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

CREATE POLICY "admins can update org clock events"
  ON public.clock_events FOR UPDATE
  USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

-- holiday_requests
DROP POLICY IF EXISTS "staff can insert own holiday requests"  ON public.holiday_requests;
DROP POLICY IF EXISTS "staff can read own holiday requests"    ON public.holiday_requests;
DROP POLICY IF EXISTS "admins can read all holiday requests"   ON public.holiday_requests;
DROP POLICY IF EXISTS "admins can update holiday requests"     ON public.holiday_requests;

CREATE POLICY "staff can insert own holiday requests"
  ON public.holiday_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() AND organisation_id = public.get_my_org_id());

CREATE POLICY "staff can read own holiday requests"
  ON public.holiday_requests FOR SELECT
  USING (user_id = auth.uid() AND organisation_id = public.get_my_org_id());

CREATE POLICY "admins can read org holiday requests"
  ON public.holiday_requests FOR SELECT
  USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

CREATE POLICY "admins can update org holiday requests"
  ON public.holiday_requests FOR UPDATE
  USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

-- notifications
DROP POLICY IF EXISTS "users can read own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "service can insert notifications"   ON public.notifications;

CREATE POLICY "users can read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid() AND organisation_id = public.get_my_org_id());

CREATE POLICY "users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() AND organisation_id = public.get_my_org_id());

CREATE POLICY "service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- audit_log
DROP POLICY IF EXISTS "admins can read audit log"    ON public.audit_log;
DROP POLICY IF EXISTS "admins can insert audit log"  ON public.audit_log;

CREATE POLICY "admins can read org audit log"
  ON public.audit_log FOR SELECT
  USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

CREATE POLICY "admins can insert org audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

-- organisations: members can read their own org
CREATE POLICY "members can read own org"
  ON public.organisations FOR SELECT
  USING (id = public.get_my_org_id());

CREATE POLICY "admins can update own org"
  ON public.organisations FOR UPDATE
  USING (id = public.get_my_org_id() AND public.get_my_role() = 'admin');
