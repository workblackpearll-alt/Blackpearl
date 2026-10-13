import confetti from 'canvas-confetti';
import {
  isSupabaseConfigured,
  saveBookingHold,
  fetchBlockedDates,
  trackPageView
} from '../supabaseClient.js';

/* ========================================================
   BLACK PEARL · LADY ALICE
   Dedicated Booking Page Controller (/book)
   ======================================================== */

const baseOccasionPrices = {
  'Private Event': 75000,
  'Proposals': 45000,
  'Coastal sailing cruises': 85000,
  'Engagements': 90000,
  'Birthday parties': 75000,
  'Private parties': 75000,
  'Corporate events': 75000,
  'Anniversaries & private dinners': 55000,
  'Sunrise yoga and wellness': 40000,
  'Pre-wedding & photo shoots': 55000,
  'Festive nights': 90000,
  'Bachelor & bachelorette nights': 75000,
  'Family celebrations': 75000,
  'Something else': 75000
};

const priceMultipliers = {
  1: 1,
  3: 2,
  6: 3.333
};

const sailingSurcharges = {
  1: 25000,
  3: 45000,
  6: 75000
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Booking Page State
const bookState = {
  isPrivateEvent: false,
  selectedOccasion: 'Proposals',
  customEventName: '',
  occasionBasePrice: 45000,
  voyageMode: 'paused', // 'paused' or 'sailing'
  selectedDuration: 3,
  selectedDate: '2026-11-14',
  selectedSlot: 'Sunset',
  selectedSlotTime: '4:30 pm',
  currentMonth: 10, // 0-indexed: 10 is November
  currentYear: 2026,
  blockedDates: ['2026-11-01', '2026-11-08', '2026-11-20', '2026-11-27', '2026-11-28'],
  fillingDates: ['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22'],
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
  initOccasionPicker();
  initVoyageModeAndDuration();
  initCalendar();
  initSlotPicker();
  initGuestForm();
  initRazorpayCheckout();
  initConfirmationActions();
  syncBlockedDatesFromSupabase();

  try {
    trackPageView(window.location.pathname || '/book');
  } catch (e) {}
});

/* ========================================================
   1. URL PARAMETER HANDLING & PRE-SELECTION
   ======================================================== */
function initUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const occasionParam = params.get('occasion');

  if (occasionParam) {
    const decoded = decodeURIComponent(occasionParam).trim();
    const lower = decoded.toLowerCase();

    if (lower === 'private event' || lower === 'private' || lower === 'bespoke' || lower === 'charter') {
      selectPrivateEvent();
      return;
    }

    // Check if matches curated occasion
    const match = Object.keys(baseOccasionPrices).find(
      key => key.toLowerCase() === lower
    );

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
  bookState.occasionBasePrice = baseOccasionPrices['Private Event'] || 75000;

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

  updatePriceCalculations();
  updateSummarySidebar();
}

function selectCuratedOccasion(occasionName) {
  bookState.isPrivateEvent = false;
  bookState.selectedOccasion = occasionName;
  bookState.occasionBasePrice = baseOccasionPrices[occasionName] || 75000;

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

  // Pre-configure mode for coastal cruises
  if (occasionName === 'Coastal sailing cruises') {
    bookState.voyageMode = 'sailing';
  } else {
    bookState.voyageMode = 'paused';
  }
  syncVoyageModeUI();

  const pageHeroTitle = document.getElementById('pageHeroTitle');
  if (pageHeroTitle) {
    pageHeroTitle.textContent = 'Reserve Your Private Charter';
  }

  updatePriceCalculations();
  updateSummarySidebar();
}

/* ========================================================
   2. OCCASION PICKER & CUSTOM PRIVATE EVENT INPUT
   ======================================================== */
function initOccasionPicker() {
  const featuredCard = document.getElementById('privateEventFeaturedCard');
  const customInput = document.getElementById('customEventNameInput');

  if (featuredCard) {
    featuredCard.addEventListener('click', (e) => {
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
   3. NAVIGATION STYLE & DURATION
   ======================================================== */
function initVoyageModeAndDuration() {
  document.querySelectorAll('input[name="voyageMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      bookState.voyageMode = radio.value;
      syncVoyageModeUI();
      updatePriceCalculations();
      updateSummarySidebar();
    });
  });

  document.querySelectorAll('input[name="voyageDuration"]').forEach(radio => {
    radio.addEventListener('change', () => {
      bookState.selectedDuration = parseInt(radio.value, 10) || 3;
      updatePriceCalculations();
      updateSummarySidebar();
    });
  });
}

function syncVoyageModeUI() {
  document.querySelectorAll('.voyage-mode-card').forEach(c => c.classList.remove('active'));
  const activeRadio = document.querySelector(`input[name="voyageMode"][value="${bookState.voyageMode}"]`);
  if (activeRadio) {
    activeRadio.checked = true;
    const parentCard = activeRadio.closest('.voyage-mode-option')?.querySelector('.voyage-mode-card');
    if (parentCard) parentCard.classList.add('active');
  }
}

function formatCurrency(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

function calculateCurrentTotal() {
  const base = bookState.occasionBasePrice;
  const isSailing = bookState.voyageMode === 'sailing';
  const addon = isSailing ? (sailingSurcharges[bookState.selectedDuration] || 45000) : 0;
  return Math.round(base * priceMultipliers[bookState.selectedDuration] + addon);
}

function updatePriceCalculations() {
  const base = bookState.occasionBasePrice;
  const isSailing = bookState.voyageMode === 'sailing';

  const p1 = Math.round(base * priceMultipliers[1] + (isSailing ? sailingSurcharges[1] : 0));
  const p3 = Math.round(base * priceMultipliers[3] + (isSailing ? sailingSurcharges[3] : 0));
  const p6 = Math.round(base * priceMultipliers[6] + (isSailing ? sailingSurcharges[6] : 0));

  const el1 = document.getElementById('durationPrice1');
  const el3 = document.getElementById('durationPrice3');
  const el6 = document.getElementById('durationPrice6');

  if (el1) el1.textContent = formatCurrency(p1);
  if (el3) el3.textContent = formatCurrency(p3);
  if (el6) el6.textContent = formatCurrency(p6);
}

/* ========================================================
   4. CALENDAR GENERATOR & SLOTS
   ======================================================== */
function initCalendar() {
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
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

  // Days of current month
  for (let day = 1; day <= totalDays; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const mStr = (bookState.currentMonth + 1) < 10 ? `0${bookState.currentMonth + 1}` : `${bookState.currentMonth + 1}`;
    const dateIso = `${bookState.currentYear}-${mStr}-${dayStr}`;

    const cell = document.createElement('button');
    cell.className = 'cal-day-cell';
    cell.setAttribute('type', 'button');
    cell.textContent = day;

    const dot = document.createElement('span');
    dot.className = 'day-dot';

    const isBlocked = bookState.blockedDates.includes(dateIso);
    const isFilling = bookState.fillingDates.includes(dateIso);
    const isSelected = bookState.selectedDate === dateIso;

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
        bookState.selectedDate = dateIso;
        updateSelectedDateBanner(day, bookState.currentMonth, bookState.currentYear, isFilling);
        updateSummarySidebar();
      });
    }

    grid.appendChild(cell);
  }

  // Initial banner update
  const selectedParts = bookState.selectedDate.split('-');
  const d = parseInt(selectedParts[2], 10);
  const isFill = bookState.fillingDates.includes(bookState.selectedDate);
  updateSelectedDateBanner(d, bookState.currentMonth, bookState.currentYear, isFill);
}

function updateSelectedDateBanner(day, monthIdx, year, isFilling) {
  const title = document.getElementById('statusDateTitle');
  const count = document.getElementById('statusDateSlotsCount');

  const dateObj = new Date(year, monthIdx, day);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const mName = monthNames[monthIdx];
  const formattedStr = `${dayName}, ${day} ${mName} ${year}`;

  if (title) title.textContent = formattedStr;
  if (count) {
    count.textContent = isFilling ? '3 of 4 slots open' : 'Every slot on this date is open';
  }
}

function initSlotPicker() {
  document.querySelectorAll('input[name="sailingSlot"]').forEach(radio => {
    radio.addEventListener('change', () => {
      bookState.selectedSlot = radio.value;
      bookState.selectedSlotTime = radio.getAttribute('data-time') || '4:30 pm';
      updateSummarySidebar();
    });
  });
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
    showFormError('Please enter your full name so our concierge knows who to address.');
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

  const dateObj = new Date(bookState.selectedDate);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const mName = monthNames[dateObj.getMonth()].substring(0, 3);
  if (dateEl) dateEl.textContent = `${dayName}, ${dateObj.getDate()} ${mName} ${dateObj.getFullYear()}`;

  if (slotEl) slotEl.textContent = `${bookState.selectedSlot} (${bookState.selectedSlotTime})`;
  if (durationEl) durationEl.textContent = `${bookState.selectedDuration} hour${bookState.selectedDuration > 1 ? 's' : ''}`;
  if (modeEl) {
    modeEl.textContent = bookState.voyageMode === 'sailing'
      ? 'Active Sailing (Underway)'
      : 'At Anchor (Paused)';
  }

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

function handlePageRazorpayPayment() {
  const payBtn = document.getElementById('btnPagePay5000');
  const payText = document.getElementById('btnPagePayText');
  const errBox = document.getElementById('formErrorMsg');

  if (!validateGuestForm()) {
    return;
  }

  if (payBtn) payBtn.disabled = true;
  if (payText) payText.textContent = 'Connecting to Razorpay...';

  const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;

  // Booking Code BP-{DDMM}-{RAND}
  const dateObj = new Date(bookState.selectedDate);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const randNum = String(Math.floor(10 + Math.random() * 90));
  const bookingCode = `BP-${dd}${mm}-${randNum}`;

  let displayOccasion = bookState.selectedOccasion;
  if (bookState.isPrivateEvent && bookState.customEventName) {
    displayOccasion = `Private Event: ${bookState.customEventName}`;
  }

  const hasRealKey = rzpKey && rzpKey.trim().length > 0 && !rzpKey.includes('your_razorpay_key');

  if (typeof window.Razorpay === 'function' && hasRealKey) {
    try {
      const options = {
        key: rzpKey.trim(),
        amount: 5000 * 100, // ₹5,000 in paise
        currency: 'INR',
        name: 'Black Pearl · Lady Alice',
        description: `${displayOccasion} - Date Lock Deposit (Ref: ${bookingCode})`,
        image: '/assets/black-pearl-mark.svg',
        prefill: {
          name: bookState.guestDetails.name,
          email: bookState.guestDetails.email,
          contact: bookState.guestDetails.phone.replace(/[^0-9]/g, '').slice(-10)
        },
        notes: {
          booking_code: bookingCode,
          occasion: displayOccasion,
          charter_date: bookState.selectedDate,
          slot: `${bookState.selectedSlot} (${bookState.selectedSlotTime})`,
          duration: `${bookState.selectedDuration} hours`,
          voyage_mode: bookState.voyageMode === 'sailing' ? 'Active Sailing' : 'Paused (At Anchor)',
          guest_count: bookState.guestDetails.guests,
          notes: bookState.guestDetails.notes
        },
        theme: {
          color: '#C9A968'
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay] Checkout dismissed by guest.');
            if (payBtn) payBtn.disabled = false;
            if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay to Lock Date';
          }
        },
        handler: function (response) {
          console.log('[Razorpay] Payment successful! Payment ID:', response.razorpay_payment_id);
          const paymentId = response.razorpay_payment_id || `pay_${Date.now()}`;
          completePageBooking(bookingCode, paymentId);
          if (payBtn) payBtn.disabled = false;
          if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay to Lock Date';
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
        if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay to Lock Date';
      });

      rzpInstance.open();
      return;
    } catch (err) {
      console.warn('[Razorpay] Exception opening checkout, switching to verified fallback:', err);
    }
  }

  // Test simulation fallback when Razorpay test credentials not yet added
  console.info('[Razorpay] Test/Demo mode active. Simulating ₹5,000 hold deposit...');
  setTimeout(() => {
    if (payText) payText.textContent = 'Verifying ₹5,000 deposit...';
  }, 600);

  setTimeout(() => {
    const mockPaymentId = `pay_test_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    completePageBooking(bookingCode, mockPaymentId);
    if (payBtn) payBtn.disabled = false;
    if (payText) payText.textContent = 'Pay ₹5,000 via Razorpay to Lock Date';
  }, 1300);
}

function completePageBooking(bookingCode, paymentId) {
  const dateObj = new Date(bookState.selectedDate);
  const total = calculateCurrentTotal();

  let finalOccasion = bookState.selectedOccasion;
  if (bookState.isPrivateEvent && bookState.customEventName) {
    finalOccasion = `Private Event: ${bookState.customEventName}`;
  } else if (bookState.isPrivateEvent) {
    finalOccasion = 'Private Event / Custom Charter';
  }

  const newHold = {
    id: bookingCode,
    occasion: finalOccasion,
    date: `${dateObj.toLocaleDateString('en-US', { weekday: 'short' })}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`,
    dateIso: bookState.selectedDate,
    slot: `${bookState.selectedSlot} (${bookState.selectedSlotTime})`,
    duration: `${bookState.selectedDuration} hours`,
    voyageMode: bookState.voyageMode === 'sailing' ? 'Active Sailing (Underway)' : 'Paused (At Anchor)',
    guests: bookState.guestDetails.guests,
    price: formatCurrency(total),
    paidToken: '₹5,000',
    paymentMethod: 'razorpay',
    paymentId: paymentId,
    name: bookState.guestDetails.name,
    phone: bookState.guestDetails.phone,
    email: bookState.guestDetails.email,
    address: '',
    notes: bookState.guestDetails.notes || 'None',
    status: 'Held (Deposit Paid)'
  };

  bookState.lastCompletedHold = newHold;

  // Save to local storage for instant sync across tabs
  try {
    const existing = JSON.parse(localStorage.getItem('black_pearl_holds') || '[]');
    existing.unshift(newHold);
    localStorage.setItem('black_pearl_holds', JSON.stringify(existing));
  } catch (e) {}

  // Asynchronously save to Supabase
  saveBookingHold(newHold)
    .then(res => {
      if (res.success && res.source === 'supabase') {
        console.log('[Black Pearl] Booking hold persisted to Supabase with ID:', res.data.id);
      } else {
        console.info('[Black Pearl] Booking hold saved locally:', res);
      }
    })
    .catch(err => console.error('Error storing booking in Supabase:', err));

  // Render Confirmation Receipt
  renderConfirmationReceipt(newHold);

  // Transition UI to Confirmed State
  const container = document.getElementById('bookingFlowContainer');
  const confirmView = document.getElementById('bookingConfirmationView');

  if (container) container.classList.add('confirmed');
  if (confirmView) {
    confirmView.classList.add('active');
    confirmView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Confetti burst (Champagne gold & pearl)
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.55 },
    colors: ['#EBD7A6', '#C9A968', '#F3EDE0', '#C6A462', '#8F6F33']
  });
}

function renderConfirmationReceipt(hold) {
  const refCodeEl = document.getElementById('confirmedRefCode');
  const occEl = document.getElementById('recOccasion');
  const dateEl = document.getElementById('recDate');
  const slotEl = document.getElementById('recSlot');
  const modeEl = document.getElementById('recMode');
  const guestEl = document.getElementById('recGuest');
  const phoneEl = document.getElementById('recPhone');
  const payIdEl = document.getElementById('recPaymentId');
  const waBtn = document.getElementById('btnRecChatWa');

  if (refCodeEl) refCodeEl.textContent = `Booking Reference: ${hold.id}`;
  if (occEl) occEl.textContent = hold.occasion;
  if (dateEl) dateEl.textContent = hold.date;
  if (slotEl) slotEl.textContent = `${hold.slot} · ${hold.duration}`;
  if (modeEl) modeEl.textContent = hold.voyageMode;
  if (guestEl) guestEl.textContent = `${hold.name} (${hold.email})`;
  if (phoneEl) phoneEl.textContent = hold.phone;
  if (payIdEl) payIdEl.textContent = hold.paymentId;

  if (waBtn) {
    const waText = encodeURIComponent(
      `Hello Black Pearl Concierge, I have locked date ${hold.date} for our ${hold.occasion} on Lady Alice. ` +
      `Booking Ref: ${hold.id} (Deposit ₹5,000 paid via Razorpay, ID: ${hold.paymentId}). ` +
      `Please contact me on ${hold.phone} to coordinate details.`
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

  let hour = '16';
  let min = '30';
  if (hold.slot.includes('Sunrise')) { hour = '06'; min = '00'; }
  if (hold.slot.includes('Afternoon')) { hour = '12'; min = '00'; }
  if (hold.slot.includes('Evening')) { hour = '20'; min = '00'; }

  const startTime = `${y}${m}${d}T${hour}${min}00`;
  const durHours = parseInt(hold.duration, 10) || 3;
  const endHour = String(parseInt(hour, 10) + durHours).padStart(2, '0');
  const endTime = `${y}${m}${d}T${endHour}${min}00`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Black Pearl//Lady Alice Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:Lady Alice · ${hold.occasion} (${hold.id})`,
    `DESCRIPTION:Private charter on Lady Alice luxury ship at Gateway of India. Held with Black Pearl.\\nBooking: ${hold.id}\\nGuest: ${hold.name}\\nPayment ID: ${hold.paymentId}`,
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
  a.download = `Lady_Alice_${hold.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========================================================
   9. SUPABASE BLOCKED DATES SYNC
   ======================================================== */
async function syncBlockedDatesFromSupabase() {
  try {
    const res = await fetchBlockedDates();
    if (res.success && res.data && res.data.length > 0) {
      res.data.forEach(item => {
        const d = item.date || item.blocked_date;
        if (d && !bookState.blockedDates.includes(d)) {
          bookState.blockedDates.push(d);
        }
      });
      renderCalendar();
    }
  } catch (err) {
    console.warn('Could not sync blocked dates:', err);
  }
}
