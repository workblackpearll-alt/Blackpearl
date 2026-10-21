import QRCode from 'qrcode';
import { formatCurrency, DEPOSIT_AMOUNT } from '../../shared/pricing.js';
import { getVerifyUrl } from './booking.js';

// Inline image id: the QR travels inside the email, so it shows even when
// email apps block outside images or the website is unreachable.
const QR_CONTENT_ID = 'booking-qr';

/* Booking confirmation email via Resend (REST API, no SDK needed). */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;color:#8B8576;font-size:13px;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;color:#111214;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

export async function sendBookingConfirmationEmail(hold) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be set on the server.');
  }

  const verifyUrl = getVerifyUrl(hold);
  const qrPng = await QRCode.toBuffer(verifyUrl, { width: 480, margin: 2, color: { dark: '#050506', light: '#FFFFFF' } });

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F1E9;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1E9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E6DED0;">
        <tr><td style="background:#050506;padding:22px 28px;color:#EBD7A6;font-size:13px;letter-spacing:4px;">BLACK PEARL · LADY ALICE</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 6px;font-size:24px;color:#111214;font-weight:600;">Your date is booked, ${escapeHtml(hold.name.split(' ')[0])}.</h1>
          <p style="margin:0 0 20px;color:#4B4B4B;font-size:14px;line-height:1.6;">
            We have received your ${formatCurrency(DEPOSIT_AMOUNT)} advance. Our team will call you on ${escapeHtml(hold.phone)} to plan the rest of your charter.
          </p>

          <div style="text-align:center;margin:0 0 20px;">
            <img src="cid:${QR_CONTENT_ID}" width="200" height="200" alt="Booking QR code" style="display:inline-block;border:1px solid #E6DED0;">
            <div style="margin-top:10px;font-family:'Courier New',monospace;font-size:20px;letter-spacing:3px;color:#111214;font-weight:700;">${escapeHtml(hold.id)}</div>
            <div style="color:#8B8576;font-size:12px;margin-top:4px;">Show this QR code or booking code when you board. The QR is also attached.</div>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEE7DA;border-bottom:1px solid #EEE7DA;margin-bottom:20px;">
            ${row('Celebration', hold.occasion)}
            ${row('Date', hold.date)}
            ${row('Slot & time', hold.slot)}
            ${row('Duration', hold.duration)}
            ${row('Itinerary', hold.voyage_mode)}
            ${row('Guests', `${hold.guests}`)}
            ${row('Charter price', hold.price)}
            ${row('Advance paid', `${hold.paid_token} (Razorpay ${hold.payment_id})`)}
          </table>

          <p style="margin:0 0 20px;text-align:center;">
            <a href="${verifyUrl}" style="display:inline-block;background:#050506;color:#FFFFFF;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:2px;">VIEW BOOKING PASS</a>
          </p>
          <p style="margin:0;color:#8B8576;font-size:12px;line-height:1.6;">
            Boarding: Jetty No. 2, Princess Ferry Wharf (Bhaucha Dhakka), Mazgaon, Mumbai 400010.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const payload = {
    from,
    to: [hold.email],
    subject: `Booking confirmed · ${hold.id} · Lady Alice`,
    html,
    attachments: [{
      filename: `${hold.id}-qr.png`,
      content: qrPng.toString('base64'),
      content_type: 'image/png',
      content_id: QR_CONTENT_ID
    }]
  };
  // Customer replies go to a real inbox instead of the sending address
  if (process.env.BOOKING_REPLY_TO_EMAIL) {
    payload.reply_to = process.env.BOOKING_REPLY_TO_EMAIL;
  }

  return sendViaResend(apiKey, payload);
}

async function sendViaResend(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend error: ${data?.message || res.status}`);
  }
  return data; // { id } — used to match Resend's delivery updates
}

/**
 * Short "new booking" alert to the team (BOOKING_NOTIFY_EMAIL), sent as its
 * own email so its delivery can be tracked separately from the guest's.
 * Returns null when no team address is configured.
 */
export async function sendAdminBookingAlert(hold) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.BOOKING_NOTIFY_EMAIL;
  if (!to) return null;
  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be set on the server.');
  }

  const adminUrl = `${getVerifyUrl(hold).split('/verify')[0]}/admin/orders`;
  const isRequest = hold.status === 'Booking Requested';
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#F5F1E9;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E6DED0;">
    <tr><td style="background:#050506;padding:18px 24px;color:#EBD7A6;font-size:12px;letter-spacing:3px;">${isRequest ? 'NEW BOOKING REQUEST · CONFIRM ON WHATSAPP' : 'NEW BOOKING · ADVANCE PAID'}</td></tr>
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 4px;font-size:20px;color:#111214;">${escapeHtml(hold.name)} ${isRequest ? 'requested' : 'booked'} ${escapeHtml(hold.date)}</h1>
      <p style="margin:0 0 18px;color:#4B4B4B;font-size:14px;">${isRequest ? 'Nothing paid yet, and this time is <strong>not blocked</strong> on the website. Confirm with them on WhatsApp, then set the booking to Confirmed in admin (or lock the time in Calendar) so nobody else can book it.' : 'Call them to plan the charter.'}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEE7DA;border-bottom:1px solid #EEE7DA;margin-bottom:18px;">
        ${row('Booking', hold.id)}
        ${row('Phone', hold.phone)}
        ${row('Email', hold.email)}
        ${row('Occasion', hold.occasion)}
        ${row('Time', hold.slot)}
        ${row('Duration', hold.duration)}
        ${row('Guests', `${hold.guests}`)}
        ${row('Charter price', hold.price)}
        ${isRequest ? row('Payment', 'Not paid yet: confirm on WhatsApp') : row('Advance', `${hold.paid_token} (Razorpay ${hold.payment_id})`)}
        ${hold.notes ? row('Notes', hold.notes) : ''}
      </table>
      <a href="${adminUrl}" style="display:inline-block;background:#050506;color:#FFFFFF;text-decoration:none;padding:11px 20px;font-size:13px;letter-spacing:1px;">OPEN ADMIN PANEL</a>
    </td></tr>
  </table>
</body></html>`;

  const payload = {
    from,
    to: [to],
    subject: `${isRequest ? 'New booking request' : 'New booking'} · ${hold.name} · ${hold.date} · ${hold.slot}`,
    html
  };
  // Replying to the alert goes straight to the guest
  if (hold.email) payload.reply_to = hold.email;

  return sendViaResend(apiKey, payload);
}

/**
 * 6-digit admin login code, sent only to an allow-listed admin's own email.
 */
export async function sendAdminLoginCode(to, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be set on the server.');
  }

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#F5F1E9;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;margin:0 auto;background:#FFFFFF;border:1px solid #E6DED0;">
    <tr><td style="background:#050506;padding:18px 24px;color:#EBD7A6;font-size:12px;letter-spacing:3px;">BLACK PEARL · ADMIN</td></tr>
    <tr><td style="padding:28px 24px;text-align:center;">
      <p style="margin:0 0 14px;color:#4B4B4B;font-size:14px;">Your admin login code:</p>
      <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#111214;">${escapeHtml(code)}</div>
      <p style="margin:16px 0 0;color:#8B8576;font-size:12.5px;line-height:1.6;">It expires in 10 minutes and works once.<br>If you did not just sign in, change your admin password now.</p>
    </td></tr>
  </table>
</body></html>`;

  return sendViaResend(apiKey, {
    from,
    to: [to],
    subject: `${code} is your Black Pearl admin code`,
    html
  });
}
