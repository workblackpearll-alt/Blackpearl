import crypto from 'node:crypto';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { readRawBody, send, methodNotAllowed } from './_lib/http.js';

/**
 * POST /api/resend-webhook
 * Resend reports what happened to each booking email (delivered, bounced,
 * marked as spam...). We store it on the booking so the admin panel can show
 * whether the guest and the team actually received their email.
 *
 * Set up in Resend -> Webhooks -> Add endpoint:
 *   https://YOUR-DOMAIN/api/resend-webhook
 *   events: email.sent, email.delivered, email.delivery_delayed,
 *           email.bounced, email.complained, email.failed
 * then copy the signing secret into RESEND_WEBHOOK_SECRET.
 */
export const config = { api: { bodyParser: false } };

const EVENT_STATUS = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'spam',
  'email.failed': 'failed'
};

// Higher rank wins, so late-arriving events never move a status backwards
const STATUS_RANK = { sent: 1, delayed: 2, delivered: 3, failed: 4, bounced: 4, spam: 5 };

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

// Resend signs webhooks with Svix: base64 HMAC-SHA256 of "id.timestamp.body"
function verifySignature(rawBody, headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new Error('RESEND_WEBHOOK_SECRET must be set on the server.');

  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatureHeader = headers['svix-signature'];
  if (!id || !timestamp || !signatureHeader) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_CLOCK_SKEW_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
  const expectedBuf = Buffer.from(expected);

  return String(signatureHeader).split(' ').some(part => {
    const [version, signature] = part.split(',');
    if (version !== 'v1' || !signature) return false;
    const sigBuf = Buffer.from(signature);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

async function applyStatus(db, idColumn, prefix, emailId, status, at) {
  const { data: hold } = await db.from('holds')
    .select(`id, ${prefix}_email_status`)
    .eq(idColumn, emailId)
    .maybeSingle();
  if (!hold) return false;

  const current = hold[`${prefix}_email_status`];
  if (current && (STATUS_RANK[current] || 0) > (STATUS_RANK[status] || 0)) return true;

  await db.from('holds').update({
    [`${prefix}_email_status`]: status,
    [`${prefix}_email_status_at`]: at
  }).eq('id', hold.id);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  try {
    const raw = await readRawBody(req);
    if (!verifySignature(raw, req.headers)) {
      return send(res, 400, { error: 'Invalid signature' });
    }

    const event = JSON.parse(raw);
    const status = EVENT_STATUS[event.type];
    const emailId = event?.data?.email_id;
    if (!status || !emailId) return send(res, 200, { ok: true, ignored: true });

    const at = event.created_at || new Date().toISOString();
    const db = getSupabaseAdmin();

    // The same email id belongs to either the guest confirmation or the team alert
    const matchedGuest = await applyStatus(db, 'guest_email_id', 'guest', emailId, status, at);
    if (!matchedGuest) await applyStatus(db, 'admin_email_id', 'admin', emailId, status, at);

    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('[resend-webhook]', err);
    // 500 makes Resend retry later
    return send(res, 500, { error: 'Webhook processing failed' });
  }
}
