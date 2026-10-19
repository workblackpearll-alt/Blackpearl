-- ========================================================
-- BLACK PEARL · MIGRATION: ADMIN LOGIN CODE (EMAIL OTP)
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run,
-- AFTER supabase_migration_payments.sql. Safe to re-run.
-- Also included in supabase_schema.sql.
--
-- After the password, admins must enter a 6-digit code emailed (via Resend)
-- to their allow-listed address. Until they do, the database treats that
-- login session as NOT an admin, so a stolen password alone reads nothing.
-- ========================================================

-- 1. One-time codes (server only: no policies, so the website can't read them)
CREATE TABLE IF NOT EXISTS public.admin_otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,          -- the login session the code belongs to
    code_hash TEXT NOT NULL,           -- never stored in plain text
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_admin_otp_user_created ON public.admin_otp_codes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_otp_session ON public.admin_otp_codes(session_id);
ALTER TABLE public.admin_otp_codes ENABLE ROW LEVEL SECURITY;

-- 2. Login sessions that passed the code check (server only)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- 3. "Is this email on the admin list?" (used by the login screen before the code step)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 4. "Admin AND this login session entered a valid code" — every data policy uses this
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user()
     AND EXISTS (
       SELECT 1 FROM public.admin_sessions s
       WHERE s.session_id::text = coalesce(auth.jwt() ->> 'session_id', '')
         AND s.expires_at > now()
     );
$$;
