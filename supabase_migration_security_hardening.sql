-- ========================================================
-- BLACK PEARL · LADY ALICE
-- SECURITY HARDENING MIGRATION (supabase_migration_security_hardening.sql)
-- ========================================================
-- Resolves:
--   - BP-SEC-01: Unauthorized public read/update access to voyage_briefs
--   - BP-SEC-03: Unauthorized anonymous insert into gallery_images
--   - BP-SEC-10: Unauthorized public read access to page_views
--
-- Instructions:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard
-- 2. Go to SQL Editor -> New Query.
-- 3. Paste and run this script.
-- ========================================================

-- 1. HARDEN VOYAGE_BRIEFS (BP-SEC-01)
-- Public can still submit bespoke briefs, but only allow-listed admins can read, update, or delete.
DROP POLICY IF EXISTS "Public can view voyage briefs" ON public.voyage_briefs;
DROP POLICY IF EXISTS "Public can update voyage briefs" ON public.voyage_briefs;
DROP POLICY IF EXISTS "Admins can view voyage briefs" ON public.voyage_briefs;
DROP POLICY IF EXISTS "Admins can update voyage briefs" ON public.voyage_briefs;
DROP POLICY IF EXISTS "Admins can delete voyage briefs" ON public.voyage_briefs;

CREATE POLICY "Admins can view voyage briefs"
ON public.voyage_briefs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update voyage briefs"
ON public.voyage_briefs FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete voyage briefs"
ON public.voyage_briefs FOR DELETE
TO authenticated
USING (public.is_admin());

-- 2. HARDEN GALLERY_IMAGES (BP-SEC-03)
-- Public can view gallery images, but only allow-listed admins can insert, update, or delete.
DROP POLICY IF EXISTS "Public can insert gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can insert gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can update gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can delete gallery images" ON public.gallery_images;

CREATE POLICY "Admins can insert gallery images"
ON public.gallery_images FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update gallery images"
ON public.gallery_images FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete gallery images"
ON public.gallery_images FOR DELETE
TO authenticated
USING (public.is_admin());

-- 3. HARDEN PAGE_VIEWS ANALYTICS (BP-SEC-10)
-- Public can record anonymous page hits, but only allow-listed admins can query analytics.
DROP POLICY IF EXISTS "Public can view page views" ON public.page_views;
DROP POLICY IF EXISTS "Admins can view page views" ON public.page_views;

CREATE POLICY "Admins can view page views"
ON public.page_views FOR SELECT
TO authenticated
USING (public.is_admin());
