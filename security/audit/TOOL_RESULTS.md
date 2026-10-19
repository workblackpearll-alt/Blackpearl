# Black Pearl · Lady Alice — Automated & Security Tool Results

**Last Updated**: 19 October 2026  
**Environment**: macOS (Darwin 24.6.0 arm64), Node.js v24.20.0, npm 11.5.0, Vite 6.4.4

---

## 1. Automated Security Regression Test Harness

* **Command**: `npm run test:security` (`node scripts/security_test_harness.mjs`)
* **Exit Code**: `0`
* **Execution Time**: ~280ms
* **Total Assertions**: 54
* **Results**: **54 Passed, 0 Failed**

### Test Breakdown by Subsystem:
1. **Razorpay Cryptographic Controls (6 tests)**:
   - Valid payment signature accepted: **PASS**
   - Forged payment signature rejected: **PASS**
   - Altered order ID signature rejected: **PASS**
   - Truncated payment signature rejected: **PASS**
   - Valid webhook signature accepted: **PASS**
   - Forged webhook signature rejected: **PASS**
2. **Stored XSS Sanitization & Media Filtering (11 tests)**:
   - `<script>alert("XSS")</script>` escaped: **PASS**
   - `<img src=x onerror=alert(1)>` escaped: **PASS**
   - `"><svg/onload=confirm(document.cookie)>` escaped: **PASS**
   - `';alert(String.fromCharCode(88,83,83))//` escaped: **PASS**
   - `<a href="javascript:alert(1)">Click</a>` escaped: **PASS**
   - HTTPS image URLs allowed: **PASS**
   - Relative media paths allowed: **PASS**
   - Safe `data:image/png` allowed: **PASS**
   - `javascript:` URI rejected: **PASS**
   - `data:text/html` URI rejected: **PASS**
   - `vbscript:` URI rejected: **PASS**
3. **CSV Formula Injection Sanitization (8 tests)**:
   - `=1+2` neutralized with leading `'`: **PASS**
   - `+SUM(A1:A10)` neutralized with leading `'`: **PASS**
   - `-2+3*CMD` neutralized with leading `'`: **PASS**
   - `@SUM(B1)` neutralized with leading `'`: **PASS**
   - `\t=cmd|` neutralized with leading `'`: **PASS**
   - `\r=calc` neutralized with leading `'`: **PASS**
   - Normal text preserved: **PASS**
   - Internal double quotes escaped: **PASS**
4. **QR Verification PII Minimization (8 tests)**:
   - Code, status, name, guest count retained: **PASS**
   - Phone number excluded: **PASS**
   - Email address excluded: **PASS**
   - Notes excluded: **PASS**
   - Payment ID masked: **PASS**
5. **Request Body Buffer Size Limits (2 tests)**:
   - Normal payload (< 64KB) accepted: **PASS**
   - Oversized payload (> 64KB) returns HTTP 413: **PASS**
6. **Vercel Security Headers (10 tests)**:
   - Headers block defined: **PASS**
   - Content-Security-Policy configured: **PASS**
   - CSP permits Razorpay scripts & API: **PASS**
   - CSP permits ImageKit media: **PASS**
   - CSP frame-ancestors 'self': **PASS**
   - Strict-Transport-Security (HSTS): **PASS**
   - X-Content-Type-Options: nosniff: **PASS**
   - X-Frame-Options: SAMEORIGIN: **PASS**
   - Referrer-Policy: strict-origin-when-cross-origin: **PASS**
   - Permissions-Policy configured: **PASS**
7. **Database Migrations & Source Code Integrity (9 tests)**:
   - Hardening migration file exists: **PASS**
   - `voyage_briefs` SELECT revoked for anon: **PASS**
   - `gallery_images` INSERT restricted to admin: **PASS**
   - `page_views` SELECT restricted to admin: **PASS**
   - `admin.js` invokes `verifyAdminStatus`: **PASS**
   - `admin.js` escapes media grid fields: **PASS**
   - `main.js` mock payment simulation removed: **PASS**
   - `create-order.js` implements IP rate limit: **PASS**
   - `create-order.js` enforces pending hold quotas: **PASS**

---

## 2. Production Build Verification

* **Command**: `npm run build` (`vite build`)
* **Exit Code**: `0`
* **Build Time**: 432ms
* **Output**:
  - `dist/index.html` (72.19 kB)
  - `dist/book/index.html` (63.04 kB)
  - `dist/admin/index.html` (32.36 kB)
  - `dist/gallery/index.html` (25.82 kB)
  - `dist/contact/index.html` (23.18 kB)
  - `dist/about/index.html` (16.98 kB)
  - `dist/terms/index.html` (16.58 kB)
  - `dist/privacy/index.html` (15.34 kB)
  - `dist/cancellation/index.html` (15.21 kB)
  - `dist/verify/index.html` (11.35 kB)
  - `dist/404.html` (6.71 kB)
  - All JS and CSS bundles successfully compiled and minified with zero errors.

---

## 3. Dependency Vulnerability Analysis

* **Command**: `npm audit`
* **Exit Code**: `0`
* **Result**: **0 vulnerabilities found** across all direct and transitive dependencies.

---

## 4. Secret & Credential Exposure Scan

* **Method**: Static search for live credentials, API keys, and sensitive tokens across all tracked git files and `dist/`.
* **Patterns Checked**:
  - `RAZORPAY_KEY_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - High-entropy private keys
* **Results**: Clean. No live secrets committed. Production bundles only reference public client tokens (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID`).
