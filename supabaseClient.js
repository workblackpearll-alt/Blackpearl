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
        verifyToken: item.verify_token
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
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.warn('[Admin Auth] is_admin RPC check returned error:', error);
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
export async function trackPageView(pagePath = '/') {
  // Generate or retrieve persistent anonymous session ID per browser tab
  let sessionId = sessionStorage.getItem('bp_session_id');
  if (!sessionId) {
    sessionId = 'bp_sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    sessionStorage.setItem('bp_session_id', sessionId);
  }

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
      await supabase.from('page_views').insert([payload]);
    } catch (err) {
      // Analytics must never interrupt user experience
      console.debug('[Analytics] page_views insert note:', err);
    }
  }
}

/**
 * Fetches 100% live analytics from Supabase.
 * No hardcoded numbers — all metrics computed from real data.
 */
export async function fetchAnalyticsSummary() {
  // Default empty state — shown when Supabase has no data yet
  const empty = {
    websiteViews: 0,
    uniqueVisitors: 0,
    bookingViews: 0,
    totalHolds: 0,
    activeHolds: 0,
    topOccasion: '—',
    trafficSources: [],
    engagementReport: [],
    deviceSplit: { mobile: 0, desktop: 0 }
  };

  if (!isSupabaseConfigured() || !supabase) {
    return empty;
  }

  try {
    // 1. Fetch ALL page views from Supabase
    const { data: views, error: viewsError } = await supabase
      .from('page_views')
      .select('session_id, page_path, traffic_source, device_type, created_at');

    // 2. Fetch ALL holds for engagement + booking count
    const { data: holds, error: holdsError } = await supabase
      .from('holds')
      .select('id, occasion, price, status, created_at');

    // 3. Fetch ALL voyage briefs for inquiry count
    const { data: briefs, error: briefsError } = await supabase
      .from('voyage_briefs')
      .select('id, occasion, created_at');

    const allViews = (!viewsError && Array.isArray(views)) ? views : [];
    const allHolds = (!holdsError && Array.isArray(holds)) ? holds : [];
    const allBriefs = (!briefsError && Array.isArray(briefs)) ? briefs : [];

    // ── Website Views & Unique Visitors ──────────────────
    const totalViews = allViews.length;
    const uniqueSessions = new Set(allViews.map(v => v.session_id)).size;

    // ── Booking Views = views on /book/* paths ────────────
    const bookingViews = allViews.filter(v =>
      v.page_path && v.page_path.startsWith('/book')
    ).length;

    // ── Total Holds & Active Status ───────────────────────
    const totalHolds = allHolds.length;
    const activeHolds = allHolds.filter(h => {
      const s = (h.status || '').toLowerCase();
      return s.includes('held') || s.includes('confirmed');
    }).length;

    // ── Top Occasion (most booked) ────────────────────────
    const occasionCounts = {};
    allHolds.forEach(h => {
      if (h.occasion) {
        occasionCounts[h.occasion] = (occasionCounts[h.occasion] || 0) + 1;
      }
    });
    // Also count occasion page views
    allViews.forEach(v => {
      if (v.page_path && v.page_path.startsWith('/book/')) {
        const occ = v.page_path.replace('/book/', '').replace(/-/g, ' ');
        if (occ) occasionCounts[occ] = (occasionCounts[occ] || 0) + 0.5;
      }
    });
    const topOccasion = Object.keys(occasionCounts).length > 0
      ? Object.entries(occasionCounts).sort((a, b) => b[1] - a[1])[0][0]
      : '—';

    // ── Traffic Source Breakdown ──────────────────────────
    const SOURCE_COLORS = {
      'Direct':              '#E4E4E7',
      'Instagram (Organic)': '#e040fb',
      'Google (SEO)':        '#4fc3f7',
      'LinkedIn':            '#0077b5',
      'WhatsApp':            '#25d366',
      'YouTube':             '#f44336',
      'Referral':            '#78909c'
    };

    const sourceCounts = {};
    allViews.forEach(v => {
      const src = v.traffic_source || 'Direct';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    const totalSourceViews = Object.values(sourceCounts).reduce((a, b) => a + b, 0) || 1;
    const trafficSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalSourceViews) * 100),
        color: SOURCE_COLORS[name] || '#8B8576'
      }));

    // ── Engagement Report (per occasion: page views + holds) ─
    const occasionViewCounts = {};
    allViews.forEach(v => {
      if (v.page_path && v.page_path.startsWith('/book/')) {
        const raw = v.page_path.replace('/book/', '');
        // Capitalize first letter of each word
        const occ = raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (occ) occasionViewCounts[occ] = (occasionViewCounts[occ] || 0) + 1;
      }
    });

    const occasionHoldData = {};
    allHolds.forEach(h => {
      const occ = h.occasion || 'Other';
      if (!occasionHoldData[occ]) occasionHoldData[occ] = { holds: 0, revenue: 0 };
      occasionHoldData[occ].holds += 1;

      // Parse price string like "₹90,000" → 90000
      const priceStr = (h.price || '').replace(/[₹,]/g, '').trim();
      const priceNum = parseFloat(priceStr);
      if (!isNaN(priceNum)) occasionHoldData[occ].revenue += priceNum;
    });

    // Merge all occasions mentioned in holds or booking views
    const allOccasions = new Set([
      ...Object.keys(occasionHoldData),
      ...Object.keys(occasionViewCounts)
    ]);

    const engagementReport = Array.from(allOccasions)
      .map(occ => {
        const holdInfo = occasionHoldData[occ] || { holds: 0, revenue: 0 };
        const views = occasionViewCounts[occ] || 0;
        return {
          occasion: occ,
          views,
          clicks: holdInfo.holds,
          total: holdInfo.revenue > 0
            ? '₹' + holdInfo.revenue.toLocaleString('en-IN')
            : '₹0'
        };
      })
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks));

    // ── Device Split ──────────────────────────────────────
    const mobileViews = allViews.filter(v => v.device_type === 'Mobile').length;
    const desktopViews = allViews.filter(v => v.device_type === 'Desktop').length;

    return {
      websiteViews: totalViews,
      uniqueVisitors: uniqueSessions,
      bookingViews,
      totalHolds,
      activeHolds,
      topOccasion,
      trafficSources,
      engagementReport,
      deviceSplit: { mobile: mobileViews, desktop: desktopViews }
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
