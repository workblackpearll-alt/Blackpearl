import crypto from 'node:crypto';

/* Minimal Razorpay REST helpers (no SDK needed). */

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set on the server.');
  }
  return { keyId, keySecret };
}

export function getRazorpayKeyId() {
  return credentials().keyId;
}

export async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  const { keyId, keySecret } = credentials();
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Razorpay order failed: ${data?.error?.description || res.status}`);
  }
  return data;
}

function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Checkout success signature: HMAC_SHA256(order_id|payment_id, key_secret)
export function verifyPaymentSignature(orderId, paymentId, signature) {
  const { keySecret } = credentials();
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

// Webhook signature: HMAC_SHA256(raw body, webhook secret)
export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET must be set on the server.');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
