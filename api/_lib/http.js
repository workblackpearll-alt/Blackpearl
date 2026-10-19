/* Small request/response helpers for Vercel Node functions. */

const MAX_REQUEST_BODY_BYTES = 64 * 1024; // 64 KB

export async function readRawBody(req, limit = MAX_REQUEST_BODY_BYTES) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > limit) {
      const err = new Error('Payload Too Large');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson(req, limit = MAX_REQUEST_BODY_BYTES) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > limit) {
      const err = new Error('Payload Too Large');
      err.statusCode = 413;
      throw err;
    }
    return JSON.parse(req.body || '{}');
  }
  const raw = await readRawBody(req, limit);
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed);
  send(res, 405, { error: 'Method not allowed' });
}
