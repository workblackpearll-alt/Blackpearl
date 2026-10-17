import crypto from 'node:crypto';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { toPublicBooking } from './_lib/booking.js';
import { send, methodNotAllowed } from './_lib/http.js';

/**
 * GET /api/booking?code=BP-XXXX-XXXX&t=<token>
 * Returns the booking details behind a QR code. The secret token in the QR
 * link is required, so booking codes alone can't be used to look people up.
 */
export async function findBookingByToken(code, token) {
  if (!code || !token) return null;
  const db = getSupabaseAdmin();
  const { data: hold } = await db.from('holds').select('*').eq('id', code).maybeSingle();
  if (!hold || !hold.verify_token) return null;

  const a = Buffer.from(hold.verify_token);
  const b = Buffer.from(String(token));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return hold;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  try {
    const { code, t } = req.query || {};
    const hold = await findBookingByToken(String(code || ''), String(t || ''));
    if (!hold) return send(res, 404, { error: 'Booking not found or link is invalid.' });
    return send(res, 200, { booking: toPublicBooking(hold) });
  } catch (err) {
    console.error('[booking]', err);
    return send(res, 500, { error: 'Could not load booking.' });
  }
}
