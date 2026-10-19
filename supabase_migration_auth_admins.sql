-- ========================================================
-- BLACK PEARL · MIGRATION: SUPABASE AUTH USERS ARE THE ADMINS
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run,
-- AFTER supabase_migration_admin_otp.sql. Safe to re-run.
-- Also included in supabase_schema.sql.
--
-- Replaces the admin_users allow-list: anyone with an account in
-- Supabase -> Authentication -> Users is an admin (and still needs the
-- emailed login code before any data is visible).
--
-- !! BEFORE RUNNING: turn OFF public sign-ups in Supabase:
--    Authentication -> Sign In / Providers -> "Allow new users to sign up" = off
--    Otherwise anyone could create an account and become an admin.
--    Add admins yourself in Authentication -> Users -> Add user.
-- ========================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid());
$$;

-- The old allow-list is no longer used; drop it if you like:
-- DROP TABLE IF EXISTS public.admin_users;
