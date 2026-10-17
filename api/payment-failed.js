import { markHoldUnpaid, STATUS } from './_lib/booking.js';
import { readJson, send, methodNotAllowed } from './_lib/http.js';

/**
 * POST /api/payment-failed
 * Records a failed payment attempt or a checkout the guest closed, so it
 * shows in the admin panel and frees the slot. Never touches a paid booking.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: 'Invalid request.' });
  }

  const orderId = String(body.orderId || '');
  if (!orderId) return send(res, 400, { error: 'Missing order.' });

  const abandoned = Boolean(body.abandoned);
  try {
    await markHoldUnpaid(orderId, {
      status: abandoned ? STATUS.abandoned : STATUS.failed,
      reason: abandoned ? 'Guest closed the payment window before paying.' : String(body.reason || 'Payment failed'),
      paymentId: body.paymentId ? String(body.paymentId) : undefined
    });
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('[payment-failed]', err);
    return send(res, 500, { error: 'Could not record payment status.' });
  }
}
