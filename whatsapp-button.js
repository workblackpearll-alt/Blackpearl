/* ========================================================
   BLACK PEARL · Floating WhatsApp button (all public pages)
   Opens WhatsApp with a ready-written message.
   ======================================================== */

const WHATSAPP_NUMBER = '918591206214';

function prefilledMessage() {
  const path = window.location.pathname;
  if (path.startsWith('/book')) {
    return 'Hi Black Pearl, I have a question about booking Lady Alice.';
  }
  if (path.startsWith('/verify')) {
    return 'Hi Black Pearl, I have a question about my booking.';
  }
  return 'Hi Black Pearl, I would like to know more about celebrating on Lady Alice.';
}

const STYLES = `
.bp-whatsapp-float {
  position: fixed;
  right: calc(22px + env(safe-area-inset-right, 0px));
  bottom: calc(22px + env(safe-area-inset-bottom, 0px));
  z-index: 900;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0E0F12;
  border: 1px solid rgba(201, 169, 104, 0.65);
  color: #F3EDE0;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
  text-decoration: none;
  transition: transform 0.25s ease, opacity 0.25s ease, background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}
.bp-whatsapp-float svg {
  width: 28px;
  height: 28px;
}
.bp-whatsapp-float:hover,
.bp-whatsapp-float:focus-visible {
  background: #C9A968;
  border-color: #C9A968;
  color: #0E0F12;
  transform: translateY(-2px);
  outline: none;
}
.bp-whatsapp-float .bp-whatsapp-label {
  position: absolute;
  right: calc(100% + 12px);
  white-space: nowrap;
  background: #0E0F12;
  color: #F3EDE0;
  border: 1px solid rgba(201, 169, 104, 0.4);
  font-family: 'Jost', -apple-system, sans-serif;
  font-size: 13px;
  letter-spacing: 0.04em;
  padding: 8px 12px;
  opacity: 0;
  transform: translateX(6px);
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.bp-whatsapp-float:hover .bp-whatsapp-label,
.bp-whatsapp-float:focus-visible .bp-whatsapp-label {
  opacity: 1;
  transform: translateX(0);
}
@media (max-width: 680px) {
  .bp-whatsapp-float {
    right: calc(16px + env(safe-area-inset-right, 0px));
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: 54px;
    height: 54px;
  }
  .bp-whatsapp-float .bp-whatsapp-label {
    display: none;
  }
}
/* Hidden while the home hero is on screen */
.bp-whatsapp-float.bp-whatsapp-hidden {
  opacity: 0;
  transform: translateY(12px);
  pointer-events: none;
}
.bp-whatsapp-float { opacity: 1; }
@media print {
  .bp-whatsapp-float { display: none; }
}
`;

const WHATSAPP_ICON = `
<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M16.04 3C9.06 3 3.4 8.63 3.4 15.57c0 2.22.59 4.39 1.7 6.3L3.3 28.5l6.83-1.78a12.7 12.7 0 0 0 5.9 1.47h.01c6.98 0 12.66-5.63 12.66-12.57C28.7 8.63 23.02 3 16.04 3Zm0 22.98h-.01a10.5 10.5 0 0 1-5.35-1.46l-.38-.23-4.05 1.06 1.08-3.93-.25-.4a10.33 10.33 0 0 1-1.6-5.45c0-5.77 4.71-10.46 10.57-10.46 2.82 0 5.47 1.09 7.46 3.08a10.37 10.37 0 0 1 3.1 7.39c0 5.77-4.72 10.4-10.57 10.4Zm5.79-7.8c-.32-.16-1.88-.92-2.17-1.03-.29-.1-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57a9.5 9.5 0 0 1-1.77-2.19c-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.71-1.71-.98-2.34-.26-.62-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.11 1.08-1.11 2.64 0 1.56 1.14 3.07 1.3 3.28.16.21 2.24 3.4 5.43 4.77.76.33 1.35.52 1.81.67.76.24 1.45.2 2 .12.61-.09 1.88-.77 2.14-1.51.27-.74.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37Z"/>
</svg>`;

function addWhatsAppButton() {
  if (document.querySelector('.bp-whatsapp-float')) return;

  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);

  const link = document.createElement('a');
  link.className = 'bp-whatsapp-float';
  link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(prefilledMessage())}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', 'Chat with Black Pearl on WhatsApp');
  link.innerHTML = `${WHATSAPP_ICON}<span class="bp-whatsapp-label">Chat on WhatsApp</span>`;
  document.body.appendChild(link);
  hideOverHero(link);
}

// Home page: keep the button off the hero, show it once the hero scrolls away
function hideOverHero(link) {
  const hero = document.getElementById('arrival');
  if (!hero || !('IntersectionObserver' in window)) return;
  link.classList.add('bp-whatsapp-hidden');
  link.setAttribute('tabindex', '-1');
  new IntersectionObserver(([entry]) => {
    const overHero = entry.isIntersecting;
    link.classList.toggle('bp-whatsapp-hidden', overHero);
    if (overHero) link.setAttribute('tabindex', '-1');
    else link.removeAttribute('tabindex');
  }, { threshold: 0.15 }).observe(hero);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addWhatsAppButton);
} else {
  addWhatsAppButton();
}
