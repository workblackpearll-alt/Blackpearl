import { verifyPaymentSignature } from './_lib/razorpay.js';
import { markHoldPaid, toPublicBooking, getVerifyUrl, getQrImageUrl, PAID_STATUSES, STATUS } from './_lib/booking.js';
import { readJson, send, methodNotAllowed } from './_lib/http.js';

/**
 * POST /api/verify-payment
 * Called by the booking page after Razorpay Checkout succeeds. Verifies the
 * signature, marks the booking paid and sends the confirmation email.
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
  const paymentId = String(body.paymentId || '');
  const signature = String(body.signature || '');

  if (!orderId || !paymentId || !signature) {
    return send(res, 400, { error: 'Missing payment details.' });
  }

  try {
    if (!verifyPaymentSignature(orderId, paymentId, signature)) {
      return send(res, 400, { error: 'Payment could not be verified. If money was deducted, our team will contact you.' });
    }

    const hold = await markHoldPaid(orderId, paymentId);
    if (!hold) return send(res, 404, { error: 'Booking not found for this payment.' });

    if (hold.status === STATUS.conflict) {
      return send(res, 409, {
        error: 'Your payment went through, but this slot was booked moments earlier by another guest. Our team will refund your advance or help you pick another slot.',
        bookingCode: hold.id
      });
    }
    if (!PAID_STATUSES.includes(hold.status)) {
      return send(res, 409, { error: 'Payment is still being processed.' });
    }

    return send(res, 200, {
      booking: toPublicBooking(hold),
      verifyUrl: getVerifyUrl(hold),
      qrUrl: getQrImageUrl(hold),
      emailSent: Boolean(hold.email_sent_at)
    });
  } catch (err) {
    console.error('[verify-payment]', err);
    return send(res, 500, { error: 'We could not confirm your booking right now. If money was deducted, it is safe and our team will contact you.' });
  }
}
