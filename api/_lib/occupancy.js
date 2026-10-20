import { getSupabaseAdmin } from './supabaseAdmin.js';
import { PAID_STATUSES, PENDING_HOLD_MINUTES, STATUS } from './booking.js';
import { rangeFromRecord, slotKeyFromLabel } from '../../shared/pricing.js';

/**
 * Occupied time ranges (paid bookings, fresh pending checkouts and admin
 * locks) for one date or for every date from `fromDate`. Never includes
 * guest details or lock notes.
 * Returns [{ date, start, end }].
 */
export async function getOccupiedRanges({ date, fromDate }) {
  const db = getSupabaseAdmin();
  const pendingCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000).toISOString();

  let holdsQuery = db.from('holds')
    .select('date_iso, slot, slot_key, start_hour, duration_hours, status, created_at')
    .in('status', [...PAID_STATUSES, STATUS.pending, STATUS.conflict]);
  // Booking requests (no advance paid) never block time: the team blocks it
  // themselves by setting the booking to Confirmed or adding a calendar lock.
  let locksQuery = db.from('blocked_dates').select('date, slot_key, start_hour, end_hour');

  if (date) {
    holdsQuery = holdsQuery.eq('date_iso', date);
    locksQuery = locksQuery.eq('date', date);
  } else {
    holdsQuery = holdsQuery.gte('date_iso', fromDate);
    locksQuery = locksQuery.gte('date', fromDate);
  }

  const [{ data: holds, error: holdsError }, { data: locks, error: locksError }] = await Promise.all([holdsQuery, locksQuery]);
  if (holdsError) throw holdsError;
  if (locksError) throw locksError;

  const fromHolds = (holds || [])
    // A pending checkout only blocks its time for a few minutes
    .filter(h => h.status !== STATUS.pending || h.created_at > pendingCutoff)
    .map(h => ({
      date: h.date_iso,
      ...rangeFromRecord({
        startHour: h.start_hour,
        durationHours: h.duration_hours,
        slotKey: h.slot_key || slotKeyFromLabel(h.slot)
      })
    }));

  const fromLocks = (locks || []).map(l => ({
    date: l.date,
    ...rangeFromRecord({ startHour: l.start_hour, endHour: l.end_hour, slotKey: l.slot_key })
  }));

  return [...fromHolds, ...fromLocks];
}
