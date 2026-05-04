-- ============================================================
-- ClockDesk — Subscriptions & Trial Gating
-- Run AFTER 002_organisations.sql
-- ============================================================

-- Extend organisations with subscription fields
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS plan              TEXT    NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'starter', 'growth', 'pro', 'expired')),
  ADD COLUMN IF NOT EXISTS trial_ends_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  ADD COLUMN IF NOT EXISTS max_employees     INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS referral_code     TEXT UNIQUE;

-- Set trial_ends_at for any orgs already created (14 days from now as a safe default)
UPDATE public.organisations
  SET trial_ends_at = NOW() + INTERVAL '14 days',
      referral_code = LOWER(SUBSTR(MD5(id::TEXT), 1, 8))
  WHERE trial_ends_at IS NULL;

-- Make trial_ends_at NOT NULL after backfill
ALTER TABLE public.organisations
  ALTER COLUMN trial_ends_at SET NOT NULL;

-- Referral tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id   UUID        NOT NULL REFERENCES public.organisations(id),
  referee_org_id    UUID        REFERENCES public.organisations(id),
  referral_code     TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'credited')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at      TIMESTAMPTZ
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read own org referrals"
  ON public.referrals FOR SELECT
  USING (referrer_org_id = public.get_my_org_id() AND public.get_my_role() = 'admin');

-- Helper: get subscription status for current user's org
CREATE OR REPLACE FUNCTION public.get_my_plan()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT plan FROM public.organisations WHERE id = public.get_my_org_id();
$$;

CREATE OR REPLACE FUNCTION public.get_trial_days_remaining()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT GREATEST(0, EXTRACT(DAY FROM (trial_ends_at - NOW()))::INTEGER)
  FROM public.organisations
  WHERE id = public.get_my_org_id();
$$;
