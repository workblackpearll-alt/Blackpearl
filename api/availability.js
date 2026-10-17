import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { PAID_STATUSES, PENDING_HOLD_MINUTES, STATUS, todayInIndia } from './_lib/booking.js';
import { slotKeyFromLabel } from '../shared/pricing.js';
import { send, methodNotAllowed } from './_lib/http.js';

/**
 * GET /api/availability
 * Taken slots (portal bookings) and admin locks (offline bookings) for the
 * booking calendar. Returns only dates and slot names — never guest details
 * or lock notes.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  try {
    const db = getSupabaseAdmin();
    const today = todayInIndia();
    const pendingCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000).toISOString();

    const [{ data: holds, error: holdsError }, { data: blocked, error: blockedError }] = await Promise.all([
      db.from('holds')
        .select('date_iso, slot, slot_key, status, created_at')
        .gte('date_iso', today)
        .in('status', [...PAID_STATUSES, STATUS.pending, STATUS.conflict]),
      db.from('blocked_dates').select('date, slot_key').gte('date', today)
    ]);
    if (holdsError) throw holdsError;
    if (blockedError) throw blockedError;

    const bookedSlots = (holds || [])
      .filter(h => h.status !== STATUS.pending || h.created_at > pendingCutoff)
      .map(h => ({ date: h.date_iso, slot: h.slot_key || slotKeyFromLabel(h.slot) }))
      .filter(h => h.slot);

    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, {
      bookedSlots,
      // slot null = whole day locked
      blocks: (blocked || []).map(b => ({ date: b.date, slot: b.slot_key || null }))
    });
  } catch (err) {
    console.error('[availability]', err);
    return send(res, 500, { error: 'Could not load availability.' });
  }
}
