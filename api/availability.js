import { todayInIndia } from './_lib/booking.js';
import { getOccupiedRanges } from './_lib/occupancy.js';
import { send, methodNotAllowed } from './_lib/http.js';

/**
 * GET /api/availability
 * Occupied time ranges (website bookings, in-progress checkouts and admin
 * locks) for the booking calendar, as [{ date, start, end }] in 24h hours.
 * Returns only times — never guest details or lock notes.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  try {
    const occupied = await getOccupiedRanges({ fromDate: todayInIndia() });
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, { occupied });
  } catch (err) {
    console.error('[availability]', err);
    return send(res, 500, { error: 'Could not load availability.' });
  }
}
