import confetti from 'canvas-confetti';
import { trackPageView } from '../supabaseClient.js';
import {
  DEPOSIT_AMOUNT,
  charterSlots,
  durationItinerary,
  formatCurrency,
  formatClock,
  getItineraryLabel,
  getSlotTimingLabel as slotTimingLabelFor,
  getStartHourOptions as startHourOptionsFor,
  getCharterPrice,
  isRangeFree,
  TURNAROUND_GAP_HOURS
} from '../shared/pricing.js';

/* ========================================================
   BLACK PEARL · LADY ALICE
   Dedicated Booking Page Controller (/book)
   ======================================================== */

// Curated occasions (price no longer depends on occasion)
const curatedOccasions = [
  'Proposals',
  'Coastal sailing cruises',
  'Engagements',
  'Birthday parties',
  'Private parties',
  'Corporate events',
  'Anniversaries & private dinners',
  'Sunrise yoga and wellness',
  'Pre-wedding & photo shoots',
  'Festive nights',
  'Bachelor & bachelorette nights',
  'Family celebrations',
  'Something else'
];

// Background photo shown behind the booking page for each occasion
const occasionBackgrounds = {
  'Proposals': 'proposal-sunset.jpg',
  'Coastal sailing cruises': 'sailing-cruise.jpg',
  'Engagements': 'engagement-ceremony.jpg',
  'Birthday parties': 'birthday-party.jpg',
  'Private parties': 'cocktail-party.jpg',
  'Corporate events': 'corporate-gala.jpg',
  'Anniversaries & private dinners': 'private-dining.jpg',
  'Sunrise yoga and wellness': 'sunrise-yoga.jpg',
  'Pre-wedding & photo shoots': 'master-suite.jpg',
  'Festive nights': 'festive-fireworks.jpg',
  'Bachelor & bachelorette nights': 'bachelorette-party.jpg',
  'Family celebrations': 'family-reunion.jpg'
};
const defaultBackground = 'lady-alice-mumbai-night-skyline.jpg';
const privateEventBackground = 'lady-alice-night.jpg';

function setPageBackground(file) {
  document.body.style.setProperty('--booking-bg-image', `url('/assets/images/${file || defaultBackground}')`);
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const today = new Date();
const todayIso = toIsoDate(today);

// Booking Page State
const bookState = {
  currentStep: 1,
  isPrivateEvent: false,
  selectedOccasion: 'Proposals',
  customEventName: '',
  selectedSlot: 'evening', // 'day' or 'evening'
  selectedDuration: 3,
  startHour: 14,
  selectedDate: null,
  currentMonth: today.getMonth(),
  currentYear: today.getFullYear(),
  occupied: {}, // { 'YYYY-MM-DD': [{ start, end }] } booked / locked hours (24h)
  guestDetails: {
    name: '',
    phone: '',
    email: '',
    guests: 2,
    notes: ''
  },
  lastCompletedHold: null
};

document.addEventListener('DOMContentLoaded', () => {
  initUrlParameters();
  initStepNavigation();
  initOccasionPicker();
  initSlotAndDuration();
  initCalendar();
  initStartTimePicker();
  initGuestForm();
  initRazorpayCheckout();
  initConfirmationActions();
  updateSummarySidebar();
  syncAvailability();
  initMobileNav();

  try {
    trackPageView(window.location.pathname || '/book');
  } catch (e) {}
});

function initMobileNav() {
  const header = document.getElementById('siteHeader');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  const drawerLinks = document.querySelectorAll('.mobile-nav-link');

  if (mobileBtn && drawer) {
    mobileBtn.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('open');
      if (header) {
        if (isOpen) {
          header.classList.add('drawer-open');
        } else {
          header.classList.remove('drawer-open');
        }
      }
    });

    drawerLinks.forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        if (header) header.classList.remove('drawer-open');
      });
    });
  }
}

/* ========================================================
   0. MULTI-STEP SUBPAGE NAVIGATION & VALIDATION
   ======================================================== */
function initStepNavigation() {
  // Next step buttons
  document.querySelectorAll('[data-next-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStep = parseInt(btn.getAttribute('data-next-step'), 10);
      attemptGoToStep(targetStep);
    });
  });

  // Prev step buttons
  document.querySelectorAll('[data-prev-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStep = parseInt(btn.getAttribute('data-prev-step'), 10);
      goToStep(targetStep);
    });
  });

  // Progress pill navigation (can go backwards freely, or forwards if current validated)
  document.querySelectorAll('.progress-step-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const step = parseInt(pill.getAttribute('data-step'), 10);
      if (step < bookState.currentStep) {
        goToStep(step);
      } else if (step > bookState.currentStep) {
        attemptGoToStep(step);
      }
    });
  });
}

function attemptGoToStep(targetStep) {
  // Validate steps sequentially
  if (targetStep > bookState.currentStep) {
    for (let s = bookState.currentStep; s < targetStep; s++) {
      if (!validateStep(s)) {
        return false;
      }
    }
  }
  goToStep(targetStep);
  return true;
}

function validateStep(stepNum) {
  if (stepNum === 1) {
    if (!bookState.selectedOccasion) {
      alert('Please select an occasion or private event to continue.');
      return false;
    }
    return true;
  }

  if (stepNum === 2) {
    if (!charterSlots[bookState.selectedSlot] || !durationItinerary[bookState.selectedDuration]) {
      alert('Please select a charter slot and duration.');
      return false;
    }
    return true;
  }

  if (stepNum === 3) {
    if (!bookState.selectedDate || !isDateAvailable(bookState.selectedDate)) {
      alert('Please click and select an open date on the calendar.');
      return false;
    }
    if (!getStartHourOptions().includes(bookState.startHour) || !isStartFree(bookState.selectedDate, bookState.startHour)) {
      alert('Please choose an available start time for your charter.');
      return false;
    }
    return true;
  }

  return true;
}

function goToStep(stepNum) {
  if (stepNum < 1 || stepNum > 4) return;
  bookState.currentStep = stepNum;

  // Toggle step panels
  document.querySelectorAll('.booking-step-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetPanel = document.getElementById(`stepPanel${stepNum}`);
  if (targetPanel) targetPanel.classList.add('active');

  // Update progress tracker pills
  document.querySelectorAll('.progress-step-pill').forEach(pill => {
    const pStep = parseInt(pill.getAttribute('data-step'), 10);
    pill.classList.remove('active', 'completed');
    if (pStep === stepNum) {
      pill.classList.add('active');
    } else if (pStep < stepNum) {
      pill.classList.add('completed');
    }
  });

  // If entering step 4, refresh review overview block
  if (stepNum === 4) {
    updateStepReviewSummary();
  }

  // Smooth scroll container to top of form
  const container = document.getElementById('bookingProgressTracker');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updateStepReviewSummary() {
  const occEl = document.getElementById('revStepOccasion');
  const dateEl = document.getElementById('revStepDate');
  const slotEl = document.getElementById('revStepSlot');
  const modeEl = document.getElementById('revStepMode');

  let displayOccasion = bookState.selectedOccasion;
  if (bookState.isPrivateEvent && bookState.customEventName) {
    displayOccasion = `Private Event (${bookState.customEventName})`;
  } else if (bookState.isPrivateEvent) {
    displayOccasion = 'Private Event / Custom Charter';
  }

  if (occEl) occEl.textContent = displayOccasion;
  if (dateEl) dateEl.textContent = formatShortDate(bookState.selectedDate) || '—';
  if (slotEl) slotEl.textContent = `${getSlotTimingLabel()} · ${bookState.selectedDuration} hrs`;
  if (modeEl) modeEl.textContent = getItineraryLabel(bookState.selectedDuration);
}

/* ========================================================
   1. URL PARAMETER HANDLING & PRE-SELECTION
   ======================================================== */
function initUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const occasionParam = params.get('occasion');

  // Optional pre-selection from links, e.g. /book?slot=day&hours=5
  const slotParam = (params.get('slot') || '').toLowerCase();
  if (charterSlots[slotParam]) bookState.selectedSlot = slotParam;
  const hoursParam = parseInt(params.get('hours'), 10);
  if (durationItinerary[hoursParam]) bookState.selectedDuration = hoursParam;
  bookState.startHour = charterSlots[bookState.selectedSlot].startHour;

  if (occasionParam) {
    const decoded = decodeURIComponent(occasionParam).trim();
    const lower = decoded.toLowerCase();

    if (lower === 'private event' || lower === 'private' || lower === 'bespoke' || lower === 'charter') {
      selectPrivateEvent();
      return;
    }

    // Check if matches curated occasion
    const match = curatedOccasions.find(key => key.toLowerCase() === lower);

    if (match) {
      selectCuratedOccasion(match);
    } else {
      // Treat custom string as private event with custom title
      selectPrivateEvent();
      const customInput = document.getElementById('customEventNameInput');
      if (customInput) {
        customInput.value = decoded;
        bookState.customEventName = decoded;
      }
    }
  } else {
    // Default: Sunset Proposal
    selectCuratedOccasion('Proposals');
  }
}

function selectPrivateEvent() {
  bookState.isPrivateEvent = true;
  bookState.selectedOccasion = 'Private Event / Custom Charter';
  setPageBackground(privateEventBackground);

  // Uncheck curated event radios
  document.querySelectorAll('input[name="bookingOccasion"]').forEach(radio => {
    radio.checked = radio.value === 'Private Event';
  });

  const featuredCard = document.getElementById('privateEventFeaturedCard');
  if (featuredCard) {
    featuredCard.classList.add('active');
    const radio = featuredCard.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }

  const customWrap = document.getElementById('customPrivateInputWrap');
  if (customWrap) {
    customWrap.classList.add('active');
  }

  const pageHeroTitle = document.getElementById('pageHeroTitle');
  if (pageHeroTitle) {
    pageHeroTitle.textContent = 'Reserve Private Vessel Buyout';
  }

  updateSummarySidebar();
}

function selectCuratedOccasion(occasionName) {
  bookState.isPrivateEvent = false;
  bookState.selectedOccasion = occasionName;
  setPageBackground(occasionBackgrounds[occasionName]);

  const featuredCard = document.getElementById('privateEventFeaturedCard');
  if (featuredCard) {
    featuredCard.classList.remove('active');
    const privateRadio = featuredCard.querySelector('input[type="radio"]');
    if (privateRadio) privateRadio.checked = false;
  }

  const customWrap = document.getElementById('customPrivateInputWrap');
  if (customWrap) {
    customWrap.classList.remove('active');
  }

  const radio = document.querySelector(`input[name="bookingOccasion"][value="${occasionName}"]`);
  if (radio) {
    radio.checked = true;
  }

  const pageHeroTitle = document.getElementById('pageHeroTitle');
  if (pageHeroTitle) {
    pageHeroTitle.textContent = 'Reserve Your Private Charter';
  }

  updateSummarySidebar();
}

/* ========================================================
   2. OCCASION PICKER & CUSTOM PRIVATE EVENT INPUT
   ======================================================== */
function initOccasionPicker() {
  const featuredCard = document.getElementById('privateEventFeaturedCard');
  const customInput = document.getElementById('customEventNameInput');

  if (featuredCard) {
    featuredCard.addEventListener('click', () => {
      selectPrivateEvent();
      if (customInput) customInput.focus();
    });
  }

  if (customInput) {
    customInput.addEventListener('input', () => {
      bookState.customEventName = customInput.value.trim();
      updateSummarySidebar();
    });
  }

  // Curated Radios
  document.querySelectorAll('input[name="bookingOccasion"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'Private Event') {
        selectPrivateEvent();
      } else {
        selectCuratedOccasion(radio.value);
      }
    });
  });
}

/* ========================================================
   3. CHARTER SLOT, DURATION & PRICING
   ======================================================== */
function initSlotAndDuration() {
  const slotRadio = document.querySelector(`input[name="charterSlot"][value="${bookState.selectedSlot}"]`);
  if (slotRadio) slotRadio.checked = true;
  const durationRadio = document.querySelector(`input[name="voyageDuration"][value="${bookState.selectedDuration}"]`);
  if (durationRadio) durationRadio.checked = true;

  document.querySelectorAll('input[name="charterSlot"]').forEach(radio => {
    radio.addEventListener('change', () => {
      bookState.selectedSlot = radio.value;
      bookState.startHour = charterSlots[radio.value].startHour;
      // A date open for the old slot may be taken for the new one
      if (bookState.selectedDate && !isDateAvailable(bookState.selectedDate)) {
        bookState.selectedDate = null;
      }
      onScheduleChanged();
    });
  });

  document.querySelectorAll('input[name="voyageDuration"]').forEach(radio => {
    radio.addEventListener('change', () => {
      bookState.selectedDuration = parseInt(radio.value, 10) || 3;
      onScheduleChanged();
    });
  });

  updatePriceCalculations();
}

function onScheduleChanged() {
  // A longer charter may no longer fit on the chosen date
  if (bookState.selectedDate && !isDateAvailable(bookState.selectedDate)) {
    bookState.selectedDate = null;
  }
  updatePriceCalculations();
  renderStartTimeOptions();
  renderCalendar();
  updateSummarySidebar();
}

function calculateCurrentTotal() {
  return getCharterPrice(bookState.selectedSlot, bookState.selectedDuration);
}

function updatePriceCalculations() {
  const prices = charterSlots[bookState.selectedSlot].prices;
  Object.keys(durationItinerary).forEach(d => {
    const priceEl = document.getElementById(`durationPrice${d}`);
    const planEl = document.getElementById(`durationPlan${d}`);
    if (priceEl) priceEl.textContent = formatCurrency(prices[d]);
    if (planEl) planEl.textContent = getItineraryLabel(Number(d));
  });
}

/* ========================================================
   4. CALENDAR, AVAILABILITY & START TIME
   ======================================================== */
function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(iso) {
  if (!iso) return '';
  const d = fromIsoDate(iso);
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${dayName}, ${d.getDate()} ${monthNames[d.getMonth()].substring(0, 3)} ${d.getFullYear()}`;
}

function getSlotWindowLabel(slotKey = bookState.selectedSlot) {
  const slot = charterSlots[slotKey];
  return `${slot.label} (${formatClock(slot.startHour)} – ${formatClock(slot.endHour)})`;
}

function getSlotTimingLabel() {
  return slotTimingLabelFor(bookState.selectedSlot, bookState.startHour, bookState.selectedDuration);
}

function getOccupied(dateIso) {
  return bookState.occupied[dateIso] || [];
}

function isStartFree(dateIso, startHour, duration = bookState.selectedDuration) {
  return isRangeFree(startHour, startHour + duration, getOccupied(dateIso));
}

// Start times in the chosen slot that keep a 1-hour gap from other bookings
function getFreeStartOptions(dateIso) {
  return getStartHourOptions().filter(h => isStartFree(dateIso, h));
}

function isDateAvailable(dateIso) {
  return dateIso >= todayIso && getFreeStartOptions(dateIso).length > 0;
}

function initCalendar() {
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      // No browsing before the current month
      if (bookState.currentYear === today.getFullYear() && bookState.currentMonth === today.getMonth()) return;
      bookState.currentMonth--;
      if (bookState.currentMonth < 0) {
        bookState.currentMonth = 11;
        bookState.currentYear--;
      }
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      bookState.currentMonth++;
      if (bookState.currentMonth > 11) {
        bookState.currentMonth = 0;
        bookState.currentYear++;
      }
      renderCalendar();
    });
  }

  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendarDaysGrid');
  const monthLabel = document.getElementById('currentMonthLabel');
  if (!grid || !monthLabel) return;

  monthLabel.textContent = `${monthNames[bookState.currentMonth]} ${bookState.currentYear}`;
  grid.innerHTML = '';

  const prevBtn = document.getElementById('prevMonthBtn');
  if (prevBtn) {
    prevBtn.disabled = bookState.currentYear === today.getFullYear() && bookState.currentMonth === today.getMonth();
  }

  const firstDay = new Date(bookState.currentYear, bookState.currentMonth, 1);
  let startingDay = firstDay.getDay() - 1;
  if (startingDay === -1) startingDay = 6;

  const totalDays = new Date(bookState.currentYear, bookState.currentMonth + 1, 0).getDate();

  // Blank slots for previous month
  for (let i = 0; i < startingDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day-cell empty';
    grid.appendChild(blank);
  }

  const slotName = charterSlots[bookState.selectedSlot].label;

  // Days of current month
  for (let day = 1; day <= totalDays; day++) {
    const dateIso = toIsoDate(new Date(bookState.currentYear, bookState.currentMonth, day));

    const cell = document.createElement('button');
    cell.className = 'cal-day-cell';
    cell.setAttribute('type', 'button');
    cell.textContent = day;

    const dot = document.createElement('span');
    dot.className = 'day-dot';

    const isPast = dateIso < todayIso;
    const freeCount = isPast ? 0 : getFreeStartOptions(dateIso).length;
    const allCount = getStartHourOptions().length;
    const isOpen = freeCount > 0;

    if (isPast) {
      cell.classList.add('disabled');
      cell.title = 'Date has passed';
    } else if (!isOpen) {
      cell.classList.add('disabled');
      dot.classList.add('booked');
      cell.title = `No ${bookState.selectedDuration}-hour times left in the ${slotName} on this date`;
    } else if (freeCount < allCount) {
      dot.classList.add('filling');
      cell.title = `Some times already booked · ${freeCount} start time${freeCount === 1 ? '' : 's'} left`;
    } else {
      dot.classList.add('free');
      cell.title = `${slotName} open`;
    }

    if (bookState.selectedDate === dateIso) {
      cell.classList.add('selected');
    }

    cell.appendChild(dot);

    if (isOpen) {
      cell.addEventListener('click', () => {
        grid.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        bookState.selectedDate = dateIso;
        renderStartTimeOptions();
        updateSelectedDateBanner();
        updateSummarySidebar();
      });
    } else {
      cell.disabled = true;
    }

    grid.appendChild(cell);
  }

  updateSelectedDateBanner();
}

function updateSelectedDateBanner() {
  const title = document.getElementById('statusDateTitle');
  const count = document.getElementById('statusDateSlotsCount');

  if (!bookState.selectedDate) {
    if (title) title.textContent = 'Choose a date';
    if (count) count.textContent = `Showing open dates for the ${getSlotWindowLabel()}.`;
    return;
  }

  const dateObj = fromIsoDate(bookState.selectedDate);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  if (title) title.textContent = `${dayName}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  const free = getFreeStartOptions(bookState.selectedDate).length;
  const all = getStartHourOptions().length;
  if (count) {
    count.textContent = free === all
      ? `${getSlotWindowLabel()} is fully open on this date.`
      : `Some times are already booked. ${free} start time${free === 1 ? '' : 's'} left in the ${getSlotWindowLabel()}.`;
  }
}

function getStartHourOptions() {
  return startHourOptionsFor(bookState.selectedSlot, bookState.selectedDuration);
}

function initStartTimePicker() {
  const select = document.getElementById('startTimeSelect');
  if (select) {
    select.addEventListener('change', () => {
      bookState.startHour = parseInt(select.value, 10);
      renderStartTimeHint();
      updateSummarySidebar();
    });
  }
  renderStartTimeOptions();
}

function renderStartTimeOptions() {
  const select = document.getElementById('startTimeSelect');
  const options = getStartHourOptions();
  const date = bookState.selectedDate;
  const isFree = h => !date || isStartFree(date, h);

  if (!options.includes(bookState.startHour) || !isFree(bookState.startHour)) {
    bookState.startHour = options.find(isFree) ?? options[0];
  }

  if (select) {
    select.innerHTML = options
      .map(h => {
        const free = isFree(h);
        return `<option value="${h}" ${h === bookState.startHour ? 'selected' : ''} ${free ? '' : 'disabled'}>${formatClock(h)} – ${formatClock(h + bookState.selectedDuration)}${free ? '' : ' (booked)'}</option>`;
      })
      .join('');
  }
  renderStartTimeHint();
}

function renderStartTimeHint() {
  const hint = document.getElementById('startTimeHint');
  if (!hint) return;
  hint.textContent = `Your ${bookState.selectedDuration}-hour charter: ${getItineraryLabel(bookState.selectedDuration)}. ` +
    `Times close to another booking are unavailable, as we keep a ${TURNAROUND_GAP_HOURS}-hour gap between charters.`;
}

/* ========================================================
   5. GUEST DETAILS FORM (ONLY NECESSARY FIELDS)
   ======================================================== */
function initGuestForm() {
  const guestCountInput = document.getElementById('bookGuestCount');
  if (guestCountInput) {
    guestCountInput.addEventListener('input', () => {
      const val = parseInt(guestCountInput.value, 10) || 2;
      bookState.guestDetails.guests = val;
      const guestsEl = document.getElementById('sideSummaryGuests');
      if (guestsEl) guestsEl.textContent = `${val} guest${val > 1 ? 's' : ''}`;
    });
  }
}

function validateGuestForm() {
  const nameEl = document.getElementById('bookGuestName');
  const phoneEl = document.getElementById('bookGuestPhone');
  const emailEl = document.getElementById('bookGuestEmail');
  const countEl = document.getElementById('bookGuestCount');
  const notesEl = document.getElementById('bookGuestNotes');
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

  if (errBox) {
    errBox.textContent = '';
    errBox.style.display = 'none';
  }

  bookState.guestDetails = {
    name,
    phone,
    email,
    guests: count,
    notes: notes || 'None'
  };

  return true;
}

function showFormError(msg) {
  const errBox = document.getElementById('formErrorMsg');
  if (errBox) {
    errBox.textContent = msg;
    errBox.style.display = 'block';
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ========================================================
   6. SUMMARY SIDEBAR UPDATE
   ======================================================== */
function updateSummarySidebar() {
  const occasionEl = document.getElementById('sideSummaryOccasion');
  const dateEl = document.getElementById('sideSummaryDate');
  const slotEl = document.getElementById('sideSummarySlot');
  const durationEl = document.getElementById('sideSummaryDuration');
  const modeEl = document.getElementById('sideSummaryMode');
  const quoteEl = document.getElementById('sideSummaryQuoteTotal');
  const guestsEl = document.getElementById('sideSummaryGuests');

  // Occasion display: if private event with custom title, display custom title
  let displayOccasion = bookState.selectedOccasion;
  if (bookState.isPrivateEvent && bookState.customEventName) {
    displayOccasion = `Private Event (${bookState.customEventName})`;
  } else if (bookState.isPrivateEvent) {
    displayOccasion = 'Private Event / Custom Charter';
  }

  if (occasionEl) occasionEl.textContent = displayOccasion;
  if (dateEl) dateEl.textContent = formatShortDate(bookState.selectedDate) || 'Select a date';
  if (slotEl) slotEl.textContent = getSlotTimingLabel();
  if (durationEl) durationEl.textContent = `${bookState.selectedDuration} hours`;
  if (modeEl) modeEl.textContent = getItineraryLabel(bookState.selectedDuration);

  const countInput = document.getElementById('bookGuestCount');
  const countVal = countInput ? countInput.value : (bookState.guestDetails.guests || 2);
  if (guestsEl) guestsEl.textContent = `${countVal} guest${countVal > 1 ? 's' : ''}`;

  const total = calculateCurrentTotal();
  if (quoteEl) quoteEl.textContent = formatCurrency(total);
}

/* ========================================================
   7. RAZORPAY CHECKOUT & CONFIRMATION
   ======================================================== */
function initRazorpayCheckout() {
  const payBtn = document.getElementById('btnPagePay5000');
  if (payBtn) {
    payBtn.addEventListener('click', handlePageRazorpayPayment);
  }
}

const PAY_BUTTON_LABEL = `Pay ${formatCurrency(DEPOSIT_AMOUNT)} via Razorpay to Lock Date`;

function setPayButton(busy, label) {
  const payBtn = document.getElementById('btnPagePay5000');
  const payText = document.getElementById('btnPagePayText');
  if (payBtn) payBtn.disabled = busy;
  if (payText) payText.textContent = label || PAY_BUTTON_LABEL;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function handlePageRazorpayPayment() {
  if (!validateGuestForm()) return;
  if (!bookState.selectedDate || !isDateAvailable(bookState.selectedDate)) {
    showFormError('Please go back and choose an open date for your charter.');
    return;
  }
  if (typeof window.Razorpay !== 'function') {
    showFormError('Payment window could not load. Please check your connection and refresh the page.');
    return;
  }

  setPayButton(true, 'Connecting to Razorpay...');

  let displayOccasion = bookState.selectedOccasion;
  if (bookState.isPrivateEvent && bookState.customEventName) {
    displayOccasion = `Private Event: ${bookState.customEventName}`;
  }

  // 1. Server validates the booking, records it as "Payment Pending" and creates the order
  let order;
  try {
    const { ok, data } = await postJson('/api/create-order', {
      occasion: displayOccasion,
      slot: bookState.selectedSlot,
      durationHours: bookState.selectedDuration,
      startHour: bookState.startHour,
      dateIso: bookState.selectedDate,
      name: bookState.guestDetails.name,
      phone: bookState.guestDetails.phone,
      email: bookState.guestDetails.email,
      guests: bookState.guestDetails.guests,
      notes: bookState.guestDetails.notes === 'None' ? '' : bookState.guestDetails.notes
    });
    if (!ok) {
      showFormError(data.error || 'Could not start the payment. Please try again.');
      if (data.code === 'SLOT_TAKEN') {
        // Someone else just took this time: refresh availability and let them re-pick
        await syncAvailability();
        if (bookState.selectedDate && !isDateAvailable(bookState.selectedDate)) bookState.selectedDate = null;
        renderStartTimeOptions();
        renderCalendar();
        updateSummarySidebar();
      }
      setPayButton(false);
      return;
    }
    order = data;
  } catch (err) {
    console.error('[Booking] create-order failed', err);
    showFormError('Could not reach our booking server. Please check your connection and try again.');
    setPayButton(false);
    return;
  }

  let lastFailure = null;
  let settled = false;

  // 2. Razorpay Checkout for the fixed advance
  const rzp = new window.Razorpay({
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency,
    name: 'Black Pearl · Lady Alice',
    description: `${displayOccasion} · Advance (Ref: ${order.bookingCode})`,
    image: '/assets/black-pearl-mark.svg',
    prefill: {
      name: bookState.guestDetails.name,
      email: bookState.guestDetails.email,
      contact: bookState.guestDetails.phone.replace(/[^0-9]/g, '').slice(-10)
    },
    notes: { booking_code: order.bookingCode },
    theme: { color: '#C9A968' },
    modal: {
      ondismiss: () => {
        if (settled) return;
        // Closed without paying: free the slot and record it for the admin panel
        if (!lastFailure) {
          postJson('/api/payment-failed', { orderId: order.orderId, abandoned: true }).catch(() => {});
        }
        setPayButton(false);
      }
    },
    // 3. Server verifies the signature, marks the booking paid and emails the QR
    handler: async (response) => {
      settled = true;
      setPayButton(true, 'Confirming your booking...');
      try {
        const { ok, data } = await postJson('/api/verify-payment', {
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature
        });
        if (!ok) {
          showFormError(data.error || 'Payment received, but we could not confirm the booking. Our team will contact you.');
          setPayButton(false);
          return;
        }
        completePageBooking(data);
      } catch (err) {
        console.error('[Booking] verify-payment failed', err);
        showFormError(`Payment received (ID ${response.razorpay_payment_id}), but we could not confirm it on screen. Your booking is safe; our team will contact you.`);
        setPayButton(false);
      }
    }
  });

  rzp.on('payment.failed', (resp) => {
    lastFailure = resp.error;
    const reason = resp.error?.description || 'Transaction was declined.';
    showFormError(`Payment failed: ${reason} You can try again.`);
    postJson('/api/payment-failed', {
      orderId: order.orderId,
      paymentId: resp.error?.metadata?.payment_id,
      reason
    }).catch(() => {});
  });

  rzp.open();
}

function completePageBooking({ booking, qrUrl, verifyUrl, emailSent }) {
  bookState.lastCompletedHold = {
    ...booking,
    startHour: bookState.startHour,
    durationHours: bookState.selectedDuration
  };
  markTimeBooked(booking.dateIso, bookState.startHour, bookState.startHour + bookState.selectedDuration);

  renderConfirmationReceipt(booking, { qrUrl, verifyUrl, emailSent });

  const container = document.getElementById('bookingFlowContainer');
  const confirmView = document.getElementById('bookingConfirmationView');
  if (container) container.classList.add('confirmed');
  if (confirmView) {
    confirmView.classList.add('active');
    confirmView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.55 },
    colors: ['#EBD7A6', '#C9A968', '#F3EDE0', '#C6A462', '#8F6F33']
  });
}

function renderConfirmationReceipt(booking, { qrUrl, verifyUrl, emailSent }) {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('confirmedRefCode', `Booking Reference: ${booking.code}`);
  setText('recOccasion', booking.occasion);
  setText('recDate', booking.date);
  setText('recSlot', `${booking.slot} · ${booking.duration}`);
  setText('recMode', booking.itinerary);
  setText('recGuest', `${booking.name} (${booking.email})`);
  setText('recPhone', booking.phone);
  setText('recPaymentId', booking.paymentId || '—');
  setText('boardingQrRefText', booking.code);
  setText('recEmailNote', emailSent
    ? `A confirmation with this QR code has been emailed to ${booking.email}.`
    : `We could not email your confirmation just now. Please save this page or screenshot the QR code.`);

  const qrImg = document.getElementById('boardingQrImg');
  if (qrImg) {
    qrImg.src = qrUrl;
    qrImg.alt = `QR code for booking ${booking.code}`;
  }
  const passLink = document.getElementById('recPassLink');
  if (passLink) passLink.href = verifyUrl;

  const waBtn = document.getElementById('btnRecChatWa');
  if (waBtn) {
    const waText = encodeURIComponent(
      `Hello Black Pearl Team, I have booked ${booking.date} (${booking.slot}) for our ${booking.occasion} on Lady Alice. ` +
      `Booking Ref: ${booking.code} (Advance ${booking.advancePaid} paid, Razorpay ID: ${booking.paymentId}).`
    );
    waBtn.href = `https://wa.me/919820000000?text=${waText}`;
  }
}

/* ========================================================
   8. CONFIRMATION SCREEN ACTIONS (.ICS CALENDAR)
   ======================================================== */
function initConfirmationActions() {
  const addCalBtn = document.getElementById('btnRecAddToCal');
  if (addCalBtn) {
    addCalBtn.addEventListener('click', generateICalendarDownload);
  }
}

function generateICalendarDownload() {
  const hold = bookState.lastCompletedHold;
  if (!hold) return;

  const dateParts = hold.dateIso.split('-');
  const y = dateParts[0];
  const m = dateParts[1];
  const d = dateParts[2];

  const startHour = hold.startHour;
  const durHours = parseInt(hold.duration, 10) || 3;
  const startTime = `${y}${m}${d}T${String(startHour).padStart(2, '0')}0000`;
  const endTime = `${y}${m}${d}T${String(startHour + durHours).padStart(2, '0')}0000`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Black Pearl//Lady Alice Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:Lady Alice · ${hold.occasion} (${hold.code})`,
    `DESCRIPTION:Private charter on Lady Alice luxury ship at Gateway of India. Held with Black Pearl.\\nBooking: ${hold.code}\\nGuest: ${hold.name}\\nPayment ID: ${hold.paymentId}`,
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
  a.download = `Lady_Alice_${hold.code}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========================================================
   9. SUPABASE BLOCKED DATES SYNC
   ======================================================== */
// Website bookings + admin offline locks, as booked hours per date (no guest details)
async function syncAvailability() {
  try {
    const res = await fetch('/api/availability', { cache: 'no-store' });
    if (!res.ok) throw new Error(`availability ${res.status}`);
    const { occupied = [] } = await res.json();

    bookState.occupied = {};
    occupied.forEach(range => markTimeBooked(range.date, range.start, range.end));

    if (bookState.selectedDate && !isDateAvailable(bookState.selectedDate)) {
      bookState.selectedDate = null;
    }
    renderStartTimeOptions();
    renderCalendar();
    updateSummarySidebar();
  } catch (err) {
    console.warn('Could not load availability:', err);
  }
}

function markTimeBooked(dateIso, start, end) {
  if (!dateIso || !Number.isFinite(start) || !Number.isFinite(end)) return;
  if (!bookState.occupied[dateIso]) bookState.occupied[dateIso] = [];
  bookState.occupied[dateIso].push({ start, end });
}
