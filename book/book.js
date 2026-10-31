import confetti from 'canvas-confetti';
import { isLikelyRealPhone } from '../shared/phone.js';
import { trackPageView, getCampaign } from '../supabaseClient.js';
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
  formatRange,
  TURNAROUND_GAP_HOURS,
  ONLINE_PAYMENTS_ENABLED,
  SHOW_PRICES
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
  selectedSlot: null, // 'day' | 'evening', set by the chosen time
  selectedDuration: 3,
  startHour: null, // 24h, set by the chosen time
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
  initDuration();
  initCalendar();
  renderStartTimeOptions();
  initGuestForm();
  initRazorpayCheckout();
  initConfirmationActions();
  applyPaymentMode();
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
   0. STEPS: 1 Occasion · 2 Date & time · 3 Your details
   ======================================================== */
const LAST_STEP = 3;

function initStepNavigation() {
  document.querySelectorAll('[data-next-step]').forEach(btn => {
    btn.addEventListener('click', () => attemptGoToStep(parseInt(btn.getAttribute('data-next-step'), 10)));
  });

  document.querySelectorAll('[data-prev-step]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.getAttribute('data-prev-step'), 10)));
  });

  // Progress pills: go back freely, forward only if the current step is complete
  document.querySelectorAll('.progress-step-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const step = parseInt(pill.getAttribute('data-step'), 10);
      if (step < bookState.currentStep) goToStep(step);
      else if (step > bookState.currentStep) attemptGoToStep(step);
    });
  });
}

function attemptGoToStep(targetStep) {
  if (targetStep > bookState.currentStep) {
    for (let s = bookState.currentStep; s < targetStep; s++) {
      if (!validateStep(s)) return false;
    }
  }
  goToStep(targetStep);
  return true;
}

function validateStep(stepNum) {
  if (stepNum === 1 && !bookState.selectedOccasion) {
    alert('Please choose what you are celebrating.');
    return false;
  }
  if (stepNum === 2) {
    if (!bookState.selectedDate) {
      alert('Please pick a date.');
      return false;
    }
    if (!isTimeSelected()) {
      alert('Please pick a time.');
      return false;
    }
  }
  return true;
}

function goToStep(stepNum) {
  if (stepNum < 1 || stepNum > LAST_STEP) return;
  bookState.currentStep = stepNum;

  document.querySelectorAll('.booking-step-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(`stepPanel${stepNum}`)?.classList.add('active');

  document.querySelectorAll('.progress-step-pill').forEach(pill => {
    const pStep = parseInt(pill.getAttribute('data-step'), 10);
    pill.classList.toggle('active', pStep === stepNum);
    pill.classList.toggle('completed', pStep < stepNum);
  });

  document.getElementById('bookingProgressTracker')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ========================================================
   1. URL PARAMETERS & OCCASION
   ======================================================== */
function initUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const occasionParam = params.get('occasion');

  // Optional pre-selection from links, e.g. /book?hours=5
  const hoursParam = parseInt(params.get('hours'), 10);
  if (durationItinerary[hoursParam]) bookState.selectedDuration = hoursParam;

  if (!occasionParam) {
    selectCuratedOccasion('Proposals');
    return;
  }

  const decoded = decodeURIComponent(occasionParam).trim();
  const lower = decoded.toLowerCase();
  if (['private event', 'private', 'bespoke', 'charter'].includes(lower)) {
    selectPrivateEvent();
    return;
  }

  const match = curatedOccasions.find(key => key.toLowerCase() === lower);
  if (match) {
    selectCuratedOccasion(match);
  } else {
    // Unknown occasion name: treat as "Something else" with that name
    selectPrivateEvent();
    const customInput = document.getElementById('customEventNameInput');
    if (customInput) customInput.value = decoded;
    bookState.customEventName = decoded;
  }
}

function setOccasionRadio(value) {
  const radio = document.querySelector(`input[name="bookingOccasion"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function selectPrivateEvent() {
  bookState.isPrivateEvent = true;
  bookState.selectedOccasion = 'Private Event / Custom Charter';
  setPageBackground(privateEventBackground);
  setOccasionRadio('Private Event');
  document.getElementById('customPrivateInputWrap')?.classList.add('active');
  updateSummarySidebar();
}

function selectCuratedOccasion(occasionName) {
  bookState.isPrivateEvent = false;
  bookState.selectedOccasion = occasionName;
  setPageBackground(occasionBackgrounds[occasionName]);
  setOccasionRadio(occasionName);
  document.getElementById('customPrivateInputWrap')?.classList.remove('active');
  updateSummarySidebar();
}

function getDisplayOccasion() {
  if (!bookState.isPrivateEvent) {
    const radio = document.querySelector(`input[name="bookingOccasion"][value="${bookState.selectedOccasion}"]`);
    return radio?.closest('label')?.querySelector('.event-choice-name')?.textContent || bookState.selectedOccasion;
  }
  return bookState.customEventName ? `Private Event: ${bookState.customEventName}` : 'Private / custom event';
}

function initOccasionPicker() {
  const customInput = document.getElementById('customEventNameInput');
  if (customInput) {
    customInput.addEventListener('input', () => {
      bookState.customEventName = customInput.value.trim();
      updateSummarySidebar();
    });
  }

  document.querySelectorAll('input[name="bookingOccasion"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'Private Event') {
        selectPrivateEvent();
        customInput?.focus();
      } else {
        selectCuratedOccasion(radio.value);
      }
    });
  });
}

/* ========================================================
   2. DURATION, DATE & EXACT AVAILABLE TIMES
   ======================================================== */
function initDuration() {
  const radio = document.querySelector(`input[name="voyageDuration"][value="${bookState.selectedDuration}"]`);
  if (radio) radio.checked = true;

  document.querySelectorAll('input[name="voyageDuration"]').forEach(r => {
    r.addEventListener('change', () => {
      bookState.selectedDuration = parseInt(r.value, 10) || 3;
      // A longer charter may no longer fit: keep the date only if it still has a free time
      if (bookState.selectedDate && !isDateAvailable(bookState.selectedDate)) bookState.selectedDate = null;
      clearTimeIfTaken();
      renderCalendar();
      renderStartTimeOptions();
      updateSummarySidebar();
    });
  });
}

function calculateCurrentTotal() {
  return bookState.selectedSlot ? getCharterPrice(bookState.selectedSlot, bookState.selectedDuration) : null;
}

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

function getSlotTimingLabel() {
  if (!bookState.selectedSlot || !Number.isFinite(bookState.startHour)) return '';
  return slotTimingLabelFor(bookState.selectedSlot, bookState.startHour, bookState.selectedDuration);
}

function getOccupied(dateIso) {
  return bookState.occupied[dateIso] || [];
}

function isStartFree(dateIso, startHour, duration = bookState.selectedDuration) {
  return isRangeFree(startHour, startHour + duration, getOccupied(dateIso));
}

// Every free start time on a date, across both slots: [{ slotKey, startHour }]
function getFreeTimes(dateIso) {
  const times = [];
  Object.keys(charterSlots).forEach(slotKey => {
    startHourOptionsFor(slotKey, bookState.selectedDuration).forEach(h => {
      if (isStartFree(dateIso, h)) times.push({ slotKey, startHour: h });
    });
  });
  return times;
}

function countAllTimes() {
  return Object.keys(charterSlots).reduce((n, key) => n + startHourOptionsFor(key, bookState.selectedDuration).length, 0);
}

function isDateAvailable(dateIso) {
  return dateIso >= todayIso && getFreeTimes(dateIso).length > 0;
}

function isTimeSelected() {
  return Boolean(bookState.selectedDate && bookState.selectedSlot && Number.isFinite(bookState.startHour)
    && startHourOptionsFor(bookState.selectedSlot, bookState.selectedDuration).includes(bookState.startHour)
    && isStartFree(bookState.selectedDate, bookState.startHour));
}

// Drop the chosen time if it no longer fits (date/duration changed or someone booked it)
function clearTimeIfTaken() {
  if (!isTimeSelected()) {
    bookState.selectedSlot = null;
    bookState.startHour = null;
  }
}

function initCalendar() {
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');

  prevBtn?.addEventListener('click', () => {
    if (bookState.currentYear === today.getFullYear() && bookState.currentMonth === today.getMonth()) return;
    bookState.currentMonth--;
    if (bookState.currentMonth < 0) { bookState.currentMonth = 11; bookState.currentYear--; }
    renderCalendar();
  });

  nextBtn?.addEventListener('click', () => {
    bookState.currentMonth++;
    if (bookState.currentMonth > 11) { bookState.currentMonth = 0; bookState.currentYear++; }
    renderCalendar();
  });

  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendarDaysGrid');
  const monthLabel = document.getElementById('currentMonthLabel');
  if (!grid || !monthLabel) return;

  monthLabel.textContent = `${monthNames[bookState.currentMonth]} ${bookState.currentYear}`;
  grid.innerHTML = '';

  const prevBtn = document.getElementById('prevMonthBtn');
  if (prevBtn) prevBtn.disabled = bookState.currentYear === today.getFullYear() && bookState.currentMonth === today.getMonth();

  const firstDay = new Date(bookState.currentYear, bookState.currentMonth, 1);
  const leading = (firstDay.getDay() + 6) % 7; // Monday-first
  const totalDays = new Date(bookState.currentYear, bookState.currentMonth + 1, 0).getDate();
  const allTimes = countAllTimes();

  for (let i = 0; i < leading; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day-cell empty';
    grid.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateIso = toIsoDate(new Date(bookState.currentYear, bookState.currentMonth, day));
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day-cell';
    cell.textContent = day;

    const dot = document.createElement('span');
    dot.className = 'day-dot';

    const isPast = dateIso < todayIso;
    const freeCount = isPast ? 0 : getFreeTimes(dateIso).length;

    if (isPast) {
      cell.classList.add('disabled');
      cell.title = 'Date has passed';
    } else if (freeCount === 0) {
      cell.classList.add('disabled');
      dot.classList.add('booked');
      cell.title = `Fully booked for ${bookState.selectedDuration} hours`;
    } else if (freeCount < allTimes) {
      dot.classList.add('filling');
      cell.title = `${freeCount} time${freeCount === 1 ? '' : 's'} left`;
    } else {
      dot.classList.add('free');
      cell.title = 'All times open';
    }

    if (bookState.selectedDate === dateIso) cell.classList.add('selected');
    cell.appendChild(dot);

    if (freeCount > 0) {
      cell.addEventListener('click', () => {
        bookState.selectedDate = dateIso;
        clearTimeIfTaken();
        renderCalendar();
        renderStartTimeOptions();
        updateSummarySidebar();
        document.getElementById('timeQuestion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      cell.disabled = true;
    }

    grid.appendChild(cell);
  }
}

// The exact free times for the chosen date, as tappable buttons grouped by slot
function renderStartTimeOptions() {
  const container = document.getElementById('timeOptions');
  const question = document.getElementById('timeQuestion');
  if (!container) return;
  container.innerHTML = '';

  if (!bookState.selectedDate) {
    if (question) question.textContent = 'Pick a time';
    container.innerHTML = '<p class="time-empty">Pick a date to see the times available.</p>';
    return;
  }

  if (question) question.textContent = `Available times on ${formatShortDate(bookState.selectedDate)}`;
  const free = getFreeTimes(bookState.selectedDate);

  Object.entries(charterSlots).forEach(([slotKey, slot]) => {
    const group = document.createElement('div');
    group.className = 'time-group';

    const times = free.filter(t => t.slotKey === slotKey);
    group.innerHTML = `
      <div class="time-group-head">
        <span class="time-group-name">${slot.label.replace(' Slot', '')} <span class="time-group-window">${formatClock(slot.startHour)} – ${formatClock(slot.endHour)}</span></span>
        ${SHOW_PRICES ? `<span class="time-group-price">${formatCurrency(getCharterPrice(slotKey, bookState.selectedDuration))}</span>` : ''}
      </div>
    `;

    const list = document.createElement('div');
    list.className = 'time-chip-list';
    if (!times.length) {
      list.innerHTML = '<span class="time-empty">No times left</span>';
    }
    times.forEach(({ startHour }) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'time-chip';
      const isSelected = bookState.selectedSlot === slotKey && bookState.startHour === startHour;
      chip.classList.toggle('selected', isSelected);
      chip.setAttribute('aria-pressed', String(isSelected));
      chip.textContent = `${formatClock(startHour)} – ${formatClock(startHour + bookState.selectedDuration)}`;
      chip.addEventListener('click', () => {
        bookState.selectedSlot = slotKey;
        bookState.startHour = startHour;
        renderStartTimeOptions();
        updateSummarySidebar();
      });
      list.appendChild(chip);
    });

    group.appendChild(list);
    container.appendChild(group);
  });

  const note = document.createElement('p');
  note.className = 'time-note';
  note.textContent = `Times next to another booking aren't shown, as we keep a ${TURNAROUND_GAP_HOURS}-hour gap between charters.`;
  container.appendChild(note);
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
  if (!isLikelyRealPhone(phone)) {
    showFormError('Please enter a valid WhatsApp number (10-digit mobile, or with + country code).');
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
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const hasTime = Number.isFinite(bookState.startHour) && bookState.selectedSlot;

  set('sideSummaryOccasion', getDisplayOccasion());
  set('sideSummaryDate', formatShortDate(bookState.selectedDate) || '—');
  set('sideSummarySlot', hasTime ? formatRange(bookState.startHour, bookState.startHour + bookState.selectedDuration) : '—');
  set('sideSummaryDuration', `${bookState.selectedDuration} hours · ${getItineraryLabel(bookState.selectedDuration)}`);

  const countInput = document.getElementById('bookGuestCount');
  set('sideSummaryGuests', countInput ? countInput.value : String(bookState.guestDetails.guests || 2));

  const total = calculateCurrentTotal();
  if (!SHOW_PRICES) {
    set('sideSummaryQuoteTotal', 'Quoted on WhatsApp');
    return;
  }
  set('sideSummaryQuoteTotal', total ? formatCurrency(total)
    : `from ${formatCurrency(Math.min(...Object.keys(charterSlots).map(k => getCharterPrice(k, bookState.selectedDuration))))}`);
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

const PAY_BUTTON_LABEL = `Pay ${formatCurrency(DEPOSIT_AMOUNT)} to Book`;

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
  if (!ONLINE_PAYMENTS_ENABLED) return handleBookingRequest();
  if (!validateGuestForm()) return;
  if (!isTimeSelected()) {
    showFormError('Please go back to "Date & time" and pick an available time.');
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
      notes: bookState.guestDetails.notes === 'None' ? '' : bookState.guestDetails.notes,
      campaign: getCampaign()
    });
    if (!ok) {
      showFormError(data.error || 'Could not start the payment. Please try again.');
      if (data.code === 'SLOT_TAKEN') {
        // Someone else just took this time: refresh availability and let them re-pick
        await syncAvailability();
        if (bookState.selectedDate && !isDateAvailable(bookState.selectedDate)) bookState.selectedDate = null;
        clearTimeIfTaken();
        goToStep(2);
        renderStartTimeOptions();
        renderCalendar();
        updateSummarySidebar();
        alert(data.error);
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
    waBtn.href = `https://wa.me/918591206214?text=${waText}`;
  }
}

/* ========================================================
   7b. REQUEST MODE (while ONLINE_PAYMENTS_ENABLED is false)
   The request is saved as "Booking Requested" (time not blocked) and they send the
   details to the team on WhatsApp. No payment, QR or email for now.
   ======================================================== */
const BOOKING_WHATSAPP_NUMBER = '918591206214';

// Swap payment wording for request wording on the page
function loadRazorpayCheckout() {
  if (window.Razorpay || document.getElementById('razorpayCheckoutScript')) return;
  const script = document.createElement('script');
  script.id = 'razorpayCheckoutScript';
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  document.head.appendChild(script);
}

function applyPaymentMode() {
  if (ONLINE_PAYMENTS_ENABLED) {
    // The page's built-in text describes request mode; switch it to online payment wording
    const put = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    put('bookingHeroSub', `Pay ${formatCurrency(DEPOSIT_AMOUNT)} to hold your date. Our team calls you to plan the rest.`);
    put('btnPagePayText', PAY_BUTTON_LABEL);
    put('summaryPayNote', 'The rest is settled with our team. Refundable within 48 hours.');
    put('summarySecureNote', 'Secure payment by Razorpay · UPI, cards, net banking');
    put('receiptAdvancePaid', `${formatCurrency(DEPOSIT_AMOUNT)} (Secured via Razorpay)`);
    put('recAdvanceLabel', 'Advance Paid');
    put('recPaymentLabel', 'Razorpay Reference');
    ['recPaymentRow', 'recAdvanceRow'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; });
    const payToday = document.getElementById('summaryPayToday');
    if (payToday) { payToday.innerHTML = `<span>Pay today</span><strong>${formatCurrency(DEPOSIT_AMOUNT)}</strong>`; payToday.hidden = false; }
    const secure = document.getElementById('summarySecureNote');
    if (secure) secure.hidden = false;
    const priceRow = document.getElementById('summaryPriceRow');
    if (priceRow) priceRow.hidden = !SHOW_PRICES;
    if (SHOW_PRICES) put('summaryPriceLabel', 'Charter price');
    loadRazorpayCheckout();
    return;
  }
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('bookingHeroSub', 'Pick your date and time, then confirm with our team on WhatsApp.');
  set('btnPagePayText', REQUEST_BUTTON_LABEL);
  set('bookGuestEmailLabel', 'Email');
  set('summaryPayNote', 'Our team confirms availability and your booking with you on WhatsApp.');
  const priceRow = document.getElementById('summaryPriceRow');
  if (priceRow) priceRow.hidden = !SHOW_PRICES;
  if (SHOW_PRICES) set('summaryPriceLabel', 'Price');
}

const REQUEST_BUTTON_LABEL = 'Request Booking on WhatsApp';

function buildWhatsAppMessage(code) {
  const lines = [
    'Hi Black Pearl, I would like to book Lady Alice.',
    '',
    `Booking ref: ${code}`,
    `Occasion: ${getDisplayOccasion()}`,
    `Date: ${formatShortDate(bookState.selectedDate)}`,
    `Time: ${formatRange(bookState.startHour, bookState.startHour + bookState.selectedDuration)}`,
    `Duration: ${bookState.selectedDuration} hours (${getItineraryLabel(bookState.selectedDuration)})`,
    `Guests: ${bookState.guestDetails.guests}`,
    '',
    `Name: ${bookState.guestDetails.name}`,
    `Phone: ${bookState.guestDetails.phone}`,
    `Email: ${bookState.guestDetails.email}`
  ];
  if (bookState.guestDetails.notes && bookState.guestDetails.notes !== 'None') {
    lines.push(`Notes: ${bookState.guestDetails.notes}`);
  }
  return lines.join('\n');
}

async function handleBookingRequest() {
  if (!validateGuestForm()) return;
  if (!isTimeSelected()) {
    showFormError('Please go back to "Date & time" and pick an available time.');
    return;
  }

  // Open the WhatsApp tab now, inside the tap, so phones don't block it
  let waWindow = null;
  try {
    waWindow = window.open('', '_blank');
  } catch {
    waWindow = null;
  }

  setPayButton(true, 'Holding your slot...');

  try {
    const { ok, data } = await postJson('/api/create-order', {
      occasion: getDisplayOccasion(),
      slot: bookState.selectedSlot,
      durationHours: bookState.selectedDuration,
      startHour: bookState.startHour,
      dateIso: bookState.selectedDate,
      name: bookState.guestDetails.name,
      phone: bookState.guestDetails.phone,
      email: bookState.guestDetails.email,
      guests: bookState.guestDetails.guests,
      notes: bookState.guestDetails.notes === 'None' ? '' : bookState.guestDetails.notes,
      campaign: getCampaign()
    });

    if (!ok) {
      if (waWindow) waWindow.close();
      setPayButton(false, REQUEST_BUTTON_LABEL);
      if (data.code === 'SLOT_TAKEN') {
        await syncAvailability();
        if (bookState.selectedDate && !isDateAvailable(bookState.selectedDate)) bookState.selectedDate = null;
        clearTimeIfTaken();
        goToStep(2);
        renderStartTimeOptions();
        renderCalendar();
        updateSummarySidebar();
        alert(data.error);
        return;
      }
      showFormError(data.error || 'Could not send your request. Please try again.');
      return;
    }

    const waLink = `https://wa.me/${BOOKING_WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(data.bookingCode))}`;
    if (waWindow) waWindow.location.href = waLink;

    showRequestConfirmation(data.bookingCode, waLink);
  } catch (err) {
    console.error('[Booking] request failed', err);
    if (waWindow) waWindow.close();
    setPayButton(false, REQUEST_BUTTON_LABEL);
    showFormError('Could not reach our booking server. Please check your connection and try again.');
  }
}

function showRequestConfirmation(code, waLink) {
  const rows = [
    ['Booking ref', code],
    ['Occasion', getDisplayOccasion()],
    ['Date', formatShortDate(bookState.selectedDate)],
    ['Time', formatRange(bookState.startHour, bookState.startHour + bookState.selectedDuration)],
    ['Duration', `${bookState.selectedDuration} hours · ${getItineraryLabel(bookState.selectedDuration)}`],
    ['Guests', String(bookState.guestDetails.guests)],
    ...(SHOW_PRICES ? [['Charter price', formatCurrency(calculateCurrentTotal())]] : [])
  ];
  const summary = document.getElementById('requestSummary');
  if (summary) {
    summary.innerHTML = rows.map(([label, value]) => `
      <div class="receipt-row"><span class="r-label">${label}</span><span class="r-val"></span></div>`).join('');
    summary.querySelectorAll('.r-val').forEach((el, i) => { el.textContent = rows[i][1]; });
  }

  const ref = document.getElementById('requestRefCode');
  if (ref) ref.textContent = `Booking reference: ${code}`;
  const btn = document.getElementById('requestWhatsAppBtn');
  if (btn) btn.href = waLink;

  document.getElementById('bookingFlowContainer')?.classList.add('request-sent');
  const view = document.getElementById('requestConfirmView');
  if (view) {
    view.hidden = false;
    view.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    `DESCRIPTION:Private charter on Lady Alice luxury ship in Mumbai harbour. Held with Black Pearl.\\nBooking: ${hold.code}\\nGuest: ${hold.name}\\nPayment ID: ${hold.paymentId}`,
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
    clearTimeIfTaken();
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
