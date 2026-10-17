-- ========================================================
-- BLACK PEARL · MIGRATION: MULTIPLE BOOKINGS PER SLOT
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run,
-- AFTER supabase_migration_payments.sql. Safe to re-run.
-- Also included in supabase_schema.sql.
--
-- A slot (Day 6 am – 2 pm / Evening 2 pm – 11 pm) can now hold several
-- bookings, e.g. 2–5 pm and 6–9 pm. Any two bookings need at least a
-- 1-hour gap. Offline locks can cover specific hours, not just a whole slot.
-- ========================================================

-- 1. Drop the old "one paid booking per slot" rule
DROP INDEX IF EXISTS public.idx_holds_one_paid_booking_per_slot;

-- 2. Database guard: two paid bookings on the same date can never overlap
--    or sit closer than 1 hour. Each booking occupies [start, end + 1 hour).
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'holds_paid_no_overlap') THEN
    ALTER TABLE public.holds
      ADD CONSTRAINT holds_paid_no_overlap
      EXCLUDE USING gist (
        date_iso WITH =,
        int4range(start_hour, start_hour + duration_hours + 1) WITH &&
      )
      WHERE (
        status IN ('Held (Deposit Paid)', 'Confirmed', 'Completed')
        AND start_hour IS NOT NULL
        AND duration_hours IS NOT NULL
      );
  END IF;
END $$;

-- 3. Offline locks can cover specific hours (NULL = whole slot / whole day as before)
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS start_hour INTEGER;
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS end_hour INTEGER;

-- Several offline bookings can now share a slot, so drop one-lock-per-slot
DROP INDEX IF EXISTS public.idx_blocked_dates_date_slot;
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON public.blocked_dates(date);
