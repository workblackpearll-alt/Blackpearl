import crypto from 'node:crypto';
import {
  DEPOSIT_AMOUNT,
  charterSlots,
  durationItinerary,
  formatCurrency,
  getCharterPrice,
  getItineraryLabel,
  getSlotTimingLabel,
  getStartHourOptions,
  isRangeFree
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
