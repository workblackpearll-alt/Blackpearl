/* ========================================================
   BLACK PEARL · LADY ALICE
   Charter slots, prices & itineraries — single source of truth.
   Imported by the booking page (book/book.js) and the server (api/).
   ======================================================== */

// Advance taken online for every booking (INR)
export const DEPOSIT_AMOUNT = 5000;

// Standard charter slots: one booking per slot per date.
// Hours are 24h clock; prices in INR for each duration.
export const charterSlots = {
  day: {
    label: 'Day Slot',
    startHour: 6,
    endHour: 14,
    prices: { 3: 115000, 5: 200000, 6: 225000 }
  },
  evening: {
    label: 'Evening Slot',
    startHour: 14,
    endHour: 23,
    prices: { 3: 195000, 5: 304000, 6: 345000 }
  }
};

// Fixed itinerary per duration (hours sailing, then at anchor)
export const durationItinerary = {
  3: { sailing: 1, anchored: 2 },
  5: { sailing: 1.5, anchored: 3.5 },
  6: { sailing: 3, anchored: 3 }
};

export function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export function formatClock(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 || hour === 24 ? 'am' : 'pm'}`;
}

function formatHours(h) {
  return `${h} hr${h === 1 ? '' : 's'}`;
}

export function getItineraryLabel(duration) {
  const plan = durationItinerary[duration];
  return `${formatHours(plan.sailing)} sailing · ${formatHours(plan.anchored)} at anchor`;
}

export function getSlotTimingLabel(slotKey, startHour, duration) {
  return `${charterSlots[slotKey].label} · ${formatClock(startHour)} – ${formatClock(startHour + duration)}`;
}

// Hourly start times that keep the whole charter inside the slot window
export function getStartHourOptions(slotKey, duration) {
  const slot = charterSlots[slotKey];
  const options = [];
  for (let h = slot.startHour; h + duration <= slot.endHour; h++) {
    options.push(h);
  }
  return options;
}

export function getCharterPrice(slotKey, duration) {
  return charterSlots[slotKey].prices[duration];
}

// Maps a stored slot label (new or legacy) to 'day' / 'evening'
export function slotKeyFromLabel(label) {
  const l = (label || '').toLowerCase();
  if (/day|sunrise|morning|afternoon/.test(l)) return 'day';
  if (/evening|sunset|night/.test(l)) return 'evening';
  return null;
}
