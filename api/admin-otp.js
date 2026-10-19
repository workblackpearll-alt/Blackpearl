import crypto from 'node:crypto';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { readJson, send, methodNotAllowed } from './_lib/http.js';

/**
 * POST /api/admin-otp   (Authorization: Bearer <Supabase access token>)
 * Second login step for the admin panel. body.action:
 *   "request" – email a 6-digit code to the signed-in user's own address
 *   "verify"  – check the code; on success this login session becomes an admin
 *               session (the database's is_admin() then allows data access)
 *   "status"  – is this login session verified?
 *   "logout"  – end the verified admin session
 */
const CODE_TTL_MINUTES = 10;
const SESSION_TTL_HOURS = 12;
const MAX_ATTEMPTS_PER_CODE = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODES_PER_HOUR = 5;

function hashCode(sessionId, code) {
  const key = process.env.ADMIN_OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return crypto.createHmac('sha256', key).update(`${sessionId}:${code}`).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

// The Supabase login session id lives in the access token (verified via getUser first)
function sessionIdFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.session_id || null;
  } catch {
    return null;
  }
}

async function authenticate(req, db) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user?.email) return null;

  const sessionId = sessionIdFromToken(token);
  if (!sessionId) return null;

  // Every Supabase Auth user is an admin (public sign-ups must be off in Supabase)
  return { user: data.user, sessionId };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: 'Invalid request.' });
  }

  try {
    const db = getSupabaseAdmin();
    const auth = await authenticate(req, db);
    if (!auth) return send(res, 401, { error: 'Please sign in with an admin account.' });
    const { user, sessionId } = auth;
    const now = Date.now();

    if (body.action === 'status') {
      const { data: session } = await db.from('admin_sessions').select('expires_at').eq('session_id', sessionId).maybeSingle();
      const verified = Boolean(session && new Date(session.expires_at).getTime() > now);
      return send(res, 200, { verified, expiresAt: verified ? session.expires_at : null, sentTo: maskEmail(user.email) });
    }

    if (body.action === 'logout') {
      await db.from('admin_sessions').delete().eq('session_id', sessionId);
      return send(res, 200, { ok: true });
    }

    if (body.action === 'request') {
      const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      const { data: recent, error: recentError } = await db.from('admin_otp_codes')
        .select('created_at').eq('user_id', user.id).gte('created_at', hourAgo)
        .order('created_at', { ascending: false });
      if (recentError) throw recentError;

      if (recent?.length) {
        const secondsSinceLast = (now - new Date(recent[0].created_at).getTime()) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
          return send(res, 429, {
            error: 'A code was just sent. Please check your email.',
            retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast),
            sentTo: maskEmail(user.email)
          });
        }
        if (recent.length >= MAX_CODES_PER_HOUR) {
          return send(res, 429, { error: 'Too many codes requested. Please try again in an hour.' });
        }
      }

      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

      // Only the newest code for this login session can be used
      await db.from('admin_otp_codes').update({ consumed_at: new Date(now).toISOString() })
        .eq('session_id', sessionId).is('consumed_at', null);
      const { error: insertError } = await db.from('admin_otp_codes').insert([{
        user_id: user.id,
        session_id: sessionId,
        code_hash: hashCode(sessionId, code),
        expires_at: new Date(now + CODE_TTL_MINUTES * 60 * 1000).toISOString()
      }]);
      if (insertError) throw insertError;

      const { sendAdminLoginCode } = await import('./_lib/email.js');
      await sendAdminLoginCode(user.email, code);
      return send(res, 200, { sentTo: maskEmail(user.email), retryAfter: RESEND_COOLDOWN_SECONDS });
    }

    if (body.action === 'verify') {
      const code = String(body.code || '').replace(/\D/g, '');
      if (code.length !== 6) return send(res, 400, { error: 'Enter the 6-digit code from your email.' });

      const { data: otp } = await db.from('admin_otp_codes')
        .select('*').eq('session_id', sessionId).eq('user_id', user.id).is('consumed_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!otp || new Date(otp.expires_at).getTime() < now) {
        return send(res, 400, { error: 'This code has expired. Request a new one.', code: 'EXPIRED' });
      }
      if (otp.attempts >= MAX_ATTEMPTS_PER_CODE) {
        return send(res, 429, { error: 'Too many wrong tries. Request a new code.', code: 'LOCKED' });
      }

      if (!safeEqual(otp.code_hash, hashCode(sessionId, code))) {
        const attempts = otp.attempts + 1;
        await db.from('admin_otp_codes').update({ attempts }).eq('id', otp.id);
        const left = MAX_ATTEMPTS_PER_CODE - attempts;
        return send(res, 400, left > 0
          ? { error: `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` }
          : { error: 'Too many wrong tries. Request a new code.', code: 'LOCKED' });
      }

      await db.from('admin_otp_codes').update({ consumed_at: new Date(now).toISOString() }).eq('id', otp.id);
      const expiresAt = new Date(now + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await db.from('admin_sessions').upsert({
        session_id: sessionId,
        user_id: user.id,
        email: user.email,
        verified_at: new Date(now).toISOString(),
        expires_at: expiresAt
      });
      if (sessionError) throw sessionError;
      return send(res, 200, { verified: true, expiresAt });
    }

    return send(res, 400, { error: 'Unknown action.' });
  } catch (err) {
    console.error('[admin-otp]', err);
    return send(res, 500, { error: 'Could not complete the login step. Please try again.' });
  }
}
