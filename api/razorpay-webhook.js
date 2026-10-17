import { verifyWebhookSignature } from './_lib/razorpay.js';
import { markHoldPaid, markHoldUnpaid, STATUS } from './_lib/booking.js';
import { readRawBody, send, methodNotAllowed } from './_lib/http.js';

/**
 * POST /api/razorpay-webhook
 * Backup confirmation straight from Razorpay, so a booking is still marked
 * paid (and emailed) even if the guest's browser closed mid-payment.
 * Configure in Razorpay Dashboard -> Webhooks with events:
 * payment.captured, order.paid, payment.failed
 */
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  try {
    const raw = await readRawBody(req);
    const signature = req.headers['x-razorpay-signature'];
    if (!signature || !verifyWebhookSignature(raw, signature)) {
      return send(res, 400, { error: 'Invalid signature' });
    }

    const event = JSON.parse(raw);
    const payment = event?.payload?.payment?.entity;
    const orderId = payment?.order_id || event?.payload?.order?.entity?.id;

    if (orderId && (event.event === 'payment.captured' || event.event === 'order.paid')) {
      await markHoldPaid(orderId, payment?.id || null);
    } else if (orderId && event.event === 'payment.failed') {
      await markHoldUnpaid(orderId, {
        status: STATUS.failed,
        reason: payment?.error_description || payment?.error_reason || 'Payment failed',
        paymentId: payment?.id
      });
    }

    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('[razorpay-webhook]', err);
    // 500 makes Razorpay retry later
    return send(res, 500, { error: 'Webhook processing failed' });
  }
}
