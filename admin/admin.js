import {
  signInAdmin,
  signUpAdmin,
  signOutAdmin,
  getCurrentAdminUser,
  onAuthStateChange,
  fetchAnalyticsSummary,
  fetchBookingHolds,
  fetchVoyageBriefs,
  updateBookingStatus,
  updateBriefStatus,
  fetchGalleryImages,
  saveGalleryImage,
  fetchBlockedDates,
  saveBlockedDate,
  deleteBlockedDate,
  fetchAdminActivity,
  recordAdminActivity,
  fetchContactInquiries,
  updateContactInquiryStatus,
  fetchCommunitySignups,
  updateCommunityStatus,
  verifyAdminStatus,
  getAccessToken,
  isSupabaseConfigured
} from '../supabaseClient.js';
import {
  slotKeyFromLabel,
  rangeFromRecord,
  rangesConflict,
  formatRange,
  charterSlots,
  DAY_START_HOUR,
  DAY_END_HOUR,
  TURNAROUND_GAP_HOURS
} from '../shared/pricing.js';

import {
  uploadImageToImageKit,
  getImageKitUrl,
  isImageKitConfigured
} from '../imageKitService.js';

/* ========================================================
   BLACK PEARL · LADY ALICE - ADMIN COMMAND DECK
   Supabase Auth Guard, Live Analytics & Management Controller
   ======================================================== */

// Global Admin Application State
const state = {
  currentUser: null,
  authMode: 'signin', // 'signin' or 'signup'
  currentPage: 'dashboard',
  bookings: [],
  filteredBookings: [],
  briefs: [],
  filteredBriefs: [],
  mediaItems: [],
  blockedDates: [],
  analytics: null,
  analyticsDays: 30, // 7 | 30 | null (all time)
  activeBookingFilter: 'all',
  bookingSearchQuery: '',
  briefSearchQuery: '',
  contactInquiries: [],
  contactSearchQuery: '',
  communityMembers: [],
  communitySearchQuery: ''
};

// --- DOM Element References ---
const elements = {
  authView: document.getElementById('authView'),
  portalView: document.getElementById('portalView'),
  authForm: document.getElementById('adminAuthForm'),
  emailInput: document.getElementById('adminEmailInput'),
  passwordInput: document.getElementById('adminPasswordInput'),
  btnSubmitAuth: document.getElementById('btnSubmitAuth'),
  btnAuthText: document.getElementById('btnAuthText'),
  authSubtitle: document.getElementById('authSubtitle'),
  authSwitchText: document.getElementById('authSwitchText'),
  btnToggleAuthMode: document.getElementById('btnToggleAuthMode'),
  authFeedback: document.getElementById('authFeedbackMsg'),
  
  // Sidebar elements
  sidebarUserAvatar: document.getElementById('sidebarUserAvatar'),
  sidebarUserEmail: document.getElementById('sidebarUserEmail'),
  btnSignOut: document.getElementById('btnSignOut'),
  sidebarBookingsCount: document.getElementById('sidebarBookingsCount'),
  navItems: document.querySelectorAll('.sidebar-nav .nav-item'),
  pagePanels: document.querySelectorAll('.admin-page-panel'),

  // Dashboard elements
  btnRefreshAnalytics: document.getElementById('btnRefreshAnalytics'),
  metricViews: document.getElementById('metricViews'),
  metricVisitors: document.getElementById('metricVisitors'),
  trafficList: document.getElementById('trafficAcquisitionList'),

  // Bookings elements
  bookingsSearchInput: document.getElementById('bookingsSearchInput'),
  bookingFilterButtons: document.querySelectorAll('.table-filters-bar .filter-btn'),
  bookingsTableBody: document.getElementById('bookingsTableBody'),
  bookingsEmptyState: document.getElementById('bookingsEmptyState'),

  // Inquiries elements
  briefsSearchInput: document.getElementById('briefsSearchInput'),
  inquiriesTableBody: document.getElementById('inquiriesTableBody'),
  briefsEmptyState: document.getElementById('briefsEmptyState'),

  // Contact inquiries elements
  sidebarContactCount: document.getElementById('sidebarContactCount'),
  contactSearchInput: document.getElementById('contactSearchInput'),
  contactTableBody: document.getElementById('contactTableBody'),
  contactEmptyState: document.getElementById('contactEmptyState'),

  // Community elements
  sidebarCommunityCount: document.getElementById('sidebarCommunityCount'),
  communitySearchInput: document.getElementById('communitySearchInput'),
  communityTableBody: document.getElementById('communityTableBody'),
  communityEmptyState: document.getElementById('communityEmptyState'),
  btnCopyCommunityNumbers: document.getElementById('btnCopyCommunityNumbers'),
  btnExportCommunityCsv: document.getElementById('btnExportCommunityCsv'),

  // Media elements
  mediaUploadForm: document.getElementById('adminMediaUploadForm'),
  mediaTitle: document.getElementById('adminMediaTitle'),
  mediaCategory: document.getElementById('adminMediaCategory'),
  mediaSubtitle: document.getElementById('adminMediaSubtitle'),
  mediaFile: document.getElementById('adminMediaFile'),
  mediaUrl: document.getElementById('adminMediaUrl'),
  btnSubmitMediaUpload: document.getElementById('btnSubmitMediaUpload'),
  mediaUploadFeedback: document.getElementById('mediaUploadFeedback'),
  mediaCountSpan: document.getElementById('mediaCountSpan'),
  adminMediaGrid: document.getElementById('adminMediaGrid'),

  // Calendar Locks elements
  lockDateInput: document.getElementById('adminLockDate'),
  lockReasonSelect: document.getElementById('adminLockReason'),
  lockStartSelect: document.getElementById('adminLockStart'),
  lockEndSelect: document.getElementById('adminLockEnd'),
  lockNoteInput: document.getElementById('adminLockNote'),
  btnSubmitLockDate: document.getElementById('btnSubmitLockDate'),
  lockedDatesList: document.getElementById('lockedDatesList'),

  // Modal elements
  bookingModal: document.getElementById('bookingDetailModal'),
  modalBookingId: document.getElementById('modalBookingId'),
  modalBookingBody: document.getElementById('modalBookingBody'),
  btnCloseModal: document.getElementById('btnCloseDetailModal')
};

/* ========================================================
   1. INITIALIZATION & SUPABASE AUTH GUARD
   ======================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  // Setup default lock date to tomorrow
  if (elements.lockDateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    elements.lockDateInput.value = tomorrow.toISOString().split('T')[0];
  }

  // Register event handlers
  initAuthHandlers();
  initOtpHandlers();
  initSidebarNavigation();
  initDashboardHandlers();
  initBookingsHandlers();
  initOverviewLinks();
  initInquiriesHandlers();
  initContactHandlers();
  initCommunityHandlers();
  initMediaHandlers();
  initCalendarHandlers();
  initModalHandlers();
  initNotifications();

  // Listen to popstate for browser back/forward navigation
  window.addEventListener('popstate', () => {
    handleRouteFromUrl();
  });

  // Check current session with Supabase Auth
  await checkSessionAndRoute();

  // Subscribe to real-time Supabase Auth state changes
  onAuthStateChange(async (event, session) => {
    console.log('[Admin Auth State Change]', event, session?.user?.email);
    if (session && session.user) {
      const isAuthorized = await verifyAdminStatus();
      if (!isAuthorized) {
        console.warn('[Admin Auth] User authenticated but not authorized in public.is_admin():', session.user.email);
        await signOutAdmin();
        state.currentUser = null;
        showAuthScreen();
        showAuthFeedback('Access Denied: Your account does not have administrator privileges.', 'error');
        return;
      }
      if (state.currentUser) {
        state.currentUser = session.user;
        updateUserProfileUI(session.user);
      }
    } else if (event === 'SIGNED_OUT') {
      state.currentUser = null;
      showAuthScreen();
    }
  });
});

/**
 * Checks if user is authenticated with Supabase Auth and renders appropriate screen
 */
async function checkSessionAndRoute() {
  try {
    const user = await getCurrentAdminUser();
    if (user) {
      const isAuthorized = await verifyAdminStatus();
      if (!isAuthorized) {
        console.warn('[Admin Auth] Session found for unauthorized user:', user.email);
        await signOutAdmin();
        state.currentUser = null;
        showAuthScreen();
        showAuthFeedback('Access Denied: Your account does not have administrator privileges.', 'error');
        return;
      }
      await continueAfterPassword(user);
    } else {
      state.currentUser = null;
      showAuthScreen();
    }
  } catch (err) {
    console.error('Session check error:', err);
    showAuthScreen();
  }
}

/**
 * Inspects URL pathname and activates the matching section
 */
function handleRouteFromUrl() {
  const path = window.location.pathname.toLowerCase();
  
  if (path.includes('/admin/login')) {
    if (state.currentUser) {
      navigateTo('dashboard');
    } else {
      showAuthScreen();
    }
    return;
  }

  if (!state.currentUser) {
    showAuthScreen();
    return;
  }

  if (path.includes('/admin/orders') || path.includes('/admin/bookings')) {
    navigateTo('bookings', false);
  } else if (path.includes('/admin/inquiries') || path.includes('/admin/briefs')) {
    navigateTo('contact', false);
  } else if (path.includes('/admin/contact')) {
    navigateTo('contact', false);
  } else if (path.includes('/admin/community')) {
    navigateTo('community', false);
  } else if (path.includes('/admin/media')) {
    navigateTo('media', false);
  } else if (path.includes('/admin/calendar')) {
    navigateTo('calendar', false);
  } else {
    // Default to dashboard
    navigateTo('dashboard', false);
  }
}

/* ========================================================
   2b. LOGIN CODE (EMAIL OTP) — second step after the password
   The database only treats this login as admin once the code is verified.
   ======================================================== */
let otpCooldownTimer = null;

async function callAdminOtp(action, extra = {}) {
  const token = await getAccessToken();
  if (!token) return { ok: false, status: 401, data: { error: 'Please sign in again.' } };
  try {
    const res = await fetch('/api/admin-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the login service. Check your connection.' } };
  }
}

function showOtpFeedback(msg, type = 'info') {
  const el = document.getElementById('otpFeedbackMsg');
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-feedback ${type}`;
  el.style.display = msg ? 'block' : 'none';
}

function startResendCooldown(seconds) {
  const btn = document.getElementById('btnResendOtp');
  if (!btn) return;
  clearInterval(otpCooldownTimer);
  let left = Math.max(0, Math.ceil(seconds || 0));
  const tick = () => {
    btn.disabled = left > 0;
    btn.textContent = left > 0 ? `Send a new code (${left}s)` : 'Send a new code';
    left--;
    if (left < 0) clearInterval(otpCooldownTimer);
  };
  tick();
  otpCooldownTimer = setInterval(tick, 1000);
}

function showOtpScreen(sentTo) {
  if (elements.portalView) elements.portalView.style.display = 'none';
  if (elements.authView) elements.authView.style.display = 'flex';
  if (elements.authForm) elements.authForm.hidden = true;
  const otpForm = document.getElementById('adminOtpForm');
  if (otpForm) otpForm.hidden = false;
  if (elements.authSubtitle) elements.authSubtitle.textContent = 'One more step to keep the admin panel safe.';
  const sentText = document.getElementById('otpSentText');
  if (sentText) sentText.textContent = sentTo
    ? `We emailed a 6-digit code to ${sentTo}. It expires in 10 minutes.`
    : 'Enter the 6-digit code from your email.';
  const input = document.getElementById('adminOtpInput');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function resetToPasswordForm() {
  const otpForm = document.getElementById('adminOtpForm');
  if (otpForm) otpForm.hidden = true;
  if (elements.authForm) elements.authForm.hidden = false;
  if (elements.authSubtitle) elements.authSubtitle.textContent = 'Sign in to manage bookings, the calendar and enquiries.';
  showOtpFeedback('');
  clearInterval(otpCooldownTimer);
}

async function requestLoginCode() {
  showOtpFeedback('Sending your code...');
  const { ok, status, data } = await callAdminOtp('request');
  if (ok) {
    showOtpScreen(data.sentTo);
    showOtpFeedback('');
    startResendCooldown(data.retryAfter);
  } else if (status === 429 && data.sentTo) {
    // A code was sent moments ago (e.g. page refresh): use that one
    showOtpScreen(data.sentTo);
    showOtpFeedback(data.error, 'info');
    startResendCooldown(data.retryAfter);
  } else {
    showOtpScreen(null);
    showOtpFeedback(data.error || 'Could not send the code. Please try again.', 'error');
    startResendCooldown(0);
  }
}

// After a correct password (or on page load with a session): verified → open, else ask for the code
async function continueAfterPassword(user) {
  state.pendingUser = user;
  const { ok, data } = await callAdminOtp('status');
  if (ok && data.verified) {
    enterAdminPortal(user);
    return;
  }
  showOtpScreen(data?.sentTo || null);
  await requestLoginCode();
}

function enterAdminPortal(user) {
  resetToPasswordForm();
  state.currentUser = user;
  updateUserProfileUI(user);
  showPortalScreen();
  handleRouteFromUrl();
  loadAllPortalData();
}

function initOtpHandlers() {
  const form = document.getElementById('adminOtpForm');
  const input = document.getElementById('adminOtpInput');
  const btn = document.getElementById('btnVerifyOtp');
  const btnText = document.getElementById('btnVerifyOtpText');

  input?.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = (input?.value || '').trim();
    if (code.length !== 6) {
      showOtpFeedback('Enter the 6-digit code from your email.', 'error');
      return;
    }
    btn.disabled = true;
    btnText.textContent = 'Checking...';
    const { ok, data } = await callAdminOtp('verify', { code });
    btn.disabled = false;
    btnText.textContent = 'Verify & Open Admin';

    if (ok && data.verified) {
      showOtpFeedback('');
      enterAdminPortal(state.pendingUser || state.currentUser);
      return;
    }
    showOtpFeedback(data.error || 'That code did not work. Please try again.', 'error');
    if (input) {
      input.value = '';
      input.focus();
    }
  });

  document.getElementById('btnResendOtp')?.addEventListener('click', requestLoginCode);

  document.getElementById('btnOtpCancel')?.addEventListener('click', async () => {
    await signOutAdmin();
    state.currentUser = null;
    state.pendingUser = null;
    resetToPasswordForm();
    showAuthScreen();
  });
}

function showAuthScreen() {
  resetToPasswordForm();
  if (elements.portalView) elements.portalView.style.display = 'none';
  if (elements.authView) elements.authView.style.display = 'flex';
  
  if (!window.location.pathname.includes('/admin/login')) {
    history.replaceState({}, '', '/admin/login');
  }
}

function showPortalScreen() {
  if (elements.authView) elements.authView.style.display = 'none';
  if (elements.portalView) elements.portalView.style.display = 'flex';
}

function updateUserProfileUI(user) {
  const email = user.email || 'admin@blackpearl.in';
  if (elements.sidebarUserEmail) {
    elements.sidebarUserEmail.textContent = email;
  }
  if (elements.sidebarUserAvatar) {
    const initial = email.charAt(0).toUpperCase();
    elements.sidebarUserAvatar.textContent = initial;
  }
}

/* ========================================================
   2. AUTHENTICATION LOGIC (SUPABASE AUTH)
   ======================================================== */
function initAuthHandlers() {
  if (!elements.authForm) return;

  // Toggle between Sign In and Sign Up modes
  if (elements.btnToggleAuthMode) {
    elements.btnToggleAuthMode.addEventListener('click', () => {
      state.authMode = state.authMode === 'signin' ? 'signup' : 'signin';
      
      if (state.authMode === 'signup') {
        elements.authSubtitle.textContent = 'Register a new admin credentials account for Black Pearl.';
        elements.btnAuthText.textContent = 'Create Admin Account';
        elements.authSwitchText.textContent = 'Already have an admin account?';
        elements.btnToggleAuthMode.textContent = 'Sign In Instead';
      } else {
        elements.authSubtitle.textContent = 'Sign in with your verified admin credentials to access the Lady Alice command deck.';
        elements.btnAuthText.textContent = 'Sign In';
        elements.authSwitchText.textContent = "Don't have an admin account yet?";
        elements.btnToggleAuthMode.textContent = 'Create Admin Account';
      }
      hideAuthFeedback();
    });
  }

  // Handle Form Submit
  elements.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!email || !password) {
      showAuthFeedback('Please enter both email and password.', 'error');
      return;
    }

    if (password.length < 6) {
      showAuthFeedback('Password must be at least 6 characters.', 'error');
      return;
    }

    setAuthLoading(true);
    hideAuthFeedback();

    try {
      if (state.authMode === 'signin') {
        const res = await signInAdmin(email, password);
        if (res.success && res.data && res.data.user) {
          const isAuthorized = await verifyAdminStatus();
          if (!isAuthorized) {
            await signOutAdmin();
            state.currentUser = null;
            showAuthFeedback('Access Denied: Your account is not authorized as an administrator.', 'error');
            return;
          }
          elements.passwordInput.value = '';
          await continueAfterPassword(res.data.user);
        } else {
          const errMsg = res.error?.message || 'Invalid login credentials. Please check email and password.';
          showAuthFeedback(errMsg, 'error');
        }
      } else {
        // Sign Up
        const res = await signUpAdmin(email, password);
        if (res.success && res.data) {
          showAuthFeedback('Account registered. Administrative access must be granted by a system administrator in Supabase before you can log in.', 'success');
          // Always keep on sign in mode and do not route to dashboard
          if (elements.btnToggleAuthMode) elements.btnToggleAuthMode.click();
        } else {
          const errMsg = res.error?.message || 'Failed to register admin account.';
          showAuthFeedback(errMsg, 'error');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      showAuthFeedback('Authentication error: ' + (err.message || 'Network issue'), 'error');
    } finally {
      setAuthLoading(false);
    }
  });

  // Handle Sign Out
  if (elements.btnSignOut) {
    elements.btnSignOut.addEventListener('click', async () => {
      if (confirm('Sign out of Black Pearl Admin deck?')) {
        await callAdminOtp('logout');
        await signOutAdmin();
        state.currentUser = null;
        showAuthScreen();
      }
    });
  }
}

function setAuthLoading(loading) {
  if (!elements.btnSubmitAuth) return;
  elements.btnSubmitAuth.disabled = loading;
  if (loading) {
    elements.btnAuthText.innerHTML = '<span class="spinner-inline"></span> Authenticating...';
  } else {
    elements.btnAuthText.textContent = state.authMode === 'signup' ? 'Create Admin Account' : 'Sign In';
  }
}

function showAuthFeedback(msg, type = 'info') {
  if (!elements.authFeedback) return;
  elements.authFeedback.textContent = msg;
  elements.authFeedback.className = `auth-feedback ${type}`;
  elements.authFeedback.style.display = 'block';
}

function hideAuthFeedback() {
  if (!elements.authFeedback) return;
  elements.authFeedback.style.display = 'none';
  elements.authFeedback.textContent = '';
}

/* ========================================================
   3. SIDEBAR NAVIGATION & ROUTING
   ======================================================== */
const SIDEBAR_COLLAPSED_KEY = 'bp_admin_sidebar_collapsed';
const mobileLayoutQuery = window.matchMedia('(max-width: 1024px)');

function initSidebarNavigation() {
  elements.navItems.forEach(item => {
    // Tooltip so icons stay identifiable when the sidebar is collapsed
    const label = item.querySelector('.nav-label');
    if (label) item.title = label.textContent.trim();

    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page) {
        navigateTo(page);
      }
      if (mobileLayoutQuery.matches) closeMobileSidebar();
    });
  });

  initSidebarToggles();
  initResponsiveTables();
}

function initSidebarToggles() {
  const layout = elements.portalView;
  const collapseBtn = document.getElementById('btnSidebarCollapse');
  const menuBtn = document.getElementById('btnMobileMenu');
  const closeBtn = document.getElementById('btnSidebarClose');
  const backdrop = document.getElementById('sidebarBackdrop');

  // Desktop: collapse to icon rail, remembered per browser
  const setCollapsed = (collapsed) => {
    layout.classList.toggle('sidebar-collapsed', collapsed);
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      const text = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      collapseBtn.setAttribute('aria-label', text);
      collapseBtn.title = text;
    }
  };

  try {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  } catch {
    setCollapsed(false);
  }

  collapseBtn?.addEventListener('click', () => {
    const collapsed = !layout.classList.contains('sidebar-collapsed');
    setCollapsed(collapsed);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch { /* storage unavailable */ }
  });

  // Mobile / tablet: off-canvas drawer
  menuBtn?.addEventListener('click', openMobileSidebar);
  closeBtn?.addEventListener('click', closeMobileSidebar);
  backdrop?.addEventListener('click', closeMobileSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && layout.classList.contains('sidebar-open')) closeMobileSidebar();
  });
  mobileLayoutQuery.addEventListener('change', (e) => {
    if (!e.matches) closeMobileSidebar();
  });
}

function openMobileSidebar() {
  elements.portalView.classList.add('sidebar-open');
  document.body.classList.add('admin-drawer-open');
  document.getElementById('btnMobileMenu')?.setAttribute('aria-expanded', 'true');
  document.getElementById('btnSidebarClose')?.focus();
}

function closeMobileSidebar() {
  if (!elements.portalView.classList.contains('sidebar-open')) return;
  elements.portalView.classList.remove('sidebar-open');
  document.body.classList.remove('admin-drawer-open');
  const menuBtn = document.getElementById('btnMobileMenu');
  menuBtn?.setAttribute('aria-expanded', 'false');
  menuBtn?.focus();
}

/**
 * Copies each column header onto its cells as data-label, so the
 * mobile card layout can show "LABEL  value" for every field.
 */
function initResponsiveTables() {
  document.querySelectorAll('.admin-data-table').forEach(table => {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const applyLabels = () => {
      tbody.querySelectorAll('tr').forEach(tr => {
        Array.from(tr.children).forEach((td, i) => {
          td.setAttribute('data-label', headers[i] || '');
        });
      });
    };

    applyLabels();
    new MutationObserver(applyLabels).observe(tbody, { childList: true });
  });
}

function navigateTo(pageName, pushState = true) {
  state.currentPage = pageName;

  // Update URL in browser
  const targetPath = `/admin/${pageName === 'bookings' ? 'orders' : pageName}`;
  if (pushState && window.location.pathname !== targetPath) {
    history.pushState({ page: pageName }, '', targetPath);
  }

  // Update sidebar active tab
  elements.navItems.forEach(item => {
    const target = item.getAttribute('data-page');
    item.classList.toggle('active', target === pageName);
    if (target === pageName) {
      const title = document.getElementById('mobilePageTitle');
      const label = item.querySelector('.nav-label');
      if (title && label) title.textContent = label.textContent.trim();
    }
  });

  // Update panels visibility
  const panelIdMap = {
    dashboard: 'pageDashboard',
    bookings: 'pageBookings',
    contact: 'pageContact',
    community: 'pageCommunity',
    media: 'pageMedia',
    calendar: 'pageCalendar'
  };

  const activePanelId = panelIdMap[pageName] || 'pageDashboard';

  elements.pagePanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === activePanelId);
  });

  // Re-render specific views if needed
  if (pageName === 'dashboard') {
    renderDashboard();
  } else if (pageName === 'bookings') {
    renderBookingsTable();
  } else if (pageName === 'contact') {
    renderContactTable();
    renderInquiriesTable();
  } else if (pageName === 'community') {
    renderCommunityTable();
  } else if (pageName === 'media') {
    renderMediaGrid();
  } else if (pageName === 'calendar') {
    renderBlockedDatesList();
  }

  // Scroll main viewport to top
  const viewport = document.querySelector('.admin-main-viewport');
  if (viewport) viewport.scrollTop = 0;
}

/* ========================================================
   4. DATA FETCHING & SYNCHRONIZATION
   ======================================================== */
async function loadAllPortalData() {
  await Promise.all([
    loadAnalyticsData(),
    loadBookingsData(),
    loadInquiriesData(),
    loadContactData(),
    loadCommunityData(),
    loadMediaData(),
    loadBlockedDatesData(),
    loadCalendarReview()
  ]);
  notifState.ready = true;
  renderNotifications();
}

async function loadAnalyticsData() {
  try {
    const summary = await fetchAnalyticsSummary(state.analyticsDays);
    state.analytics = summary;
    renderDashboard();
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

async function loadBookingsData() {
  try {
    const res = await fetchBookingHolds();
    state.bookings = (res && res.success && Array.isArray(res.data)) ? res.data : [];
  } catch (err) {
    console.error('Failed to load bookings:', err);
    state.bookings = [];
  }
  applyBookingFilters();
  renderOverview();
  renderAdminCalendar();
}

async function loadInquiriesData() {
  try {
    const res = await fetchVoyageBriefs();
    state.briefs = (res && res.success && Array.isArray(res.data)) ? res.data : [];
  } catch (err) {
    console.error('Failed to load voyage briefs:', err);
    state.briefs = [];
  }
  // Older briefs only show if there are any
  const legacyBlock = document.getElementById('legacyBriefsBlock');
  if (legacyBlock) legacyBlock.hidden = state.briefs.length === 0;
  applyBriefFilters();
}

async function loadMediaData() {
  try {
    const res = await fetchGalleryImages();
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      state.mediaItems = res.data;
    } else {
      state.mediaItems = [];
    }
    if (elements.mediaCountSpan) {
      elements.mediaCountSpan.textContent = state.mediaItems.length;
    }
    renderMediaGrid();
  } catch (err) {
    console.error('Failed to load media:', err);
    state.mediaItems = [];
    renderMediaGrid();
  }
}

/* ========================================================
   5. DASHBOARD CONTROLLER (SCREENSHOT 1)
   ======================================================== */
function initDashboardHandlers() {
  document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const range = btn.getAttribute('data-range');
      state.analyticsDays = range === 'all' ? null : Number(range);
      document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('active', b === btn));
      await loadAnalyticsData();
    });
  });

  if (elements.btnRefreshAnalytics) {
    elements.btnRefreshAnalytics.addEventListener('click', async () => {
      elements.btnRefreshAnalytics.disabled = true;
      elements.btnRefreshAnalytics.innerHTML = '<span>Refreshing...</span>';
      await loadAllPortalData();
      elements.btnRefreshAnalytics.disabled = false;
      elements.btnRefreshAnalytics.innerHTML = '<span>Refresh</span>';
    });
  }
}

function renderReportRows(bodyId, rows, rowHtml, columns, emptyText) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  body.innerHTML = Array.isArray(rows) && rows.length
    ? rows.map(row => `<tr>${rowHtml(row)}</tr>`).join('')
    : `<tr><td colspan="${columns}" class="overview-empty">${emptyText}</td></tr>`;
}

// Rounds the chart's top value up to a clean number (5, 10, 20, 50, 100...)
function niceMax(value) {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  return steps.map(s => s * magnitude).find(s => s >= value) || 10 * magnitude;
}

/**
 * Visitors per day (single series): thin bars, a light grid, a hover/focus
 * tooltip on every bar, and a direct label only on the busiest day.
 */
function renderVisitorsChart(series) {
  const chart = document.getElementById('visitorsChart');
  const axis = document.getElementById('visitorsChartAxis');
  if (!chart || !axis) return;

  const points = series?.points || [];
  const perWeek = series?.step === 7;
  document.getElementById('visitorsChartTitle').textContent = perWeek ? 'Visitors per week' : 'Visitors per day';

  if (!points.length || points.every(p => p.visitors === 0)) {
    chart.innerHTML = '<p class="overview-empty">No visits recorded in this period yet.</p>';
    axis.innerHTML = '';
    document.getElementById('visitorsChartMeta').textContent = '';
    return;
  }

  const peak = points.reduce((best, p) => (p.visitors > best.visitors ? p : best), points[0]);
  const top = niceMax(peak.visitors);
  const total = points.reduce((sum, p) => sum + p.visitors, 0);
  document.getElementById('visitorsChartMeta').textContent =
    `Busiest ${perWeek ? 'week' : 'day'}: ${peak.label} · ${peak.visitors.toLocaleString('en-IN')} visitors`;
  chart.setAttribute('aria-label', `${perWeek ? 'Visitors per week' : 'Visitors per day'}, ${points.length} bars, busiest ${peak.label} with ${peak.visitors}`);

  const grid = [1, 0.5].map(f => `
    <div class="chart-gridline" style="bottom:${f * 100}%"><span>${Math.round(top * f).toLocaleString('en-IN')}</span></div>`).join('');

  chart.innerHTML = `${grid}<div class="chart-bars">${points.map(p => `
    <div class="chart-col" tabindex="0" aria-label="${p.label}: ${p.visitors} visitors, ${p.views} page views">
      <div class="chart-bar" style="height:${Math.max(p.visitors ? 2 : 0, (p.visitors / top) * 100)}%"></div>
      ${p === peak ? `<span class="chart-peak-label" style="bottom:${(p.visitors / top) * 100}%">${p.visitors.toLocaleString('en-IN')}</span>` : ''}
      <div class="chart-tip" role="tooltip"><strong>${p.label}</strong><span>${p.visitors.toLocaleString('en-IN')} visitors</span><span>${p.views.toLocaleString('en-IN')} page views</span></div>
    </div>`).join('')}</div>`;

  // Date labels: show about 7 so they never collide
  const every = Math.max(1, Math.ceil(points.length / 7));
  axis.innerHTML = points.map((p, i) =>
    `<span>${i % every === 0 || i === points.length - 1 ? p.label.replace('Week of ', '') : ''}</span>`).join('');
  axis.style.gridTemplateColumns = `repeat(${points.length}, minmax(0, 1fr))`;
  chart.querySelector('.chart-bars').style.gridTemplateColumns = `repeat(${points.length}, minmax(0, 1fr))`;

  // Single-series chart: total visitors is the headline
  chart.dataset.total = total;
}

function renderDashboard() {
  renderOverview();
  if (!state.analytics) return;
  const a = state.analytics;
  const num = (n) => Number(n || 0).toLocaleString('en-IN');
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('metricViews', num(a.websiteViews));
  set('metricVisitors', num(a.uniqueVisitors));
  set('metricBookingViews', num(a.bookingViews));
  set('metricPaidBookings', num(a.paidBookings));
  set('metricBookingValue', `₹${num(Math.round(a.bookingValue || 0))}`);
  set('metricConversion', `${(a.conversionRate || 0).toFixed(a.conversionRate >= 10 || !a.conversionRate ? 0 : 1)}%`);

  set('metricSignups', num(a.communitySignups));
  set('metricEnquiries', num(a.enquiries));

  renderVisitorsChart(a.series);
  renderReportRows('campaignReportBody', a.campaigns, row => `
    <td class="engagement-product-title">${escapeHtml(row.name)}</td>
    <td class="text-right num-cell">${num(row.visitors)}</td>
    <td class="text-right num-cell">${num(row.bookings)}</td>
    <td class="text-right total-cell">₹${num(Math.round(row.value))}</td>`, 4,
    'No campaign links used yet in this period.');
  renderReportRows('topPagesBody', a.topPages, row => `
    <td class="engagement-product-title">${escapeHtml(row.name)}</td>
    <td class="text-right num-cell">${num(row.views)}</td>
    <td class="text-right num-cell">${num(row.visitors)}</td>`, 3,
    'No visits recorded in this period yet.');

  const devices = (a.deviceSplit?.mobile || 0) + (a.deviceSplit?.desktop || 0);
  set('metricDeviceSplit', devices ? `${Math.round((a.deviceSplit.mobile / devices) * 100)}% on phones` : '');

  // Traffic sources
  if (elements.trafficList) {
    elements.trafficList.innerHTML = '';
    if (Array.isArray(a.trafficSources) && a.trafficSources.length) {
      a.trafficSources.forEach(source => {
        const item = document.createElement('div');
        item.className = 'traffic-row';
        item.innerHTML = `
          <div class="traffic-row-header">
            <span class="traffic-name">${escapeHtml(source.name)}</span>
            <span class="traffic-stats"><strong>${num(source.count)}</strong> (${source.percentage}%)</span>
          </div>
          <div class="traffic-bar-bg">
            <div class="traffic-bar-fill" style="width: ${Math.min(100, Math.max(2, source.percentage))}%; background-color: ${source.color};"></div>
          </div>
        `;
        elements.trafficList.appendChild(item);
      });
    } else {
      elements.trafficList.innerHTML = '<p class="overview-empty">No visits recorded in this period yet.</p>';
    }
  }

  // Bookings by occasion
  const body = document.getElementById('engagementReportBody');
  if (body) {
    body.innerHTML = '';
    if (Array.isArray(a.engagementReport) && a.engagementReport.length) {
      a.engagementReport.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="engagement-product-title">${escapeHtml(row.occasion)}</td>
          <td class="text-right num-cell">${num(row.bookings)}</td>
          <td class="text-right total-cell">₹${num(Math.round(row.value))}</td>
        `;
        body.appendChild(tr);
      });
    } else {
      body.innerHTML = '<tr><td colspan="3" class="overview-empty">No paid bookings in this period yet.</td></tr>';
    }
  }
}

/* ========================================================
   6. BOOKINGS (PAYMENTS FROM THE WEBSITE)
   ======================================================== */
const PAID_STATUSES = ['Held (Deposit Paid)', 'Confirmed', 'Completed'];
const UNPAID_STATUSES = ['Payment Pending', 'Payment Failed', 'Payment Abandoned', 'Paid - Slot Conflict'];
const BOOKING_STATUS_OPTIONS = [
  ['Held (Deposit Paid)', 'Advance paid'],
  ['Confirmed', 'Confirmed'],
  ['Completed', 'Completed'],
  ['Cancelled', 'Cancelled']
];

function bookingStatusLabel(status) {
  if (status === 'Held (Deposit Paid)') return 'Advance paid';
  if (status === 'Paid - Slot Conflict') return 'Paid · slot clash, refund';
  return status || '—';
}

function bookingStatusClass(status) {
  const s = (status || '').toLowerCase();
  if (PAID_STATUSES.includes(status)) return 'status-confirmed';
  if (s.includes('pending')) return 'status-held';
  if (s.includes('cancel') || s.includes('failed') || s.includes('abandoned') || s.includes('conflict')) return 'status-failed';
  return 'status-shipped';
}

function bookingMatchesFilter(b, filter) {
  const s = (b.status || '').toLowerCase();
  if (filter === 'paid') return PAID_STATUSES.includes(b.status) || s.includes('delivered') || s.includes('shipped');
  if (filter === 'pending') return b.status === 'Payment Pending';
  if (filter === 'failed') return ['Payment Failed', 'Payment Abandoned', 'Paid - Slot Conflict', 'Failed'].includes(b.status);
  if (filter === 'cancelled') return s.includes('cancel');
  return true;
}

// Delivery status reported by Resend for the guest's confirmation and the team alert
const EMAIL_STATUS_LABELS = {
  sent: 'Sent', delivered: 'Delivered', delayed: 'Delayed', bounced: 'Bounced', spam: 'Marked spam', failed: 'Failed'
};
const EMAIL_PROBLEM_STATUSES = ['bounced', 'spam', 'failed'];

function guestEmailStatus(b) {
  if (b.guestEmailStatus) return b.guestEmailStatus;
  // Bookings from before delivery tracking
  if (b.emailSentAt) return 'sent';
  if (b.emailError) return 'failed';
  return null;
}

function emailPill(who, status, detail) {
  if (!status) return `<span class="email-pill none">${who}: —</span>`;
  const tone = status === 'delivered' ? 'sent' : (EMAIL_PROBLEM_STATUSES.includes(status) ? 'error' : 'pending');
  return `<span class="email-pill ${tone}"${detail ? ` title="${escapeHtml(detail)}"` : ''}>${who}: ${EMAIL_STATUS_LABELS[status] || status}</span>`;
}

function emailStatusHtml(b) {
  return `<div class="email-pills">
    ${emailPill('Guest', guestEmailStatus(b), b.emailError)}
    ${emailPill('You', b.adminEmailStatus)}
  </div>`;
}

function emailStatusText(status, at) {
  if (!status) return 'Not sent';
  const label = EMAIL_STATUS_LABELS[status] || status;
  return at ? `${label} · ${new Date(at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}` : label;
}

function bookingPassUrl(b) {
  if (!b.verifyToken) return '';
  return `${window.location.origin}/verify?code=${encodeURIComponent(b.id)}&t=${encodeURIComponent(b.verifyToken)}`;
}

function initBookingsHandlers() {
  if (elements.bookingsSearchInput) {
    elements.bookingsSearchInput.addEventListener('input', (e) => {
      state.bookingSearchQuery = e.target.value.toLowerCase().trim();
      applyBookingFilters();
    });
  }

  elements.bookingFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => setBookingFilter(btn.getAttribute('data-filter') || 'all'));
  });
}

function setBookingFilter(filter) {
  state.activeBookingFilter = filter;
  elements.bookingFilterButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === filter));
  applyBookingFilters();
}

function applyBookingFilters() {
  let list = state.bookings.filter(b => bookingMatchesFilter(b, state.activeBookingFilter));

  if (state.bookingSearchQuery) {
    const q = state.bookingSearchQuery;
    list = list.filter(b =>
      [b.id, b.name, b.email, b.phone, b.occasion, b.paymentId].some(v => v && String(v).toLowerCase().includes(q))
    );
  }

  state.filteredBookings = list;
  renderBookingsTable();
}

function renderBookingsTable() {
  if (!elements.bookingsTableBody) return;
  elements.bookingsTableBody.innerHTML = '';

  if (state.filteredBookings.length === 0) {
    if (elements.bookingsEmptyState) elements.bookingsEmptyState.style.display = 'block';
    return;
  }
  if (elements.bookingsEmptyState) elements.bookingsEmptyState.style.display = 'none';

  state.filteredBookings.forEach(booking => {
    const tr = document.createElement('tr');
    const isUnpaid = UNPAID_STATUSES.includes(booking.status);

    const statusCell = isUnpaid
      ? `<span class="status-select-pill ${bookingStatusClass(booking.status)}" title="${escapeHtml(booking.failureReason || '')}">${escapeHtml(bookingStatusLabel(booking.status))}</span>`
      : `<select class="status-select-pill ${bookingStatusClass(booking.status)}">
          ${BOOKING_STATUS_OPTIONS.map(([value, label]) => `<option value="${value}" ${booking.status === value ? 'selected' : ''}>${label}</option>`).join('')}
          ${BOOKING_STATUS_OPTIONS.some(([v]) => v === booking.status) ? '' : `<option selected>${escapeHtml(booking.status || '—')}</option>`}
        </select>`;

    tr.innerHTML = `
      <td>
        <div class="font-mono"><strong>${escapeHtml(booking.id)}</strong></div>
        <div class="text-muted cell-sub">${formatDisplayDate(booking.createdAt)}</div>
      </td>
      <td>
        <div><strong>${escapeHtml(booking.date || '—')}</strong></div>
        <div class="cell-sub">${escapeHtml(booking.slot || '')}</div>
        <div class="cell-sub">${escapeHtml(booking.occasion || '')}</div>
      </td>
      <td>
        <div><strong>${escapeHtml(booking.name || '—')}</strong></div>
        <div class="cell-sub"><a href="tel:${escapeHtml(booking.phone || '')}" class="contact-link">${escapeHtml(booking.phone || '')}</a></div>
        <div class="cell-sub">${escapeHtml(booking.email || '')}</div>
      </td>
      <td>
        <strong>${escapeHtml(booking.price || '—')}</strong>
        <div class="cell-sub">Advance ${escapeHtml(booking.paidToken || '₹5,000')}</div>
      </td>
      <td>${statusCell}</td>
      <td>${emailStatusHtml(booking)}</td>
      <td class="text-center">
        <button class="btn-table-icon" title="View details">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </td>
    `;

    const select = tr.querySelector('select.status-select-pill');
    if (select) {
      select.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        if (newStatus === 'Cancelled' && !confirm(`Cancel booking ${booking.id}? The slot will open for online booking again.`)) {
          e.target.value = booking.status;
          return;
        }
        const res = await updateBookingStatus(booking.id, newStatus);
        if (res && res.success === false) {
          e.target.value = booking.status;
          showToastNotification('Could not update status. Please try again.');
          return;
        }
        booking.status = newStatus;
        select.className = `status-select-pill ${bookingStatusClass(newStatus)}`;
        showToastNotification(`${booking.id} marked ${bookingStatusLabel(newStatus)}`);
        renderOverview();
        renderAdminCalendar();
      });
    }

    tr.querySelector('.btn-table-icon').addEventListener('click', () => openBookingDetailModal(booking));
    elements.bookingsTableBody.appendChild(tr);
  });
}

/* ========================================================
   6b. OVERVIEW (WHAT NEEDS ATTENTION)
   ======================================================== */
function renderOverview() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const upcoming = state.bookings
    .filter(b => PAID_STATUSES.includes(b.status) && (b.dateIso || '') >= todayIso)
    .sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || '') || (a.startHour || 0) - (b.startHour || 0));

  const followUp = state.bookings
    .filter(b => ['Payment Failed', 'Payment Abandoned', 'Paid - Slot Conflict'].includes(b.status) && new Date(b.createdAt).getTime() >= weekAgo)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const newEnquiries = state.contactInquiries.filter(i => (i.status || 'New') === 'New').length;
  const newMembers = state.communityMembers.filter(m => (m.status || 'New') === 'New').length;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('ovUpcoming', upcoming.length);
  setText('ovFollowUp', followUp.length);
  setText('ovEnquiries', newEnquiries);
  setText('ovCommunity', newMembers);

  // Sidebar counters show what is waiting, not raw totals
  if (elements.sidebarBookingsCount) elements.sidebarBookingsCount.textContent = upcoming.length;
  if (elements.sidebarContactCount) elements.sidebarContactCount.textContent = newEnquiries;
  if (elements.sidebarCommunityCount) elements.sidebarCommunityCount.textContent = newMembers;

  renderOverviewList('ovNextCharters', upcoming.slice(0, 6), b => `
      <strong>${escapeHtml(b.date || '')}</strong>
      <span>${escapeHtml(b.slot || '')}</span>
      <span class="cell-sub">${escapeHtml(b.name || '')} · ${escapeHtml(b.occasion || '')}</span>`,
    'No upcoming charters booked yet.');

  renderOverviewList('ovFollowUpList', followUp.slice(0, 6), b => `
      <strong>${escapeHtml(b.name || '')} · <a href="tel:${escapeHtml(b.phone || '')}" class="contact-link" onclick="event.stopPropagation()">${escapeHtml(b.phone || '')}</a></strong>
      <span>${escapeHtml(b.date || '')} · ${escapeHtml(b.slot || '')}</span>
      <span class="cell-sub">${escapeHtml(bookingStatusLabel(b.status))}${b.failureReason ? ' · ' + escapeHtml(b.failureReason) : ''}</span>`,
    'Nobody to call back. Failed or abandoned payments from the last 7 days show here.');

  renderNotifications();
}

function renderOverviewList(containerId, items, rowHtml, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = `<p class="overview-empty">${emptyText}</p>`;
    return;
  }
  items.forEach(b => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'overview-row';
    row.innerHTML = rowHtml(b);
    row.addEventListener('click', () => openBookingDetailModal(b));
    container.appendChild(row);
  });
}

function initOverviewLinks() {
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.getAttribute('data-goto');
      navigateTo(page);
      const filter = el.getAttribute('data-filter');
      if (page === 'bookings' && filter) setBookingFilter(filter);
    });
  });
}

/* ========================================================
   7. INQUIRIES & VOYAGE BRIEFS CONTROLLER (OPTION 3)
   ======================================================== */
function initInquiriesHandlers() {
  if (elements.briefsSearchInput) {
    elements.briefsSearchInput.addEventListener('input', (e) => {
      state.briefSearchQuery = e.target.value.toLowerCase().trim();
      applyBriefFilters();
    });
  }
}

function applyBriefFilters() {
  let list = [...state.briefs];

  if (state.briefSearchQuery) {
    const q = state.briefSearchQuery;
    list = list.filter(b => {
      return (
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.phone && b.phone.toLowerCase().includes(q)) ||
        (b.occasion && b.occasion.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    });
  }

  state.filteredBriefs = list;
  renderInquiriesTable();
}

function renderInquiriesTable() {
  if (!elements.inquiriesTableBody) return;
  elements.inquiriesTableBody.innerHTML = '';

  if (state.filteredBriefs.length === 0) {
    if (elements.briefsEmptyState) elements.briefsEmptyState.style.display = 'block';
    return;
  }

  if (elements.briefsEmptyState) elements.briefsEmptyState.style.display = 'none';

  state.filteredBriefs.forEach(brief => {
    const tr = document.createElement('tr');
    tr.className = 'inquiry-table-row';

    const cleanPhone = (brief.phone || '').replace(/\D/g, '');
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(brief.name || 'Sir')},%20this%20is%20Black%20Pearl%20regarding%20your%20charter%20inquiry.` : '#';

    tr.innerHTML = `
      <td class="font-mono text-muted">${formatDisplayDate(brief.created_at || new Date())}</td>
      <td class="font-medium"><strong>${escapeHtml(brief.name || 'Private Client')}</strong></td>
      <td>
        <a href="${waLink}" target="_blank" rel="noopener" class="contact-link whatsapp">
          ${escapeHtml(brief.phone || 'N/A')}
        </a>
      </td>
      <td><span class="occasion-tag">${escapeHtml(brief.occasion || 'Custom')}</span></td>
      <td><span class="charter-mode-pill">${escapeHtml(formatCharterMode(brief.charter_mode || brief.charterMode))}</span></td>
      <td>${escapeHtml(brief.duration || '3 Hours')}</td>
      <td class="notes-cell" title="${escapeHtml(brief.notes || 'None')}">${brief.notes ? escapeHtml(brief.notes.length > 50 ? brief.notes.substring(0, 50) + '...' : brief.notes) : '—'}</td>
      <td>
        <select class="status-select-pill status-shipped" data-brief-id="${escapeHtml(brief.id)}">
          <option value="New" ${brief.status === 'New' ? 'selected' : ''}>New</option>
          <option value="Contacted" ${brief.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
          <option value="Confirmed" ${brief.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Archived" ${brief.status === 'Archived' ? 'selected' : ''}>Archived</option>
        </select>
      </td>
      <td class="text-center">
        <a href="${waLink}" target="_blank" rel="noopener" class="btn-table-icon" title="Chat on WhatsApp">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        </a>
      </td>
    `;

    const select = tr.querySelector('select');
    if (select) {
      select.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        brief.status = newStatus;
        await updateBriefStatus(brief.id, newStatus);
        showToastNotification(`Inquiry from ${brief.name} updated to ${newStatus}`);
      });
    }

    elements.inquiriesTableBody.appendChild(tr);
  });
}

/* ========================================================
   7b. CONTACT PAGE INQUIRIES
   ======================================================== */
async function loadContactData() {
  const res = await fetchContactInquiries();
  state.contactInquiries = (res && res.success && Array.isArray(res.data)) ? res.data : [];
  renderContactTable();
  renderOverview();
}

function initContactHandlers() {
  if (elements.contactSearchInput) {
    elements.contactSearchInput.addEventListener('input', (e) => {
      state.contactSearchQuery = e.target.value.toLowerCase().trim();
      renderContactTable();
    });
  }
}

function renderContactTable() {
  if (!elements.contactTableBody) return;
  elements.contactTableBody.innerHTML = '';

  const q = state.contactSearchQuery;
  const list = q
    ? state.contactInquiries.filter(i =>
        [i.name, i.phone, i.email, i.occasion, i.notes].some(v => v && v.toLowerCase().includes(q)))
    : state.contactInquiries;

  if (elements.contactEmptyState) elements.contactEmptyState.style.display = list.length ? 'none' : 'block';

  const statuses = ['New', 'Contacted', 'Confirmed', 'Archived'];

  list.forEach(inq => {
    const tr = document.createElement('tr');
    const cleanPhone = (inq.phone || '').replace(/\D/g, '');
    const waLink = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${inq.name || ''}, this is Black Pearl regarding your charter inquiry.`)}`
      : '#';
    const notes = inq.notes || '';

    tr.innerHTML = `
      <td class="font-mono text-muted">${formatDisplayDate(inq.created_at)}</td>
      <td class="font-medium"><strong>${escapeHtml(inq.name || '—')}</strong></td>
      <td><a href="${waLink}" target="_blank" rel="noopener" class="contact-link whatsapp">${escapeHtml(inq.phone || 'N/A')}</a></td>
      <td>${inq.email ? `<a href="mailto:${escapeHtml(inq.email)}" class="contact-link">${escapeHtml(inq.email)}</a>` : '—'}</td>
      <td><span class="occasion-tag">${escapeHtml(inq.occasion || '—')}</span></td>
      <td>${inq.target_date ? formatDisplayDate(inq.target_date) : '—'}</td>
      <td>${escapeHtml(inq.guests || '—')}</td>
      <td class="notes-cell" title="${escapeHtml(notes)}">${notes ? escapeHtml(notes.length > 50 ? notes.substring(0, 50) + '...' : notes) : '—'}</td>
      <td>
        <select class="status-select-pill status-shipped">
          ${statuses.map(st => `<option value="${st}" ${inq.status === st ? 'selected' : ''}>${st}</option>`).join('')}
        </select>
      </td>
    `;

    tr.querySelector('select').addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      const res = await updateContactInquiryStatus(inq.id, newStatus);
      if (res.success) {
        inq.status = newStatus;
        showToastNotification(`Inquiry from ${inq.name} updated to ${newStatus}`);
      } else {
        e.target.value = inq.status;
        showToastNotification('Could not update status. Please try again.');
      }
    });

    elements.contactTableBody.appendChild(tr);
  });
}

/* ========================================================
   7c. COMMUNITY SIGN-UPS (WHATSAPP BROADCAST)
   ======================================================== */
const COMMUNITY_STATUSES = ['New', 'Added to Broadcast', 'Opted Out'];

async function loadCommunityData() {
  const res = await fetchCommunitySignups();
  state.communityMembers = (res && res.success && Array.isArray(res.data)) ? res.data : [];
  renderCommunityTable();
  renderOverview();
}

function initCommunityHandlers() {
  if (elements.communitySearchInput) {
    elements.communitySearchInput.addEventListener('input', (e) => {
      state.communitySearchQuery = e.target.value.toLowerCase().trim();
      renderCommunityTable();
    });
  }

  // Copies "New" members' numbers, one per line, for adding to the WhatsApp broadcast
  if (elements.btnCopyCommunityNumbers) {
    elements.btnCopyCommunityNumbers.addEventListener('click', async () => {
      const numbers = state.communityMembers
        .filter(m => m.status === 'New')
        .map(m => '+' + m.phone);
      if (!numbers.length) {
        showToastNotification('No new members to add right now.');
        return;
      }
      try {
        await navigator.clipboard.writeText(numbers.join('\n'));
        showToastNotification(`Copied ${numbers.length} new number${numbers.length === 1 ? '' : 's'}.`);
      } catch {
        showToastNotification('Clipboard blocked by browser. Use Export CSV instead.');
      }
    });
  }

  if (elements.btnExportCommunityCsv) {
    elements.btnExportCommunityCsv.addEventListener('click', () => {
      if (!state.communityMembers.length) {
        showToastNotification('No community members to export yet.');
        return;
      }
      const csvCell = (v) => {
        let str = String(v ?? '');
        // BP-SEC-06: Neutralize formula injection triggers (=, +, -, @, \t, \r)
        if (/^[=+\-@\t\r]/.test(str)) {
          str = "'" + str;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const rows = [
        ['Name', 'Phone', 'Email', 'Status', 'Joined'],
        ...state.communityMembers.map(m => [m.name, '+' + m.phone, m.email || '', m.status, m.created_at])
      ];
      const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `black-pearl-community-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

function renderCommunityTable() {
  if (!elements.communityTableBody) return;
  elements.communityTableBody.innerHTML = '';

  const q = state.communitySearchQuery;
  const list = q
    ? state.communityMembers.filter(m =>
        [m.name, m.phone, m.email, m.status].some(v => v && v.toLowerCase().includes(q)))
    : state.communityMembers;

  if (elements.communityEmptyState) elements.communityEmptyState.style.display = list.length ? 'none' : 'block';

  list.forEach(member => {
    const tr = document.createElement('tr');
    const phone = member.phone ? '+' + member.phone : 'N/A';

    tr.innerHTML = `
      <td class="font-mono text-muted">${formatDisplayDate(member.created_at)}</td>
      <td class="font-medium"><strong>${escapeHtml(member.name || '—')}</strong></td>
      <td><a href="https://wa.me/${escapeHtml(member.phone || '')}" target="_blank" rel="noopener" class="contact-link whatsapp">${escapeHtml(phone)}</a></td>
      <td>${member.email ? `<a href="mailto:${escapeHtml(member.email)}" class="contact-link">${escapeHtml(member.email)}</a>` : '—'}</td>
      <td>
        <select class="status-select-pill status-shipped">
          ${COMMUNITY_STATUSES.map(st => `<option value="${st}" ${member.status === st ? 'selected' : ''}>${st}</option>`).join('')}
        </select>
      </td>
    `;

    tr.querySelector('select').addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      const res = await updateCommunityStatus(member.id, newStatus);
      if (res.success) {
        member.status = newStatus;
        showToastNotification(`${member.name} marked as ${newStatus}`);
      } else {
        e.target.value = member.status;
        showToastNotification('Could not update status. Please try again.');
      }
    });

    elements.communityTableBody.appendChild(tr);
  });
}


/* ========================================================
   8. IMAGEKIT MEDIA ASSETS & CDN CONTROLLER
   ======================================================== */
/**
 * Helper to convert and optimize a file from device to a fast, clean DataURL (max 1400px)
 */
function optimizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof file === 'string') {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(e.target.result); // Fallback to raw dataUrl
      img.onload = () => {
        const maxDim = 1400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function initMediaHandlers() {
  if (!elements.mediaUploadForm) return;

  const fileInput = document.getElementById('adminMediaFile');
  const dropzoneContent = document.getElementById('dropzoneContent');
  const dropzonePreview = document.getElementById('dropzonePreview');
  const previewImg = document.getElementById('devicePreviewImg');
  const btnClearPreview = document.getElementById('btnClearPreview');

  // Instant preview when photo is chosen from phone or computer
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          if (previewImg) previewImg.src = loadEvent.target.result;
          if (dropzoneContent) dropzoneContent.style.display = 'none';
          if (dropzonePreview) dropzonePreview.style.display = 'flex';

          // Auto-suggest title if empty
          if (elements.mediaTitle && !elements.mediaTitle.value.trim()) {
            const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            elements.mediaTitle.value = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Clear preview and re-pick
  if (btnClearPreview) {
    btnClearPreview.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (fileInput) fileInput.value = '';
      if (previewImg) previewImg.src = '';
      if (dropzonePreview) dropzonePreview.style.display = 'none';
      if (dropzoneContent) dropzoneContent.style.display = 'flex';
    });
  }

  // Form Submission
  elements.mediaUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = elements.mediaTitle.value.trim();
    const category = elements.mediaCategory.value;
    const subtitle = elements.mediaSubtitle ? elements.mediaSubtitle.value.trim() : '';
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!file && (!previewImg || !previewImg.src)) {
      alert('Please choose a photo from your device.');
      return;
    }

    elements.btnSubmitMediaUpload.disabled = true;
    elements.btnSubmitMediaUpload.innerHTML = '<span>Adding Photo to Website...</span>';

    if (elements.mediaUploadFeedback) {
      elements.mediaUploadFeedback.style.display = 'block';
      elements.mediaUploadFeedback.textContent = 'Processing photo from device...';
      elements.mediaUploadFeedback.className = 'upload-feedback info';
    }

    try {
      // 1. Optimize photo from device
      const dataUrl = await optimizeImageFile(file || previewImg.src);

      // 2. Build record
      const record = {
        id: 'img_' + Date.now(),
        title,
        subtitle: subtitle || 'Private charter on Lady Alice',
        category,
        imagekitUrl: dataUrl,
        fileId: 'dev_' + Date.now(),
        thumbnailUrl: dataUrl,
        created_at: new Date().toISOString()
      };

      // 3. Save to Supabase table gallery_images
      await saveGalleryImage(record);

      // 4. Cache in localStorage for immediate display across the site
      const savedLocal = JSON.parse(localStorage.getItem('black_pearl_gallery') || '[]');
      savedLocal.unshift(record);
      localStorage.setItem('black_pearl_gallery', JSON.stringify(savedLocal));

      // 5. Update Admin UI
      state.mediaItems.unshift(record);
      if (elements.mediaCountSpan) elements.mediaCountSpan.textContent = state.mediaItems.length;
      const sidebarCount = document.getElementById('sidebarMediaCount');
      if (sidebarCount) sidebarCount.textContent = state.mediaItems.length;
      renderMediaGrid();

      if (elements.mediaUploadFeedback) {
        elements.mediaUploadFeedback.textContent = `Photo "${title}" successfully added to the website gallery!`;
        elements.mediaUploadFeedback.className = 'upload-feedback success';
      }

      // Reset form & preview
      elements.mediaUploadForm.reset();
      if (previewImg) previewImg.src = '';
      if (dropzonePreview) dropzonePreview.style.display = 'none';
      if (dropzoneContent) dropzoneContent.style.display = 'flex';
      showToastNotification(`Photo "${title}" is now live on the website!`);
    } catch (err) {
      console.error('Media upload error:', err);
      if (elements.mediaUploadFeedback) {
        elements.mediaUploadFeedback.textContent = 'Upload failed: ' + (err.message || 'Please try another photo');
        elements.mediaUploadFeedback.className = 'upload-feedback error';
      }
    } finally {
      elements.btnSubmitMediaUpload.disabled = false;
      elements.btnSubmitMediaUpload.innerHTML = '<span>Add Photo to Website Gallery</span>';
    }
  });
}

function renderMediaGrid() {
  if (!elements.adminMediaGrid) return;
  elements.adminMediaGrid.innerHTML = '';

  state.mediaItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'admin-media-card';
    
    const rawUrl = item.imagekit_url || item.url || '';
    const displayUrl = getImageKitUrl(rawUrl, { width: 450, quality: 75, format: 'auto' });

    card.innerHTML = `
      <div class="admin-media-card-thumb">
        <img src="${escapeHtml(displayUrl)}" alt="${escapeHtml(item.title || '')}" loading="lazy">
        <span class="media-cat-badge">${escapeHtml(item.category || 'all')}</span>
      </div>
      <div class="admin-media-card-body">
        <h4 class="media-title">${escapeHtml(item.title || '')}</h4>
        <p class="media-sub">${escapeHtml(item.subtitle || 'Private Lady Alice charter')}</p>
        <div class="media-url-row font-mono">
          <input type="text" readonly value="${escapeHtml(item.imagekit_url || displayUrl)}" class="copyable-url-input">
        </div>
      </div>
    `;

    const copyInput = card.querySelector('.copyable-url-input');
    copyInput.addEventListener('click', () => {
      copyInput.select();
      navigator.clipboard.writeText(copyInput.value);
      showToastNotification('CDN Image URL copied to clipboard!');
    });

    elements.adminMediaGrid.appendChild(card);
  });
}

/* ========================================================
   9. CALENDAR: ONLINE BOOKINGS + OFFLINE BLOCKED TIMES
   A day can hold several bookings; any two need a 1-hour gap.
   ======================================================== */
// Statuses that do NOT occupy time on the calendar
const NON_BLOCKING_STATUSES = ['Payment Pending', 'Payment Failed', 'Payment Abandoned', 'Paid - Slot Conflict', 'Cancelled', 'Failed'];

const adminCal = (() => {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
})();

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLockDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

// Short clock label for calendar cells, e.g. 2pm, 6am
function shortClock(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour < 12 || hour === 24 ? 'am' : 'pm'}`;
}

function bookingRange(b) {
  return rangeFromRecord({ startHour: b.startHour, durationHours: b.durationHours, slotKey: b.slotKey || slotKeyFromLabel(b.slot) });
}

function lockRange(l) {
  return rangeFromRecord({ startHour: l.start_hour, endHour: l.end_hour, slotKey: l.slot_key });
}

// Everything occupying time on a date, sorted by start: [{ kind, start, end, record }]
function getDayEntries(dateIso) {
  const bookings = state.bookings
    .filter(b => b.dateIso === dateIso && !NON_BLOCKING_STATUSES.includes(b.status))
    .map(b => ({ kind: 'booking', ...bookingRange(b), record: b }));
  const locks = state.blockedDates
    .filter(l => l.date === dateIso)
    .map(l => ({ kind: 'lock', ...lockRange(l), record: l }));
  return [...bookings, ...locks].sort((a, b) => a.start - b.start);
}

async function loadBlockedDatesData() {
  try {
    const res = await fetchBlockedDates();
    state.blockedDates = (res && res.success && Array.isArray(res.data)) ? res.data : [];
  } catch (err) {
    console.error('Failed to load blocked times:', err);
    state.blockedDates = [];
  }
  renderBlockedDatesList();
}

function setLockTimes(start, end) {
  elements.lockStartSelect.value = String(start);
  elements.lockEndSelect.value = String(end);
}

function initCalendarHandlers() {
  document.getElementById('adminCalPrev')?.addEventListener('click', () => {
    adminCal.month--;
    if (adminCal.month < 0) { adminCal.month = 11; adminCal.year--; }
    renderAdminCalendar();
  });
  document.getElementById('adminCalNext')?.addEventListener('click', () => {
    adminCal.month++;
    if (adminCal.month > 11) { adminCal.month = 0; adminCal.year++; }
    renderAdminCalendar();
  });

  document.querySelectorAll('[data-lock-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [start, end] = btn.getAttribute('data-lock-preset').split('-').map(Number);
      setLockTimes(start, end);
    });
  });

  if (!elements.btnSubmitLockDate) return;

  elements.btnSubmitLockDate.addEventListener('click', async () => {
    const dateVal = elements.lockDateInput.value;
    const start = Number(elements.lockStartSelect.value);
    const end = Number(elements.lockEndSelect.value);
    const reason = elements.lockReasonSelect.value;
    const note = elements.lockNoteInput.value.trim();

    if (!dateVal) {
      alert('Please choose a date.');
      return;
    }
    if (dateVal < toIsoDate(new Date())) {
      alert('That date has already passed.');
      return;
    }
    if (!(end > start)) {
      alert('"To" must be later than "From".');
      return;
    }

    // Same rule as the website: no overlap, and a 1-hour gap from every other booking / block
    const clash = getDayEntries(dateVal).find(entry => rangesConflict(start, end, entry));
    if (clash) {
      const who = clash.kind === 'booking'
        ? `a website booking by ${clash.record.name} (${clash.record.id})`
        : `blocked time (${clash.record.reason || 'Blocked'})`;
      alert(`${formatRange(start, end)} on ${formatLockDate(dateVal)} clashes with ${who} at ${formatRange(clash.start, clash.end)}. ` +
        `Bookings need a ${TURNAROUND_GAP_HOURS}-hour gap between them.`);
      return;
    }

    elements.btnSubmitLockDate.disabled = true;
    elements.btnSubmitLockDate.textContent = 'Saving...';

    try {
      const slotKey = start === DAY_START_HOUR && end === DAY_END_HOUR ? null
        : (end <= charterSlots.day.endHour ? 'day' : (start >= charterSlots.evening.startHour ? 'evening' : null));
      const res = await saveBlockedDate(dateVal, reason, { slotKey, note, startHour: start, endHour: end });
      if (!res.success) {
        alert('Could not block this time. Please refresh and try again.');
        return;
      }
      state.blockedDates.push(res.data);
      elements.lockNoteInput.value = '';
      renderBlockedDatesList();
      renderNotifications();
      showToastNotification(`${formatRange(start, end)} blocked on ${formatLockDate(dateVal)}`);
    } catch (err) {
      console.error('Failed to block time:', err);
    } finally {
      elements.btnSubmitLockDate.disabled = false;
      elements.btnSubmitLockDate.textContent = 'Block Time';
    }
  });
}

async function unlockSlot(lock) {
  const range = lockRange(lock);
  const what = `${formatRange(range.start, range.end)} on ${formatLockDate(lock.date)}`;
  if (!confirm(`Unblock ${what}? It will open for online booking again.`)) return;

  const res = await deleteBlockedDate(lock.id);
  if (!res.success) {
    showToastNotification('Could not unblock. Please try again.');
    return;
  }
  state.blockedDates = state.blockedDates.filter(l => l.id !== lock.id);
  renderBlockedDatesList();
  showToastNotification(`${what} unblocked`);
}

function prefillLockForm(dateIso) {
  elements.lockDateInput.value = dateIso;
  document.getElementById('adminLockFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  elements.lockStartSelect.focus({ preventScroll: true });
}

function renderAdminCalendar() {
  const grid = document.getElementById('adminCalGrid');
  const label = document.getElementById('adminCalLabel');
  if (!grid || !label) return;

  const first = new Date(adminCal.year, adminCal.month, 1);
  label.textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  grid.innerHTML = '';

  const todayIso = toIsoDate(new Date());
  const leading = (first.getDay() + 6) % 7; // Monday-first
  const totalDays = new Date(adminCal.year, adminCal.month + 1, 0).getDate();

  for (let i = 0; i < leading; i++) {
    const blank = document.createElement('div');
    blank.className = 'admin-cal-day empty';
    grid.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateIso = toIsoDate(new Date(adminCal.year, adminCal.month, day));
    const isPast = dateIso < todayIso;
    const entries = getDayEntries(dateIso);

    const cell = document.createElement('div');
    cell.className = `admin-cal-day${isPast ? ' past' : ''}${dateIso === todayIso ? ' today' : ''}`;
    cell.innerHTML = `<span class="admin-cal-date">${day}</span>`;

    entries.forEach(entry => {
      const chip = document.createElement('button');
      chip.type = 'button';
      const time = `${shortClock(entry.start)}–${shortClock(entry.end)}`;

      if (entry.kind === 'booking') {
        chip.className = 'slot-chip booked';
        chip.innerHTML = `${time}<span class="chip-detail"> · ${escapeHtml(entry.record.name || 'Booked')}</span>`;
        chip.title = `${formatRange(entry.start, entry.end)}: booked on the website by ${entry.record.name} (${entry.record.id})`;
        chip.addEventListener('click', (e) => { e.stopPropagation(); openBookingDetailModal(entry.record); });
      } else {
        chip.className = 'slot-chip locked';
        chip.innerHTML = `${time}<span class="chip-detail"> · ${escapeHtml(entry.record.reason || 'Blocked')}</span>`;
        chip.title = `${formatRange(entry.start, entry.end)}: ${entry.record.reason || 'Blocked'}${entry.record.note ? ' · ' + entry.record.note : ''}`;
        if (isPast) chip.disabled = true;
        else chip.addEventListener('click', (e) => { e.stopPropagation(); unlockSlot(entry.record); });
      }
      cell.appendChild(chip);
    });

    if (!isPast) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'slot-chip add-block';
      add.textContent = entries.length ? '+ Block' : 'Open · + Block';
      add.title = 'Block time on this day for an offline booking';
      add.addEventListener('click', () => prefillLockForm(dateIso));
      cell.appendChild(add);
    }

    grid.appendChild(cell);
  }
}

function renderBlockedDatesList() {
  renderAdminCalendar();
  renderCalendarReviewStatus();
  if (!elements.lockedDatesList) return;
  elements.lockedDatesList.innerHTML = '';

  const todayIso = toIsoDate(new Date());
  const upcoming = state.blockedDates
    .filter(l => l.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || lockRange(a).start - lockRange(b).start);

  if (upcoming.length === 0) {
    elements.lockedDatesList.innerHTML = '<p class="text-muted" style="padding: 12px 0;">Nothing blocked. Website bookings block their own time automatically.</p>';
    return;
  }

  upcoming.forEach(lock => {
    const range = lockRange(lock);
    const row = document.createElement('div');
    row.className = 'locked-date-item';
    row.innerHTML = `
      <div class="locked-date-info">
        <span class="date-badge">${escapeHtml(formatLockDate(lock.date))}</span>
        <span class="reason-text">
          ${escapeHtml(formatRange(range.start, range.end))} · ${escapeHtml(lock.reason || 'Blocked')}
          ${lock.note ? `<span class="lock-note">${escapeHtml(lock.note)}</span>` : ''}
        </span>
      </div>
      <button type="button" class="btn-unlock">Unblock</button>
    `;
    row.querySelector('.btn-unlock').addEventListener('click', () => unlockSlot(lock));
    elements.lockedDatesList.appendChild(row);
  });
}

/* ========================================================
   10. MODAL DETAILS CONTROLLER
   ======================================================== */
function initModalHandlers() {
  if (elements.btnCloseModal) {
    elements.btnCloseModal.addEventListener('click', closeModal);
  }

  if (elements.bookingModal) {
    elements.bookingModal.addEventListener('click', (e) => {
      if (e.target === elements.bookingModal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.bookingModal && elements.bookingModal.style.display !== 'none') {
      closeModal();
    }
  });
}

function openBookingDetailModal(booking) {
  if (!elements.bookingModal || !elements.modalBookingBody) return;

  elements.modalBookingId.textContent = `Booking ${booking.id || ''}`;

  const field = (label, value) => `
      <div class="detail-field">
        <label>${label}</label>
        <div>${value}</div>
      </div>`;
  const passUrl = bookingPassUrl(booking);
  const phoneDigits = (booking.phone || '').replace(/\D/g, '');
  const guestStatus = guestEmailStatus(booking);
  const guestEmailText = emailStatusText(guestStatus, booking.guestEmailStatusAt || booking.emailSentAt)
    + (booking.emailError && guestStatus === 'failed' ? ` (${booking.emailError})` : '');

  elements.modalBookingBody.innerHTML = `
    <div class="modal-detail-grid">
      ${field('Customer', `<strong>${escapeHtml(booking.name || '—')}</strong>`)}
      ${field('Phone', `<a href="tel:${escapeHtml(booking.phone || '')}" class="contact-link">${escapeHtml(booking.phone || '—')}</a>`)}
      ${field('Email', `<a href="mailto:${escapeHtml(booking.email || '')}" class="contact-link">${escapeHtml(booking.email || '—')}</a>`)}
      ${field('Guests', `${escapeHtml(booking.guests || '—')}`)}
      ${field('Occasion', escapeHtml(booking.occasion || '—'))}
      ${field('Date', `<strong>${escapeHtml(booking.date || '—')}</strong>`)}
      ${field('Slot & time', escapeHtml(booking.slot || '—'))}
      ${field('Duration', `${escapeHtml(booking.duration || '—')} · ${escapeHtml(booking.voyageMode || '')}`)}
      ${field('Charter price', `<strong>${escapeHtml(booking.price || '—')}</strong>`)}
      ${field('Advance', escapeHtml(booking.paidToken || '₹5,000'))}
      ${field('Status', `<span class="status-select-pill ${bookingStatusClass(booking.status)}">${escapeHtml(bookingStatusLabel(booking.status))}</span>`)}
      ${field('Guest confirmation email', escapeHtml(guestEmailText))}
      ${field('Your new-booking email', escapeHtml(emailStatusText(booking.adminEmailStatus, booking.adminEmailStatusAt)))}
      ${booking.paymentId ? field('Razorpay payment', `<code class="mono-chip">${escapeHtml(booking.paymentId)}</code>`) : ''}
      ${booking.razorpayOrderId ? field('Razorpay order', `<code class="mono-chip">${escapeHtml(booking.razorpayOrderId)}</code>`) : ''}
      ${booking.failureReason ? field('Payment note', escapeHtml(booking.failureReason)) : ''}
      ${field('Created', formatDisplayDate(booking.createdAt))}
    </div>

    ${booking.notes && booking.notes !== 'None' ? `
      <div class="detail-notes-box">
        <label>Guest notes</label>
        <p>${escapeHtml(booking.notes)}</p>
      </div>
    ` : ''}

    <div class="modal-footer-actions">
      ${phoneDigits ? `<a href="tel:${escapeHtml(booking.phone)}" class="btn-panel-action btn-refresh"><span>Call</span></a>` : ''}
      ${phoneDigits ? `<a href="https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello ${booking.name || ''}, this is Black Pearl regarding booking ${booking.id}.`)}" target="_blank" rel="noopener" class="btn-panel-action btn-refresh"><span>WhatsApp</span></a>` : ''}
      ${passUrl ? `<a href="${passUrl}" target="_blank" rel="noopener" class="btn-panel-action btn-primary"><span>Booking pass</span></a>` : ''}
    </div>
  `;

  elements.bookingModal.style.display = 'flex';
}

function closeModal() {
  if (elements.bookingModal) {
    elements.bookingModal.style.display = 'none';
  }
}

/* ========================================================
   10. SMART NOTIFICATIONS ("TO DO")
   Built from live data, so items disappear once handled.
   ======================================================== */
const NOTIF_REFRESH_MS = 2 * 60 * 1000;
const CALENDAR_REMINDER_HOUR_IST = 10; // desktop alert for the calendar check after 10 am
const DISMISSED_KEY = 'bp_admin_dismissed_notifications';

const notifState = {
  calendarReviewedAt: null,
  calendarReviewedBy: null,
  ready: false // set after the first full data load
};

function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function hourInIndia() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function readStoredSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

function writeStoredSet(key, set) {
  try {
    // Keep the list short; old ids no longer matter
    localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-300)));
  } catch { /* storage unavailable */ }
}

function isCalendarReviewedToday() {
  if (!notifState.calendarReviewedAt) return false;
  const reviewedDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(notifState.calendarReviewedAt));
  return reviewedDay === todayInIndia();
}

/**
 * Every item: { id, level: 'urgent' | 'action' | 'reminder' | 'info', title, detail, actionLabel, onAction, dismissible }
 */
function buildNotifications() {
  const items = [];
  const today = todayInIndia();
  const tomorrow = addDaysIso(today, 1);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // Urgent: paid twice for one slot -> refund
  state.bookings.filter(b => b.status === 'Paid - Slot Conflict').forEach(b => items.push({
    id: `conflict:${b.id}`,
    level: 'urgent',
    title: `Refund needed: ${b.name}`,
    detail: `Paid for ${b.date} (${b.slot}), but the slot was already booked. Refund the advance or offer another slot.`,
    actionLabel: 'Open booking',
    onAction: () => openBookingDetailModal(b)
  }));

  // Urgent: paid but the guest's confirmation didn't arrive (failed, bounced or marked spam)
  state.bookings.filter(b => PAID_STATUSES.includes(b.status) && EMAIL_PROBLEM_STATUSES.includes(guestEmailStatus(b))).forEach(b => items.push({
    id: `email:${b.id}:${guestEmailStatus(b)}`,
    level: 'urgent',
    title: `Confirmation email ${EMAIL_STATUS_LABELS[guestEmailStatus(b)].toLowerCase()}: ${b.name}`,
    detail: `They paid but didn't receive their QR email (${b.email}). Send them the booking pass on WhatsApp.`,
    actionLabel: 'Open booking',
    onAction: () => openBookingDetailModal(b)
  }));

  // Action: paid, waiting for the team's call (clears when marked Confirmed)
  const awaitingCall = state.bookings.filter(b => b.status === 'Held (Deposit Paid)' && (b.dateIso || '') >= today);
  if (awaitingCall.length) {
    items.push({
      id: `awaiting:${awaitingCall.map(b => b.id).sort().join(',')}`,
      level: 'action',
      title: `${plural(awaitingCall.length, 'booking', 'bookings')} paid, waiting for your call`,
      detail: `${awaitingCall.slice(0, 3).map(b => `${b.name} (${b.date})`).join(', ')}${awaitingCall.length > 3 ? '…' : ''}. Call them, then set the status to Confirmed.`,
      actionLabel: 'View bookings',
      onAction: () => { navigateTo('bookings'); setBookingFilter('paid'); }
    });
  }

  // Action: payments that didn't go through (dismiss once called)
  state.bookings
    .filter(b => ['Payment Failed', 'Payment Abandoned'].includes(b.status) && new Date(b.createdAt).getTime() >= weekAgo)
    .forEach(b => items.push({
      id: `followup:${b.id}`,
      level: 'action',
      title: `Call back ${b.name}`,
      detail: `${b.status === 'Payment Abandoned' ? 'Left the payment page' : 'Payment failed'} for ${b.date} (${b.slot}) · ${b.phone}`,
      actionLabel: 'Open booking',
      onAction: () => openBookingDetailModal(b),
      dismissible: true
    }));

  // Action: new enquiries (clears when status changes from New)
  const newEnquiries = state.contactInquiries.filter(i => (i.status || 'New') === 'New');
  if (newEnquiries.length) {
    items.push({
      id: `enquiries:${newEnquiries.map(i => i.id).sort().join(',')}`,
      level: 'action',
      title: `${plural(newEnquiries.length, 'new enquiry', 'new enquiries')} to reply to`,
      detail: newEnquiries.slice(0, 3).map(i => `${i.name} (${i.occasion || 'enquiry'})`).join(', ') + (newEnquiries.length > 3 ? '…' : ''),
      actionLabel: 'Open enquiries',
      onAction: () => navigateTo('contact')
    });
  }

  // Reminder: daily calendar check for offline bookings / maintenance
  if (!isCalendarReviewedToday()) {
    items.push({
      id: `calendar:${today}`,
      level: 'reminder',
      title: 'Check today\'s calendar',
      detail: 'Lock any offline bookings or maintenance so they can\'t be booked online.',
      actionLabel: 'Open calendar',
      onAction: () => navigateTo('calendar')
    });
  }

  // Reminder: community members to add to the WhatsApp broadcast
  const newMembers = state.communityMembers.filter(m => (m.status || 'New') === 'New');
  if (newMembers.length) {
    items.push({
      id: `community:${newMembers.map(m => m.id).sort().join(',')}`,
      level: 'reminder',
      title: `Add ${plural(newMembers.length, 'person', 'people')} to the WhatsApp broadcast`,
      detail: 'Copy their numbers from Community, then mark them as added.',
      actionLabel: 'Open community',
      onAction: () => navigateTo('community')
    });
  }

  // Info: charters today and tomorrow
  state.bookings
    .filter(b => PAID_STATUSES.includes(b.status) && (b.dateIso === today || b.dateIso === tomorrow))
    .sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || '') || (a.startHour || 0) - (b.startHour || 0))
    .forEach(b => items.push({
      id: `upcoming:${b.id}`,
      level: 'info',
      title: `${b.dateIso === today ? 'Today' : 'Tomorrow'}: ${b.name}`,
      detail: `${b.slot} · ${b.guests || '—'} guests · ${b.occasion}`,
      actionLabel: 'Open booking',
      onAction: () => openBookingDetailModal(b)
    }));

  const dismissed = readStoredSet(DISMISSED_KEY);
  return items.filter(item => !(item.dismissible && dismissed.has(item.id)));
}

const LEVEL_LABELS = { urgent: 'Urgent', action: 'To do', reminder: 'Reminder', info: 'Coming up' };
const LEVEL_ORDER = { urgent: 0, action: 1, reminder: 2, info: 3 };
const HISTORY_KEY = 'bp_admin_notifications';
const HISTORY_LIMIT = 100;
const POPUP_LIMIT_ON_LOGIN = 3;
const POPUP_HIDE_MS = 9000;

// Live actions for current items, keyed by notification id
let currentActions = new Map();

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  } catch { /* storage unavailable */ }
}

function timeAgo(isoTime) {
  const mins = Math.round((Date.now() - new Date(isoTime).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return new Date(isoTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Merges the live items into the stored history: new items are added
 * (and returned so they can pop up), handled items are marked resolved.
 */
function syncNotificationHistory(items) {
  const history = readHistory();
  const byId = new Map(history.map(h => [h.id, h]));
  const liveIds = new Set(items.map(i => i.id));
  const added = [];

  items.forEach(item => {
    const existing = byId.get(item.id);
    if (existing) {
      Object.assign(existing, { title: item.title, detail: item.detail, level: item.level, resolved: false });
    } else {
      const entry = { id: item.id, level: item.level, title: item.title, detail: item.detail, createdAt: new Date().toISOString(), read: false, resolved: false };
      history.unshift(entry);
      added.push(entry);
    }
  });

  history.forEach(h => {
    if (!liveIds.has(h.id) && !h.resolved) {
      h.resolved = true;
      h.resolvedAt = new Date().toISOString();
    }
  });

  writeHistory(history);
  return { history, added };
}

function renderNotificationList(container, items) {
  if (!container) return;
  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = '<p class="overview-empty">All caught up. Nothing needs your attention right now.</p>';
    return;
  }

  items.forEach(item => container.appendChild(buildNotificationRow(item)));
}

function buildNotificationRow(item, { showTime = false } = {}) {
  const row = document.createElement('div');
  row.className = `notif-item notif-${item.level}${item.resolved ? ' is-resolved' : ''}${item.read === false ? ' is-unread' : ''}`;
  const action = currentActions.get(item.id);
  row.innerHTML = `
    <div class="notif-body">
      <span class="notif-level">${item.resolved ? 'Done' : LEVEL_LABELS[item.level]}${showTime ? ` · ${timeAgo(item.createdAt)}` : ''}</span>
      <strong class="notif-title">${escapeHtml(item.title)}</strong>
      <span class="notif-detail">${escapeHtml(item.detail)}</span>
    </div>
    ${!item.resolved && action ? `
    <div class="notif-actions">
      <button type="button" class="btn-panel-action btn-refresh notif-action">${escapeHtml(action.actionLabel)}</button>
      ${action.dismissible ? '<button type="button" class="btn-text-link notif-dismiss">Done</button>' : ''}
    </div>` : ''}
  `;
  row.querySelector('.notif-action')?.addEventListener('click', () => {
    closeNotificationPanel();
    action.onAction();
  });
  row.querySelector('.notif-dismiss')?.addEventListener('click', () => dismissNotification(item.id));
  return row;
}

function dismissNotification(id) {
  const dismissed = readStoredSet(DISMISSED_KEY);
  dismissed.add(id);
  writeStoredSet(DISMISSED_KEY, dismissed);
  renderNotifications();
}

function renderNotificationPanel(history) {
  const list = document.getElementById('notifList');
  if (!list) return;
  list.innerHTML = '';

  const open = history.filter(h => !h.resolved)
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.createdAt.localeCompare(a.createdAt));
  const earlier = history.filter(h => h.resolved)
    .sort((a, b) => (b.resolvedAt || b.createdAt).localeCompare(a.resolvedAt || a.createdAt))
    .slice(0, 30);

  if (!open.length && !earlier.length) {
    list.innerHTML = '<p class="overview-empty">No notifications yet.</p>';
    return;
  }

  const section = (title, rows) => {
    if (!rows.length) return;
    const heading = document.createElement('h3');
    heading.className = 'notif-section-title';
    heading.textContent = title;
    list.appendChild(heading);
    rows.forEach(item => list.appendChild(buildNotificationRow(item, { showTime: true })));
  };
  section(open.length ? 'Needs attention' : 'All caught up', open);
  section('Earlier', earlier);
}

function renderNotifications() {
  const items = buildNotifications();
  currentActions = new Map(items.map(i => [i.id, i]));

  // Before the first full load, only refresh the live lists (no history, no popups)
  if (!notifState.ready) {
    renderNotificationList(document.getElementById('ovTodoList'), items);
    renderCalendarReviewStatus();
    return;
  }

  const { history, added } = syncNotificationHistory(items);
  const unread = history.filter(h => !h.read && !h.resolved).length;

  document.querySelectorAll('[data-notif-count]').forEach(el => {
    el.textContent = unread;
    el.hidden = unread === 0;
  });

  renderNotificationPanel(history);
  renderNotificationList(document.getElementById('ovTodoList'), items);
  renderCalendarReviewStatus();
  announceNewNotifications(added);
}

function markAllNotificationsRead() {
  const history = readHistory();
  let changed = false;
  history.forEach(h => {
    if (!h.read) { h.read = true; changed = true; }
  });
  if (changed) writeHistory(history);
  document.querySelectorAll('[data-notif-count]').forEach(el => { el.hidden = true; el.textContent = '0'; });
}

/* ---------- Pop-ups ---------- */
function announceNewNotifications(added) {
  if (!added.length) return;

  // Calendar reminder pops up from mid-morning; before that it waits in the list
  const toAnnounce = added
    .filter(n => !(n.id.startsWith('calendar:') && hourInIndia() < CALENDAR_REMINDER_HOUR_IST))
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  if (!toAnnounce.length) return;

  const useDesktop = document.hidden && desktopAlertsAvailable() && Notification.permission === 'granted';
  const shown = toAnnounce.slice(0, POPUP_LIMIT_ON_LOGIN);

  shown.forEach((n, i) => {
    if (useDesktop) showDesktopNotification(n);
    else setTimeout(() => showPopup(n), i * 350);
  });

  const remaining = toAnnounce.length - shown.length;
  if (remaining > 0 && !useDesktop) {
    setTimeout(() => showPopup({
      id: 'more',
      level: 'info',
      title: `${remaining} more notification${remaining === 1 ? '' : 's'}`,
      detail: 'Open Notifications to see everything.'
    }, { openPanel: true }), shown.length * 350);
  }
}

function showPopup(n, { openPanel = false } = {}) {
  let stack = document.getElementById('notifPopupStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'notifPopupStack';
    stack.className = 'notif-popup-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }

  const action = currentActions.get(n.id);
  const popup = document.createElement('div');
  popup.className = `notif-popup notif-${n.level}`;
  popup.innerHTML = `
    <div class="notif-body">
      <span class="notif-level">${LEVEL_LABELS[n.level]}</span>
      <strong class="notif-title">${escapeHtml(n.title)}</strong>
      <span class="notif-detail">${escapeHtml(n.detail)}</span>
    </div>
    <button type="button" class="notif-popup-close" aria-label="Dismiss">✕</button>
  `;

  const remove = () => {
    popup.classList.add('is-leaving');
    setTimeout(() => popup.remove(), 250);
  };
  popup.querySelector('.notif-popup-close').addEventListener('click', (e) => {
    e.stopPropagation();
    remove();
  });
  popup.addEventListener('click', () => {
    remove();
    if (openPanel || !action) openNotificationPanel();
    else action.onAction();
  });

  stack.appendChild(popup);
  let timer = setTimeout(remove, POPUP_HIDE_MS);
  popup.addEventListener('mouseenter', () => clearTimeout(timer));
  popup.addEventListener('mouseleave', () => { timer = setTimeout(remove, POPUP_HIDE_MS / 2); });
}

function showDesktopNotification(n) {
  try {
    const notification = new Notification(n.title, { body: n.detail, icon: '/assets/black-pearl-mark.svg', tag: n.id });
    notification.onclick = () => {
      window.focus();
      currentActions.get(n.id)?.onAction();
      notification.close();
    };
  } catch {
    showPopup(n);
  }
}


/* ---------- Daily calendar review ---------- */
async function loadCalendarReview() {
  const res = await fetchAdminActivity('calendar_reviewed');
  if (res.success && res.data) {
    notifState.calendarReviewedAt = res.data.happened_at;
    notifState.calendarReviewedBy = res.data.by_email;
  }
  renderNotifications();
}

function renderCalendarReviewStatus() {
  const status = document.getElementById('calendarReviewStatus');
  const btn = document.getElementById('btnCalendarReviewed');
  if (!status) return;

  if (isCalendarReviewedToday()) {
    const time = new Date(notifState.calendarReviewedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    status.textContent = `Checked today at ${time}${notifState.calendarReviewedBy ? ` by ${notifState.calendarReviewedBy}` : ''}.`;
    status.classList.remove('is-due');
    if (btn) btn.textContent = 'Checked today ✓';
  } else {
    status.textContent = 'Not checked today. Add any offline bookings or maintenance, then press "Calendar is up to date".';
    status.classList.add('is-due');
    if (btn) btn.textContent = 'Calendar is up to date';
  }
}

async function markCalendarReviewed() {
  const btn = document.getElementById('btnCalendarReviewed');
  if (btn) btn.disabled = true;
  const res = await recordAdminActivity('calendar_reviewed', state.currentUser?.email);
  if (btn) btn.disabled = false;

  if (!res.success) {
    showToastNotification('Could not save. Please try again.');
    return;
  }
  notifState.calendarReviewedAt = res.data.happened_at;
  notifState.calendarReviewedBy = res.data.by_email;
  renderNotifications();
  showToastNotification('Thanks. Calendar marked as checked for today.');
}

/* ---------- Panel ---------- */
function openNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  const backdrop = document.getElementById('notifBackdrop');
  if (!panel) return;
  if (mobileLayoutQuery.matches) closeMobileSidebar();
  renderNotifications();
  markAllNotificationsRead();
  panel.hidden = false;
  if (backdrop) backdrop.hidden = false;
  document.querySelectorAll('.notif-trigger').forEach(t => t.setAttribute('aria-expanded', 'true'));
  document.getElementById('btnCloseNotifications')?.focus();
}

function closeNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  const backdrop = document.getElementById('notifBackdrop');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.querySelectorAll('.notif-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));
}

/* ---------- Desktop alerts (while the admin tab is open) ---------- */
function desktopAlertsAvailable() {
  return typeof window.Notification !== 'undefined';
}

function renderAlertsStatus() {
  const statusEl = document.getElementById('notifAlertsStatus');
  const btn = document.getElementById('btnEnableAlerts');
  if (!statusEl || !btn) return;

  if (!desktopAlertsAvailable()) {
    statusEl.textContent = 'Desktop alerts are not supported in this browser.';
    btn.hidden = true;
  } else if (Notification.permission === 'granted') {
    statusEl.textContent = 'Desktop alerts are on: you will also be notified when this tab is in the background.';
    btn.hidden = true;
  } else if (Notification.permission === 'denied') {
    statusEl.textContent = 'Desktop alerts are blocked in your browser settings.';
    btn.hidden = true;
  } else {
    statusEl.textContent = 'Also get desktop alerts when this tab is in the background.';
    btn.hidden = false;
  }
}

async function refreshForNotifications() {
  if (state.currentUser) {
    const { ok, data } = await callAdminOtp('status');
    if (ok && !data.verified) {
      showToastNotification('Your admin session expired. Enter a new login code.');
      await continueAfterPassword(state.currentUser);
      return;
    }
  }
  if (!state.currentUser || document.hidden && !(desktopAlertsAvailable() && Notification.permission === 'granted')) return;
  await Promise.all([loadBookingsData(), loadContactData(), loadCommunityData(), loadBlockedDatesData()]);
  await loadCalendarReview();
}

function initNotifications() {
  document.querySelectorAll('.notif-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById('notifPanel');
      if (panel && !panel.hidden) closeNotificationPanel();
      else openNotificationPanel();
    });
  });
  document.getElementById('btnCloseNotifications')?.addEventListener('click', closeNotificationPanel);
  document.getElementById('notifBackdrop')?.addEventListener('click', closeNotificationPanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNotificationPanel();
  });

  document.getElementById('btnCalendarReviewed')?.addEventListener('click', markCalendarReviewed);

  document.getElementById('btnEnableAlerts')?.addEventListener('click', async () => {
    if (!desktopAlertsAvailable()) return;
    await Notification.requestPermission();
    renderAlertsStatus();
    renderNotifications();
  });
  renderAlertsStatus();

  setInterval(refreshForNotifications, NOTIF_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshForNotifications();
  });
}

/* ========================================================
   11. HELPER UTILITIES
   ======================================================== */
function formatDisplayDate(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateInput;
  }
}

function formatCharterMode(mode) {
  if (mode === 'day') return 'Day Slot (6 am – 2 pm)';
  if (mode === 'evening') return 'Evening Slot (2 pm – 11 pm)';
  // Legacy briefs from before standard slots
  if (mode === 'sailing') return 'Active Sailing';
  if (mode === 'hybrid') return 'Hybrid Cruise';
  return 'At Rest / Ocean Anchor';
}

function showToastNotification(message) {
  let toast = document.getElementById('adminToastNotice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToastNotice';
    toast.className = 'admin-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
