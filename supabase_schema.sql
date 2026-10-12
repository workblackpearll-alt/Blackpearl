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
    payment_method TEXT DEFAULT 'upi',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Held (Deposit Paid)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

-- Holds: Allow public (anon) users to create booking holds and read holds
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

-- Voyage Briefs: Allow public to submit briefs and view
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

-- ========================================================
-- INITIAL SEED DATA (Optional)
-- ========================================================
INSERT INTO public.blocked_dates (date, reason)
VALUES
    ('2026-11-01', 'Scheduled Marine Hull Inspection'),
    ('2026-11-08', 'Naval Harbour Operations'),
    ('2026-11-20', 'Private VIP Charter'),
    ('2026-11-27', 'Engine Maintenance & Rigging Check'),
    ('2026-11-28', 'Scheduled Deck Teak Refinishing')
ON CONFLICT (date) DO NOTHING;
