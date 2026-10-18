# Black Pearl · Lady Alice — Database Security Report (Supabase / PostgreSQL)

## 1. Executive Database Security Summary
The Black Pearl application uses PostgreSQL hosted on Supabase as its primary database. The schema implements advanced database-level integrity controls including the `btree_gist` extension with an `EXCLUDE` constraint preventing overlapping confirmed charters. 

However, an audit of Row Level Security (RLS) policies revealed critical permission leakages:
1. **`voyage_briefs`**: Fully exposed to the public for both reading and updating by unauthenticated anonymous users.
2. **`gallery_images`**: Anonymous users can insert arbitrary records, opening a stored XSS vector onto the landing page.
3. **`page_views`**: Allows anonymous users to inspect traffic metrics and visitor referrers.

---

## 2. Table-by-Table Row Level Security (RLS) Matrix

| Table Name | RLS Enabled | Anon SELECT | Anon INSERT | Anon UPDATE | Anon DELETE | Admin Only Policy | Security Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`holds`** | YES | **NO** | **NO** (via service-role only) | **NO** | **NO** | `public.is_admin()` for SELECT & UPDATE | **PASS** — Properly locked. Website writes via trusted `/api` backend. Only allow-listed admins can view. |
| **`blocked_dates`** | YES | **NO** | **NO** | **NO** | **NO** | `public.is_admin()` for SELECT, INSERT & DELETE | **PASS** — Properly locked. Public reads availability via `/api/availability` which returns no notes. |
| **`admin_users`** | YES | **NO** | **NO** | **NO** | **NO** | Default Deny (no public policies) | **PASS** — Queried only by `SECURITY DEFINER` function `public.is_admin()`. |
| **`contact_inquiries`** | YES | **NO** | **YES** | **NO** | **NO** | `public.is_admin()` for SELECT & UPDATE | **PASS** — Public can submit inquiries, but only allow-listed admins can read or update them. |
| **`community_members`** | YES | **NO** | **YES** | **NO** | **NO** | `public.is_admin()` for SELECT & UPDATE | **PASS** — Unique index on phone prevents duplicates. Only allow-listed admins can view list. |
| **`voyage_briefs`** | YES | **YES (FAIL)** | **YES** | **YES (FAIL)** | **NO** | None (Public policies active) | **FAIL (CRITICAL — BP-SEC-01)** — Overly permissive policies `Public can view voyage briefs` and `Public can update voyage briefs` allow any visitor with the anon key to read all private customer briefs and tamper with statuses! |
| **`gallery_images`** | YES | **YES** | **YES (FAIL)** | **NO** | **NO** | None | **FAIL (CRITICAL — BP-SEC-03)** — `Public can insert gallery images` allows unauthenticated insertion, enabling Stored XSS on the homepage. |
| **`page_views`** | YES | **YES (LEAK)** | **YES** | **NO** | **NO** | None | **PARTIAL (LOW — BP-SEC-10)** — Unauthenticated users can read full visitor traffic logs. |
| **`admin_activity`** | YES | **NO** | **NO** | **NO** | **NO** | `public.is_admin()` for SELECT, INSERT & UPDATE | **PASS** — Audit log is restricted to verified administrators. |

---

## 3. SQL Functions & Privilege Analysis

### `public.is_admin()`
```sql
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
```
- **Strengths**:
  - `SECURITY DEFINER` correctly isolates access to `admin_users`.
  - `SET search_path = public` prevents schema search path hijacking.
  - Normalizes email with `lower()` to prevent casing discrepancies.
  - Evaluates `auth.jwt() ->> 'email'` from the cryptographically verified JWT issued by Supabase Auth.
- **Weaknesses**:
  - While the database function is robust, the frontend admin deck in `admin.js` fails to call this function to verify admin status before rendering the UI shell (BP-SEC-04).

---

## 4. Concurrency & Slot-Locking Analysis

### Exclusion Constraint: `holds_paid_no_overlap`
```sql
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
```
- **Mechanism**: Enforces that for any date (`date_iso`), no two records in a paid status can have overlapping hour ranges, including an automatic +1 hour turnaround buffer (`int4range(start_hour, start_hour + duration_hours + 1)`).
- **Concurrency Test Verification**:
  - If two users simultaneously pay for overlapping slots, the first transaction commits successfully.
  - The second transaction triggers a PostgreSQL exclusion constraint violation (`error.code === '23P01'`).
  - Backend handler `markHoldPaid` in `api/_lib/booking.js` specifically catches `23P01`, marks the second hold as `STATUS.conflict` ('Paid - Slot Conflict'), records the payment ID for a refund, and notifies the client with an HTTP 409 conflict message.
- **Limitation**:
  - Does not cover `Payment Pending` records, allowing unthrottled orders to create overlapping 15-minute pending locks (addressed in BP-SEC-05).

---

## 5. Remediation SQL Migration

To resolve the critical database permission vulnerabilities, the following migration must be applied to Supabase:

```sql
-- ========================================================
-- BLACK PEARL · LADY ALICE - SECURITY HARDENING MIGRATION
-- ========================================================

-- 1. Lock down voyage_briefs (BP-SEC-01)
DROP POLICY IF EXISTS "Public can view voyage briefs" ON public.voyage_briefs;
DROP POLICY IF EXISTS "Public can update voyage briefs" ON public.voyage_briefs;

CREATE POLICY "Admins can view voyage briefs"
ON public.voyage_briefs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update voyage briefs"
ON public.voyage_briefs FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Lock down gallery_images insert (BP-SEC-03)
DROP POLICY IF EXISTS "Public can insert gallery images" ON public.gallery_images;

CREATE POLICY "Admins can insert gallery images"
ON public.gallery_images FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- 3. Restrict page_views read access to admins (BP-SEC-10)
DROP POLICY IF EXISTS "Public can view page views" ON public.page_views;

CREATE POLICY "Admins can view page views"
ON public.page_views FOR SELECT
TO authenticated
USING (public.is_admin());
```
