-- ========================================================
-- BLACK PEARL · LADY ALICE - SUPABASE DATABASE SCHEMA
-- ========================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your Black Pearl project.
-- 3. In the left navigation, click "SQL Editor" -> "New query".
-- 4. Paste this entire script and click "Run".
-- ========================================================

-- 1. TABLE: holds (Guest Bookings & Holds)
CREATE TABLE IF NOT EXISTS public.holds (
    id TEXT PRIMARY KEY,
    booking_code TEXT NOT NULL,
    occasion TEXT NOT NULL,
    date TEXT NOT NULL,
    date_iso DATE NOT NULL,
    slot TEXT NOT NULL,
    duration TEXT NOT NULL,
    voyage_mode TEXT NOT NULL DEFAULT 'Paused (At Anchor)',
    guests INTEGER NOT NULL DEFAULT 2,
    price TEXT NOT NULL,
    paid_token TEXT NOT NULL DEFAULT '₹5,000',
    payment_method TEXT DEFAULT 'razorpay',
    payment_id TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Held (Deposit Paid)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure payment_id column exists if table was already created
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- Index for speedy calendar availability lookups
CREATE INDEX IF NOT EXISTS idx_holds_date_iso ON public.holds(date_iso);
CREATE INDEX IF NOT EXISTS idx_holds_created_at ON public.holds(created_at DESC);

-- 2. TABLE: voyage_briefs (Bespoke Sail vs Rest Charter Briefs)
CREATE TABLE IF NOT EXISTS public.voyage_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    occasion TEXT NOT NULL,
    duration TEXT NOT NULL,
    charter_mode TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_briefs_created_at ON public.voyage_briefs(created_at DESC);

-- 3. TABLE: blocked_dates (Admin & Maintenance Calendar Locks)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reason TEXT NOT NULL DEFAULT 'Maintenance',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON public.blocked_dates(date);

-- 4. TABLE: gallery_images (ImageKit Media URLs & Metadata)
CREATE TABLE IF NOT EXISTS public.gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    category TEXT NOT NULL DEFAULT 'all',
    imagekit_url TEXT NOT NULL,
    file_id TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_gallery_created_at ON public.gallery_images(created_at DESC);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- Enable RLS on all tables
ALTER TABLE public.holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyage_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- Holds: Allow public (anon) users to create booking holds, read holds, and update status
DROP POLICY IF EXISTS "Public can create holds" ON public.holds;
CREATE POLICY "Public can create holds"
ON public.holds FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view holds" ON public.holds;
CREATE POLICY "Public can view holds"
ON public.holds FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can update holds" ON public.holds;
CREATE POLICY "Public can update holds"
ON public.holds FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Voyage Briefs: Allow public to submit briefs, view, and update status
DROP POLICY IF EXISTS "Public can submit voyage briefs" ON public.voyage_briefs;
CREATE POLICY "Public can submit voyage briefs"
ON public.voyage_briefs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view voyage briefs" ON public.voyage_briefs;
CREATE POLICY "Public can view voyage briefs"
ON public.voyage_briefs FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can update voyage briefs" ON public.voyage_briefs;
CREATE POLICY "Public can update voyage briefs"
ON public.voyage_briefs FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Blocked Dates: Allow public to view blocked dates and crew to add
DROP POLICY IF EXISTS "Public can view blocked dates" ON public.blocked_dates;
CREATE POLICY "Public can view blocked dates"
ON public.blocked_dates FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can insert blocked dates" ON public.blocked_dates;
CREATE POLICY "Public can insert blocked dates"
ON public.blocked_dates FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Gallery Images: Allow public to view and add gallery items with ImageKit URLs
DROP POLICY IF EXISTS "Public can view gallery images" ON public.gallery_images;
CREATE POLICY "Public can view gallery images"
ON public.gallery_images FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can insert gallery images" ON public.gallery_images;
CREATE POLICY "Public can insert gallery images"
ON public.gallery_images FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 5. TABLE: page_views (Website Analytics & Traffic Tracking)
CREATE TABLE IF NOT EXISTS public.page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    page_path TEXT NOT NULL DEFAULT '/',
    referrer TEXT,
    traffic_source TEXT DEFAULT 'Direct',
    device_type TEXT DEFAULT 'Desktop',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON public.page_views(session_id);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can record page views" ON public.page_views;
CREATE POLICY "Public can record page views"
ON public.page_views FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view page views" ON public.page_views;
CREATE POLICY "Public can view page views"
ON public.page_views FOR SELECT
TO anon, authenticated
USING (true);

-- 6. TABLE: community_members (WhatsApp broadcast sign-ups)
CREATE TABLE IF NOT EXISTS public.community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    whatsapp_consent BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'New',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- One sign-up per WhatsApp number
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_phone ON public.community_members(phone);
CREATE INDEX IF NOT EXISTS idx_community_members_created_at ON public.community_members(created_at DESC);

-- 7. TABLE: contact_inquiries (Contact page consultation form)
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    occasion TEXT NOT NULL,
    target_date DATE,
    guests TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at ON public.contact_inquiries(created_at DESC);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Community: public can join, only admins can view / update
DROP POLICY IF EXISTS "Public can join community" ON public.community_members;
CREATE POLICY "Public can join community"
ON public.community_members FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view community" ON public.community_members;
CREATE POLICY "Admins can view community"
ON public.community_members FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update community" ON public.community_members;
CREATE POLICY "Admins can update community"
ON public.community_members FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Contact inquiries: public can submit, only admins can view / update
DROP POLICY IF EXISTS "Public can submit contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Public can submit contact inquiries"
ON public.contact_inquiries FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Admins can view contact inquiries"
ON public.contact_inquiries FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Admins can update contact inquiries"
ON public.contact_inquiries FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ========================================================
-- PAYMENTS, QR VERIFICATION, ADMIN-ONLY ACCESS & SLOT LOCKS
-- (same as supabase_migration_payments.sql)
-- After running, add admins: INSERT INTO public.admin_users (email) VALUES ('you@example.com');
-- ========================================================
-- 8. Admin allow-list (signing up alone no longer grants access)
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

-- 9. Payment & verification columns on holds
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

-- 10. Lock holds: the website writes through server functions (service role),
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

-- 11. Community & contact data: admins only (not just any signed-in account)
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

-- 11b. Voyage briefs, gallery images & analytics: restrict to admins (BP-SEC-01, BP-SEC-03, BP-SEC-10)
DROP POLICY IF EXISTS "Public can view voyage briefs" ON public.voyage_briefs;
DROP POLICY IF EXISTS "Public can update voyage briefs" ON public.voyage_briefs;
DROP POLICY IF EXISTS "Admins can view voyage briefs" ON public.voyage_briefs;
CREATE POLICY "Admins can view voyage briefs"
ON public.voyage_briefs FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update voyage briefs" ON public.voyage_briefs;
CREATE POLICY "Admins can update voyage briefs"
ON public.voyage_briefs FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can insert gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can insert gallery images" ON public.gallery_images;
CREATE POLICY "Admins can insert gallery images"
ON public.gallery_images FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update gallery images" ON public.gallery_images;
CREATE POLICY "Admins can update gallery images"
ON public.gallery_images FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete gallery images" ON public.gallery_images;
CREATE POLICY "Admins can delete gallery images"
ON public.gallery_images FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view page views" ON public.page_views;
DROP POLICY IF EXISTS "Admins can view page views" ON public.page_views;
CREATE POLICY "Admins can view page views"
ON public.page_views FOR SELECT
TO authenticated
USING (public.is_admin());

-- 12. Calendar locks: per slot (Day / Evening) or full day, with a note,
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

-- 13. TABLE: admin_activity (shared admin reminders, e.g. calendar last reviewed)
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

-- ========================================================
-- MULTIPLE BOOKINGS PER SLOT (same as supabase_migration_multibooking.sql)
-- ========================================================
-- 14. Drop the old "one paid booking per slot" rule
DROP INDEX IF EXISTS public.idx_holds_one_paid_booking_per_slot;

-- 15. Database guard: two paid bookings on the same date can never overlap
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

-- 16. Offline locks can cover specific hours (NULL = whole slot / whole day as before)
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS start_hour INTEGER;
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS end_hour INTEGER;

-- Several offline bookings can now share a slot, so drop one-lock-per-slot
DROP INDEX IF EXISTS public.idx_blocked_dates_date_slot;
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON public.blocked_dates(date);

-- 17. EMAIL DELIVERY TRACKING (same as supabase_migration_email_tracking.sql)
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS guest_email_id TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS guest_email_status TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS guest_email_status_at TIMESTAMPTZ;

ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS admin_email_id TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS admin_email_status TEXT;
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS admin_email_status_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_holds_guest_email_id ON public.holds(guest_email_id);
CREATE INDEX IF NOT EXISTS idx_holds_admin_email_id ON public.holds(admin_email_id);

-- ========================================================
-- ADMIN LOGIN CODE / EMAIL OTP (same as supabase_migration_admin_otp.sql)
-- Must stay at the END: it redefines is_admin() to require a verified code.
-- ========================================================
-- 18. One-time codes (server only: no policies, so the website can't read them)
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

-- 19. Login sessions that passed the code check (server only)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- 20. "Is this a Supabase Auth user?" (every Auth user is an admin: keep public sign-ups OFF)
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

-- 21. "Admin AND this login session entered a valid code" — every data policy uses this
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

-- 22. PROMOTION ANALYTICS (same as supabase_migration_analytics.sql)
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS campaign TEXT;
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON public.page_views(visitor_id);

-- Bookings remember the promotion that brought the guest
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS campaign TEXT;
