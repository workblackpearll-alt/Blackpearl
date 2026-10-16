-- ========================================================
-- BLACK PEARL · MIGRATION: COMMUNITY SIGN-UPS & CONTACT INQUIRIES
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run. Also included in supabase_schema.sql.
--
-- Unlike the older tables, these hold personal details, so the public
-- website may only INSERT. Only signed-in admins can read / update.
-- ========================================================

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
