import confetti from 'canvas-confetti';
import {
  isSupabaseConfigured,
  saveBookingHold,
  fetchBookingHolds,
  fetchVoyageBriefs,
  saveBlockedDate,
  fetchBlockedDates,
  saveGalleryImage,
  fetchGalleryImages,
  trackPageView,
  saveCommunitySignup,
  normalizePhone
} from './supabaseClient.js';
import {
  isImageKitConfigured,
  getImageKitUrl,
  uploadImageToImageKit
} from './imageKitService.js';

/* ========================================================
   BLACK PEARL · LADY ALICE
   Main Application Logic & Booking Engine
   ======================================================== */

// --- Global State Store ---
const state = {
  selectedOccasion: 'Proposals',
  occasionBasePrice: 45000,
  voyageMode: 'paused', // 'paused' (At Anchor) or 'sailing' (Underway Cruise)
  selectedDate: '2026-11-14',
  selectedDuration: 3,
  selectedSlot: 'Sunset',
  selectedSlotTime: '4:30 pm',
  guestDetails: {
    fullName: 'Arjun Mehta',
    phone: '+91 85912 06214',
    email: 'arjun@example.com',
    address: 'Bandra West, Mumbai',
    guestCount: 2,
    notes: 'It is a surprise. Please call me, not her.'
  },
  currentMonth: 10, // 0-indexed: 10 is November
  currentYear: 2026,
  blockedDates: ['2026-11-01', '2026-11-08', '2026-11-20', '2026-11-27', '2026-11-28'],
  blockedDatesDetails: [],
  fillingDates: ['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22'],
  voyageBriefs: [],
  galleryImages: [],
  holds: [
    {
      id: 'BP-1411-027',
      occasion: 'Proposals',
      date: 'Sat, 14 Nov 2026',
      dateIso: '2026-11-14',
      slot: 'Sunset (4:30 pm)',
      duration: '3 hours',
      voyageMode: 'Paused (At Anchor)',
      guests: 2,
      price: '₹90,000',
      paidToken: '₹5,000',
      name: 'Arjun Mehta',
      phone: '+91 85912 06214',
      email: 'arjun@example.com',
      notes: 'It is a surprise. Please call me, not her.',
      status: 'Held (Deposit Paid)'
    },
    {
      id: 'BP-2111-014',
      occasion: 'Birthday parties',
      date: 'Sat, 21 Nov 2026',
      dateIso: '2026-11-21',
      slot: 'Evening (8:00 pm)',
      duration: '6 hours',
      voyageMode: 'Active Sailing (Underway)',
      guests: 45,
      price: '₹2,50,000',
      paidToken: '₹5,000',
      name: 'Pooja Singhania',
      phone: '+91 98111 22334',
      email: 'pooja@singhania.in',
      notes: '30th birthday, need DJ console on turf deck.',
      status: 'Held (Deposit Paid)'
    }
  ]
};

// Load persistent holds from localStorage if available
try {
  const saved = localStorage.getItem('black_pearl_holds');
  if (saved) {
    state.holds = JSON.parse(saved);
  }
} catch (e) {
  console.warn('LocalStorage unavailable', e);
}

function saveHoldsToStorage() {
  try {
    localStorage.setItem('black_pearl_holds', JSON.stringify(state.holds));
  } catch (e) {
    console.warn('LocalStorage write failed', e);
  }
  updateAdminView();
}

// Pricing Matrix for durations
const priceMultipliers = {
  1: 1,
  3: 2,
  6: 3.333
};

// Operational sailing surcharges for active navigation (fuel, marine propulsion & port movement)
const sailingSurcharges = {
  1: 25000,
  3: 45000,
  6: 75000
};

const baseOccasionPrices = {
  'Proposals': 45000,
  'Coastal sailing cruises': 85000,
  'Engagements': 90000,
  'Birthday parties': 75000,
  'Private parties': 75000,
  'Corporate events': 75000,
  'Something else': 75000,
  'Custom Event': 75000,
  'Anniversaries & private dinners': 55000,
  'Sunrise yoga and wellness': 40000,
  'Pre-wedding & photo shoots': 55000,
  'Festive nights': 90000,
  'Bachelor & bachelorette nights': 75000,
  'Family celebrations': 75000
};

// --- DOM Initializer ---
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initSpacesExplorer();
  initOccasionsFilter();
  initGalleryLightbox();
  initFaqAccordion();
  initBookingEngine();
  initCommunitySignup();
  initAdminPortal();
  initWaterlineAnimations();
  initSmoothParallax();
  updateAdminView();
  initSupabaseSync();
  initImageKitOptimization();

  // Track page visit in Supabase analytics
  try {
    trackPageView(window.location.pathname || '/');
  } catch (e) {
    // Analytics fail-safe
  }

  const heroVideo = document.getElementById('heroBgVideo');
  if (heroVideo) {
    heroVideo.play().catch(() => {});
  }
});

/* ========================================================
   WATERLINE DIVIDER CENTER-TO-EDGES ANIMATION
   ======================================================== */
function initWaterlineAnimations() {
  const waterlines = document.querySelectorAll('.section-waterline');
  if (!waterlines.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -20px 0px'
    });

    waterlines.forEach(line => {
      observer.observe(line);
      // Immediately trigger if already in or near viewport
      const rect = line.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        line.classList.add('in-view');
      }
    });
  } else {
    waterlines.forEach(line => line.classList.add('in-view'));
  }
}

/* ========================================================
   NAVIGATION & MOBILE DRAWER
   ======================================================== */
function initNavigation() {
  const header = document.getElementById('siteHeader');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  const drawerLinks = document.querySelectorAll('.mobile-nav-link');
  const mobileDrawerBooking = document.getElementById('mobileDrawerBookingBtn');

  // Dynamic navbar: transparent on rest, background color on scroll
  if (header) {
    const updateHeaderScroll = () => {
      if (window.scrollY > 25) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', updateHeaderScroll, { passive: true });
    updateHeaderScroll();
  }

  if (mobileBtn && drawer) {
    mobileBtn.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('open');
      if (header) {
        if (isOpen) {
          header.classList.add('drawer-open');
        } else if (window.scrollY <= 25) {
          header.classList.remove('drawer-open');
        }
      }
    });

    drawerLinks.forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        if (header && window.scrollY <= 25) {
          header.classList.remove('drawer-open');
        }
      });
    });

    if (mobileDrawerBooking) {
      mobileDrawerBooking.addEventListener('click', () => {
        drawer.classList.remove('open');
        if (header && window.scrollY <= 25) {
          header.classList.remove('drawer-open');
        }
        openBookingModal('General');
      });
    }
  }

  // Smooth scroll for nav
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetElem = document.querySelector(targetId);
      if (targetElem) {
        e.preventDefault();
        targetElem.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/* ========================================================
   SPACES & DECKS EXPLORER TABS
   ======================================================== */
function initSpacesExplorer() {
  const tabs = document.querySelectorAll('.space-tab');
  const panels = document.querySelectorAll('.space-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabKey = tab.getAttribute('data-tab');

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const targetPanel = document.getElementById(`tab-${tabKey}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  const planningHoldBtn = document.getElementById('planningHoldBtn');
  if (planningHoldBtn) {
    planningHoldBtn.addEventListener('click', () => openBookingModal('General'));
  }
}

/* ========================================================
   OCCASIONS FILTER & CARD TRIGGERS
   ======================================================== */
function initOccasionsFilter() {
  const cards = document.querySelectorAll('.occasion-card');
  const categoriesGrid = document.getElementById('occasionCategoriesGrid');
  const eventsGrid = document.getElementById('occasionsGrid');
  const drillHeader = document.getElementById('occasionsDrillHeader');
  const drillTitle = document.getElementById('occasionsDrillTitle');
  const section = document.getElementById('occasions');
  const eventCards = eventsGrid ? eventsGrid.querySelectorAll('.occasion-card') : [];

  const inCategory = (card, key) => (card.getAttribute('data-category') || '').split(/\s+/).includes(key);

  // Fill "View N Events" counts from the actual event cards
  document.querySelectorAll('[data-count-for]').forEach(el => {
    const key = el.getAttribute('data-count-for');
    el.textContent = Array.from(eventCards).filter(card => inCategory(card, key)).length;
  });

  const scrollToSection = () => {
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showCategory = (key, title) => {
    eventCards.forEach(card => {
      card.style.display = inCategory(card, key) ? 'flex' : 'none';
    });
    if (drillTitle) drillTitle.textContent = title;
    if (categoriesGrid) categoriesGrid.hidden = true;
    if (drillHeader) drillHeader.hidden = false;
    if (eventsGrid) eventsGrid.hidden = false;
    scrollToSection();
  };

  const showCategories = () => {
    if (eventsGrid) eventsGrid.hidden = true;
    if (drillHeader) drillHeader.hidden = true;
    if (categoriesGrid) categoriesGrid.hidden = false;
    scrollToSection();
  };

  document.querySelectorAll('.category-card').forEach(card => {
    const key = card.getAttribute('data-category-target');
    const title = card.querySelector('.event-card-category')?.textContent.trim() || '';
    card.addEventListener('click', () => showCategory(key, title));
  });

  document.getElementById('occasionsBackBtn')?.addEventListener('click', showCategories);

  // Card check dates buttons
  document.querySelectorAll('.btn-book-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const occasion = btn.getAttribute('data-occasion');
      openBookingModal(occasion);
    });
  });

  // Clicking anywhere on event card also opens booking modal
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-book-card')) return;
      const occasion = card.getAttribute('data-occasion') || 'Proposals';
      openBookingModal(occasion);
    });
  });

  // Footer occasion links
  document.querySelectorAll('[data-card-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetOccasion = link.textContent.trim();
      openBookingModal(targetOccasion);
    });
  });
}

/* ========================================================
   GALLERY LIGHTBOX
   ======================================================== */
function initGalleryLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  const img = document.getElementById('lightboxImg');
  const title = document.getElementById('lightboxTitle');
  const subtitle = document.getElementById('lightboxSubtitle');
  const closeBtn = document.getElementById('lightboxCloseBtn');

  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const src = item.getAttribute('data-src');
      const t = item.getAttribute('data-title');
      const sub = item.getAttribute('data-subtitle');

      img.src = src;
      title.textContent = t;
      subtitle.textContent = sub;
      overlay.classList.add('active');
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('active');
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      overlay.classList.remove('active');
    }
  });
}

/* ========================================================
   FAQ ACCORDION
   ======================================================== */
function initFaqAccordion() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.faq-item');
      const isOpen = parent.classList.contains('open');

      // Close other open questions for clean accordion feel
      document.querySelectorAll('.faq-item').forEach(item => {
        if (item !== parent) item.classList.remove('open');
      });

      if (!isOpen) {
        parent.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        parent.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/* ========================================================
   5-STEP BOOKING ENGINE
   ======================================================== */
function initBookingEngine() {
  const openBtns = [
    document.getElementById('openBookingBtn'),
    document.getElementById('heroCheckDatesBtn'),
    document.getElementById('workflowCheckDatesBtn'),
    document.getElementById('footerBookBtn'),
    document.getElementById('mobileStickyBookBtn'),
    document.getElementById('planningHoldBtn')
  ];

  openBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        const occ = btn.getAttribute('data-occasion') || 'General';
        openBookingModal(occ);
      });
    }
  });
}

function openBookingModal(occasionName = 'Proposals') {
  const occ = occasionName && occasionName !== 'General' ? occasionName : '';
  const targetUrl = occ ? `/book?occasion=${encodeURIComponent(occ)}` : '/book';
  window.location.href = targetUrl;
}

function closeBookingModal() {
  // Legacy stub for safety
}

function goToStep(stepNum) {
  // Update moving pearl position on waterline track
  const pearl = document.getElementById('movingPearl');
  const stepText = document.getElementById('stepIndicatorText');
  const stops = document.querySelectorAll('.progress-stops .stop');

  if (stepNum === 'confirmation' || stepNum === 3 || stepNum === 6) {
    if (pearl) pearl.style.left = '100%';
    if (stepText) stepText.textContent = 'Confirmed: Date Locked';
    stops.forEach(stop => stop.classList.add('active'));

    document.querySelectorAll('.booking-step').forEach(step => step.classList.remove('active'));
    const confirmStep = document.getElementById('stepConfirmation');
    if (confirmStep) confirmStep.classList.add('active');
    return;
  }

  const num = parseInt(stepNum, 10) || 1;

  if (pearl) {
    pearl.style.left = num === 1 ? '0%' : '100%';
  }

  if (stepText) {
    stepText.textContent = num === 1
      ? 'Step 1 of 2: Experience & Schedule'
      : 'Step 2 of 2: Guest Details & Payment';
  }

  stops.forEach((stop, index) => {
    if (index + 1 <= num) {
      stop.classList.add('active');
    } else {
      stop.classList.remove('active');
    }
  });

  // Switch visible step panels
  document.querySelectorAll('.booking-step').forEach(step => step.classList.remove('active'));
  const target = document.getElementById(`step${num}`);
  if (target) target.classList.add('active');

  // If entering Step 2, populate summary review
  if (num === 2) {
    populateStep2Summary();
  }
}

function updateStepLabels() {
  const label = document.getElementById('step2SelectedOccasionLabel');
  if (label) {
    label.textContent = state.selectedOccasion;
  }
}

function updatePriceCalculations() {
  const base = state.occasionBasePrice;
  const isSailing = state.voyageMode === 'sailing';
  const addon1 = isSailing ? sailingSurcharges[1] : 0;
  const addon3 = isSailing ? sailingSurcharges[3] : 0;
  const addon6 = isSailing ? sailingSurcharges[6] : 0;

  const p1 = Math.round(base * priceMultipliers[1] + addon1);
  const p3 = Math.round(base * priceMultipliers[3] + addon3);
  const p6 = Math.round(base * priceMultipliers[6] + addon6);

  const el1 = document.getElementById('durationPrice1');
  const el3 = document.getElementById('durationPrice3');
  const el6 = document.getElementById('durationPrice6');

  if (el1) el1.textContent = formatCurrency(p1);
  if (el3) el3.textContent = formatCurrency(p3);
  if (el6) el6.textContent = formatCurrency(p6);

  // Update live pricing banner in Step 1
  const activeAddon = isSailing ? (sailingSurcharges[state.selectedDuration] || 45000) : 0;
  const calculatedTotal = Math.round(base * priceMultipliers[state.selectedDuration] + activeAddon);
  const liveQuoteEl = document.getElementById('liveQuoteTotal');
  if (liveQuoteEl) liveQuoteEl.textContent = formatCurrency(calculatedTotal);

  const summaryRough = document.getElementById('summaryRoughPrice');
  if (summaryRough) summaryRough.textContent = formatCurrency(calculatedTotal);
}

function formatCurrency(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

/* ========================================================
   CALENDAR GENERATOR & REAL-TIME AVAILABILITY
   ======================================================== */
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function renderCalendar() {
  const grid = document.getElementById('calendarDaysGrid');
  const monthLabel = document.getElementById('currentMonthLabel');
  if (!grid || !monthLabel) return;

  monthLabel.textContent = `${monthNames[state.currentMonth]} ${state.currentYear}`;
  grid.innerHTML = '';

  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  // Shift Sunday from 0 to 6 (Monday starts week at 0)
  let startingDay = firstDay.getDay() - 1;
  if (startingDay === -1) startingDay = 6;

  const totalDays = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();

  // Blank slots for days before 1st of month
  for (let i = 0; i < startingDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day-cell empty';
    grid.appendChild(blank);
  }

  // Days of current month
  for (let day = 1; day <= totalDays; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const mStr = (state.currentMonth + 1) < 10 ? `0${state.currentMonth + 1}` : `${state.currentMonth + 1}`;
    const dateIso = `${state.currentYear}-${mStr}-${dayStr}`;

    const cell = document.createElement('button');
    cell.className = 'cal-day-cell';
    cell.setAttribute('type', 'button');
    cell.textContent = day;

    const dot = document.createElement('span');
    dot.className = 'day-dot';

    const isBlocked = state.blockedDates.includes(dateIso);
    const isFilling = state.fillingDates.includes(dateIso);
    const isSelected = state.selectedDate === dateIso;

    if (isBlocked) {
      cell.classList.add('disabled');
      dot.classList.add('booked');
      cell.title = 'Date is fully booked or undergoing maintenance';
    } else if (isFilling) {
      dot.classList.add('filling');
      cell.title = 'Few slots remaining on this date';
    } else {
      dot.classList.add('free');
      cell.title = 'All sailing slots open';
    }

    if (isSelected) {
      cell.classList.add('selected');
    }

    cell.appendChild(dot);

    if (!isBlocked) {
      cell.addEventListener('click', () => {
        document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        state.selectedDate = dateIso;
        updateSelectedDateBanner(day, state.currentMonth, state.currentYear, isFilling);
      });
    }

    grid.appendChild(cell);
  }

  // Initial banner update
  const selectedParts = state.selectedDate.split('-');
  const d = parseInt(selectedParts[2], 10);
  const isFill = state.fillingDates.includes(state.selectedDate);
  updateSelectedDateBanner(d, state.currentMonth, state.currentYear, isFill);
}

function updateSelectedDateBanner(day, monthIdx, year, isFilling) {
  const title = document.getElementById('statusDateTitle');
  const count = document.getElementById('statusDateSlotsCount');
  const sub3 = document.getElementById('step3DateSubtitle');

  const dateObj = new Date(year, monthIdx, day);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const mName = monthNames[monthIdx];
  const formattedStr = `${dayName}, ${day} ${mName} ${year}`;

  if (title) title.textContent = formattedStr;
  if (sub3) sub3.textContent = formattedStr;
  if (count) {
    count.textContent = isFilling ? '3 of 4 slots free' : 'Every slot on this date is open';
  }
}

/* ========================================================
   GUEST DETAILS FORM VALIDATION (STEP 2)
   ======================================================== */
function validateGuestForm() {
  const nameEl = document.getElementById('guestFullName');
  const phoneEl = document.getElementById('guestPhone');
  const emailEl = document.getElementById('guestEmail');
  const countEl = document.getElementById('guestCount');
  const notesEl = document.getElementById('guestNotes');
  const errBox = document.getElementById('formErrorMsg');

  const name = nameEl ? nameEl.value.trim() : '';
  const phone = phoneEl ? phoneEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const count = countEl ? parseInt(countEl.value, 10) : 2;
  const notes = notesEl ? notesEl.value.trim() : '';

  if (!name) {
    showFormError('Please enter your full name so our team knows who to address.');
    if (nameEl) nameEl.focus();
    return false;
  }
  if (!phone || phone.replace(/\D/g, '').length < 9) {
    showFormError('Please enter a valid WhatsApp mobile number for booking confirmation.');
    if (phoneEl) phoneEl.focus();
    return false;
  }
  if (!email || !email.includes('@')) {
    showFormError('Please enter a valid email address for your official receipt.');
    if (emailEl) emailEl.focus();
    return false;
  }
  if (!count || count < 1 || count > 100) {
    showFormError('Guest count must be between 1 and 100 guests.');
    if (countEl) countEl.focus();
    return false;
  }

  if (errBox) errBox.style.display = 'none';

  state.guestDetails = {
    fullName: name,
    phone,
    email,
    address: '',
    guestCount: count,
    notes: notes || 'None'
  };

  return true;
}

function showFormError(msg) {
  const errBox = document.getElementById('formErrorMsg');
  if (errBox) {
    errBox.textContent = msg;
    errBox.style.display = 'block';
  }
}

/* ========================================================
   STEP 2 SUMMARY & RAZORPAY PAYMENT ENGINE
   ======================================================== */
function populateStep2Summary() {
  const isSailing = state.voyageMode === 'sailing';
  const sailingAddon = isSailing ? (sailingSurcharges[state.selectedDuration] || 45000) : 0;
  const calculatedTotal = Math.round(state.occasionBasePrice * priceMultipliers[state.selectedDuration] + sailingAddon);

  const occEl = document.getElementById('summaryOccasion');
  if (occEl) occEl.textContent = state.selectedOccasion;

  const dateObj = new Date(state.selectedDate);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const mName = monthNames[dateObj.getMonth()].substring(0, 3);
  const dateEl = document.getElementById('summaryDate');
  if (dateEl) dateEl.textContent = `${dayName}, ${dateObj.getDate()} ${mName} ${dateObj.getFullYear()}`;

  const slotEl = document.getElementById('summarySlot');
  if (slotEl) slotEl.textContent = `${state.selectedSlot}, ${state.selectedSlotTime}`;

  const durEl = document.getElementById('summaryDuration');
  if (durEl) durEl.textContent = `${state.selectedDuration} hours`;

  const modeEl = document.getElementById('summaryVoyageMode');
  if (modeEl) {
    modeEl.textContent = isSailing ? 'Active Sailing (Underway)' : 'Paused (At Anchor)';
  }

  const countInput = document.getElementById('guestCount');
  const countVal = countInput ? countInput.value : (state.guestDetails.guestCount || 2);
  const guestsEl = document.getElementById('summaryGuests');
  if (guestsEl) guestsEl.textContent = `${countVal} guests`;

  const roughEl = document.getElementById('summaryRoughPrice');
  if (roughEl) roughEl.textContent = formatCurrency(calculatedTotal);
}

function handleRazorpayPayment() {
  const payBtn = document.getElementById('btnPay5000');
  const payText = document.getElementById('btnPayText');
  const errBox = document.getElementById('formErrorMsg');

  if (!validateGuestForm()) {
    return;
  }

  if (payBtn) payBtn.disabled = true;
  if (payText) payText.textContent = 'Connecting to Razorpay...';

  // Read Razorpay Key from environment variables
  const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;

  // Generate authentic booking reference code: BP-{DDMM}-{RANDOM}
  const dateObj = new Date(state.selectedDate);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const randNum = String(Math.floor(10 + Math.random() * 90));
  const bookingCode = `BP-${dd}${mm}-${randNum}`;

  // Check if Razorpay Checkout script is loaded and a configured key exists
  const hasRealKey = rzpKey && rzpKey.trim().length > 0 && !rzpKey.includes('your_razorpay_key');

  if (typeof window.Razorpay === 'function' && hasRealKey) {
    try {
      const options = {
        key: rzpKey.trim(),
        amount: 5000 * 100, // ₹5,000 in paise (500000)
        currency: 'INR',
        name: 'Black Pearl · Lady Alice',
        description: `${state.selectedOccasion} - Date Lock Deposit (Ref: ${bookingCode})`,
        image: '/assets/black-pearl-mark.svg',
        prefill: {
          name: state.guestDetails.fullName,
          email: state.guestDetails.email,
          contact: state.guestDetails.phone.replace(/[^0-9]/g, '').slice(-10)
        },
        notes: {
          booking_code: bookingCode,
          occasion: state.selectedOccasion,
          charter_date: state.selectedDate,
          slot: `${state.selectedSlot} (${state.selectedSlotTime})`,
          duration: `${state.selectedDuration} hours`,
          voyage_mode: state.voyageMode === 'sailing' ? 'Active Sailing' : 'Paused (At Anchor)',
          guest_count: state.guestDetails.guestCount
        },
        theme: {
          color: '#C9A968' // Black Pearl Champagne Gold
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay] Checkout dismissed by guest.');
            if (payBtn) payBtn.disabled = false;
            if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay';
          }
        },
        handler: function (response) {
          console.log('[Razorpay] Payment successful! Payment ID:', response.razorpay_payment_id);
          const paymentId = response.razorpay_payment_id || `pay_${Date.now()}`;
          completeBookingAndCelebrate(bookingCode, paymentId);
          if (payBtn) payBtn.disabled = false;
          if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay';
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', function (resp) {
        console.error('[Razorpay] Payment failed:', resp.error);
        if (errBox) {
          errBox.textContent = `Payment failed: ${resp.error.description || 'Transaction was declined.'} Please try again.`;
          errBox.style.display = 'block';
        }
        if (payBtn) payBtn.disabled = false;
        if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay';
      });

      rzpInstance.open();
      return;
    } catch (err) {
      console.warn('[Razorpay] Exception opening checkout:', err);
    }
  }

  // Gateway unavailable or credentials not set
  console.warn('[Razorpay] Payment gateway unavailable or credentials missing.');
  if (errBox) {
    errBox.textContent = 'Payment gateway is currently unavailable. Please contact our concierge directly or book online at /book.';
    errBox.style.display = 'block';
  }
  if (payBtn) payBtn.disabled = false;
  if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay';
}

function completeBookingAndCelebrate(bookingCode, paymentId = 'pay_verified') {
  const dateObj = new Date(state.selectedDate);
  const isSailing = state.voyageMode === 'sailing';
  const sailingAddon = isSailing ? (sailingSurcharges[state.selectedDuration] || 45000) : 0;
  const calculatedTotal = Math.round(state.occasionBasePrice * priceMultipliers[state.selectedDuration] + sailingAddon);

  const newHold = {
    id: bookingCode,
    occasion: state.selectedOccasion,
    date: `${dateObj.toLocaleDateString('en-US', { weekday: 'short' })}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`,
    dateIso: state.selectedDate,
    slot: `${state.selectedSlot} (${state.selectedSlotTime})`,
    duration: `${state.selectedDuration} hours`,
    voyageMode: isSailing ? 'Active Sailing (Underway)' : 'Paused (At Anchor)',
    guests: state.guestDetails.guestCount,
    price: formatCurrency(calculatedTotal),
    paidToken: '₹5,000',
    paymentMethod: 'razorpay',
    paymentId: paymentId,
    name: state.guestDetails.fullName,
    phone: state.guestDetails.phone,
    email: state.guestDetails.email,
    address: '',
    notes: state.guestDetails.notes || 'None',
    status: 'Held (Deposit Paid)'
  };

  // Add to active holds and mark date as filling or booked
  state.holds.unshift(newHold);
  if (!state.fillingDates.includes(state.selectedDate)) {
    state.fillingDates.push(state.selectedDate);
  }
  saveHoldsToStorage();

  // Asynchronously persist to Supabase
  saveBookingHold(newHold)
    .then(res => {
      if (res.success && res.source === 'supabase') {
        console.log('[Black Pearl] Booking stored in Supabase with ID:', res.data.id);
      } else {
        console.info('[Black Pearl] Booking stored in local storage:', res);
      }
    })
    .catch(err => console.error('Error storing booking in Supabase:', err));

  // Populate Confirmation Screen
  const refEl = document.getElementById('confirmedBookingRef');
  if (refEl) refEl.textContent = `Booking ${bookingCode}`;

  const rOcc = document.getElementById('rOccasion');
  if (rOcc) rOcc.textContent = newHold.occasion;

  const rDt = document.getElementById('rDate');
  if (rDt) rDt.textContent = newHold.date;

  const rSl = document.getElementById('rSlot');
  if (rSl) rSl.textContent = `${newHold.slot} · ${newHold.duration}`;

  const rMode = document.getElementById('rVoyageMode');
  if (rMode) rMode.textContent = newHold.voyageMode;

  const rGst = document.getElementById('rGuest');
  if (rGst) rGst.textContent = newHold.name;

  const rPh = document.getElementById('rPhone');
  if (rPh) rPh.textContent = newHold.phone;

  const rPayId = document.getElementById('rPaymentId');
  if (rPayId) rPayId.textContent = paymentId;

  // WhatsApp direct team prefilled link
  const waBtn = document.getElementById('btnChatWaConfirmation');
  if (waBtn) {
    const waText = encodeURIComponent(`Hello Black Pearl team, I have just secured date ${newHold.date} for our ${newHold.occasion} on Lady Alice (Deposit ₹5,000 paid via Razorpay). My booking code is ${bookingCode} (Payment ID: ${paymentId}). Please call me on ${newHold.phone} to plan the evening.`);
    waBtn.href = `https://wa.me/918591206214?text=${waText}`;
  }

  // Go to confirmation step
  goToStep('confirmation');

  // Trigger champagne gold & pearl confetti burst
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#EBD7A6', '#C9A968', '#F3EDE0', '#C6A462', '#8F6F33']
  });
}

/* ========================================================
   ICALENDAR (.ICS) FILE GENERATOR
   ======================================================== */
function generateICalendarFile() {
  const currentHold = state.holds[0];
  if (!currentHold) return;

  const dateParts = currentHold.dateIso.split('-');
  const y = dateParts[0];
  const m = dateParts[1];
  const d = dateParts[2];

  // Set start hour according to slot
  let hour = '16';
  let min = '30';
  if (currentHold.slot.includes('Sunrise')) { hour = '06'; min = '00'; }
  if (currentHold.slot.includes('Afternoon')) { hour = '12'; min = '00'; }
  if (currentHold.slot.includes('Evening')) { hour = '20'; min = '00'; }

  const startTime = `${y}${m}${d}T${hour}${min}00`;
  const durHours = parseInt(currentHold.duration, 10) || 3;
  const endHour = String(parseInt(hour, 10) + durHours).padStart(2, '0');
  const endTime = `${y}${m}${d}T${endHour}${min}00`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Black Pearl//Lady Alice Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:Lady Alice · ${currentHold.occasion} (${currentHold.id})`,
    `DESCRIPTION:Private celebration on board Lady Alice luxury yacht in Mumbai harbour. One booking at a time. Held with Black Pearl.\\nBooking ID: ${currentHold.id}\\nGuest: ${currentHold.name}\\nDuration: ${currentHold.duration}`,
    'LOCATION:Jetty No. 2, Princess Ferry Wharf (Bhaucha Dhakka), Mazgaon, Mumbai 400010',
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Lady_Alice_${currentHold.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========================================================
   CREW & ADMIN MANAGEMENT PORTAL
   ======================================================== */
/* ========================================================
   CREW & ADMIN MANAGEMENT PORTAL (SUPABASE + IMAGEKIT)
   ======================================================== */
function initAdminPortal() {
  const modal = document.getElementById('adminModal');
  const trigger = document.getElementById('crewPortalTrigger');
  const closeBtn = document.getElementById('adminCloseBtn');
  const blockBtn = document.getElementById('btnAdminBlockDate');
  const resetBtn = document.getElementById('adminResetDemoData');
  const refreshHoldsBtn = document.getElementById('btnAdminRefreshHolds');
  const refreshBriefsBtn = document.getElementById('btnAdminRefreshBriefs');
  const mediaForm = document.getElementById('adminMediaUploadForm');

  // Navigation Tabs (Holds, Briefs, Media, Calendar)
  const tabs = document.querySelectorAll('.admin-nav-tab');
  const panels = {
    holds: document.getElementById('adminPanelHolds'),
    briefs: document.getElementById('adminPanelBriefs'),
    media: document.getElementById('adminPanelMedia'),
    calendar: document.getElementById('adminPanelCalendar')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-admin-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      Object.keys(panels).forEach(key => {
        if (panels[key]) {
          panels[key].classList.toggle('active', key === target);
        }
      });
    });
  });

  if (trigger) {
    trigger.addEventListener('click', () => {
      updateAdminView();
      updateAdminBriefsView();
      updateAdminMediaView();
      updateAdminBlockedDatesView();
      updateConnectionBadges();
      modal.classList.add('active');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Keyboard shortcut: Shift + A to open Crew Portal
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      updateAdminView();
      updateAdminBriefsView();
      updateAdminMediaView();
      updateAdminBlockedDatesView();
      updateConnectionBadges();
      modal.classList.toggle('active');
    }
  });

  // Supabase Manual Refresh Buttons
  if (refreshHoldsBtn) {
    refreshHoldsBtn.addEventListener('click', async () => {
      refreshHoldsBtn.disabled = true;
      refreshHoldsBtn.textContent = 'Refreshing...';
      const res = await fetchBookingHolds();
      if (res.success && res.data.length > 0) {
        state.holds = res.data;
        saveHoldsToStorage();
        updateAdminView();
      }
      refreshHoldsBtn.disabled = false;
      refreshHoldsBtn.textContent = 'Refresh from Supabase';
    });
  }

  if (refreshBriefsBtn) {
    refreshBriefsBtn.addEventListener('click', async () => {
      refreshBriefsBtn.disabled = true;
      refreshBriefsBtn.textContent = 'Refreshing...';
      const res = await fetchVoyageBriefs();
      if (res.success) {
        state.voyageBriefs = res.data;
        updateAdminBriefsView();
      }
      refreshBriefsBtn.disabled = false;
      refreshBriefsBtn.textContent = 'Refresh from Supabase';
    });
  }

  // Block Date Form (persisted to Supabase)
  if (blockBtn) {
    blockBtn.addEventListener('click', async () => {
      const dateVal = document.getElementById('adminBlockDateInput').value;
      const reason = document.getElementById('adminBlockReason').value;
      if (!dateVal) {
        alert('Please choose a date to block.');
        return;
      }

      if (!state.blockedDates.includes(dateVal)) {
        state.blockedDates.push(dateVal);
      }
      state.blockedDatesDetails.push({ date: dateVal, reason });

      blockBtn.disabled = true;
      blockBtn.textContent = 'Saving...';

      try {
        await saveBlockedDate(dateVal, reason);
      } catch (err) {
        console.warn('Blocked date saved locally:', err);
      }

      blockBtn.disabled = false;
      blockBtn.textContent = 'Block Date';
      renderCalendar();
      updateAdminBlockedDatesView();
      alert(`Date ${dateVal} is now locked in calendar for: ${reason}`);
    });
  }

  // ImageKit Media Uploader Form
  if (mediaForm) {
    mediaForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('mediaTitleInput').value.trim();
      const category = document.getElementById('mediaCategorySelect').value;
      const subtitle = document.getElementById('mediaSubtitleInput').value.trim();
      const fileInput = document.getElementById('mediaFileInput');
      const urlInput = document.getElementById('mediaUrlInput').value.trim();
      const submitBtn = document.getElementById('btnAdminUploadMedia');
      const feedback = document.getElementById('mediaUploadFeedback');

      const file = fileInput.files && fileInput.files[0];
      const source = file || urlInput;

      if (!title) {
        alert('Please provide an image title.');
        return;
      }

      if (!source) {
        alert('Please select an image file or provide an ImageKit / web image URL.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Uploading to ImageKit & Saving to Supabase...</span>';
      feedback.style.display = 'none';

      try {
        const fileName = file ? file.name : `lady_alice_${category}_${Date.now()}.jpg`;
        const ikRes = await uploadImageToImageKit(source, fileName, { tags: ['lady-alice', category] });

        const imageRecord = {
          title,
          subtitle: subtitle || 'Private celebration on Lady Alice',
          category,
          imagekitUrl: ikRes.url,
          fileId: ikRes.fileId || '',
          thumbnailUrl: ikRes.thumbnailUrl || ikRes.url
        };

        const spRes = await saveGalleryImage(imageRecord);
        state.galleryImages.unshift(imageRecord);

        // Append dynamically to live gallery on the website
        renderDynamicGalleryImages([imageRecord]);
        updateAdminMediaView();

        feedback.className = 'upload-feedback-msg success';
        feedback.textContent = `Image "${title}" successfully processed with ImageKit & saved to Supabase!`;
        feedback.style.display = 'block';

        mediaForm.reset();
      } catch (err) {
        console.error('Image upload failed:', err);
        feedback.className = 'upload-feedback-msg error';
        feedback.textContent = `Upload issue: ${err.message || 'Please check ImageKit and Supabase config'}`;
        feedback.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Upload to ImageKit & Save to Supabase</span>';
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('black_pearl_holds');
      window.location.reload();
    });
  }
}

function updateConnectionBadges() {
  const sbStatus = document.getElementById('adminSupabaseStatus');
  const ikStatus = document.getElementById('adminImageKitStatus');
  const footerSync = document.getElementById('adminFooterSyncText');

  const sbConnected = isSupabaseConfigured();
  const ikConnected = isImageKitConfigured();

  if (sbStatus) {
    if (sbConnected) {
      sbStatus.className = 'admin-conn-pill connected';
      sbStatus.textContent = 'Supabase: Live Database';
    } else {
      sbStatus.className = 'admin-conn-pill standby';
      sbStatus.textContent = 'Supabase: Waiting for .env';
    }
  }

  if (ikStatus) {
    if (ikConnected) {
      ikStatus.className = 'admin-conn-pill connected';
      ikStatus.textContent = 'ImageKit: Active CDN';
    } else {
      ikStatus.className = 'admin-conn-pill standby';
      ikStatus.textContent = 'ImageKit: Local Fallback';
    }
  }

  if (footerSync) {
    footerSync.textContent = sbConnected && ikConnected
      ? 'Fully Live: Supabase Datastore & ImageKit Media CDN Connected'
      : 'Configuration Ready: Set VITE_SUPABASE_* & VITE_IMAGEKIT_* in .env to go live';
  }
}

function updateAdminView() {
  const list = document.getElementById('adminBookingsList');
  const countPill = document.getElementById('adminActiveHoldsCount');
  const badgeCount = document.getElementById('crewBadgeCount');
  const depositPill = document.getElementById('adminDepositsValue');

  if (countPill) countPill.textContent = state.holds.length;
  if (badgeCount) badgeCount.textContent = `${state.holds.length} Holds`;
  if (depositPill) depositPill.textContent = `₹${(state.holds.length * 5000).toLocaleString('en-IN')}`;

  if (!list) return;
  list.innerHTML = '';

  if (state.holds.length === 0) {
    list.innerHTML = '<p style="color: var(--smoke); font-size: 13px; padding: 12px 0;">No active holds yet. Holds submitted on the site will appear here.</p>';
    return;
  }

  state.holds.forEach(hold => {
    const row = document.createElement('div');
    row.className = 'admin-booking-row';
    row.innerHTML = `
      <div class="admin-booking-info">
        <h5>${hold.occasion} · <strong>${hold.name}</strong></h5>
        <p>${hold.date} (${hold.slot}, ${hold.duration}${hold.voyageMode ? ' · ' + hold.voyageMode : ''}) · ${hold.guests} guests</p>
        <p>${hold.phone} · ${hold.email} ${hold.address ? '· ' + hold.address : ''}</p>
        ${hold.notes ? '<p style="margin-top:4px; font-style:italic; color: var(--gold);">Notes: ' + hold.notes + '</p>' : ''}
      </div>
      <div class="admin-booking-meta">
        <span class="admin-booking-status">${hold.status || 'Held'}</span>
        <div style="font-family: var(--font-heading); color: var(--gold); font-size: 16px;">${hold.id}</div>
        <div style="font-size: 12px; color: var(--mist);">Deposit: ${hold.paidToken || '₹5,000'} (${hold.paymentMethod || 'upi'})</div>
      </div>
    `;
    list.appendChild(row);
  });
}

function updateAdminBriefsView() {
  const list = document.getElementById('adminBriefsList');
  const countPill = document.getElementById('adminBriefsCount');

  if (countPill) countPill.textContent = state.voyageBriefs.length;
  if (!list) return;

  list.innerHTML = '';
  if (state.voyageBriefs.length === 0) {
    list.innerHTML = '<p style="color: var(--smoke); font-size: 13px; padding: 12px 0;">No bespoke voyage briefs received yet. Submissions from the "Sail or Rest in Ocean" form will appear here.</p>';
    return;
  }

  state.voyageBriefs.forEach(brief => {
    const card = document.createElement('div');
    card.className = 'admin-brief-card';
    card.innerHTML = `
      <div>
        <h5>${brief.name} · <span style="color: var(--gold);">${brief.occasion}</span></h5>
        <p><strong>${brief.phone}</strong> · ${brief.duration === 'custom' ? 'Custom Hours' : brief.duration + ' Hours'}</p>
        <p>Notes: ${brief.notes || 'None'}</p>
        <span class="admin-brief-mode-tag">Slot: ${brief.charterMode || brief.charter_mode || '—'}</span>
      </div>
      <div style="text-align: right;">
        <span class="admin-booking-status">${brief.status || 'New Brief'}</span>
        <div style="font-size: 11px; color: var(--smoke); margin-top: 6px;">
          ${brief.created_at ? new Date(brief.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today'}
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

function updateAdminMediaView() {
  const grid = document.getElementById('adminMediaGrid');
  const countPill = document.getElementById('adminMediaCount');

  if (countPill) countPill.textContent = state.galleryImages.length;
  if (!grid) return;

  grid.innerHTML = '';
  if (state.galleryImages.length === 0) {
    grid.innerHTML = '<p style="color: var(--smoke); font-size: 13px; grid-column: 1 / -1;">No user-uploaded images in Supabase yet. Use the form above to upload images via ImageKit.</p>';
    return;
  }

  state.galleryImages.forEach(img => {
    const card = document.createElement('div');
    card.className = 'admin-media-card';
    const ikUrl = getImageKitUrl(img.imagekit_url || img.imagekitUrl || img.url, { width: 300, height: 200, quality: 75 });
    card.innerHTML = `
      <img src="${ikUrl}" alt="${img.title}" loading="lazy">
      <div class="admin-media-card-body">
        <div class="admin-media-card-cat">${img.category}</div>
        <div class="admin-media-card-title">${img.title}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function updateAdminBlockedDatesView() {
  const list = document.getElementById('adminBlockedDatesList');
  if (!list) return;

  list.innerHTML = '';
  const dates = state.blockedDatesDetails.length > 0
    ? state.blockedDatesDetails
    : state.blockedDates.map(d => ({ date: d, reason: 'Maintenance / Reserved' }));

  dates.forEach(item => {
    const row = document.createElement('div');
    row.className = 'admin-blocked-date-item';
    row.innerHTML = `
      <span><strong>${item.date}</strong> — ${item.reason}</span>
      <span style="font-size: 11px; color: var(--gold); border: 1px solid var(--gold-deep); padding: 2px 6px; border-radius: 4px;">Locked</span>
    `;
    list.appendChild(row);
  });
}

/* ========================================================
   HARDWARE-ACCELERATED SMOOTH GPU MOBILE & DESKTOP PARALLAX
   Uses requestAnimationFrame + CSS translate3d custom property
   IntersectionObserver pauses calculation when off-screen (60fps)
   ======================================================== */
function initSmoothParallax() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const parallaxSections = document.querySelectorAll('.section-occasions, .section-voyage-brief, .section-gallery');
  if (!parallaxSections.length) return;

  const activeSections = new Set();
  let ticking = false;

  function updateParallax() {
    ticking = false;
    if (activeSections.size === 0) return;

    const vCenter = window.innerHeight * 0.5;
    const isMobile = window.innerWidth <= 768;
    const speed = isMobile ? 0.16 : 0.22;

    activeSections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height * 0.5;
      const diff = sectionCenter - vCenter;

      // Maximum travel bound based on oversized ::before element (140% height, top: -20%)
      const maxShift = rect.height * 0.18;
      const rawY = -diff * speed;
      const clampedY = Math.max(-maxShift, Math.min(maxShift, rawY));

      section.style.setProperty('--parallax-y', `${clampedY.toFixed(1)}px`);
    });
  }

  function requestTick() {
    if (!ticking && activeSections.size > 0) {
      ticking = true;
      requestAnimationFrame(updateParallax);
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          activeSections.add(entry.target);
          requestTick();
        } else {
          activeSections.delete(entry.target);
        }
      });
    }, {
      rootMargin: '120px 0px 120px 0px',
      threshold: 0
    });

    parallaxSections.forEach(section => observer.observe(section));
  } else {
    // Fallback if IntersectionObserver is not available
    parallaxSections.forEach(section => activeSections.add(section));
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick, { passive: true });
  window.addEventListener('orientationchange', requestTick, { passive: true });

  // Initial calculation after layout settles
  requestTick();
}

/* ========================================================
   SUPABASE LIVE DATA SYNCHRONIZATION
   ======================================================== */
async function initSupabaseSync() {
  updateConnectionBadges();

  if (!isSupabaseConfigured()) {
    console.info('Supabase credentials not set in .env yet. Running in offline/fallback mode.');
    return;
  }

  try {
    // 1. Fetch Blocked Dates from Supabase
    const blockedRes = await fetchBlockedDates();
    if (blockedRes.success && Array.isArray(blockedRes.data) && blockedRes.data.length > 0) {
      state.blockedDatesDetails = blockedRes.data;
      const remoteDates = blockedRes.data.map(item => item.date);
      state.blockedDates = Array.from(new Set([...state.blockedDates, ...remoteDates]));
      renderCalendar();
      updateAdminBlockedDatesView();
    }

    // 2. Fetch Active Holds from Supabase
    const holdsRes = await fetchBookingHolds();
    if (holdsRes.success && Array.isArray(holdsRes.data) && holdsRes.data.length > 0) {
      state.holds = holdsRes.data;
      saveHoldsToStorage();
      holdsRes.data.forEach(h => {
        if (h.dateIso && !state.fillingDates.includes(h.dateIso)) {
          state.fillingDates.push(h.dateIso);
        }
      });
      renderCalendar();
      updateAdminView();
    }

    // 3. Fetch Voyage Charter Briefs from Supabase
    const briefsRes = await fetchVoyageBriefs();
    if (briefsRes.success && Array.isArray(briefsRes.data)) {
      state.voyageBriefs = briefsRes.data;
      updateAdminBriefsView();
    }

    // 4. Fetch Dynamic Gallery Images from Supabase & Local Cache
    let allGallery = [];
    try {
      const cached = JSON.parse(localStorage.getItem('black_pearl_gallery') || '[]');
      if (Array.isArray(cached)) allGallery.push(...cached);
    } catch (_) {}

    const galleryRes = await fetchGalleryImages();
    if (galleryRes.success && Array.isArray(galleryRes.data) && galleryRes.data.length > 0) {
      allGallery.push(...galleryRes.data);
    }

    if (allGallery.length > 0) {
      state.galleryImages = allGallery;
      renderDynamicGalleryImages(allGallery);
      updateAdminMediaView();
    }
  } catch (err) {
    console.error('Error during Supabase synchronization:', err);
  }
}

/* ========================================================
   IMAGEKIT REAL-TIME CDN OPTIMIZATION & TRANSFORMATION
   ======================================================== */
function initImageKitOptimization() {
  if (!isImageKitConfigured()) {
    return;
  }

  console.log('[ImageKit] Active CDN detected. Optimizing site media...');

  // Optimize static images with ImageKit CDN with fail-safe local fallback
  const imgElements = document.querySelectorAll('img[src^="/assets/images/"], img[src^="assets/images/"]');
  imgElements.forEach(img => {
    const rawSrc = img.getAttribute('src');
    if (!rawSrc) return;

    // Attach immediate onerror handler so if ImageKit returns 404, the local image is displayed seamlessly
    img.onerror = function() {
      this.onerror = null; // Prevent loop
      console.warn(`[ImageKit] Asset not found in ImageKit media library yet. Loading local: ${rawSrc}`);
      this.src = rawSrc;
    };

    const optimized = getImageKitUrl(rawSrc, { quality: 80, format: 'auto' });
    if (optimized && optimized !== rawSrc) {
      img.src = optimized;
    }
  });

  // Optimize hero video poster
  const heroVideo = document.getElementById('heroBgVideo');
  if (heroVideo) {
    const poster = heroVideo.getAttribute('poster');
    if (poster && poster.includes('assets/images/')) {
      const origPoster = poster;
      const imgTest = new Image();
      imgTest.onerror = () => {
        heroVideo.poster = origPoster;
      };
      const optPoster = getImageKitUrl(poster, { width: 1400, quality: 75, format: 'auto' });
      imgTest.onload = () => {
        heroVideo.poster = optPoster;
      };
      imgTest.src = optPoster;
    }
  }
}

/* ========================================================
   DYNAMIC GALLERY RENDERER (SUPABASE + IMAGEKIT)
   ======================================================== */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function sanitizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^(https?:|\/|data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,)/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function renderDynamicGalleryImages(images) {
  const galleryGrid = document.querySelector('.gallery-grid');
  if (!Array.isArray(images) || images.length === 0) return;

  images.forEach(img => {
    const rawUrl = img.imagekit_url || img.imagekitUrl || img.url || img.thumbnailUrl;
    if (!rawUrl) return;

    const validatedRaw = sanitizeMediaUrl(rawUrl);
    if (!validatedRaw) return;

    const displayUrl = validatedRaw.startsWith('data:') ? validatedRaw : getImageKitUrl(validatedRaw, { width: 800, quality: 80, format: 'auto' });
    const thumbUrl = validatedRaw.startsWith('data:') ? validatedRaw : getImageKitUrl(validatedRaw, { width: 400, quality: 75, format: 'auto' });

    if (galleryGrid) {
      const imgId = String(img.id || img.file_id || img.fileId || '');
      const existing = imgId ? galleryGrid.querySelector(`[data-img-id="${escapeHtml(imgId)}"]`) : null;
      if (!existing) {
        const item = document.createElement('div');
        item.className = 'gallery-item span-sq';
        if (imgId) item.setAttribute('data-img-id', imgId);
        item.setAttribute('data-src', displayUrl);
        item.setAttribute('data-title', img.title || '');
        item.setAttribute('data-subtitle', img.subtitle || 'Private celebration on Lady Alice');
        item.innerHTML = `
          <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(img.title || 'Lady Alice charter')}" loading="lazy">
          <div class="gallery-overlay">
            <span class="overlay-tag">Celebration · ${escapeHtml(img.category || 'Special')}</span>
            <h4 class="overlay-title">${escapeHtml(img.title || '')}</h4>
            <p class="overlay-desc">${escapeHtml(img.subtitle || 'Private charter on Lady Alice')}</p>
            <span class="expand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
            </span>
          </div>
        `;

        item.addEventListener('click', () => {
          const overlay = document.getElementById('lightboxOverlay');
          const lightboxImg = document.getElementById('lightboxImg');
          const title = document.getElementById('lightboxTitle');
          const subtitle = document.getElementById('lightboxSubtitle');
          if (overlay && lightboxImg) {
            lightboxImg.src = displayUrl;
            if (title) title.textContent = img.title || '';
            if (subtitle) subtitle.textContent = img.subtitle || '';
            overlay.classList.add('active');
          }
        });
        galleryGrid.prepend(item);
      }
    }
  });

  // Strictly enforce 9 photos max on home page gallery
  if (galleryGrid) {
    const MAX_HOME_PHOTOS = 9;
    const items = galleryGrid.querySelectorAll('.gallery-item');
    if (items.length > MAX_HOME_PHOTOS) {
      for (let i = MAX_HOME_PHOTOS; i < items.length; i++) {
        items[i].remove();
      }
    }
  }
}

/* ========================================================
   COMMUNITY SIGN-UP (WHATSAPP BROADCAST LIST)
   ======================================================== */
function initCommunitySignup() {
  const form = document.getElementById('communitySignupForm');
  if (!form) return;

  const feedback = document.getElementById('communityFeedback');
  const submitBtn = document.getElementById('btnCommunitySubmit');
  const originalText = submitBtn.innerHTML;

  const showFeedback = (msg, isError = false) => {
    feedback.textContent = msg;
    feedback.classList.toggle('is-error', isError);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('communityName').value.trim();
    const phone = document.getElementById('communityPhone').value.trim();
    const email = document.getElementById('communityEmail').value.trim();
    const consent = document.getElementById('communityConsent').checked;

    if (!name) return showFeedback('Please enter your name.', true);
    const digits = normalizePhone(phone);
    if (digits.length < 11 || digits.length > 15) {
      return showFeedback('Please enter a valid WhatsApp number.', true);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showFeedback('Please enter a valid email or leave it blank.', true);
    }
    if (!consent) return showFeedback('Please tick the box so we can message you on WhatsApp.', true);

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>JOINING...</span>';
    showFeedback('');

    const res = await saveCommunitySignup({ name, phone, email });

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;

    if (!res.success) {
      return showFeedback('Something went wrong. Please try again or message us on WhatsApp.', true);
    }

    form.reset();
    showFeedback(res.duplicate
      ? `You're already on the list, ${name}. We'll see you on deck.`
      : `Welcome aboard, ${name}. We'll add you to our WhatsApp updates shortly.`);
  });
}
