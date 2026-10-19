-- ========================================================
-- BLACK PEARL · MIGRATION: PROMOTION ANALYTICS
-- ========================================================
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run. Also included in supabase_schema.sql.
--
-- visitor_id: an anonymous id kept in the visitor's browser, so the same
--             person counts once even across several visits/tabs.
-- campaign:   the utm_campaign from a promotion link, e.g.
--             https://www.blackpearl.social/?utm_source=instagram&utm_campaign=diwali
--             so you can see which promotion brought visitors and bookings.
-- ========================================================

ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS campaign TEXT;
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON public.page_views(visitor_id);

-- Bookings remember the promotion that brought the guest
ALTER TABLE public.holds ADD COLUMN IF NOT EXISTS campaign TEXT;
