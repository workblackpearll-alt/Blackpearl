# Black Pearl · Lady Alice — Security Remediation Report

**Date**: 19 October 2026  
**Auditor / Engineer**: Senior Application Security & DevSecOps Specialist  
**Project**: Black Pearl · Lady Alice (Luxury Yacht & Ship Chartering Platform)  
**Status**: All 11 Audited Security Findings Remediated & Verified  

---

## 1. Executive Summary

A comprehensive, full-scale security remediation and penetration retest has been executed on the Black Pearl · Lady Alice charter web platform. The platform handles high-value charter reservations, customer personal identifying information (PII), payment processing via Razorpay, administrative fleet operations, and dockside QR boarding pass verification.

All 11 audited findings across Priority 0 (Critical), Priority 1 (High), Priority 2 (Medium), and Priority 3 (Low / Informational) have been remediated in code and validated through automated regression testing. The remediation changes preserve all existing booking logic, exclusion constraints, UI layout, and media assets, while introducing robust defense-in-depth security controls across the database, serverless API layer, and client frontend.

### Summary of Remediated Findings

| Finding ID | Title | Original Severity | Remediated Status | Verification |
| :--- | :--- | :---: | :---: | :---: |
| **BP-SEC-01** | Overly Permissive RLS on `voyage_briefs` | **Critical** (8.7) | **FIXED** | Automated Test + Versioned Migration |
| **BP-SEC-02** | Stored XSS in Admin Inquiries Table | **Critical** (8.5) | **FIXED** | Automated Test + HTML Entity Escaping |
| **BP-SEC-03** | Stored XSS & Unauthorized Gallery Insertions | **Critical** (8.6) | **FIXED** | Automated Test + URL & DOM Sanitization |
| **BP-SEC-04** | Missing Server-Side Admin Authorization (`is_admin`) | **High** (7.1) | **FIXED** | Automated Test + RPC Guard in UI Shell |
| **BP-SEC-05** | Unthrottled Order Creation & Slot Hoarding | **High** (7.5) | **FIXED** | Automated Test + IP Rate Limit & Quota |
| **BP-SEC-06** | CSV Spreadsheet Formula Injection | **Medium** (6.5) | **FIXED** | Automated Test + Formula Sanitizer |
| **BP-SEC-07** | Absence of HTTP Security Headers (CSP/HSTS/Clickjacking) | **Medium** (5.3) | **FIXED** | Automated Test + `vercel.json` Config |
| **BP-SEC-08** | Excessive PII Exposure in QR Verification API | **Medium** (4.3) | **FIXED** | Automated Test + Data Minimization |
| **BP-SEC-09** | Unrestricted Request Body Buffering | **Low** (3.7) | **FIXED** | Automated Test + 64 KB Payload Ceiling |
| **BP-SEC-10** | Public Read Access to Traffic Analytics (`page_views`) | **Low** (3.1) | **FIXED** | Automated Test + Versioned Migration |
| **BP-SEC-11** | Deprecated Mock Payment Bypass Code | **Info** (0.0) | **FIXED** | Automated Test + Code Elimination |

---

## 2. Detailed Technical Remediations

### BP-SEC-01: Row Level Security Hardening on `voyage_briefs`
* **Root Cause**: An overly permissive policy `Public can view voyage briefs` was granting anonymous users `SELECT` access to all voyage briefs, exposing customer names, phone numbers, budgets, and celebratory notes.
* **Remediation**:
  - Created versioned SQL migration [supabase_migration_security_hardening.sql](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/supabase_migration_security_hardening.sql).
  - Updated [supabase_schema.sql](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/supabase_schema.sql#L118-L135).
  - Revoked public `SELECT`, `UPDATE`, and `DELETE` access.
  - Added policies `Admins can view voyage briefs`, `Admins can update voyage briefs`, and `Admins can delete voyage briefs` restricted strictly to `public.is_admin()`.
  - Preserved public `INSERT` allowing website visitors to submit charter inquiries while protecting existing records.

### BP-SEC-02: Stored Cross-Site Scripting (XSS) in Admin Portal
* **Root Cause**: `renderInquiriesTable` in [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js#L970-L995) interpolated unescaped user-supplied brief properties (`brief.name`, `brief.phone`, `brief.occasion`, `brief.notes`) directly into `tr.innerHTML`.
* **Remediation**:
  - Applied contextual HTML escaping via `escapeHtml()` across all interpolated properties.
  - WhatsApp link parameters were securely URL encoded via `encodeURIComponent()`.
  - Phone numbers are sanitized to digits only for `wa.me` links.

### BP-SEC-03: Stored XSS & Unauthorized Gallery Insertions
* **Root Cause**: Public `INSERT` was permitted on `public.gallery_images`, and [main.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/main.js) interpolated `img.title`, `img.subtitle`, and `img.category` directly into `item.innerHTML`.
* **Remediation**:
  - Revoked anonymous `INSERT`, `UPDATE`, and `DELETE` policies on `public.gallery_images` in [supabase_migration_security_hardening.sql](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/supabase_migration_security_hardening.sql).
  - Implemented `escapeHtml()` in [main.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/main.js#L1560-L1605) and [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js#L1360-L1380).
  - Added `sanitizeMediaUrl()` ensuring that only `https:`, relative root, or `data:image/` URLs can be rendered, rejecting `javascript:` and malicious URI schemes.

### BP-SEC-04: Server-Side Authorization Verification (`is_admin`) in Admin Frontend
* **Root Cause**: [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js) relied solely on whether a user had an active Supabase session, allowing non-admin authenticated accounts to render the portal UI.
* **Remediation**:
  - Implemented `verifyAdminStatus()` in [supabaseClient.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/supabaseClient.js#L435-L455) querying the server-side RPC `public.is_admin()`.
  - In `checkSessionAndRoute`, `initAuthHandlers`, and `onAuthStateChange`, users without administrative roles are immediately signed out (`signOutAdmin()`), denied access, and kept on the login screen.
  - Self-signup mode notifies users that administrative elevation must be provisioned by a database administrator before access is permitted.

### BP-SEC-05: Unrestricted Resource Consumption & Slot Hoarding (/api/create-order)
* **Root Cause**: `/api/create-order` allowed unthrottled order creation, enabling malicious actors to create multiple 15-minute `Payment Pending` locks across charter slots.
* **Remediation**:
  - Added IP sliding window rate limiting (5 requests/minute per client IP) in [api/create-order.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/api/create-order.js#L45-L75).
  - Added database-backed concurrency quotas: limits pending checkout attempts to 3 per client within the active pending window.
  - Idempotency & deduplication: if an active pending hold already exists for the identical slot and customer, the existing order details are returned instead of hoarding new slots.
  - Tightened pending hold duration from 15 minutes to 10 minutes in [api/_lib/booking.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/api/_lib/booking.js#L15).

### BP-SEC-06: Spreadsheet Formula Injection in CSV Export
* **Root Cause**: `csvCell(v)` in [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js#L1120-L1135) only escaped double quotes without sanitizing formula trigger characters.
* **Remediation**:
  - Updated `csvCell` to inspect cell values for leading `=, +, -, @, \t, \r` characters.
  - If detected, an apostrophe (`'`) is prepended to the string prior to wrapping in quotes, ensuring spreadsheet software (Excel, LibreOffice, Google Sheets) renders the cell strictly as plain text.

### BP-SEC-07: Missing HTTP Security Headers
* **Root Cause**: [vercel.json](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/vercel.json) lacked a `headers` definition.
* **Remediation**:
  - Implemented comprehensive `headers` block for all routes `/(.*)`:
    * `Content-Security-Policy`: Permits `'self'`, Razorpay checkout script & API domains, ImageKit CDN, Supabase WebSockets, and Google Fonts, while restricting `frame-ancestors 'self'`.
    * `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`.
    * `X-Content-Type-Options`: `nosniff`.
    * `X-Frame-Options`: `SAMEORIGIN`.
    * `Referrer-Policy`: `strict-origin-when-cross-origin`.
    * `Permissions-Policy`: Restricts camera, microphone, and geolocation, while enabling payment for `'self'` and Razorpay.

### BP-SEC-08: Excessive PII Exposure in Boarding Pass QR Verification
* **Root Cause**: `toPublicBooking` in [api/_lib/booking.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/api/_lib/booking.js) returned customer phone number, email address, and personal notes to any scanner on `/verify`.
* **Remediation**:
  - Redacted `phone`, `email`, and `notes` from `toPublicBooking`.
  - Masked `payment_id` to display only the initial prefix (`pay_ABC1...`).
  - Updated [verify/index.html](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/verify/index.html#L305-L320) to display only passenger name, date, slot, duration, guest count, and deposit verification status.

### BP-SEC-09: Unrestricted Request Body Buffering
* **Root Cause**: `readRawBody` in [api/_lib/http.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/api/_lib/http.js#L3-L15) buffered incoming chunks indefinitely without a byte limit.
* **Remediation**:
  - Enforced a 64 KB request body limit (`MAX_REQUEST_BODY_BYTES = 64 * 1024`).
  - If incoming stream data exceeds 64 KB, an error with `statusCode: 413` ('Payload Too Large') is thrown immediately, terminating chunk buffering and freeing memory.

### BP-SEC-10: Public Read Access to Traffic Analytics (`page_views`)
* **Root Cause**: The RLS policy on `public.page_views` granted anonymous `SELECT` access.
* **Remediation**:
  - Revoked public `SELECT` access in [supabase_migration_security_hardening.sql](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/supabase_migration_security_hardening.sql).
  - Created policy `"Admins can view page views"` granting `SELECT` exclusively to `public.is_admin()`.

### BP-SEC-11: Deprecated Mock Payment Code in `main.js`
* **Root Cause**: `handleRazorpayPayment` in [main.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/main.js) had a fallback that simulated deposit payment and invoked `completeBookingAndCelebrate`.
* **Remediation**:
  - Removed all mock payment simulation timeouts and fake payment ID generators.
  - If Razorpay cannot be initialized or credentials are not configured, an error message directs users to contact the concierge or visit `/book`.

---

## 3. Database Migration Deployment Guide

A migration script [supabase_migration_security_hardening.sql](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/supabase_migration_security_hardening.sql) has been prepared.

### Execution Instructions:
1. Navigate to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select the **Black Pearl** project database.
3. Open the **SQL Editor** tab -> **New Query**.
4. Paste and execute the contents of `supabase_migration_security_hardening.sql`.

### Rollback Plan:
If public read access is temporarily needed during testing, run:
```sql
CREATE POLICY "Public can view voyage briefs" ON public.voyage_briefs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can view page views" ON public.page_views FOR SELECT TO anon, authenticated USING (true);
```

---

## 4. Verification & Testing Summary

* **Automated Regression Suite**: [scripts/security_test_harness.mjs](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/scripts/security_test_harness.mjs)
* **Results**: **54 tests run, 54 passed, 0 failed**.
* **Production Build**: `npm run build` completed successfully with Vite 6.4.4 in 432ms.
* **Dependency Audit**: `npm audit` reported 0 vulnerabilities across all dependencies.

---

## 5. Remaining Risks & Recommendations

1. **Production SQL Execution**: The database migration [supabase_migration_security_hardening.sql](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/supabase_migration_security_hardening.sql) must be applied in the live Supabase SQL editor by the database administrator prior to production deployment.
2. **Distributed Redis Rate Limiter**: For multi-region serverless deployments with massive horizontal scaling, consider migrating the IP rate-limiting layer in `create-order.js` to an Upstash Redis or Vercel KV instance.
3. **Turnstile / reCAPTCHA**: If high-volume automated bot traffic is anticipated, integrating Cloudflare Turnstile on the checkout initiation form is recommended as an additional layer.
