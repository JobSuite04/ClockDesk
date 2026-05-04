-- ============================================================
-- ClockDesk — Initial Schema
-- Run this in your Supabase SQL editor (or via supabase db push)
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name               TEXT        NOT NULL,
  email                   TEXT        NOT NULL,
  job_title               TEXT,
  department              TEXT,
  start_date              DATE,
  employment_type         TEXT        NOT NULL DEFAULT 'hourly'
                            CHECK (employment_type IN ('hourly', 'salaried')),
  hourly_rate             NUMERIC(10,2),
  overtime_multiplier     NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  overtime_threshold_hours INTEGER    NOT NULL DEFAULT 40,
  annual_leave_allowance  INTEGER     NOT NULL DEFAULT 25,
  role                    TEXT        NOT NULL DEFAULT 'staff'
                            CHECK (role IN ('admin', 'staff')),
  is_active               BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clock events
CREATE TABLE IF NOT EXISTS public.clock_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type          TEXT        NOT NULL CHECK (event_type IN ('clock_in', 'clock_out')),
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note                TEXT,
  is_admin_edited     BOOLEAN     NOT NULL DEFAULT false,
  original_timestamp  TIMESTAMPTZ,
  edit_reason         TEXT,
  edited_by           UUID        REFERENCES public.profiles(id),
  edited_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clock_events_user_id_timestamp_idx
  ON public.clock_events (user_id, timestamp DESC);

-- Holiday requests
CREATE TABLE IF NOT EXISTS public.holiday_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date      DATE        NOT NULL,
  end_date        DATE        NOT NULL,
  days_requested  INTEGER     NOT NULL,
  note            TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'declined')),
  admin_note      TEXT,
  reviewed_by     UUID        REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS holiday_requests_user_id_idx
  ON public.holiday_requests (user_id);

CREATE INDEX IF NOT EXISTS holiday_requests_status_idx
  ON public.holiday_requests (status);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  related_id  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx
  ON public.notifications (user_id, is_read);

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID        NOT NULL REFERENCES public.profiles(id),
  action          TEXT        NOT NULL,
  target_user_id  UUID        REFERENCES public.profiles(id),
  record_id       UUID,
  table_name      TEXT,
  old_values      JSONB,
  new_values      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Trigger: auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;

-- Helper: check caller's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- profiles
CREATE POLICY "users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

-- clock_events
CREATE POLICY "staff can insert own clock events"
  ON public.clock_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "staff can read own clock events"
  ON public.clock_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admins can read all clock events"
  ON public.clock_events FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "admins can update clock events"
  ON public.clock_events FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- holiday_requests
CREATE POLICY "staff can insert own holiday requests"
  ON public.holiday_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "staff can read own holiday requests"
  ON public.holiday_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admins can read all holiday requests"
  ON public.holiday_requests FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "admins can update holiday requests"
  ON public.holiday_requests FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- notifications
CREATE POLICY "users can read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- audit_log
CREATE POLICY "admins can read audit log"
  ON public.audit_log FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "admins can insert audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- Realtime subscriptions (enable for live dashboard)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.clock_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
