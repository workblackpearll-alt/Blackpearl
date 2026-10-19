# Black Pearl · Lady Alice — Razorpay Payment Security Report

## 1. Executive Payment Audit Summary
The payment processing pipeline for Black Pearl was evaluated across order creation, checkout initiation, cryptographic signature verification, webhook processing, state machine transitions, and idempotency.

**Overall Payment Security Posture: HIGH INTEGRITY & CRYPTOGRAPHICALLY SECURE**
- Server-side price calculation prevents client-side price tampering.
- Cryptographic HMAC-SHA256 signature verification protects both direct callback verification and asynchronous webhooks.
- Atomic email dispatch prevents double boarding pass issuance.
- The PostgreSQL `23P01` exclusion handler prevents double booking overpayments.
- **Key Vulnerability Identified**: Absence of request rate limiting on order creation (`/api/create-order`), allowing automated slot hoarding (BP-SEC-05).

---

## 2. Order Creation Security Review (`api/create-order.js`)

| Check | Expected Behavior | Actual Implementation | Outcome |
| :--- | :--- | :--- | :--- |
| **Price Tampering** | Client cannot manipulate charter price | Price is derived entirely on the server using `getCharterPrice(slotKey, duration)` from `shared/pricing.js`. Client-supplied prices are discarded. | **PASS** |
| **Deposit Tampering** | Client cannot manipulate deposit | Fixed constant `DEPOSIT_AMOUNT = 5000` is enforced in `createRazorpayOrder({ amountPaise: DEPOSIT_AMOUNT * 100 })`. | **PASS** |
| **Slot Availability Re-check** | Re-verify slot is unoccupied before order creation | Calls `getOccupiedRanges({ date: dateIso })` and verifies `isRangeFree(startHour, startHour + duration, occupied)`. | **PASS** |
| **Input Validation** | Validate date, guest count, start hour, phone, email | Rejects past dates, guests < 1 or > 100, invalid start times, short phone numbers (<10 digits), and invalid emails with HTTP 400. | **PASS** |
| **Rate Limiting** | Prevent rapid automated order generation | No rate limiting or CAPTCHA; attackers can trigger orders repeatedly to lock calendar slots. | **FAIL (BP-SEC-05)** |

---

## 3. Payment Verification Security Review (`api/verify-payment.js`)

| Check | Expected Behavior | Actual Implementation | Outcome |
| :--- | :--- | :--- | :--- |
| **Signature Calculation** | Compute HMAC over `order_id|payment_id` with `RAZORPAY_KEY_SECRET` | Implemented in `verifyPaymentSignature`: `crypto.createHmac('sha256', keySecret).update(`${orderId}\|${paymentId}`).digest('hex')`. | **PASS** |
| **Timing Attack Resistance** | Prevent timing attacks on signature comparison | Uses `crypto.timingSafeEqual` after comparing buffer lengths in `safeEqualHex`. | **PASS** |
| **Forged Signature Rejection** | Reject forged, altered, or truncated signatures | Tested with simulated signatures; rejected 100% of invalid signatures with HTTP 400. | **PASS** |
| **Booking Association** | Payment ID and Order ID tied to specific booking | `markHoldPaid` selects `holds` record matching `razorpay_order_id = orderId`. | **PASS** |
| **Status Reversion Prevention** | Failed checkouts cannot overwrite confirmed bookings | `markHoldUnpaid` strictly enforces `.in('status', allowedFrom)` where `allowedFrom` only includes pending or earlier failures. | **PASS** |

---

## 4. Webhook Security Review (`api/razorpay-webhook.js`)

| Check | Expected Behavior | Actual Implementation | Outcome |
| :--- | :--- | :--- | :--- |
| **Raw Body Signature Verification** | Webhook signature checked against unparsed raw request body | Disables Vercel body parser (`config = { api: { bodyParser: false } }`), reads raw stream chunks via `readRawBody`, and computes HMAC against `process.env.RAZORPAY_WEBHOOK_SECRET`. | **PASS** |
| **Signature Header** | Verified via `x-razorpay-signature` | Extracted and validated; returns HTTP 400 on mismatch or missing header. | **PASS** |
| **Event Routing** | Handle `payment.captured`, `order.paid`, and `payment.failed` | Routes successfully captured payments to `markHoldPaid`, failed payments to `markHoldUnpaid`. | **PASS** |
| **Out-of-Order Events** | Late `payment.failed` event cannot overwrite an already confirmed booking | `markHoldUnpaid` explicitly excludes paid statuses from its update target. | **PASS** |

---

## 5. State Machine & Idempotency Analysis

```
[ New Request ]
       |
       v
[ POST /api/create-order ] ---> Status: 'Payment Pending' (Blocks slot for 15 mins)
       |
       v
[ Razorpay Modal ]
  ├── Payment Declined / Abandoned ──> [ POST /api/payment-failed ] ──> Status: 'Payment Failed' / 'Payment Abandoned' (Frees slot)
  │
  └── Payment Captured
           ├── Path A: Client Callback ---> [ POST /api/verify-payment ]
           └── Path B: Webhook Callback --> [ POST /api/razorpay-webhook ]
                   │
                   v
           [ markHoldPaid(orderId, paymentId) ]
                   │
                   ├── Normal Flow: Status: 'Held (Deposit Paid)'
                   │         │
                   │         v
                   │   [ sendConfirmationOnce(hold) ] (Atomic claim via email_sent_at IS NULL)
                   │         │
                   │         └──> Sends Resend HTML Boarding Pass with QR code
                   │
                   └── Concurrency Conflict: DB Constraint '23P01' trips
                             │
                             v
                       Status: 'Paid - Slot Conflict'
                       (Records payment_id & prompts admin for refund/rebooking)
```

- **Duplicate Prevention**: If both the client callback (`verify-payment.js`) and the Razorpay webhook arrive at the exact same time, `sendConfirmationOnce` executes:
  ```javascript
  const { data: claimed } = await db.from('holds')
    .update({ email_sent_at: claimedAt, email_error: null })
    .eq('id', hold.id).is('email_sent_at', null).select().maybeSingle();
  ```
  Only the single thread that successfully claims the `NULL` state sends the email; the other thread receives `null` and gracefully skips email dispatch.
