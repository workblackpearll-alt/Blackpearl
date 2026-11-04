import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const db = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await db.from('holds').select('*').order('created_at', { ascending: false });
const cs = readFileSync('supabaseClient.js', 'utf8');
const f = cs.indexOf('export async function fetchBookingHolds');
const mapSrc = cs.slice(cs.indexOf('const mapped = data.map(item => ({', f), cs.indexOf('}));', f) + 4);
const mapped = new Function('data', mapSrc + '; return mapped;')(data);

const src = readFileSync('admin/admin.js', 'utf8');
const lines = src.split('\n');
const grab = (name) => { const i = src.indexOf(`function ${name}(`); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const statusBlock = lines.slice(989, 1059).join('\n');   // constants + status/email helpers (lines 990–1059)
globalThis.document = { createElement: () => ({ set innerHTML(v) {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }) };
const code = `
const SHOW_PRICES = false;
${statusBlock}
const elements = { bookingsTableBody: { set innerHTML(v) {}, appendChild() {} }, bookingsEmptyState: { style: {} } };
const state = { filteredBookings: [] };
const openBookingDetailModal = () => {}; const updateBookingStatusInDb = () => {};
${['escapeHtml', 'formatDisplayDate', 'renderBookingsTable'].map(grab).join('\n')}
export function renderOne(b) { state.filteredBookings = [b]; renderBookingsTable(); }`;
let m;
try { m = await import('data:text/javascript,' + encodeURIComponent(code)); } catch (e) { console.log('harness error:', e.message); process.exit(); }
let bad = 0;
for (const b of mapped) {
  try { m.renderOne(b); } catch (e) { bad++; console.log('FAILS:', b.id, '|', e.message, '| guests', JSON.stringify(b.guests), '| createdAt', b.createdAt, '| status', b.status); }
}
console.log(`rendered ${mapped.length - bad} of ${mapped.length}, ${bad} failing`);
