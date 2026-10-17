-- ========================================================
-- BLACK PEARL · MIGRATION: ADMIN NOTIFICATIONS
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run,
-- AFTER supabase_migration_payments.sql (it uses public.is_admin()).
-- Safe to re-run. Also included in supabase_schema.sql.
--
-- Stores shared admin activity such as "calendar last reviewed", so the
-- daily calendar reminder clears for every admin once one of them checks it.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.admin_activity (
    key TEXT PRIMARY KEY,               -- e.g. 'calendar_reviewed'
    happened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    by_email TEXT
);

ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view activity" ON public.admin_activity;
CREATE POLICY "Admins can view activity"
ON public.admin_activity FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can record activity" ON public.admin_activity;
CREATE POLICY "Admins can record activity"
ON public.admin_activity FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update activity" ON public.admin_activity;
CREATE POLICY "Admins can update activity"
ON public.admin_activity FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
