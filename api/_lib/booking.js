import { getSupabaseAdmin } from './supabaseAdmin.js';

/* Shared booking state transitions used by verify-payment and the Razorpay webhook. */

export const PAID_STATUSES = ['Held (Deposit Paid)', 'Confirmed', 'Completed'];
export const STATUS = {
  pending: 'Payment Pending',
  failed: 'Payment Failed',
  abandoned: 'Payment Abandoned',
  paid: 'Held (Deposit Paid)',
  conflict: 'Paid - Slot Conflict'
};

// A pending checkout blocks its slot for this long, then frees it (tightened to 10 minutes)
export const PENDING_HOLD_MINUTES = 10;

export function getSiteUrl() {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function getVerifyUrl(hold) {
  return `${getSiteUrl()}/verify?code=${encodeURIComponent(hold.id)}&t=${encodeURIComponent(hold.verify_token)}`;
}

export function getQrImageUrl(hold) {
  return `${getSiteUrl()}/api/qr?code=${encodeURIComponent(hold.id)}&t=${encodeURIComponent(hold.verify_token)}`;
}

export function todayInIndia() {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/**
 * Marks the hold for this Razorpay order as paid (idempotent), then sends the
 * confirmation email once. Returns the updated hold row.
 */
export async function markHoldPaid(orderId, paymentId) {
  const db = getSupabaseAdmin();

  const { data: hold, error } = await db.from('holds').select('*').eq('razorpay_order_id', orderId).maybeSingle();
  if (error) throw error;
  if (!hold) return null;

  let current = hold;

  if (!PAID_STATUSES.includes(hold.status) && hold.status !== STATUS.conflict) {
    const update = {
      status: STATUS.paid,
      payment_id: paymentId || hold.payment_id,
      paid_at: new Date().toISOString(),
      failure_reason: null,
      updated_at: new Date().toISOString()
    };
    const { data: updated, error: updateError } = await db
      .from('holds').update(update).eq('id', hold.id).select().single();

    // 23P01: overlaps another paid booking (database guard); 23505: legacy unique index
    if (updateError && (updateError.code === '23P01' || updateError.code === '23505')) {
      // Someone else already paid for this time: keep the money trail, flag for refund
      const { data: conflicted } = await db.from('holds').update({
        status: STATUS.conflict,
        payment_id: paymentId,
        paid_at: new Date().toISOString(),
        failure_reason: 'This time was already booked by another guest (bookings need a 1-hour gap). Refund the advance.',
        updated_at: new Date().toISOString()
      }).eq('id', hold.id).select().single();
      return conflicted;
    }
    if (updateError) throw updateError;
    current = updated;
  }

  if (PAID_STATUSES.includes(current.status) && !current.email_sent_at) {
    current = await sendConfirmationOnce(current);
  }
  return current;
}

async function sendConfirmationOnce(hold) {
  const db = getSupabaseAdmin();
  // Claim the send so the webhook and the browser callback don't both email
  const now = () => new Date().toISOString();
  const { data: claimed } = await db.from('holds')
    .update({ email_sent_at: now(), email_error: null })
    .eq('id', hold.id).is('email_sent_at', null).select().maybeSingle();
  if (!claimed) return hold;

  const { sendBookingConfirmationEmail, sendAdminBookingAlert } = await import('./email.js');
  let current = claimed;

  // 1. Guest confirmation with QR
  try {
    const sent = await sendBookingConfirmationEmail(claimed);
    const { data } = await db.from('holds').update({
      guest_email_id: sent?.id || null,
      guest_email_status: 'sent',
      guest_email_status_at: now()
    }).eq('id', hold.id).select().single();
    current = data || current;
  } catch (err) {
    console.error('[email] guest confirmation failed', hold.id, err);
    const { data } = await db.from('holds').update({
      email_sent_at: null,
      email_error: String(err.message || err).slice(0, 500),
      guest_email_status: 'failed',
      guest_email_status_at: now()
    }).eq('id', hold.id).select().single();
    current = data || current;
  }

  // 2. Separate "new booking" alert to the team (tracked on its own)
  try {
    const alert = await sendAdminBookingAlert(claimed);
    if (alert) {
      const { data } = await db.from('holds').update({
        admin_email_id: alert.id || null,
        admin_email_status: 'sent',
        admin_email_status_at: now()
      }).eq('id', hold.id).select().single();
      current = data || current;
    }
  } catch (err) {
    console.error('[email] team alert failed', hold.id, err);
    const { data } = await db.from('holds').update({
      admin_email_status: 'failed',
      admin_email_status_at: now()
    }).eq('id', hold.id).select().single();
    current = data || current;
  }

  return current;
}

/** Records a failed or abandoned checkout, without overwriting a paid booking. */
export async function markHoldUnpaid(orderId, { status, reason, paymentId }) {
  const db = getSupabaseAdmin();
  const update = { status, failure_reason: (reason || '').slice(0, 500) || null, updated_at: new Date().toISOString() };
  if (paymentId) update.payment_id = paymentId;

  // Abandoning only applies to a still-pending checkout; a failure can follow a pending or earlier failure
  const allowedFrom = status === STATUS.abandoned ? [STATUS.pending] : [STATUS.pending, STATUS.failed, STATUS.abandoned];
  const { data, error } = await db.from('holds').update(update)
    .eq('razorpay_order_id', orderId).in('status', allowedFrom).select().maybeSingle();
  if (error) throw error;
  return data;
}

/** Public, scan-safe view of a booking for the QR pass page (BP-SEC-08: PII minimized). */
export function toPublicBooking(hold) {
  return {
    code: hold.id,
    status: hold.status,
    name: hold.name,
    occasion: hold.occasion,
    date: hold.date,
    dateIso: hold.date_iso,
    slot: hold.slot,
    duration: hold.duration,
    itinerary: hold.voyage_mode,
    guests: hold.guests,
    price: hold.price,
    advancePaid: hold.paid_token,
    paymentId: hold.payment_id ? `${String(hold.payment_id).slice(0, 8)}...` : null,
    paidAt: hold.paid_at
  };
}
