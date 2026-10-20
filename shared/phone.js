/**
 * Rejects obviously fake WhatsApp numbers (used by the booking form and the API).
 * Accepts Indian mobiles (10 digits starting 6-9, with optional +91 / 0) and
 * international numbers written with a leading +.
 */
export function isLikelyRealPhone(input) {
  const raw = String(input || '').trim();
  let digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+') && !digits.startsWith('91')) {
    // International: 8–15 digits
    if (digits.length < 8 || digits.length > 15) return false;
  } else {
    // India: strip +91 / 91 / 0 prefix, then a 10-digit mobile starting 6-9
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (!/^[6-9]\d{9}$/.test(digits)) return false;
  }

  // Junk patterns: one repeated digit, or straight counting runs
  if (/^(\d)\1+$/.test(digits)) return false;
  if ('01234567890123456789'.includes(digits) || '98765432109876543210'.includes(digits)) return false;
  // Mostly one digit, e.g. 9999999998
  const counts = {};
  for (const d of digits) counts[d] = (counts[d] || 0) + 1;
  if (Math.max(...Object.values(counts)) >= digits.length - 1) return false;
  return true;
}
