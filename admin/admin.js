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
  isSupabaseConfigured
} from '../supabaseClient.js';

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
  activeBookingFilter: 'all',
  bookingSearchQuery: '',
  briefSearchQuery: ''
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
  sidebarBriefsCount: document.getElementById('sidebarBriefsCount'),
  navItems: document.querySelectorAll('.sidebar-nav .nav-item'),
  pagePanels: document.querySelectorAll('.admin-page-panel'),

  // Dashboard elements
  btnRefreshAnalytics: document.getElementById('btnRefreshAnalytics'),
  btnHeaderNewBooking: document.getElementById('btnHeaderNewBooking'),
  metricViews: document.getElementById('metricViews'),
  metricVisitors: document.getElementById('metricVisitors'),
  metricBookingViews: document.getElementById('metricBookingViews'),
  metricClicks: document.getElementById('metricClicks'),
  metricCharters: document.getElementById('metricCharters'),
  metricTopOccasion: document.getElementById('metricTopOccasion'),
  trafficList: document.getElementById('trafficAcquisitionList'),
  engagementReportBody: document.getElementById('engagementReportBody'),

  // Bookings elements
  bookingsSearchInput: document.getElementById('bookingsSearchInput'),
  bookingFilterButtons: document.querySelectorAll('.table-filters-bar .filter-btn'),
  bookingsTableBody: document.getElementById('bookingsTableBody'),
  bookingsEmptyState: document.getElementById('bookingsEmptyState'),

  // Inquiries elements
  briefsSearchInput: document.getElementById('briefsSearchInput'),
  inquiriesTableBody: document.getElementById('inquiriesTableBody'),
  briefsEmptyState: document.getElementById('briefsEmptyState'),

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
  initSidebarNavigation();
  initDashboardHandlers();
  initBookingsHandlers();
  initInquiriesHandlers();
  initMediaHandlers();
  initCalendarHandlers();
  initModalHandlers();

  // Listen to popstate for browser back/forward navigation
  window.addEventListener('popstate', () => {
    handleRouteFromUrl();
  });

  // Check current session with Supabase Auth
  await checkSessionAndRoute();

  // Subscribe to real-time Supabase Auth state changes
  onAuthStateChange((event, session) => {
    console.log('[Admin Auth State Change]', event, session?.user?.email);
    if (session && session.user) {
      state.currentUser = session.user;
      updateUserProfileUI(session.user);
      if (elements.authView && elements.authView.style.display !== 'none') {
        navigateTo('dashboard');
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
      state.currentUser = user;
      updateUserProfileUI(user);
      showPortalScreen();
      handleRouteFromUrl();
      await loadAllPortalData();
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
    navigateTo('inquiries', false);
  } else if (path.includes('/admin/media')) {
    navigateTo('media', false);
  } else if (path.includes('/admin/calendar')) {
    navigateTo('calendar', false);
  } else {
    // Default to dashboard
    navigateTo('dashboard', false);
  }
}

function showAuthScreen() {
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
        elements.btnAuthText.textContent = 'Sign In to Dashboard';
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
          state.currentUser = res.data.user;
          updateUserProfileUI(res.data.user);
          showPortalScreen();
          navigateTo('dashboard');
          await loadAllPortalData();
        } else {
          const errMsg = res.error?.message || 'Invalid login credentials. Please check email and password.';
          showAuthFeedback(errMsg, 'error');
        }
      } else {
        // Sign Up
        const res = await signUpAdmin(email, password);
        if (res.success && res.data) {
          if (res.data.session) {
            state.currentUser = res.data.user;
            updateUserProfileUI(res.data.user);
            showPortalScreen();
            navigateTo('dashboard');
            await loadAllPortalData();
          } else {
            showAuthFeedback('Account created! Supabase may require email confirmation. Please check your inbox or sign in if confirmed.', 'success');
            // Toggle back to signin
            elements.btnToggleAuthMode.click();
          }
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
    elements.btnAuthText.textContent = state.authMode === 'signup' ? 'Create Admin Account' : 'Sign In to Dashboard';
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
function initSidebarNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page) {
        navigateTo(page);
      }
    });
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
  });

  // Update panels visibility
  const panelIdMap = {
    dashboard: 'pageDashboard',
    bookings: 'pageBookings',
    inquiries: 'pageInquiries',
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
  } else if (pageName === 'inquiries') {
    renderInquiriesTable();
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
    loadMediaData(),
    loadBlockedDatesData()
  ]);
}

async function loadAnalyticsData() {
  try {
    const summary = await fetchAnalyticsSummary();
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

    if (elements.sidebarBookingsCount) {
      elements.sidebarBookingsCount.textContent = state.bookings.length;
    }
    applyBookingFilters();
  } catch (err) {
    console.error('Failed to load bookings:', err);
    state.bookings = [];
    if (elements.sidebarBookingsCount) elements.sidebarBookingsCount.textContent = '0';
    applyBookingFilters();
  }
}

async function loadInquiriesData() {
  try {
    const res = await fetchVoyageBriefs();
    state.briefs = (res && res.success && Array.isArray(res.data)) ? res.data : [];

    if (elements.sidebarBriefsCount) {
      elements.sidebarBriefsCount.textContent = state.briefs.length;
    }
    applyBriefFilters();
  } catch (err) {
    console.error('Failed to load voyage briefs:', err);
    state.briefs = [];
    if (elements.sidebarBriefsCount) elements.sidebarBriefsCount.textContent = '0';
    applyBriefFilters();
  }
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

async function loadBlockedDatesData() {
  try {
    const res = await fetchBlockedDates();
    state.blockedDates = (res && res.success && Array.isArray(res.data)) ? res.data : [];
    renderBlockedDatesList();
  } catch (err) {
    console.error('Failed to load blocked dates:', err);
    state.blockedDates = [];
    renderBlockedDatesList();
  }
}

/* ========================================================
   5. DASHBOARD CONTROLLER (SCREENSHOT 1)
   ======================================================== */
function initDashboardHandlers() {
  if (elements.btnRefreshAnalytics) {
    elements.btnRefreshAnalytics.addEventListener('click', async () => {
      elements.btnRefreshAnalytics.disabled = true;
      elements.btnRefreshAnalytics.innerHTML = '<span>Refreshing...</span>';
      await loadAnalyticsData();
      await loadBookingsData();
      elements.btnRefreshAnalytics.disabled = false;
      elements.btnRefreshAnalytics.innerHTML = '<span>Refresh Data</span>';
    });
  }

  if (elements.btnHeaderNewBooking) {
    elements.btnHeaderNewBooking.addEventListener('click', () => {
      navigateTo('bookings');
    });
  }
}

function renderDashboard() {
  if (!state.analytics) return;
  const a = state.analytics;

  // 1. KPI Cards (100% Live metrics)
  if (elements.metricViews) elements.metricViews.textContent = Number(a.websiteViews || 0).toLocaleString('en-IN');
  if (elements.metricVisitors) elements.metricVisitors.textContent = Number(a.uniqueVisitors || 0).toLocaleString('en-IN');
  if (elements.metricBookingViews) elements.metricBookingViews.textContent = Number(a.bookingViews || 0).toLocaleString('en-IN');
  if (elements.metricClicks) elements.metricClicks.textContent = Number(a.totalHolds || 0).toLocaleString('en-IN');
  if (elements.metricCharters) elements.metricCharters.textContent = Number(a.activeHolds || 0).toLocaleString('en-IN');
  if (elements.metricTopOccasion) elements.metricTopOccasion.textContent = a.topOccasion || '—';

  // 2. Traffic Acquisition List
  if (elements.trafficList) {
    elements.trafficList.innerHTML = '';
    if (Array.isArray(a.trafficSources) && a.trafficSources.length > 0) {
      a.trafficSources.forEach(source => {
        const item = document.createElement('div');
        item.className = 'traffic-row';
        item.innerHTML = `
          <div class="traffic-row-header">
            <span class="traffic-name">${source.name}</span>
            <span class="traffic-stats"><strong>${source.count.toLocaleString('en-IN')}</strong> (${source.percentage}%)</span>
          </div>
          <div class="traffic-bar-bg">
            <div class="traffic-bar-fill" style="width: ${Math.min(100, Math.max(2, source.percentage))}%; background-color: ${source.color || '#C9A968'};"></div>
          </div>
        `;
        elements.trafficList.appendChild(item);
      });
    } else {
      elements.trafficList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--bp-mist-dark); font-size: 0.85rem;">No traffic records yet. Browse the site to log live visits.</div>';
    }
  }

  // 3. Engagement Report Table
  if (elements.engagementReportBody) {
    elements.engagementReportBody.innerHTML = '';
    if (Array.isArray(a.engagementReport) && a.engagementReport.length > 0) {
      a.engagementReport.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="engagement-product-title">${row.occasion}</td>
          <td class="text-right num-cell">${row.views.toLocaleString('en-IN')}</td>
          <td class="text-right num-cell">${row.clicks.toLocaleString('en-IN')}</td>
          <td class="text-right total-cell">${row.total}</td>
        `;
        elements.engagementReportBody.appendChild(tr);
      });
    } else {
      elements.engagementReportBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--bp-mist-dark); font-size: 0.85rem;">No occasion engagement recorded yet</td></tr>';
    }
  }
}

/* ========================================================
   6. BOOKINGS CONTROLLER (SCREENSHOT 2)
   ======================================================== */
function initBookingsHandlers() {
  // Search input live filtering
  if (elements.bookingsSearchInput) {
    elements.bookingsSearchInput.addEventListener('input', (e) => {
      state.bookingSearchQuery = e.target.value.toLowerCase().trim();
      applyBookingFilters();
    });
  }

  // Filter chips
  elements.bookingFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.bookingFilterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeBookingFilter = btn.getAttribute('data-filter') || 'all';
      applyBookingFilters();
    });
  });
}

function applyBookingFilters() {
  let list = [...state.bookings];

  // Apply status filter
  if (state.activeBookingFilter !== 'all') {
    list = list.filter(b => {
      const st = (b.status || '').toLowerCase();
      if (state.activeBookingFilter === 'held') return st.includes('held');
      if (state.activeBookingFilter === 'confirmed') return st.includes('confirmed');
      if (state.activeBookingFilter === 'completed') return st.includes('completed') || st.includes('delivered');
      return true;
    });
  }

  // Apply search query
  if (state.bookingSearchQuery) {
    const q = state.bookingSearchQuery;
    list = list.filter(b => {
      return (
        (b.id && b.id.toLowerCase().includes(q)) ||
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.email && b.email.toLowerCase().includes(q)) ||
        (b.phone && b.phone.toLowerCase().includes(q)) ||
        (b.occasion && b.occasion.toLowerCase().includes(q))
      );
    });
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
    tr.className = 'booking-table-row';

    // Status styling class
    const statusLower = (booking.status || '').toLowerCase();
    let statusPillClass = 'status-held';
    if (statusLower.includes('confirmed') || statusLower.includes('delivered')) statusPillClass = 'status-confirmed';
    else if (statusLower.includes('shipped') || statusLower.includes('active')) statusPillClass = 'status-shipped';
    else if (statusLower.includes('failed') || statusLower.includes('cancelled')) statusPillClass = 'status-failed';

    const orderIdDisplay = booking.id ? (booking.id.startsWith('#') ? booking.id : `#${booking.id}`) : '#BP-NEW';

    tr.innerHTML = `
      <td class="order-id-cell font-mono">${orderIdDisplay}</td>
      <td class="order-date-cell">${formatDisplayDate(booking.date || booking.createdAt)}</td>
      <td class="order-customer-cell">
        <div class="customer-info-line">
          <span class="customer-email">${booking.email || 'guest@blackpearl.in'}</span>
          <span class="customer-name">${booking.name || 'Private Guest'}</span>
        </div>
      </td>
      <td class="order-occasion-cell">
        <span class="occasion-tag">${booking.occasion}</span>
        <span class="slot-tag">${booking.slot || ''} (${booking.duration || '3h'})</span>
      </td>
      <td class="order-amount-cell">
        <strong>${booking.price || '₹90,000'}</strong>
        <span class="deposit-subtext">Deposit: ${booking.paidToken || '₹5,000'}</span>
      </td>
      <td class="order-status-cell">
        <div class="status-dropdown-wrapper">
          <select class="status-select-pill ${statusPillClass}" data-booking-id="${booking.id}">
            <option value="Held (Deposit Paid)" ${booking.status === 'Held (Deposit Paid)' ? 'selected' : ''}>Held</option>
            <option value="Confirmed" ${booking.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Shipped" ${booking.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${booking.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Completed" ${booking.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Failed" ${booking.status === 'Failed' ? 'selected' : ''}>Failed</option>
            <option value="Cancelled" ${booking.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </div>
      </td>
      <td class="order-contact-cell">
        <div class="email-indicator-dots" title="Email receipt confirmed">
          <span class="dot active"></span>
          <span class="dot active"></span>
          <span class="dot"></span>
        </div>
      </td>
      <td class="text-center order-action-cell">
        <button class="btn-table-icon btn-view-booking-detail" data-id="${booking.id}" title="View Order Details">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </td>
    `;

    // Status change listener
    const select = tr.querySelector('.status-select-pill');
    if (select) {
      select.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        const bId = booking.id;
        
        // Update local object
        booking.status = newStatus;

        // Visual update
        let updatedClass = 'status-held';
        const low = newStatus.toLowerCase();
        if (low.includes('confirmed') || low.includes('delivered') || low.includes('completed')) updatedClass = 'status-confirmed';
        else if (low.includes('shipped')) updatedClass = 'status-shipped';
        else if (low.includes('failed') || low.includes('cancelled')) updatedClass = 'status-failed';
        
        select.className = `status-select-pill ${updatedClass}`;

        // Persist to Supabase
        await updateBookingStatus(bId, newStatus);
        showToastNotification(`Order ${bId} status updated to ${newStatus}`);
      });
    }

    // Detail modal button listener
    const viewBtn = tr.querySelector('.btn-view-booking-detail');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        openBookingDetailModal(booking);
      });
    }

    elements.bookingsTableBody.appendChild(tr);
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
      <td class="font-medium"><strong>${brief.name || 'Private Client'}</strong></td>
      <td>
        <a href="${waLink}" target="_blank" class="contact-link whatsapp">
          ${brief.phone || 'N/A'}
        </a>
      </td>
      <td><span class="occasion-tag">${brief.occasion || 'Custom'}</span></td>
      <td><span class="charter-mode-pill">${formatCharterMode(brief.charter_mode || brief.charterMode)}</span></td>
      <td>${brief.duration || '3 Hours'}</td>
      <td class="notes-cell" title="${brief.notes || 'None'}">${brief.notes ? (brief.notes.length > 50 ? brief.notes.substring(0, 50) + '...' : brief.notes) : '—'}</td>
      <td>
        <select class="status-select-pill status-shipped" data-brief-id="${brief.id}">
          <option value="New" ${brief.status === 'New' ? 'selected' : ''}>New</option>
          <option value="Contacted" ${brief.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
          <option value="Confirmed" ${brief.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Archived" ${brief.status === 'Archived' ? 'selected' : ''}>Archived</option>
        </select>
      </td>
      <td class="text-center">
        <a href="${waLink}" target="_blank" class="btn-table-icon" title="Chat on WhatsApp">
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
    
    const displayUrl = getImageKitUrl(item.imagekit_url || item.url, { width: 450, quality: 75, format: 'auto' });

    card.innerHTML = `
      <div class="admin-media-card-thumb">
        <img src="${displayUrl}" alt="${item.title}" loading="lazy">
        <span class="media-cat-badge">${item.category || 'all'}</span>
      </div>
      <div class="admin-media-card-body">
        <h4 class="media-title">${item.title}</h4>
        <p class="media-sub">${item.subtitle || 'Private Lady Alice charter'}</p>
        <div class="media-url-row font-mono">
          <input type="text" readonly value="${item.imagekit_url || displayUrl}" class="copyable-url-input">
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
   9. CALENDAR LOCKS CONTROLLER
   ======================================================== */
function initCalendarHandlers() {
  if (!elements.btnSubmitLockDate) return;

  elements.btnSubmitLockDate.addEventListener('click', async () => {
    const dateVal = elements.lockDateInput.value;
    const reason = elements.lockReasonSelect.value;

    if (!dateVal) {
      alert('Please choose a date to lock.');
      return;
    }

    elements.btnSubmitLockDate.disabled = true;
    elements.btnSubmitLockDate.textContent = 'Locking...';

    try {
      await saveBlockedDate(dateVal, reason);
      state.blockedDates.unshift({ date: dateVal, reason });
      renderBlockedDatesList();
      showToastNotification(`Date ${dateVal} locked on booking calendar for: ${reason}`);
    } catch (err) {
      console.error('Failed to lock date:', err);
    } finally {
      elements.btnSubmitLockDate.disabled = false;
      elements.btnSubmitLockDate.textContent = 'Lock Date';
    }
  });
}

function renderBlockedDatesList() {
  if (!elements.lockedDatesList) return;
  elements.lockedDatesList.innerHTML = '';

  if (state.blockedDates.length === 0) {
    elements.lockedDatesList.innerHTML = '<p class="text-muted" style="padding: 12px 0;">No dates currently locked.</p>';
    return;
  }

  state.blockedDates.forEach(item => {
    const row = document.createElement('div');
    row.className = 'locked-date-item';
    row.innerHTML = `
      <div class="locked-date-info">
        <span class="date-badge">${item.date}</span>
        <span class="reason-text">${item.reason || 'Maintenance / Reserved'}</span>
      </div>
      <span class="lock-status-pill">Locked in Calendar</span>
    `;
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

  elements.modalBookingId.textContent = `Order Details · ${booking.id || 'BP-NEW'}`;
  
  elements.modalBookingBody.innerHTML = `
    <div class="modal-detail-grid">
      <div class="detail-field">
        <label>Customer Name</label>
        <div><strong>${booking.name || 'Private Guest'}</strong></div>
      </div>
      <div class="detail-field">
        <label>Contact Phone</label>
        <div><a href="tel:${booking.phone}" class="contact-link">${booking.phone || 'N/A'}</a></div>
      </div>
      <div class="detail-field">
        <label>Email Address</label>
        <div><a href="mailto:${booking.email}" class="contact-link">${booking.email || 'N/A'}</a></div>
      </div>
      <div class="detail-field">
        <label>City / Location</label>
        <div>${booking.address || '—'}</div>
      </div>

      <div class="detail-field">
        <label>Occasion Experience</label>
        <div><strong>${booking.occasion || '—'}</strong></div>
      </div>
      <div class="detail-field">
        <label>Charter Date</label>
        <div>${booking.date || '—'}</div>
      </div>
      <div class="detail-field">
        <label>Time Slot & Duration</label>
        <div>${booking.slot || ''}${booking.duration ? ` · ${booking.duration}` : ''}</div>
      </div>
      <div class="detail-field">
        <label>Voyage Navigation Mode</label>
        <div>${booking.voyageMode || '—'}</div>
      </div>

      <div class="detail-field">
        <label>Guest Capacity</label>
        <div>${booking.guests || 0} guests on board</div>
      </div>
      <div class="detail-field">
        <label>Total Charter Quote</label>
        <div><strong>${booking.price || '—'}</strong></div>
      </div>
      <div class="detail-field">
        <label>Deposit Paid</label>
        <div>${booking.paidToken || '—'}${booking.paymentMethod ? ` (${booking.paymentMethod})` : ''}</div>
      </div>
      ${booking.paymentId ? `
      <div class="detail-field">
        <label>Razorpay Payment ID</label>
        <div><code style="color: var(--bp-gold); font-size: 0.82rem; background: rgba(201,169,104,0.1); padding: 2px 6px; border-radius: 4px;">${booking.paymentId}</code></div>
      </div>` : ''}
      <div class="detail-field">
        <label>Current Status</label>
        <div><span class="status-select-pill status-confirmed">${booking.status || 'Held'}</span></div>
      </div>
    </div>

    ${booking.notes ? `
      <div class="detail-notes-box">
        <label>Guest Surprise / Special Instructions</label>
        <p>“${booking.notes}”</p>
      </div>
    ` : ''}

    <div class="modal-footer-actions">
      <a href="https://wa.me/${(booking.phone || '').replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(booking.name || 'Sir')},%20this%20is%20Black%20Pearl%20regarding%20booking%20${booking.id}." target="_blank" class="btn-panel-action btn-primary">
        <span>WhatsApp Guest</span>
      </a>
      <button class="btn-panel-action btn-refresh" id="btnPrintModalReceipt">
        <span>Print Manifest</span>
      </button>
    </div>
  `;

  const printBtn = elements.modalBookingBody.querySelector('#btnPrintModalReceipt');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  elements.bookingModal.style.display = 'flex';
}

function closeModal() {
  if (elements.bookingModal) {
    elements.bookingModal.style.display = 'none';
  }
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
