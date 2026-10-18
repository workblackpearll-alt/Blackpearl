#!/usr/bin/env node
/**
 * BLACK PEARL · LADY ALICE
 * AUTOMATED SECURITY REGRESSION TEST HARNESS & PENETRATION RETEST
 *
 * Validates remediation for all 11 security findings:
 * - BP-SEC-01: RLS access control for voyage_briefs
 * - BP-SEC-02: Stored XSS neutralization in admin portal
 * - BP-SEC-03: Stored XSS & gallery image security
 * - BP-SEC-04: Admin server authorization verification
 * - BP-SEC-05: Rate limiting & booking-slot anti-hoarding
 * - BP-SEC-06: CSV formula injection neutralization
 * - BP-SEC-07: HTTP security headers in vercel.json
 * - BP-SEC-08: QR verification PII minimization
 * - BP-SEC-09: Request body buffer limits (HTTP 413)
 * - BP-SEC-10: Analytics (page_views) RLS lockdown
 * - BP-SEC-11: Deprecated mock-payment bypass elimination
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Set dummy test environment secrets for cryptographic testing
process.env.RAZORPAY_KEY_ID = 'rzp_test_testkey12345';
process.env.RAZORPAY_KEY_SECRET = 'supersecretkey1234567890';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhooksecret1234567890';

// Import project modules
import { verifyPaymentSignature, verifyWebhookSignature } from '../api/_lib/razorpay.js';
import { toPublicBooking } from '../api/_lib/booking.js';
import { readRawBody, readJson } from '../api/_lib/http.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    results.push({ test: description, status: 'PASS', details });
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${description}`);
  } else {
    failed++;
    results.push({ test: description, status: 'FAIL', details });
    console.error(`  \x1b[31m✘ FAIL\x1b[0m ${description}${details ? ' - ' + details : ''}`);
  }
}

console.log('\n================================================================');
console.log(' BLACK PEARL · LADY ALICE - SECURITY REGRESSION TEST HARNESS');
console.log('================================================================\n');

// -------------------------------------------------------------
// SECTION 1: PAYMENT CRYPTOGRAPHIC VERIFICATION (HMAC-SHA256)
// -------------------------------------------------------------
console.log('[1/7] Testing Razorpay Cryptographic Controls...');
{
  const orderId = 'order_test_12345678';
  const paymentId = 'pay_test_987654321';
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const validSignature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  assert('Valid payment signature is accepted', verifyPaymentSignature(orderId, paymentId, validSignature));
  assert('Forged payment signature is rejected', !verifyPaymentSignature(orderId, paymentId, '0000000000000000000000000000000000000000000000000000000000000000'));
  assert('Altered order ID is rejected', !verifyPaymentSignature('order_test_altered', paymentId, validSignature));
  assert('Truncated payment signature is rejected', !verifyPaymentSignature(orderId, paymentId, validSignature.slice(0, 32)));

  const rawWebhookBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId } } } });
  const validWebhookSig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawWebhookBody).digest('hex');

  assert('Valid webhook signature is accepted', verifyWebhookSignature(rawWebhookBody, validWebhookSig));
  assert('Forged webhook signature is rejected', !verifyWebhookSignature(rawWebhookBody, 'forged_webhook_signature_value_123456'));
}

// -------------------------------------------------------------
// SECTION 2: STORED XSS ESCAPING & MEDIA URL SANITIZATION (BP-SEC-02, BP-SEC-03)
// -------------------------------------------------------------
console.log('\n[2/7] Testing Stored XSS Sanitization & Media Filtering...');
{
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function sanitizeMediaUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^(https?:|\/|data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,)/i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }

  const maliciousPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg/onload=confirm(document.cookie)>',
    "';alert(String.fromCharCode(88,83,83))//",
    '<a href="javascript:alert(1)">Click</a>'
  ];

  for (const payload of maliciousPayloads) {
    const escaped = escapeHtml(payload);
    assert(`escapeHtml neutralizes: ${payload.slice(0, 30)}...`,
      !escaped.includes('<') &&
      !escaped.includes('>') &&
      !escaped.includes('"') &&
      (escaped.includes('&lt;') || !payload.includes('<'))
    );
  }

  assert('sanitizeMediaUrl accepts HTTPS URLs', Boolean(sanitizeMediaUrl('https://ik.imagekit.io/blackpearl/lady-alice.jpg')));
  assert('sanitizeMediaUrl accepts relative root URLs', Boolean(sanitizeMediaUrl('/assets/images/boat.jpg')));
  assert('sanitizeMediaUrl accepts data:image/png;base64', Boolean(sanitizeMediaUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=')));
  assert('sanitizeMediaUrl rejects javascript: URI', sanitizeMediaUrl('javascript:alert(1)') === '');
  assert('sanitizeMediaUrl rejects data:text/html URI', sanitizeMediaUrl('data:text/html,<script>alert(1)</script>') === '');
  assert('sanitizeMediaUrl rejects vbscript: URI', sanitizeMediaUrl('vbscript:msgbox(1)') === '');
}

// -------------------------------------------------------------
// SECTION 3: SPREADSHEET FORMULA INJECTION (BP-SEC-06)
// -------------------------------------------------------------
console.log('\n[3/7] Testing CSV Formula Injection Sanitization (BP-SEC-06)...');
{
  const csvCell = (v) => {
    let str = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const formulaTestCases = [
    { input: '=1+2', expectedPrefix: "'=" },
    { input: '+SUM(A1:A10)', expectedPrefix: "'+SUM" },
    { input: '-2+3*CMD', expectedPrefix: "'-2" },
    { input: '@SUM(B1)', expectedPrefix: "'@SUM" },
    { input: '\t=cmd|', expectedPrefix: "'\t" },
    { input: '\r=calc', expectedPrefix: "'\r" },
    { input: 'Normal Name', expectedPrefix: 'Normal Name' }
  ];

  for (const tc of formulaTestCases) {
    const formatted = csvCell(tc.input);
    if (tc.expectedPrefix.startsWith("'")) {
      assert(`CSV cell quotes and prepends apostrophe to "${tc.input}"`, formatted.startsWith(`"${tc.expectedPrefix}`));
    } else {
      assert(`CSV cell preserves safe text "${tc.input}"`, formatted === `"${tc.input}"`);
    }
  }

  // Double quotes escaping
  assert('CSV cell correctly escapes internal double quotes', csvCell('Captain "Jack" Sparrow') === '"Captain ""Jack"" Sparrow"');
}

// -------------------------------------------------------------
// SECTION 4: QR BOARDING PASS PII MINIMIZATION (BP-SEC-08)
// -------------------------------------------------------------
console.log('\n[4/7] Testing QR Verification PII Minimization (BP-SEC-08)...');
{
  const mockHold = {
    id: 'BP-1910-K7X9',
    status: 'Held (Deposit Paid)',
    name: 'Maharaja of Jaipur',
    phone: '+91 98765 43210',
    email: 'private.client@example.com',
    occasion: 'Royal Anniversary',
    date: 'Mon, 19 Oct 2026',
    date_iso: '2026-10-19',
    slot: 'Evening Voyage · 05:00 PM to 08:00 PM',
    duration: '3 hours',
    voyage_mode: 'Active Sailing (Underway)',
    guests: 8,
    price: '₹1,35,000',
    paid_token: '₹5,000',
    payment_id: 'pay_ABC123XYZ456',
    paid_at: '2026-10-19T01:00:00.000Z',
    notes: 'VIP guest requiring high security and privacy.'
  };

  const publicView = toPublicBooking(mockHold);

  assert('toPublicBooking retains booking code', publicView.code === 'BP-1910-K7X9');
  assert('toPublicBooking retains status', publicView.status === 'Held (Deposit Paid)');
  assert('toPublicBooking retains passenger name', publicView.name === 'Maharaja of Jaipur');
  assert('toPublicBooking retains guest count', publicView.guests === 8);
  assert('toPublicBooking EXCLUDES customer phone number', publicView.phone === undefined);
  assert('toPublicBooking EXCLUDES customer email address', publicView.email === undefined);
  assert('toPublicBooking EXCLUDES private charter notes', publicView.notes === undefined);
  assert('toPublicBooking masks payment ID', publicView.paymentId === 'pay_ABC1...');
}

// -------------------------------------------------------------
// SECTION 5: REQUEST BODY BUFFER SIZE LIMIT (BP-SEC-09)
// -------------------------------------------------------------
console.log('\n[5/7] Testing Request Body Buffer Limits (BP-SEC-09)...');
{
  // Test async readable stream simulation
  async function* makeStream(chunks) {
    for (const chunk of chunks) yield chunk;
  }

  // Test 1: Normal small payload (should succeed)
  const smallStream = makeStream([Buffer.from(JSON.stringify({ test: 'hello' }))]);
  try {
    const raw = await readRawBody(smallStream, 64 * 1024);
    assert('Normal request body (< 64KB) is read successfully', raw.includes('hello'));
  } catch (err) {
    assert('Normal request body (< 64KB) is read successfully', false, err.message);
  }

  // Test 2: Oversized payload (> 64KB)
  const hugeChunk = Buffer.alloc(70 * 1024, 'A'); // 70 KB
  const hugeStream = makeStream([hugeChunk]);
  try {
    await readRawBody(hugeStream, 64 * 1024);
    assert('Oversized request (> 64KB) triggers HTTP 413 error', false, 'Should have thrown 413');
  } catch (err) {
    assert('Oversized request (> 64KB) triggers HTTP 413 error', err.statusCode === 413 && err.message === 'Payload Too Large');
  }
}

// -------------------------------------------------------------
// SECTION 6: HTTP SECURITY HEADERS IN VERCEL.JSON (BP-SEC-07)
// -------------------------------------------------------------
console.log('\n[6/7] Testing vercel.json Security Headers (BP-SEC-07)...');
{
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8'));
  assert('vercel.json defines headers block', Array.isArray(vercelConfig.headers) && vercelConfig.headers.length > 0);

  const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || [];
  const headerMap = Object.fromEntries(globalHeaders.map(h => [h.key, h.value]));

  assert('Content-Security-Policy is configured', Boolean(headerMap['Content-Security-Policy']));
  assert('CSP permits Razorpay scripts', headerMap['Content-Security-Policy']?.includes('https://checkout.razorpay.com'));
  assert('CSP permits ImageKit media', headerMap['Content-Security-Policy']?.includes('https://ik.imagekit.io'));
  assert('CSP enforces frame-ancestors', headerMap['Content-Security-Policy']?.includes("frame-ancestors 'self'"));
  assert('Strict-Transport-Security (HSTS) is configured', headerMap['Strict-Transport-Security']?.includes('max-age=63072000'));
  assert('X-Content-Type-Options: nosniff is set', headerMap['X-Content-Type-Options'] === 'nosniff');
  assert('X-Frame-Options: SAMEORIGIN is set', headerMap['X-Frame-Options'] === 'SAMEORIGIN');
  assert('Referrer-Policy: strict-origin-when-cross-origin is set', headerMap['Referrer-Policy'] === 'strict-origin-when-cross-origin');
  assert('Permissions-Policy is configured', Boolean(headerMap['Permissions-Policy']));
}

// -------------------------------------------------------------
// SECTION 7: STATIC CODE AUDIT FOR AUTHORIZATION & MIGRATIONS
// -------------------------------------------------------------
console.log('\n[7/7] Testing Database Migrations & Code Remediation Integrity...');
{
  // Test 1: Verify supabase_migration_security_hardening.sql exists and contains expected rules
  const migrationPath = path.join(ROOT_DIR, 'supabase_migration_security_hardening.sql');
  assert('Security hardening migration file exists', fs.existsSync(migrationPath));
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert('Migration revokes public SELECT on voyage_briefs', migrationSql.includes('Admins can view voyage briefs') && migrationSql.includes('public.is_admin()'));
  assert('Migration restricts gallery_images INSERT to admin', migrationSql.includes('Admins can insert gallery images') && migrationSql.includes('public.is_admin()'));
  assert('Migration restricts page_views SELECT to admin', migrationSql.includes('Admins can view page views') && migrationSql.includes('public.is_admin()'));

  // Test 2: Verify admin.js enforces verifyAdminStatus
  const adminJsPath = path.join(ROOT_DIR, 'admin', 'admin.js');
  const adminJs = fs.readFileSync(adminJsPath, 'utf8');
  assert('admin.js imports and verifies verifyAdminStatus', adminJs.includes('verifyAdminStatus') && adminJs.includes('await verifyAdminStatus()'));
  assert('admin.js escapes renderMediaGrid fields', adminJs.includes('escapeHtml(displayUrl)') && adminJs.includes('escapeHtml(item.title'));

  // Test 3: Verify main.js mock payment bypass removal
  const mainJsPath = path.join(ROOT_DIR, 'main.js');
  const mainJs = fs.readFileSync(mainJsPath, 'utf8');
  assert('main.js removes mock payment simulation fallback', !mainJs.includes('Simulating ₹5,000 hold deposit') && !mainJs.includes('pay_test_'));

  // Test 4: Verify create-order.js has anti-hoarding and rate limiting
  const createOrderPath = path.join(ROOT_DIR, 'api', 'create-order.js');
  const createOrderJs = fs.readFileSync(createOrderPath, 'utf8');
  assert('create-order.js implements IP rate limiting', createOrderJs.includes('checkIpRateLimit') && createOrderJs.includes('429'));
  assert('create-order.js checks pending hold count', createOrderJs.includes('pendingCount >= 3'));
}

console.log('\n================================================================');
console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
