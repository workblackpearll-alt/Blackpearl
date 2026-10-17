import crypto from 'node:crypto';
import {
  DEPOSIT_AMOUNT,
  charterSlots,
  durationItinerary,
  formatCurrency,
  getCharterPrice,
  getItineraryLabel,
  getSlotTimingLabel,
  getStartHourOptions
} from '../shared/pricing.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { createRazorpayOrder, getRazorpayKeyId } from './_lib/razorpay.js';
import { PAID_STATUSES, PENDING_HOLD_MINUTES, STATUS, todayInIndia } from './_lib/booking.js';
import { readJson, send, methodNotAllowed } from './_lib/http.js';

/**
 * POST /api/create-order
 * Validates the booking, checks the slot is free, records a "Payment Pending"
 * hold and creates a Razorpay order for the fixed advance amount.
 */
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeBookingCode(dateIso) {
  const [, m, d] = dateIso.split('-');
  let suffix = '';
  for (const byte of crypto.randomBytes(4)) suffix += CODE_CHARS[byte % CODE_CHARS.length];
  return `BP-${d}${m}-${suffix}`;
}

function formatLongDate(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday}, ${d} ${monthNames[m - 1]} ${y}`;
}

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: 'Invalid request.' });
  }

  // ---- Validate input (never trust prices or amounts from the browser) ----
  const slotKey = clean(body.slot, 10);
  const duration = Number(body.durationHours);
  const startHour = Number(body.startHour);
  const dateIso = clean(body.dateIso, 10);
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 160).toLowerCase();
  const occasion = clean(body.occasion, 160) || 'Private Charter';
  const notes = clean(body.notes, 1000);
  const guests = Math.round(Number(body.guests));

  if (!charterSlots[slotKey] || !durationItinerary[duration]) {
    return send(res, 400, { error: 'Please choose a valid slot and duration.' });
  }
  if (!getStartHourOptions(slotKey, duration).includes(startHour)) {
    return send(res, 400, { error: 'Please choose a valid start time for this slot.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || dateIso < todayInIndia()) {
    return send(res, 400, { error: 'Please choose a valid upcoming date.' });
  }
  if (!name) return send(res, 400, { error: 'Please enter your name.' });
  if (phone.replace(/\D/g, '').length < 10) return send(res, 400, { error: 'Please enter a valid WhatsApp number.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Please enter a valid email address.' });
  if (!Number.isFinite(guests) || guests < 1 || guests > 100) {
    return send(res, 400, { error: 'Guest count must be between 1 and 100.' });
  }

  try {
    const db = getSupabaseAdmin();

    // ---- Availability: blocked date, a paid booking, or a fresh pending checkout ----
    // Admin locks: full day (slot_key null) or this specific slot
    const { data: locks, error: locksError } = await db.from('blocked_dates')
      .select('id')
      .eq('date', dateIso)
      .or(`slot_key.is.null,slot_key.eq.${slotKey}`);
    if (locksError) throw locksError;
    if (locks && locks.length) {
      return send(res, 409, { error: 'This slot is unavailable on that date. Please pick another date or slot.', code: 'SLOT_TAKEN' });
    }

    const pendingCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000).toISOString();
    const { data: existing, error: existingError } = await db.from('holds')
      .select('id, status, created_at')
      .eq('date_iso', dateIso)
      .eq('slot_key', slotKey)
      .in('status', [...PAID_STATUSES, STATUS.pending]);
    if (existingError) throw existingError;

    const taken = (existing || []).some(h => PAID_STATUSES.includes(h.status) || h.created_at > pendingCutoff);
    if (taken) {
      return send(res, 409, { error: 'Sorry, this slot was just booked. Please choose another date or slot.', code: 'SLOT_TAKEN' });
    }

    // ---- Create the pending hold and Razorpay order ----
    const price = getCharterPrice(slotKey, duration);
    const bookingCode = makeBookingCode(dateIso);
    const slotLabel = getSlotTimingLabel(slotKey, startHour, duration);

    const order = await createRazorpayOrder({
      amountPaise: DEPOSIT_AMOUNT * 100,
      receipt: bookingCode,
      notes: {
        booking_code: bookingCode,
        occasion,
        charter_date: dateIso,
        slot: slotLabel,
        guest_name: name,
        guest_phone: phone
      }
    });

    const hold = {
      id: bookingCode,
      booking_code: bookingCode,
      occasion,
      date: formatLongDate(dateIso),
      date_iso: dateIso,
      slot: slotLabel,
      slot_key: slotKey,
      start_hour: startHour,
      duration: `${duration} hours`,
      duration_hours: duration,
      voyage_mode: getItineraryLabel(duration),
      guests,
      price: formatCurrency(price),
      paid_token: formatCurrency(DEPOSIT_AMOUNT),
      payment_method: 'razorpay',
      razorpay_order_id: order.id,
      verify_token: crypto.randomBytes(24).toString('hex'),
      name,
      phone,
      email,
      notes,
      status: STATUS.pending,
      created_at: new Date().toISOString()
    };

    const { error: insertError } = await db.from('holds').insert([hold]);
    if (insertError) throw insertError;

    return send(res, 200, {
      bookingCode,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId()
    });
  } catch (err) {
    console.error('[create-order]', err);
    return send(res, 500, { error: 'Could not start the payment. Please try again in a moment.' });
  }
}
