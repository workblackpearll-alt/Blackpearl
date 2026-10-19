# Black Pearl · Lady Alice — Remediation Plan & Execution Status

**Last Updated**: 19 October 2026  
**Status**: **ALL 11 FINDINGS REMEDIATED & RETESTED (100% COMPLETE)**  

---

## Remediation Progress Summary

| Priority | Finding ID | Description | Component | Status |
| :---: | :---: | :--- | :--- | :---: |
| **P0** | **BP-SEC-01** | Lock Down Row Level Security on `voyage_briefs` | `supabase_schema.sql`, `supabase_migration_security_hardening.sql` | **COMPLETED & RETESTED** |
| **P0** | **BP-SEC-02** | Sanitize Voyage Briefs Rendering in Admin (Stored XSS) | `admin/admin.js:970-985` | **COMPLETED & RETESTED** |
| **P0** | **BP-SEC-03** | Restrict Gallery Insertions & Sanitize Dynamic Gallery | `supabase_schema.sql`, `main.js`, `admin/admin.js` | **COMPLETED & RETESTED** |
| **P1** | **BP-SEC-04** | Enforce Server-Side Authorization (`is_admin`) in Admin | `admin/admin.js`, `supabaseClient.js` | **COMPLETED & RETESTED** |
| **P1** | **BP-SEC-05** | Booking-Slot Anti-Hoarding & Rate Limiting | `api/create-order.js`, `api/_lib/booking.js` | **COMPLETED & RETESTED** |
| **P2** | **BP-SEC-06** | Neutralize Spreadsheet Formula Injection in CSV Export | `admin/admin.js:1120-1135` | **COMPLETED & RETESTED** |
| **P2** | **BP-SEC-07** | Add HTTP Security Headers (CSP, HSTS, X-Frame-Options) | `vercel.json` | **COMPLETED & RETESTED** |
| **P2** | **BP-SEC-08** | Minimize PII in QR Boarding Pass Verification | `api/_lib/booking.js`, `verify/index.html` | **COMPLETED & RETESTED** |
| **P3** | **BP-SEC-09** | Enforce Request Body Size Cap (64 KB / HTTP 413) | `api/_lib/http.js` | **COMPLETED & RETESTED** |
| **P3** | **BP-SEC-10** | Restrict Traffic Analytics (`page_views`) Access | `supabase_schema.sql`, `supabase_migration_security_hardening.sql` | **COMPLETED & RETESTED** |
| **P3** | **BP-SEC-11** | Remove Deprecated Mock-Payment Simulation Bypasses | `main.js:840-865` | **COMPLETED & RETESTED** |

---

## Priority 0 (P0) — Critical Release Blockers

### 1. BP-SEC-01: Lock Down Row Level Security on `voyage_briefs`
* **Target Files**: `supabase_schema.sql`, `supabase_migration_security_hardening.sql`
* **Implementation**: Revoked public `SELECT`, `UPDATE`, and `DELETE`. Granted access only to `public.is_admin()`. Public `INSERT` preserved for client inquiries.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 7).

### 2. BP-SEC-02: Sanitize Voyage Briefs Rendering in Admin Portal (Stored XSS)
* **Target File**: `admin/admin.js`
* **Implementation**: Wrapped all brief fields (`brief.name`, `brief.phone`, `brief.occasion`, `brief.notes`, `brief.duration`) in `escapeHtml()`.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 2).

### 3. BP-SEC-03: Restrict Gallery Insertions & Sanitize Dynamic Gallery
* **Target Files**: `supabase_schema.sql`, `main.js`, `admin/admin.js`
* **Implementation**: Restricted `gallery_images` INSERT/UPDATE/DELETE to admins. Added `escapeHtml()` and `sanitizeMediaUrl()` to reject malicious schemes (`javascript:`, `data:text/html`).
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 2 & 7).

---

## Priority 1 (P1) — High-Risk Vulnerabilities

### 4. BP-SEC-04: Server-Side Admin Authorization (`is_admin`) in Admin Frontend
* **Target Files**: `admin/admin.js`, `supabaseClient.js`
* **Implementation**: Implemented `verifyAdminStatus()` checking RPC `public.is_admin()`. Sessions without verified admin role are signed out immediately on `/admin` load, route navigation, and login.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 7).

### 5. BP-SEC-05: Rate Limiting & Anti-Hoarding in Order Creation
* **Target Files**: `api/create-order.js`, `api/_lib/booking.js`
* **Implementation**: Added sliding window IP rate limiting (5 req/min), quota check (max 3 pending holds per customer), and checkout deduplication. Tightened pending hold duration to 10 minutes.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 7).

---

## Priority 2 (P2) — Medium-Risk Vulnerabilities

### 6. BP-SEC-06: Neutralize Spreadsheet Formula Injection in CSV Export
* **Target File**: `admin/admin.js`
* **Implementation**: `csvCell()` prepends an apostrophe (`'`) to values starting with `=`, `+`, `-`, `@`, `\t`, `\r` to neutralize formulas in spreadsheet software.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 3).

### 7. BP-SEC-07: Add HTTP Security Headers in `vercel.json`
* **Target File**: `vercel.json`
* **Implementation**: Configured headers block with CSP, HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, Referrer-Policy: strict-origin-when-cross-origin, and Permissions-Policy.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 6).

### 8. BP-SEC-08: Minimize PII in QR Verification API
* **Target Files**: `api/_lib/booking.js`, `verify/index.html`
* **Implementation**: Redacted `phone`, `email`, and `notes` from `toPublicBooking(hold)`. Masked payment ID. Updated verification page rows.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 4).

---

## Priority 3 (P3) — Low-Risk & Housekeeping Improvements

### 9. BP-SEC-09: Request Body Size Ceiling in `api/_lib/http.js`
* **Target File**: `api/_lib/http.js`
* **Implementation**: Added 64 KB limit in `readRawBody` and `readJson`, terminating oversized payloads with HTTP 413.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 5).

### 10. BP-SEC-10: Restrict `page_views` Analytics SELECT
* **Target Files**: `supabase_schema.sql`, `supabase_migration_security_hardening.sql`
* **Implementation**: Dropped public SELECT policy and restricted analytics reading to `public.is_admin()`.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 7).

### 11. BP-SEC-11: Remove Deprecated Mock-Payment Simulation Bypasses
* **Target File**: `main.js`
* **Implementation**: Removed simulation fallback from `handleRazorpayPayment`.
* **Status**: **COMPLETED & RETESTED** (Verified via test harness step 7).
