import crypto from 'node:crypto';
import { isLikelyRealPhone } from '../shared/phone.js';
import {
  DEPOSIT_AMOUNT,
  charterSlots,
  durationItinerary,
  formatCurrency,
  getCharterPrice,
  getItineraryLabel,
  getSlotTimingLabel,
  getStartHourOptions,
  isRangeFree,
  ONLINE_PAYMENTS_ENABLED
} from '../shared/pricing.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { createRazorpayOrder, getRazorpayKeyId } from './_lib/razorpay.js';
import { STATUS, todayInIndia } from './_lib/booking.js';
import { getOccupiedRanges } from './_lib/occupancy.js';
import { readJson, send, methodNotAllowed } from './_lib/http.js';

/**
 * POST /api/create-order
 * Validates the booking, checks the slot is free, records a "Payment Pending"
 * hold and creates a Razorpay order for the fixed advance amount.
 *
 * While ONLINE_PAYMENTS_ENABLED is false (shared/pricing.js) it instead records a
 * "Booking Requested" hold (no payment) that the team confirms on WhatsApp.
 */
const MAX_OPEN_REQUESTS_PER_DAY = 3;
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

const ipBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ORDERS_PER_MINUTE = 5;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

function checkIpRateLimit(ip) {
  const now = Date.now();
  const timestamps = (ipBuckets.get(ip) || []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_ORDERS_PER_MINUTE) {
    return false;
  }
  timestamps.push(now);
  ipBuckets.set(ip, timestamps);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const clientIp = getClientIp(req);
  if (!checkIpRateLimit(clientIp)) {
    return send(res, 429, {
      error: 'Too many booking requests. Please wait a moment before trying again.'
    });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    if (err.statusCode === 413) {
      return send(res, 413, { error: 'Payload too large.' });
    }
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
  // Promotion link that brought the guest (utm_campaign), for analytics
  const campaign = clean(body.campaign, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || null;
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
  if (!isLikelyRealPhone(phone)) return send(res, 400, { error: 'Please enter a valid WhatsApp number.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Please enter a valid email address.' });
  if (!Number.isFinite(guests) || guests < 1 || guests > 100) {
    return send(res, 400, { error: 'Guest count must be between 1 and 100.' });
  }

  try {
    const db = getSupabaseAdmin();

    // ---- BP-SEC-05: Prevent slot hoarding by checking pending orders for this user ----
    const pendingCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: pendingCount, error: countError } = await db
      .from('holds')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('status', STATUS.pending)
      .gt('created_at', pendingCutoff);

    if (!countError && typeof pendingCount === 'number' && pendingCount >= 3) {
      return send(res, 429, {
        error: 'You have multiple pending checkout attempts. Please complete your existing checkout or try again in a few minutes.'
      });
    }

    // ---- Check for existing active pending order for this exact slot by the same client ----
    const { data: existingPending } = await db
      .from('holds')
      .select('id, razorpay_order_id, price')
      .eq('date_iso', dateIso)
      .eq('start_hour', startHour)
      .eq('email', email)
      .eq('status', STATUS.pending)
      .gt('created_at', pendingCutoff)
      .maybeSingle();

    if (existingPending && existingPending.razorpay_order_id) {
      return send(res, 200, {
        bookingCode: existingPending.id,
        orderId: existingPending.razorpay_order_id,
        amount: DEPOSIT_AMOUNT * 100,
        currency: 'INR',
        keyId: getRazorpayKeyId()
      });
    }

    // ---- Availability: this time (plus the 1-hour turnaround) must be free ----
    const occupied = await getOccupiedRanges({ date: dateIso });
    if (!isRangeFree(startHour, startHour + duration, occupied)) {
      return send(res, 409, {
        error: 'Sorry, that time is no longer available (bookings need a 1-hour gap). Please choose another start time or date.',
        code: 'SLOT_TAKEN'
      });
    }

    // ---- Request mode (no online payment yet): save the request, team confirms on WhatsApp ----
    if (!ONLINE_PAYMENTS_ENABLED) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: openRequests } = await db.from('holds')
        .select('id, date_iso, start_hour')
        .eq('email', email)
        .eq('status', STATUS.requested)
        .gt('created_at', dayAgo);

      // Double-tap / resubmit of the same request: return the one already saved
      const same = (openRequests || []).find(r => r.date_iso === dateIso && r.start_hour === startHour);
      if (same) return send(res, 200, { bookingCode: same.id, request: true });

      // Limit spam: one email can have only a few open requests a day
      if ((openRequests || []).length >= MAX_OPEN_REQUESTS_PER_DAY) {
        return send(res, 429, {
          error: 'You already have booking requests waiting. Please message us on WhatsApp and our team will help.'
        });
      }
    }

    // ---- Create the pending hold and Razorpay order ----
    const price = getCharterPrice(slotKey, duration);
    const bookingCode = makeBookingCode(dateIso);
    const slotLabel = getSlotTimingLabel(slotKey, startHour, duration);

    const order = ONLINE_PAYMENTS_ENABLED ? await createRazorpayOrder({
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
    }) : null;

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
      paid_token: ONLINE_PAYMENTS_ENABLED ? formatCurrency(DEPOSIT_AMOUNT) : 'Not paid yet',
      payment_method: ONLINE_PAYMENTS_ENABLED ? 'razorpay' : 'whatsapp',
      razorpay_order_id: order ? order.id : null,
      verify_token: crypto.randomBytes(24).toString('hex'),
      name,
      phone,
      email,
      notes,
      campaign,
      status: ONLINE_PAYMENTS_ENABLED ? STATUS.pending : STATUS.requested,
      created_at: new Date().toISOString()
    };

    let { error: insertError } = await db.from('holds').insert([hold]);
    if (insertError && /campaign/.test(insertError.message || '')) {
      // Analytics column not added yet: never let it block a booking
      delete hold.campaign;
      ({ error: insertError } = await db.from('holds').insert([hold]));
    }
    if (insertError) throw insertError;

    if (!ONLINE_PAYMENTS_ENABLED) {
      // Let the team know straight away; never fail the request because of email
      try {
        const { sendAdminBookingAlert } = await import('./_lib/email.js');
        const alert = await sendAdminBookingAlert(hold);
        if (alert) {
          await db.from('holds').update({
            admin_email_id: alert.id || null,
            admin_email_status: 'sent',
            admin_email_status_at: new Date().toISOString()
          }).eq('id', bookingCode);
        }
      } catch (emailErr) {
        console.error('[create-order] request alert email failed', emailErr);
      }
      return send(res, 200, { bookingCode, request: true });
    }

    return send(res, 200, {
      bookingCode,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId()
    });
  } catch (err) {
    console.error('[create-order]', err);
    return send(res, 500, {
      error: ONLINE_PAYMENTS_ENABLED
        ? 'Could not start the payment. Please try again in a moment.'
        : 'Could not send your booking request. Please try again, or message us on WhatsApp.'
    });
  }
}
