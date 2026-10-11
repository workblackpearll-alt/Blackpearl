import confetti from 'canvas-confetti';

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
    phone: '+91 98200 00000',
    email: 'arjun@example.com',
    address: 'Bandra West, Mumbai',
    guestCount: 2,
    notes: 'It is a surprise. Please call me, not her.'
  },
  currentMonth: 10, // 0-indexed: 10 is November
  currentYear: 2026,
  blockedDates: ['2026-11-01', '2026-11-08', '2026-11-20', '2026-11-27', '2026-11-28'],
  fillingDates: ['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22'],
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
      phone: '+91 98200 00000',
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
  initVoyageBriefSection();
  initAdminPortal();
  initWaterlineAnimations();
  initSmoothParallax();
  updateAdminView();

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
  const filterChips = document.querySelectorAll('.filter-chip');
  const cards = document.querySelectorAll('.occasion-card');

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter');

      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      cards.forEach(card => {
        const cat = card.getAttribute('data-category') || '';
        const categories = cat.split(/\s+/);
        if (filter === 'all' || categories.includes(filter)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

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
  const modal = document.getElementById('bookingModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const openBtns = [
    document.getElementById('openBookingBtn'),
    document.getElementById('heroCheckDatesBtn'),
    document.getElementById('workflowCheckDatesBtn'),
    document.getElementById('footerBookBtn'),
    document.getElementById('mobileStickyBookBtn')
  ];

  openBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        const occ = btn.getAttribute('data-occasion') || 'Proposals';
        openBookingModal(occ);
      });
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeBookingModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeBookingModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeBookingModal();
    }
  });

  // Step 1: Occasion selection change
  document.querySelectorAll('input[name="bookingOccasion"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.selectedOccasion = radio.value;
      state.occasionBasePrice = baseOccasionPrices[radio.value] || 75000;
      updatePriceCalculations();
      updateStepLabels();
    });
  });

  // Step Navigation Buttons (Next / Back)
  document.querySelectorAll('.btn-step-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStep = parseInt(btn.getAttribute('data-to'), 10);
      goToStep(nextStep);
    });
  });

  document.querySelectorAll('.btn-step-back').forEach(btn => {
    btn.addEventListener('click', () => {
      const prevStep = parseInt(btn.getAttribute('data-to'), 10);
      goToStep(prevStep);
    });
  });

  // Step 2: Calendar month navigation
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  if (prevMonthBtn && nextMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      state.currentMonth--;
      if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear--;
      }
      renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
      state.currentMonth++;
      if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
      }
      renderCalendar();
    });
  }

  // Step 3: Voyage Mode (Paused vs Sailing)
  document.querySelectorAll('input[name="voyageMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.voyageMode = radio.value;
      document.querySelectorAll('.voyage-mode-card').forEach(c => c.classList.remove('active'));
      const activeCard = radio.closest('.voyage-mode-option')?.querySelector('.voyage-mode-card');
      if (activeCard) activeCard.classList.add('active');
      updatePriceCalculations();
    });
  });

  // Step 3: Duration & Slot Selection
  document.querySelectorAll('input[name="voyageDuration"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.selectedDuration = parseInt(radio.value, 10);
      updatePriceCalculations();
    });
  });

  document.querySelectorAll('input[name="sailingSlot"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.selectedSlot = radio.value;
      state.selectedSlotTime = radio.getAttribute('data-time');
    });
  });

  // Step 4: Form Submit & Validation
  const step4NextBtn = document.getElementById('step4NextBtn');
  if (step4NextBtn) {
    step4NextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (validateGuestForm()) {
        goToStep(5);
      }
    });
  }

  // Step 5: Pay ₹5,000 Action
  const btnPay5000 = document.getElementById('btnPay5000');
  if (btnPay5000) {
    btnPay5000.addEventListener('click', handlePayHoldDeposit);
  }

  // Step 6: Confirmation Actions
  const btnAddToCal = document.getElementById('btnAddToCalendar');
  if (btnAddToCal) {
    btnAddToCal.addEventListener('click', generateICalendarFile);
  }

  const btnPrintReceipt = document.getElementById('btnPrintReceipt');
  if (btnPrintReceipt) {
    btnPrintReceipt.addEventListener('click', () => window.print());
  }

  renderCalendar();
  updatePriceCalculations();
}

function openBookingModal(occasionName = 'Proposals') {
  const modal = document.getElementById('bookingModal');
  if (!modal) return;

  // Set selected occasion radio if match exists
  if (occasionName && occasionName !== 'General') {
    const radio = document.querySelector(`input[name="bookingOccasion"][value="${occasionName}"]`);
    if (radio) {
      radio.checked = true;
      state.selectedOccasion = occasionName;
      state.occasionBasePrice = baseOccasionPrices[occasionName] || 75000;
    }
  }

  // If Coastal sailing cruise is selected, pre-set voyageMode to sailing; else paused
  if (occasionName === 'Coastal sailing cruises') {
    state.voyageMode = 'sailing';
  } else {
    state.voyageMode = 'paused';
  }

  const modeRadio = document.querySelector(`input[name="voyageMode"][value="${state.voyageMode}"]`);
  if (modeRadio) {
    modeRadio.checked = true;
    document.querySelectorAll('.voyage-mode-card').forEach(c => c.classList.remove('active'));
    const parentCard = modeRadio.closest('.voyage-mode-option')?.querySelector('.voyage-mode-card');
    if (parentCard) parentCard.classList.add('active');
  }

  updatePriceCalculations();
  updateStepLabels();
  goToStep(1);

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
  const modal = document.getElementById('bookingModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function goToStep(stepNum) {
  // Update moving pearl position on waterline track
  const pearl = document.getElementById('movingPearl');
  const stepText = document.getElementById('stepIndicatorText');
  const stops = document.querySelectorAll('.progress-stops .stop');

  const positions = {
    1: '0%',
    2: '25%',
    3: '50%',
    4: '75%',
    5: '100%',
    6: '100%'
  };

  if (pearl && positions[stepNum]) {
    pearl.style.left = positions[stepNum];
  }

  if (stepText) {
    stepText.textContent = stepNum <= 5 ? `Step ${stepNum} of 5` : 'Date Confirmed';
  }

  stops.forEach((stop, index) => {
    if (index + 1 <= stepNum) {
      stop.classList.add('active');
    } else {
      stop.classList.remove('active');
    }
  });

  // Switch visible step panels
  document.querySelectorAll('.booking-step').forEach(step => step.classList.remove('active'));

  if (stepNum === 6) {
    document.getElementById('stepConfirmation').classList.add('active');
  } else {
    const target = document.getElementById(`step${stepNum}`);
    if (target) target.classList.add('active');
  }

  // If entering Step 5, populate summary review
  if (stepNum === 5) {
    populateStep5Summary();
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
   GUEST DETAILS FORM VALIDATION (STEP 4)
   ======================================================== */
function validateGuestForm() {
  const name = document.getElementById('guestFullName').value.trim();
  const phone = document.getElementById('guestPhone').value.trim();
  const email = document.getElementById('guestEmail').value.trim();
  const address = document.getElementById('guestAddress').value.trim();
  const count = parseInt(document.getElementById('guestCount').value, 10);
  const notes = document.getElementById('guestNotes').value.trim();
  const errBox = document.getElementById('formErrorMsg');

  if (!name) {
    showFormError('Please enter your full name so our team knows who to address.');
    return false;
  }
  if (!phone || phone.length < 9) {
    showFormError('Please enter a valid WhatsApp mobile number for event planning.');
    return false;
  }
  if (!email || !email.includes('@')) {
    showFormError('Please enter a valid email address for your confirmation receipt.');
    return false;
  }
  if (!address) {
    showFormError('Please enter your city/neighborhood (e.g. Bandra, Mumbai).');
    return false;
  }
  if (!count || count < 1 || count > 100) {
    showFormError('Guest count must be between 1 and 100.');
    return false;
  }

  errBox.style.display = 'none';

  state.guestDetails = {
    fullName: name,
    phone,
    email,
    address,
    guestCount: count,
    notes
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
   STEP 5 SUMMARY & PAYMENT SIMULATION
   ======================================================== */
function populateStep5Summary() {
  const isSailing = state.voyageMode === 'sailing';
  const sailingAddon = isSailing ? (sailingSurcharges[state.selectedDuration] || 45000) : 0;
  const calculatedTotal = Math.round(state.occasionBasePrice * priceMultipliers[state.selectedDuration] + sailingAddon);

  document.getElementById('summaryOccasion').textContent = state.selectedOccasion;

  const dateObj = new Date(state.selectedDate);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const mName = monthNames[dateObj.getMonth()].substring(0, 3);
  document.getElementById('summaryDate').textContent = `${dayName}, ${dateObj.getDate()} ${mName} ${dateObj.getFullYear()}`;

  document.getElementById('summarySlot').textContent = `${state.selectedSlot}, ${state.selectedSlotTime}`;
  document.getElementById('summaryDuration').textContent = `${state.selectedDuration} hours`;

  const modeEl = document.getElementById('summaryVoyageMode');
  if (modeEl) {
    modeEl.textContent = isSailing ? 'Active Sailing (Underway)' : 'Paused (At Anchor)';
  }

  document.getElementById('summaryGuests').textContent = `${state.guestDetails.guestCount} guests`;
  document.getElementById('summaryRoughPrice').textContent = formatCurrency(calculatedTotal);
}

function handlePayHoldDeposit() {
  const payBtn = document.getElementById('btnPay5000');
  const payText = document.getElementById('btnPayText');

  payBtn.disabled = true;
  payText.textContent = 'Contacting payment gateway...';

  // Razorpay-style smooth processing animation
  setTimeout(() => {
    payText.textContent = 'Securing ₹5,000 hold...';
  }, 900);

  setTimeout(() => {
    payText.textContent = 'Hold Confirmed!';
    completeBookingAndCelebrate();
    payBtn.disabled = false;
    payText.textContent = 'Pay ₹5,000 to hold date';
  }, 1900);
}

function completeBookingAndCelebrate() {
  // Generate authentic booking code: BP-{DDMM}-{RANDOM}
  const dateObj = new Date(state.selectedDate);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const randNum = String(Math.floor(10 + Math.random() * 90));
  const bookingCode = `BP-${dd}${mm}-${randNum}`;

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
    name: state.guestDetails.fullName,
    phone: state.guestDetails.phone,
    email: state.guestDetails.email,
    notes: state.guestDetails.notes || 'None',
    status: 'Held (Deposit Paid)'
  };

  // Add to active holds and mark date as filling or booked
  state.holds.unshift(newHold);
  if (!state.fillingDates.includes(state.selectedDate)) {
    state.fillingDates.push(state.selectedDate);
  }
  saveHoldsToStorage();

  // Populate Confirmation Screen
  document.getElementById('confirmedBookingRef').textContent = `Booking ${bookingCode}`;
  document.getElementById('rOccasion').textContent = newHold.occasion;
  document.getElementById('rDate').textContent = newHold.date;
  document.getElementById('rSlot').textContent = `${newHold.slot} · ${newHold.duration}`;
  const rMode = document.getElementById('rVoyageMode');
  if (rMode) rMode.textContent = newHold.voyageMode;
  document.getElementById('rGuest').textContent = newHold.name;
  document.getElementById('rPhone').textContent = newHold.phone;

  // WhatsApp concierge prefilled link
  const waBtn = document.getElementById('btnChatWaConfirmation');
  if (waBtn) {
    const waText = encodeURIComponent(`Hello Black Pearl team, I have just held date ${newHold.date} for our ${newHold.occasion} on Lady Alice. My booking code is ${bookingCode}. Please call me on ${newHold.phone} to plan the evening.`);
    waBtn.href = `https://wa.me/919820000000?text=${waText}`;
  }

  // Go to confirmation step
  goToStep(6);

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
    `DESCRIPTION:Private celebration on board Lady Alice luxury yacht at the Gateway of India. One booking at a time. Held with Black Pearl.\\nBooking ID: ${currentHold.id}\\nGuest: ${currentHold.name}\\nDuration: ${currentHold.duration}`,
    'LOCATION:Gateway of India Jetty, Apollo Bandar, Colaba, Mumbai 400001',
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
function initAdminPortal() {
  const modal = document.getElementById('adminModal');
  const trigger = document.getElementById('crewPortalTrigger');
  const closeBtn = document.getElementById('adminCloseBtn');
  const blockBtn = document.getElementById('btnAdminBlockDate');
  const resetBtn = document.getElementById('adminResetDemoData');

  if (trigger) {
    trigger.addEventListener('click', () => {
      updateAdminView();
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
      modal.classList.toggle('active');
    }
  });

  if (blockBtn) {
    blockBtn.addEventListener('click', () => {
      const dateVal = document.getElementById('adminBlockDateInput').value;
      const reason = document.getElementById('adminBlockReason').value;
      if (!dateVal) {
        alert('Please choose a date to block.');
        return;
      }

      if (!state.blockedDates.includes(dateVal)) {
        state.blockedDates.push(dateVal);
      }
      renderCalendar();
      updateAdminView();
      alert(`Date ${dateVal} is now blocked for: ${reason}`);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('black_pearl_holds');
      window.location.reload();
    });
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

  state.holds.forEach(hold => {
    const row = document.createElement('div');
    row.className = 'admin-booking-row';
    row.innerHTML = `
      <div class="admin-booking-info">
        <h5>${hold.occasion} · <strong>${hold.name}</strong></h5>
        <p>📅 ${hold.date} (${hold.slot}, ${hold.duration}${hold.voyageMode ? ' · ' + hold.voyageMode : ''}) · 👥 ${hold.guests} guests</p>
        <p>📞 ${hold.phone} · ✉️ ${hold.email} ${hold.notes ? '· 💬 ' + hold.notes : ''}</p>
      </div>
      <div class="admin-booking-meta">
        <span class="admin-booking-status">${hold.status}</span>
        <div style="font-family: var(--font-heading); color: var(--gold); font-size: 16px;">${hold.id}</div>
        <div style="font-size: 12px; color: var(--mist);">Deposit: ${hold.paidToken}</div>
      </div>
    `;
    list.appendChild(row);
  });
}

/* ========================================================
   VOYAGE CHARTER BRIEF FORM (SAIL OR AT REST IN OCEAN)
   ======================================================== */
function initVoyageBriefSection() {
  const form = document.getElementById('voyageBriefForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('briefClientName').value.trim();
    const phone = document.getElementById('briefClientPhone').value.trim();
    const occasion = document.getElementById('briefOccasionSelect').value;
    const duration = document.getElementById('briefDurationSelect').value;
    const notes = document.getElementById('briefNotesInput').value.trim();
    const mode = document.querySelector('input[name="charterModeChoice"]:checked')?.value || 'paused';

    if (!name || !phone) {
      alert('Please provide your name and WhatsApp number.');
      return;
    }

    const modeLabels = {
      paused: 'At Rest in Ocean (At Anchor - Standard Rate)',
      sailing: 'Active Sailing Underway (Full Propulsion + Surcharge)',
      hybrid: 'Custom Hybrid (1-2h Sail + Anchor for Dinner)'
    };

    const submitBtn = document.getElementById('btnSubmitBrief');
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>PROCESSING BRIEF...</span>';

    setTimeout(() => {
      submitBtn.innerHTML = '<span>VOYAGE BRIEF READY</span> <span class="btn-submit-icon">→</span>';

      // Confetti celebration (Strict palette: Gold, White, Champagne)
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.65 },
        colors: ['#EBD7A6', '#C9A968', '#FFFFFF', '#D4AF37']
      });

      // Prepare WhatsApp message
      const waMessage = encodeURIComponent(
        `Hello Black Pearl Team, I would like to request a bespoke voyage brief for Lady Alice:\n\n` +
        `• Name: ${name}\n` +
        `• WhatsApp: ${phone}\n` +
        `• Voyage Style: ${modeLabels[mode]}\n` +
        `• Occasion: ${occasion}\n` +
        `• Preferred Hours: ${duration === 'custom' ? 'Custom Schedule' : duration + ' Hours'}\n` +
        `• Route Notes: ${notes || 'Open harbour cruise & anchor'}\n\n` +
        `Please share available dates and custom pricing estimate.`
      );

      // Open booking modal pre-populated
      setTimeout(() => {
        openBookingModal(occasion);

        // Pre-fill guest details in booking state & inputs
        state.guestDetails.fullName = name;
        state.guestDetails.phone = phone;
        if (notes) state.guestDetails.notes = notes;

        const nameInput = document.getElementById('guestFullName');
        const phoneInput = document.getElementById('guestPhone');
        const notesInput = document.getElementById('guestNotes');
        if (nameInput) nameInput.value = name;
        if (phoneInput) phoneInput.value = phone;
        if (notesInput && notes) notesInput.value = notes;

        // Set voyageMode
        state.voyageMode = mode === 'sailing' ? 'sailing' : 'paused';
        const vRadio = document.querySelector(`input[name="voyageMode"][value="${state.voyageMode}"]`);
        if (vRadio) {
          vRadio.checked = true;
          document.querySelectorAll('.voyage-mode-card').forEach(c => c.classList.remove('active'));
          vRadio.closest('.voyage-mode-option')?.querySelector('.voyage-mode-card')?.classList.add('active');
        }

        // Set duration if numeric
        const durNum = parseInt(duration, 10);
        if (durNum && [1, 3, 6].includes(durNum)) {
          state.selectedDuration = durNum;
          const durRadio = document.querySelector(`input[name="voyageDuration"][value="${durNum}"]`);
          if (durRadio) durRadio.checked = true;
        }

        updatePriceCalculations();

        // Also open WhatsApp in new tab for direct concierge contact
        window.open(`https://wa.me/919820000000?text=${waMessage}`, '_blank');

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }, 700);

    }, 750);
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

