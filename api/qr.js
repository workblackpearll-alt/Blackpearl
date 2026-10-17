import QRCode from 'qrcode';
import { findBookingByToken } from './booking.js';
import { getVerifyUrl } from './_lib/booking.js';
import { send, methodNotAllowed } from './_lib/http.js';

/**
 * GET /api/qr?code=BP-XXXX-XXXX&t=<token>
 * PNG QR code that opens the booking pass. Used in the confirmation email
 * and on the booking confirmation screen (no third-party QR service).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  try {
    const { code, t } = req.query || {};
    const hold = await findBookingByToken(String(code || ''), String(t || ''));
    if (!hold) return send(res, 404, { error: 'Not found' });

    const png = await QRCode.toBuffer(getVerifyUrl(hold), { width: 480, margin: 2, color: { dark: '#050506', light: '#FFFFFF' } });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(png);
  } catch (err) {
    console.error('[qr]', err);
    return send(res, 500, { error: 'Could not create QR code' });
  }
}
