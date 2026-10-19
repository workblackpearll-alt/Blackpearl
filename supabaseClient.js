import { createClient } from '@supabase/supabase-js';

/* ========================================================
   BLACK PEARL · LADY ALICE
   Supabase Database Client & Services
   ======================================================== */

// Retrieve environment variables exposed by Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials have been provided
export const isSupabaseConfigured = () => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim() !== '' &&
    !supabaseUrl.includes('your-project-id') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim() !== '' &&
    !supabaseAnonKey.includes('your-anon-key')
  );
};

// Singleton Supabase Client
let supabase = null;

if (isSupabaseConfigured()) {
  try {
    supabase = createClient(supabaseUrl.trim(), supabaseAnonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log('[Black Pearl] Supabase client initialized successfully.');
  } catch (err) {
    console.error('[Black Pearl] Failed to initialize Supabase client:', err);
  }
} else {
  console.info(
    '[Black Pearl] Supabase credentials not set in .env. Running in offline/local fallback mode.'
  );
}

export const getSupabaseClient = () => supabase;

/* --------------------------------------------------------
   1. BOOKING HOLDS SERVICE
   -------------------------------------------------------- */

/**
 * Saves a new booking hold into Supabase table 'holds'.
 * Falls back to localStorage if Supabase is offline or unconfigured.
 */
export async function saveBookingHold(hold) {
  const payload = {
    id: hold.id,
    booking_code: hold.id,
    occasion: hold.occasion,
    date: hold.date,
    date_iso: hold.dateIso || hold.date_iso,
    slot: hold.slot,
    duration: hold.duration,
    voyage_mode: hold.voyageMode || hold.voyage_mode,
    guests: parseInt(hold.guests, 10) || 1,
    price: hold.price,
    paid_token: hold.paidToken || hold.paid_token || '₹5,000',
    payment_method: hold.paymentMethod || hold.payment_method || 'razorpay',
    payment_id: hold.paymentId || hold.payment_id || null,
    name: hold.name,
    phone: hold.phone,
    email: hold.email,
    address: hold.address || '',
    notes: hold.notes || '',
    status: hold.status || 'Held (Deposit Paid)',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.from('holds').insert([payload]).select();
      if (error) {
        console.error('[Supabase] Error saving hold:', error);
        return { success: false, error, data: payload, source: 'supabase-error' };
      }
      console.log('[Supabase] Hold saved successfully:', data);
      return { success: true, data: data[0], source: 'supabase' };
    } catch (err) {
      console.error('[Supabase] Exception saving hold:', err);
      return { success: false, error, err, data: payload, source: 'supabase-exception' };
    }
  }

  return { success: true, data: payload, source: 'local' };
}

/**
 * Fetches all active holds from Supabase table 'holds'.
 */
export async function fetchBookingHolds() {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('holds')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase] Error fetching holds:', error);
        return { success: false, error, data: [] };
      }

      // Map snake_case to camelCase expected by client
      const mapped = data.map(item => ({
        id: item.booking_code || item.id,
        occasion: item.occasion,
        date: item.date,
        dateIso: item.date_iso,
        slot: item.slot,
        duration: item.duration,
        voyageMode: item.voyage_mode,
        guests: item.guests,
        price: item.price,
        paidToken: item.paid_token,
        paymentMethod: item.payment_method,
        paymentId: item.payment_id,
        name: item.name,
        phone: item.phone,
        email: item.email,
        address: item.address,
        notes: item.notes,
        status: item.status,
        createdAt: item.created_at,
        slotKey: item.slot_key,
        startHour: item.start_hour,
        durationHours: item.duration_hours,
        razorpayOrderId: item.razorpay_order_id,
        failureReason: item.failure_reason,
        paidAt: item.paid_at,
        emailSentAt: item.email_sent_at,
        emailError: item.email_error,
        verifyToken: item.verify_token,
        guestEmailStatus: item.guest_email_status,
        guestEmailStatusAt: item.guest_email_status_at,
        adminEmailStatus: item.admin_email_status,
        adminEmailStatusAt: item.admin_email_status_at
      }));

      return { success: true, data: mapped };
    } catch (err) {
      console.error('[Supabase] Exception fetching holds:', err);
      return { success: false, error: err, data: [] };
    }
  }
  return { success: false, data: [] };
}

/* --------------------------------------------------------
   2. VOYAGE CHARTER BRIEFS SERVICE
   -------------------------------------------------------- */

/**
 * Saves a bespoke voyage brief from the Sail or Rest form.
 */
export async function saveVoyageBrief(brief) {
  const payload = {
    name: brief.name,
    phone: brief.phone,
    occasion: brief.occasion,
    duration: brief.duration,
    charter_mode: brief.charterMode || brief.charter_mode,
    notes: brief.notes || '',
    status: 'New',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.from('voyage_briefs').insert([payload]).select();
      if (error) {
        console.error('[Supabase] Error saving voyage brief:', error);
        return { success: false, error, data: payload };
      }
      console.log('[Supabase] Voyage brief saved successfully:', data);
      return { success: true, data: data[0] };
    } catch (err) {
      console.error('[Supabase] Exception saving voyage brief:', err);
      return { success: false, error: err, data: payload };
    }
  }

  return { success: true, data: payload, source: 'local' };
}

/**
 * Fetches all voyage briefs from Supabase table 'voyage_briefs'.
 */
export async function fetchVoyageBriefs() {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('voyage_briefs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase] Error fetching briefs:', error);
        return { success: false, error, data: [] };
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Supabase] Exception fetching briefs:', err);
      return { success: false, error: err, data: [] };
    }
  }
  return { success: false, data: [] };
}

/* --------------------------------------------------------
   3. BLOCKED DATES SERVICE
   -------------------------------------------------------- */

/**
 * Blocks time on the booking calendar for offline bookings & maintenance.
 * startHour/endHour (24h) block specific hours; without them, slotKey
 * 'day' / 'evening' blocks that whole slot and null blocks the full day.
 */
export async function saveBlockedDate(dateIso, reason = 'Maintenance', { slotKey = null, note = '', startHour = null, endHour = null } = {}) {
  const payload = {
    date: dateIso,
    reason,
    slot_key: slotKey,
    start_hour: startHour,
    end_hour: endHour,
    note: note || null,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.from('blocked_dates').insert([payload]).select();
      if (error) {
        console.error('[Supabase] Error blocking date:', error);
        return { success: false, error };
      }
      return { success: true, data: data[0] };
    } catch (err) {
      console.error('[Supabase] Exception blocking date:', err);
      return { success: false, error: err };
    }
  }
  return { success: true, data: payload, source: 'local' };
}

/**
 * Removes a calendar lock (admin only).
 */
export async function deleteBlockedDate(id) {
  if (!isSupabaseConfigured() || !supabase) return { success: false };
  try {
    const { error } = await supabase.from('blocked_dates').delete().eq('id', id);
    if (error) return { success: false, error };
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

/**
 * Fetches blocked dates list from Supabase.
 */
export async function fetchBlockedDates() {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('[Supabase] Error fetching blocked dates:', error);
        return { success: false, error, data: [] };
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Supabase] Exception fetching blocked dates:', err);
      return { success: false, error: err, data: [] };
    }
  }
  return { success: false, data: [] };
}

/* --------------------------------------------------------
   4. GALLERY & MEDIA SERVICE (IMAGEKIT + SUPABASE)
   -------------------------------------------------------- */

/**
 * Stores image metadata with ImageKit URL in Supabase table 'gallery_images'.
 */
export async function saveGalleryImage(image) {
  const payload = {
    title: image.title,
    subtitle: image.subtitle || '',
    category: image.category || 'all',
    imagekit_url: image.imagekitUrl || image.imagekit_url || image.url,
    file_id: image.fileId || image.file_id || '',
    thumbnail_url: image.thumbnailUrl || image.thumbnail_url || image.url,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.from('gallery_images').insert([payload]).select();
      if (error) {
        console.error('[Supabase] Error saving gallery image:', error);
        return { success: false, error, data: payload };
      }
      console.log('[Supabase] Gallery image saved:', data);
      return { success: true, data: data[0] };
    } catch (err) {
      console.error('[Supabase] Exception saving gallery image:', err);
      return { success: false, error: err, data: payload };
    }
  }
  return { success: true, data: payload, source: 'local' };
}

/**
 * Fetches all dynamic images stored in Supabase table 'gallery_images'.
 */
export async function fetchGalleryImages() {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase] Error fetching gallery images:', error);
        return { success: false, error, data: [] };
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Supabase] Exception fetching gallery images:', err);
      return { success: false, error: err, data: [] };
    }
  }
  return { success: false, data: [] };
}

/* --------------------------------------------------------
   5. SUPABASE AUTHENTICATION SERVICES
   -------------------------------------------------------- */

/**
 * Sign in admin user using Supabase Auth (Email + Password)
 */
export async function signInAdmin(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: { message: 'Supabase credentials not configured in .env' } };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err };
  }
}

/**
 * Sign up admin user using Supabase Auth (Email + Password)
 */
export async function signUpAdmin(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: { message: 'Supabase credentials not configured in .env' } };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err };
  }
}

/**
 * Current login session's access token (for server calls like the admin login code)
 */
export async function getAccessToken() {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Sign out current admin user
 */
export async function signOutAdmin() {
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.signOut();
      return { success: true };
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }
  return { success: true };
}

/**
 * Get currently authenticated admin session & user
 */
export async function getCurrentAdminUser() {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return session.user;
  } catch (err) {
    console.warn('Error fetching session:', err);
    return null;
  }
}

/**
 * Listen to auth state transitions (SIGNED_IN, SIGNED_OUT, etc.)
 */
export function onAuthStateChange(callback) {
  if (isSupabaseConfigured() && supabase) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
  return { data: { subscription: { unsubscribe: () => {} } } };
}

/**
 * Verifies whether the currently authenticated user has verified admin privileges
 * by calling the server-side PostgreSQL function public.is_admin().
 */
export async function verifyAdminStatus() {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }
  try {
    // Allow-list check only; the emailed login code is checked separately
    let { data, error } = await supabase.rpc('is_admin_user');
    if (error && (error.code === 'PGRST202' || /is_admin_user/.test(error.message || ''))) {
      // Login-code migration not run yet: fall back to the older check
      ({ data, error } = await supabase.rpc('is_admin'));
    }
    if (error) {
      console.warn('[Admin Auth] admin check returned error:', error);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error('[Admin Auth] Exception checking is_admin RPC:', err);
    return false;
  }
}

/* --------------------------------------------------------
   6. RECORD UPDATES (STATUS CHANGES)
   -------------------------------------------------------- */

/**
 * Update the status of a booking hold (e.g. 'Held (Deposit Paid)', 'Confirmed', 'Delivered', 'Cancelled')
 */
export async function updateBookingStatus(bookingId, status) {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('holds')
        .update({ status })
        .eq('id', bookingId)
        .select();

      if (error) return { success: false, error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  }
  return { success: true };
}

/**
 * Update the status of a voyage brief (e.g. 'New', 'Contacted', 'Confirmed')
 */
export async function updateBriefStatus(briefId, status) {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('voyage_briefs')
        .update({ status })
        .eq('id', briefId)
        .select();

      if (error) return { success: false, error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  }
  return { success: true };
}

/* --------------------------------------------------------
   7. ANALYTICS & TRAFFIC ATTRIBUTION
   -------------------------------------------------------- */

/**
 * Tracks a page visit into Supabase page_views table.
 * Uses sessionStorage so one browser tab = one session.
 */
// Browser storage can be blocked (private mode); analytics must still work
function storedId(storage, key, prefix) {
  try {
    let id = storage.getItem(key);
    if (!id) {
      id = prefix + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return prefix + Math.random().toString(36).substring(2, 12);
  }
}

/**
 * The promotion campaign (utm_campaign) this visitor arrived through,
 * remembered for the rest of the visit so a later booking is credited to it.
 */
export function getCampaign() {
  try {
    const fromUrl = new URLSearchParams(window.location.search || '').get('utm_campaign');
    if (fromUrl) {
      const clean = fromUrl.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60);
      sessionStorage.setItem('bp_campaign', clean);
      return clean;
    }
    return sessionStorage.getItem('bp_campaign') || null;
  } catch {
    return null;
  }
}

export async function trackPageView(pagePath = '/') {
  // One id per browser tab (visit) and one per browser (person, anonymous)
  const sessionId = storedId(sessionStorage, 'bp_session_id', 'bp_sess_');
  const visitorId = storedId(localStorage, 'bp_visitor_id', 'bp_vis_');

  // Determine traffic attribution from UTM tags and document.referrer
  const params = new URLSearchParams(window.location.search || '');
  const utmSource = (params.get('utm_source') || params.get('source') || '').toLowerCase();
  const ref = document.referrer || '';
  let trafficSource = 'Direct';

  if (utmSource.includes('instagram') || utmSource.includes('ig')) {
    trafficSource = 'Instagram (Organic)';
  } else if (utmSource.includes('google')) {
    trafficSource = 'Google (SEO)';
  } else if (utmSource.includes('whatsapp') || utmSource.includes('wa')) {
    trafficSource = 'WhatsApp';
  } else if (utmSource.includes('linkedin')) {
    trafficSource = 'LinkedIn';
  } else if (utmSource.includes('youtube')) {
    trafficSource = 'YouTube';
  } else if (ref.includes('instagram.com')) {
    trafficSource = 'Instagram (Organic)';
  } else if (ref.includes('google.')) {
    trafficSource = 'Google (SEO)';
  } else if (ref.includes('whatsapp') || ref.includes('wa.me')) {
    trafficSource = 'WhatsApp';
  } else if (ref.includes('linkedin.com') || ref.includes('lnkd.in')) {
    trafficSource = 'LinkedIn';
  } else if (ref.includes('youtube.com')) {
    trafficSource = 'YouTube';
  } else if (ref && !ref.includes(window.location.hostname)) {
    trafficSource = 'Referral';
  }

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const payload = {
    session_id: sessionId,
    page_path: pagePath,
    referrer: ref ? ref.substring(0, 255) : '',
    traffic_source: trafficSource,
    device_type: isMobile ? 'Mobile' : 'Desktop',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const withPromo = { ...payload, visitor_id: visitorId, campaign: getCampaign() };
      const { error } = await supabase.from('page_views').insert([withPromo]);
      // Older database without the visitor/campaign columns: still record the visit
      if (error) await supabase.from('page_views').insert([payload]);
    } catch (err) {
      // Analytics must never interrupt user experience
      console.debug('[Analytics] page_views insert note:', err);
    }
  }
}

// Supabase returns at most 1,000 rows per request: fetch page by page
async function fetchAllRows(table, columns, sinceIso) {
  const PAGE = 1000;
  const MAX_ROWS = 50000;
  const rows = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let query = supabase.from(table).select(columns).order('created_at', { ascending: true }).range(from, from + PAGE - 1);
    if (sinceIso) query = query.gte('created_at', sinceIso);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// Try the newer columns first; fall back if the analytics migration isn't run yet
async function fetchRowsWithFallback(table, fullColumns, basicColumns, sinceIso) {
  try {
    return await fetchAllRows(table, fullColumns, sinceIso);
  } catch {
    return fetchAllRows(table, basicColumns, sinceIso);
  }
}

async function countSince(table, sinceIso) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (sinceIso) query = query.gte('created_at', sinceIso);
  const { count } = await query;
  return count || 0;
}

const PAGE_NAMES = {
  '/': 'Home',
  '/book': 'Booking page',
  '/gallery': 'Gallery',
  '/about': 'About',
  '/contact': 'Contact',
  '/verify': 'Booking pass (QR)',
  '/terms': 'Terms',
  '/privacy': 'Privacy',
  '/cancellation': 'Cancellation policy',
  '/refund': 'Cancellation policy'
};

function pageName(path) {
  const clean = (String(path || '/').split('?')[0].replace(/\/+$/, '') || '/').toLowerCase();
  const base = clean === '/' ? '/' : `/${clean.split('/')[1]}`;
  return PAGE_NAMES[base] || clean;
}

// YYYY-MM-DD in India time
function istDay(dateLike) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(dateLike));
}

/**
 * Visitors per day (or per week for long ranges) for the Overview chart.
 * Returns [{ start, label, visitors, views }] with every period present (zeros included).
 */
function buildSeries(views, days) {
  const today = istDay(Date.now());
  const firstDay = days
    ? istDay(Date.now() - (days - 1) * 86400000)
    : (views.length ? istDay(views[0].created_at) : today);

  const spanDays = Math.round((Date.parse(today) - Date.parse(firstDay)) / 86400000) + 1;
  const step = spanDays > 90 ? 7 : 1; // weekly bars for very long ranges

  const buckets = [];
  for (let t = Date.parse(firstDay); t <= Date.parse(today); t += step * 86400000) {
    const start = new Date(t).toISOString().slice(0, 10);
    const d = new Date(t);
    const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    buckets.push({ start, label: step === 7 ? `Week of ${label}` : label, people: new Set(), views: 0 });
  }

  views.forEach(v => {
    const day = istDay(v.created_at);
    const index = Math.floor((Date.parse(day) - Date.parse(firstDay)) / (step * 86400000));
    const bucket = buckets[index];
    if (!bucket) return;
    bucket.views += 1;
    bucket.people.add(v.visitor_id || v.session_id);
  });

  return { step, points: buckets.map(b => ({ start: b.start, label: b.label, visitors: b.people.size, views: b.views })) };
}

/**
 * Live analytics for the admin Overview. days = 7 / 30 / null (all time).
 * All numbers are computed from real data — nothing hard-coded.
 */
export async function fetchAnalyticsSummary(days = 30) {
  const empty = {
    websiteViews: 0,
    uniqueVisitors: 0,
    bookingViews: 0,
    paidBookings: 0,
    bookingValue: 0,
    conversionRate: 0,
    communitySignups: 0,
    enquiries: 0,
    trafficSources: [],
    engagementReport: [],
    topPages: [],
    campaigns: [],
    series: { step: 1, points: [] },
    deviceSplit: { mobile: 0, desktop: 0 }
  };

  if (!isSupabaseConfigured() || !supabase) return empty;

  const sinceIso = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null;
  const PAID = ['Held (Deposit Paid)', 'Confirmed', 'Completed'];

  try {
    const [allViews, allHolds, communitySignups, enquiries] = await Promise.all([
      fetchRowsWithFallback('page_views',
        'session_id, visitor_id, campaign, page_path, traffic_source, device_type, created_at',
        'session_id, page_path, traffic_source, device_type, created_at', sinceIso),
      fetchRowsWithFallback('holds', 'occasion, price, status, campaign, created_at', 'occasion, price, status, created_at', sinceIso),
      countSince('community_members', sinceIso),
      countSince('contact_inquiries', sinceIso)
    ]);

    const person = (v) => v.visitor_id || v.session_id;
    const paid = allHolds.filter(h => PAID.includes(h.status));
    const priceNumber = (p) => parseFloat(String(p || '').replace(/[₹,\s]/g, '')) || 0;

    const uniqueVisitors = new Set(allViews.map(person)).size;
    const bookingViews = allViews.filter(v => (v.page_path || '').startsWith('/book')).length;

    // Traffic sources (by visits)
    const SOURCE_COLORS = {
      'Direct': '#E4E4E7',
      'Instagram (Organic)': '#E040FB',
      'Google (SEO)': '#4FC3F7',
      'LinkedIn': '#0077B5',
      'WhatsApp': '#25D366',
      'YouTube': '#F44336',
      'Referral': '#78909C'
    };
    const sourceCounts = {};
    allViews.forEach(v => {
      const src = v.traffic_source || 'Direct';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const totalSourceViews = allViews.length || 1;
    const trafficSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalSourceViews) * 100),
        color: SOURCE_COLORS[name] || '#8B8576'
      }));

    // Top pages
    const pages = {};
    allViews.forEach(v => {
      const name = pageName(v.page_path);
      pages[name] = pages[name] || { views: 0, people: new Set() };
      pages[name].views += 1;
      pages[name].people.add(person(v));
    });
    const topPages = Object.entries(pages)
      .map(([name, d]) => ({ name, views: d.views, visitors: d.people.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    // Campaigns (promotion links): visitors + the bookings they produced
    const campaignMap = {};
    allViews.filter(v => v.campaign).forEach(v => {
      campaignMap[v.campaign] = campaignMap[v.campaign] || { people: new Set(), bookings: 0, value: 0 };
      campaignMap[v.campaign].people.add(person(v));
    });
    paid.filter(h => h.campaign).forEach(h => {
      campaignMap[h.campaign] = campaignMap[h.campaign] || { people: new Set(), bookings: 0, value: 0 };
      campaignMap[h.campaign].bookings += 1;
      campaignMap[h.campaign].value += priceNumber(h.price);
    });
    const campaigns = Object.entries(campaignMap)
      .map(([name, d]) => ({ name, visitors: d.people.size, bookings: d.bookings, value: d.value }))
      .sort((a, b) => b.visitors - a.visitors || b.bookings - a.bookings);

    // Bookings by occasion
    const byOccasion = {};
    paid.forEach(h => {
      const occ = h.occasion || 'Other';
      byOccasion[occ] = byOccasion[occ] || { bookings: 0, value: 0 };
      byOccasion[occ].bookings += 1;
      byOccasion[occ].value += priceNumber(h.price);
    });
    const engagementReport = Object.entries(byOccasion)
      .map(([occasion, d]) => ({ occasion, bookings: d.bookings, value: d.value }))
      .sort((a, b) => b.bookings - a.bookings || b.value - a.value);

    return {
      websiteViews: allViews.length,
      uniqueVisitors,
      bookingViews,
      paidBookings: paid.length,
      bookingValue: paid.reduce((sum, h) => sum + priceNumber(h.price), 0),
      conversionRate: uniqueVisitors ? (paid.length / uniqueVisitors) * 100 : 0,
      communitySignups,
      enquiries,
      trafficSources,
      engagementReport,
      topPages,
      campaigns,
      series: buildSeries(allViews, days),
      deviceSplit: {
        mobile: allViews.filter(v => v.device_type === 'Mobile').length,
        desktop: allViews.filter(v => v.device_type === 'Desktop').length
      }
    };
  } catch (err) {
    console.error('fetchAnalyticsSummary error:', err);
    return empty;
  }
}

/* --------------------------------------------------------
   8. COMMUNITY SIGN-UPS (WHATSAPP BROADCAST LIST)
   -------------------------------------------------------- */

/**
 * Normalizes a phone number to digits with country code
 * (bare 10-digit Indian numbers get a 91 prefix) so duplicates match.
 */
export function normalizePhone(raw) {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.substring(1);
  if (digits.length === 10) digits = '91' + digits;
  return digits;
}

/**
 * Saves a community sign-up. Public visitors can insert but not read
 * this table, so no .select() after insert. A repeat number counts as success.
 */
export async function saveCommunitySignup(member) {
  const payload = {
    name: member.name,
    phone: normalizePhone(member.phone),
    email: member.email || null,
    whatsapp_consent: true,
    status: 'New'
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('community_members').insert([payload]);
      if (error) {
        if (error.code === '23505') {
          return { success: true, duplicate: true, data: payload };
        }
        console.error('[Supabase] Error saving community sign-up:', error);
        return { success: false, error, data: payload };
      }
      return { success: true, data: payload };
    } catch (err) {
      console.error('[Supabase] Exception saving community sign-up:', err);
      return { success: false, error: err, data: payload };
    }
  }

  return { success: false, error: { message: 'Supabase not configured' }, data: payload };
}

/**
 * Fetches all community sign-ups (admin only).
 */
export async function fetchCommunitySignups() {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase] Error fetching community sign-ups:', error);
        return { success: false, error, data: [] };
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Supabase] Exception fetching community sign-ups:', err);
      return { success: false, error: err, data: [] };
    }
  }
  return { success: false, data: [] };
}

/**
 * Update a community member status (e.g. 'New', 'Added to Broadcast', 'Opted Out')
 */
export async function updateCommunityStatus(memberId, status) {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .update({ status })
        .eq('id', memberId)
        .select();

      if (error) return { success: false, error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  }
  return { success: true };
}

/* --------------------------------------------------------
   9. CONTACT PAGE INQUIRIES
   -------------------------------------------------------- */

/**
 * Saves a contact page consultation request (insert-only for public).
 */
export async function saveContactInquiry(inquiry) {
  const payload = {
    name: inquiry.name,
    phone: inquiry.phone,
    email: inquiry.email,
    occasion: inquiry.occasion,
    target_date: inquiry.date || null,
    guests: inquiry.guests || null,
    notes: inquiry.notes || '',
    status: 'New'
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('contact_inquiries').insert([payload]);
      if (error) {
        console.error('[Supabase] Error saving contact inquiry:', error);
        return { success: false, error, data: payload };
      }
      return { success: true, data: payload };
    } catch (err) {
      console.error('[Supabase] Exception saving contact inquiry:', err);
      return { success: false, error: err, data: payload };
    }
  }

  return { success: false, error: { message: 'Supabase not configured' }, data: payload };
}

/**
 * Fetches all contact page inquiries (admin only).
 */
export async function fetchContactInquiries() {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('contact_inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase] Error fetching contact inquiries:', error);
        return { success: false, error, data: [] };
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Supabase] Exception fetching contact inquiries:', err);
      return { success: false, error: err, data: [] };
    }
  }
  return { success: false, data: [] };
}

/**
 * Update a contact inquiry status (e.g. 'New', 'Contacted', 'Confirmed', 'Archived')
 */
export async function updateContactInquiryStatus(inquiryId, status) {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('contact_inquiries')
        .update({ status })
        .eq('id', inquiryId)
        .select();

      if (error) return { success: false, error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  }
  return { success: true };
}

/* --------------------------------------------------------
   10. ADMIN ACTIVITY (SHARED REMINDERS)
   -------------------------------------------------------- */

/**
 * Reads a shared admin activity marker, e.g. 'calendar_reviewed'.
 */
export async function fetchAdminActivity(key) {
  if (!isSupabaseConfigured() || !supabase) return { success: false, data: null };
  try {
    const { data, error } = await supabase.from('admin_activity').select('*').eq('key', key).maybeSingle();
    if (error) return { success: false, error, data: null };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err, data: null };
  }
}

/**
 * Records that an admin did something now (visible to every admin).
 */
export async function recordAdminActivity(key, byEmail) {
  if (!isSupabaseConfigured() || !supabase) return { success: false };
  try {
    const payload = { key, happened_at: new Date().toISOString(), by_email: byEmail || null };
    const { data, error } = await supabase.from('admin_activity').upsert(payload).select().single();
    if (error) return { success: false, error };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err };
  }
}
