/* ========================================================
   BLACK PEARL · LADY ALICE
   Minimalist Subpages Interactions
   (Navigation, Gallery Filter & Lightbox, Contact Form, FAQ)
   ======================================================== */

import { saveContactInquiry, trackPageView } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  trackPageView(window.location.pathname || '/');
  initSubpageNavigation();
  initSubpageGallery();
  initSubpageContact();
  initSubpageFaq();
});

/* --- 1. Navigation & Mobile Drawer --- */
function initSubpageNavigation() {
  const header = document.getElementById('siteHeader');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  const drawerLinks = document.querySelectorAll('.mobile-nav-link');

  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 25) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
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
  }
}

/* --- 2. Minimal Gallery Tabs & Clean Modal Lightbox --- */
function initSubpageGallery() {
  const tabs = document.querySelectorAll('.gallery-nav-tab');
  const cards = document.querySelectorAll('.clean-photo-item');

  // Tab Filtering
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const filter = tab.getAttribute('data-filter');

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      cards.forEach(card => {
        const cat = card.getAttribute('data-category') || '';
        const categories = cat.split(/\s+/);
        if (filter === 'all' || categories.includes(filter)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Modal Lightbox
  const modal = document.getElementById('cleanGalleryModal');
  if (!modal) return;

  const modalImg = document.getElementById('modalImageDisplay');
  const modalTitle = document.getElementById('modalTitleDisplay');
  const modalSub = document.getElementById('modalSubDisplay');
  const modalIndex = document.getElementById('modalIndexDisplay');
  const closeBtn = document.getElementById('modalCloseBtn');
  const prevBtn = document.getElementById('modalPrevBtn');
  const nextBtn = document.getElementById('modalNextBtn');

  let activeIndex = 0;
  let visibleCards = [];

  const updateVisibleCards = () => {
    visibleCards = Array.from(cards).filter(card => card.style.display !== 'none');
  };

  const showItem = (index) => {
    updateVisibleCards();
    if (visibleCards.length === 0) return;

    if (index < 0) index = visibleCards.length - 1;
    if (index >= visibleCards.length) index = 0;
    activeIndex = index;

    const card = visibleCards[activeIndex];
    const src = card.getAttribute('data-src') || card.querySelector('img')?.src;
    const title = card.getAttribute('data-title') || '';
    const sub = card.getAttribute('data-sub') || '';

    if (modalImg) modalImg.src = src;
    if (modalTitle) modalTitle.textContent = title;
    if (modalSub) modalSub.textContent = sub;
    if (modalIndex) modalIndex.textContent = `${activeIndex + 1} of ${visibleCards.length}`;
  };

  cards.forEach(card => {
    card.addEventListener('click', () => {
      updateVisibleCards();
      const idx = visibleCards.indexOf(card);
      if (idx !== -1) {
        showItem(idx);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('clean-modal-stage')) {
      closeModal();
    }
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showItem(activeIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showItem(activeIndex + 1);
    });
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') showItem(activeIndex - 1);
    if (e.key === 'ArrowRight') showItem(activeIndex + 1);
  });
}

/* --- 3. Clean Contact Form --- */
function initSubpageContact() {
  const form = document.getElementById('contactInquiryForm');
  const alertMsg = document.getElementById('contactFeedback');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting inquiry...';
      }

      const formData = {
        name: form.querySelector('#inqName')?.value.trim() || '',
        phone: form.querySelector('#inqPhone')?.value.trim() || '',
        email: form.querySelector('#inqEmail')?.value.trim() || '',
        occasion: form.querySelector('#inqOccasion')?.value || '',
        date: form.querySelector('#inqDate')?.value || '',
        guests: form.querySelector('#inqGuests')?.value || '',
        notes: form.querySelector('#inqNotes')?.value.trim() || ''
      };

      const res = await saveContactInquiry(formData);

      if (alertMsg) {
        alertMsg.textContent = res.success
          ? `Thank you, ${formData.name}. Your inquiry for ${formData.occasion} has been received. Our charter desk will contact you on ${formData.phone} shortly.`
          : 'Sorry, we could not send your inquiry. Please try again or reach us on WhatsApp.';
        alertMsg.style.display = 'block';
      }

      if (res.success) form.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = res.success ? 'Inquiry Sent' : 'Request Consultation';
        if (res.success) {
          setTimeout(() => {
            submitBtn.textContent = 'Request Consultation';
          }, 3500);
        }
      }
    });
  }
}

/* --- 4. Clean Minimal FAQ Accordion --- */
function initSubpageFaq() {
  const items = document.querySelectorAll('.clean-faq-item');
  items.forEach(item => {
    const trigger = item.querySelector('.clean-faq-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        items.forEach(i => i.classList.remove('active'));
        if (!isOpen) {
          item.classList.add('active');
        }
      });
    }
  });
}
