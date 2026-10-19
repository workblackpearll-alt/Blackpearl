-- ========================================================
-- BLACK PEARL · MIGRATION: EMAIL DELIVERY TRACKING
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run. Also included in supabase_schema.sql.
--
-- Each paid booking sends two emails: the guest's confirmation (with QR)
-- and a "new booking" alert to the team. Resend reports back whether each
-- one was delivered, bounced, marked as spam, etc.
-- Status values: sent | delivered | delayed | bounced | spam | failed
-- ========================================================

ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS guest_email_id TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS guest_email_status TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS guest_email_status_at TIMESTAMPTZ;

ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS admin_email_id TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS admin_email_status TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS admin_email_status_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_holds_guest_email_id ON public.holds(guest_email_id);
CREATE INDEX IF NOT EXISTS idx_holds_admin_email_id ON public.holds(admin_email_id);
