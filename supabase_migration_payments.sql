-- ========================================================
-- BLACK PEARL · MIGRATION: SERVER-SIDE RAZORPAY PAYMENTS,
-- BOOKING QR VERIFICATION & ADMIN-ONLY ACCESS
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run. Also included in supabase_schema.sql.
--
-- After running, add every admin's login email:
--   INSERT INTO public.admin_users (email) VALUES ('you@example.com');
-- Only emails in admin_users can read bookings, community sign-ups
-- and contact inquiries from the admin panel.
-- ========================================================

-- 1. Admin allow-list (signing up alone no longer grants access)
CREATE TABLE IF NOT EXISTS public.admin_users (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
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

-- 2. Payment & verification columns on holds
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS slot_key TEXT;           -- 'day' | 'evening'
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS start_hour INTEGER;      -- 24h clock
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS duration_hours INTEGER;  -- 3 | 5 | 6
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS verify_token TEXT;       -- secret in the QR link
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS email_error TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_holds_razorpay_order ON public.holds(razorpay_order_id);

-- A slot can only ever hold one paid booking per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_holds_one_paid_booking_per_slot
ON public.holds(date_iso, slot_key)
WHERE status IN ('Held (Deposit Paid)', 'Confirmed', 'Completed');

-- 3. Lock holds: the website writes through server functions (service role),
--    and only listed admins can read / update from the admin panel.
DROP POLICY IF EXISTS "Public can create holds" ON public.holds;
DROP POLICY IF EXISTS "Public can view holds" ON public.holds;
DROP POLICY IF EXISTS "Public can update holds" ON public.holds;

DROP POLICY IF EXISTS "Admins can view holds" ON public.holds;
CREATE POLICY "Admins can view holds"
ON public.holds FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update holds" ON public.holds;
CREATE POLICY "Admins can update holds"
ON public.holds FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Community & contact data: admins only (not just any signed-in account)
DROP POLICY IF EXISTS "Admins can view community" ON public.community_members;
CREATE POLICY "Admins can view community"
ON public.community_members FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update community" ON public.community_members;
CREATE POLICY "Admins can update community"
ON public.community_members FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Admins can view contact inquiries"
ON public.contact_inquiries FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Admins can update contact inquiries"
ON public.contact_inquiries FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Calendar locks: per slot (Day / Evening) or full day, with a note,
--    for offline bookings. Admin-only; the website reads availability
--    through the server, which never exposes notes.
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS slot_key TEXT;  -- 'day' | 'evening' | NULL = full day
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.blocked_dates DROP CONSTRAINT IF EXISTS blocked_dates_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_dates_date_slot
ON public.blocked_dates(date, coalesce(slot_key, 'all'));

-- Remove the sample locks that shipped with the original schema
DELETE FROM public.blocked_dates
WHERE (date, reason) IN (
    ('2026-11-01', 'Scheduled Marine Hull Inspection'),
    ('2026-11-08', 'Naval Harbour Operations'),
    ('2026-11-20', 'Private VIP Charter'),
    ('2026-11-27', 'Engine Maintenance & Rigging Check'),
    ('2026-11-28', 'Scheduled Deck Teak Refinishing')
);

DROP POLICY IF EXISTS "Public can view blocked dates" ON public.blocked_dates;
DROP POLICY IF EXISTS "Public can insert blocked dates" ON public.blocked_dates;

DROP POLICY IF EXISTS "Admins can view blocked dates" ON public.blocked_dates;
CREATE POLICY "Admins can view blocked dates"
ON public.blocked_dates FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can add blocked dates" ON public.blocked_dates;
CREATE POLICY "Admins can add blocked dates"
ON public.blocked_dates FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can remove blocked dates" ON public.blocked_dates;
CREATE POLICY "Admins can remove blocked dates"
ON public.blocked_dates FOR DELETE
TO authenticated
USING (public.is_admin());
