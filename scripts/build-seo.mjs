/* Builds the SEO pages and files. Run after editing scripts/seo-occasions.mjs:
     node scripts/build-seo.mjs
   Writes:
     occasions/index.html            hub listing every occasion
     occasions/<slug>/index.html     one landing page per occasion
     public/sitemap.xml, public/robots.txt
   Header and footer are copied from terms/index.html so every page matches. */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, occasionPages } from './seo-occasions.mjs';
import { charterSlots, formatCurrency, getItineraryLabel } from '../shared/pricing.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const WHATSAPP = 'https://wa.me/918591206214';
const PHONE = '+91-85912-06214';
const ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: 'Jetty No. 2, Princess Ferry Wharf (Bhaucha Dhakka)',
  addressLocality: 'Mazgaon, Mumbai',
  addressRegion: 'Maharashtra',
  postalCode: '400010',
  addressCountry: 'IN'
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n  </script>`;
const bySlug = Object.fromEntries(occasionPages.map(p => [p.slug, p]));

// Shared chrome from an existing subpage
const template = readFileSync(join(ROOT, 'terms/index.html'), 'utf8');
const header = template.slice(template.indexOf('  <!-- Header / Navigation -->'), template.indexOf('</header>') + '</header>'.length);
const footer = template.slice(template.indexOf('  <!-- FOOTER -->'), template.indexOf('</footer>') + '</footer>'.length)
  .replace(' style="color: #FFFFFF;"', '');
const fontsHead = template.slice(template.indexOf('  <!-- Favicon -->'), template.indexOf('</head>'));
if (!header || !footer || !fontsHead) throw new Error('Could not read the header/footer from terms/index.html');

function head({ title, description, path, image }) {
  const url = `${SITE_URL}${path}`;
  const img = `${SITE_URL}/assets/images/${image}`;
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#050506">
  <meta name="geo.region" content="IN-MH">
  <meta name="geo.placename" content="Mumbai">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Black Pearl Mumbai">
  <meta property="og:locale" content="en_IN">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${img}">

${fontsHead}</head>`;
}

function priceTable() {
  const rows = Object.values(charterSlots).map(slot => `
            <tr>
              <th scope="row">${esc(slot.label)}<span>${slot.startHour > 12 ? slot.startHour - 12 : slot.startHour} ${slot.startHour >= 12 ? 'pm' : 'am'} – ${slot.endHour > 12 ? slot.endHour - 12 : slot.endHour} ${slot.endHour >= 12 ? 'pm' : 'am'}</span></th>
              ${[3, 5, 6].map(h => `<td>${formatCurrency(slot.prices[h])}</td>`).join('\n              ')}
            </tr>`).join('');
  return `
        <div class="occ-table-wrap">
          <table class="occ-price-table">
            <caption>Whole-yacht charter price, up to 100 guests</caption>
            <thead><tr><th scope="col">Slot</th><th scope="col">3 hours</th><th scope="col">5 hours</th><th scope="col">6 hours</th></tr></thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
        <p class="occ-small">${[3, 5, 6].map(h => `${h} hours: ${esc(getItineraryLabel(h))}`).join(' · ')}</p>`;
}

function breadcrumbs(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE_URL}${path}` }))
  };
}

function occasionPage(p) {
  const path = `/occasions/${p.slug}`;
  const bookUrl = `/book?occasion=${encodeURIComponent(p.occasion)}&hours=${p.recommended.hours}`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: p.h1,
        serviceType: `${p.occasion} on a private yacht`,
        description: p.description,
        url: `${SITE_URL}${path}`,
        image: `${SITE_URL}/assets/images/${p.image}`,
        areaServed: { '@type': 'City', name: 'Mumbai' },
        provider: { '@type': 'LocalBusiness', '@id': `${SITE_URL}/#business`, name: 'Black Pearl · Lady Alice', telephone: PHONE, address: ADDRESS }
      },
      {
        '@type': 'FAQPage',
        mainEntity: p.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
      },
      breadcrumbs([['Home', '/'], ['Occasions', '/occasions'], [p.navLabel, path]])
    ]
  };

  return `${head({ title: p.title, description: p.description, path, image: p.image })}
<body class="subpage-body">

${header}

  <main class="subpage-main occ-page">

    <nav class="occ-breadcrumb container" aria-label="Breadcrumb">
      <a href="/">Home</a><span aria-hidden="true">/</span><a href="/occasions">Occasions</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.navLabel)}</span>
    </nav>

    <section class="occ-hero container">
      <div class="occ-hero-text">
        <span class="minimal-kicker">${esc(p.kicker)}</span>
        <h1 class="minimal-title">${esc(p.h1)}</h1>
        ${p.intro.map(t => `<p class="occ-lead">${esc(t)}</p>`).join('\n        ')}
        <div class="occ-cta-row">
          <a href="${bookUrl}" class="occ-btn occ-btn-primary">Check available dates</a>
          <a href="${WHATSAPP}?text=${encodeURIComponent(`Hi Black Pearl, I'm planning ${p.occasion.toLowerCase()} on Lady Alice.`)}" class="occ-btn" target="_blank" rel="noopener">Ask on WhatsApp</a>
        </div>
      </div>
      <figure class="occ-hero-media">
        <img src="/assets/images/${p.image}" alt="${esc(p.imageAlt)}" width="900" height="1100" fetchpriority="high">
      </figure>
    </section>

    <section class="occ-section container">
      <h2 class="occ-h2">What you get</h2>
      <ul class="occ-list">
        ${p.highlights.map(h => `<li>${esc(h)}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="occ-section container">
      <h2 class="occ-h2">Timings and pricing</h2>
      <p>${esc(p.recommended.note)} Charters run in a day slot (6 am – 2 pm) or an evening slot (2 pm – 11 pm), for 3, 5 or 6 hours. ${[3, 5, 6].map(h => `${h} hours: ${esc(getItineraryLabel(h))}`).join(' · ')}.</p>
      <p>Every event is different, so we quote each charter personally. Send your request and our team shares pricing for your date, slot and plans on WhatsApp.</p>
    </section>

    <section class="occ-section container">
      <h2 class="occ-h2">Where you board</h2>
      <p>Guests board at <strong>Jetty No. 2, Princess Ferry Wharf (Bhaucha Dhakka), Mazgaon, Mumbai 400010</strong>, near Dockyard Road station on the Harbour Line. Lady Alice then heads to quieter waters on the outskirts of the harbour. See the <a href="/contact#boarding">boarding guide</a>.</p>
    </section>

    <section class="occ-section container">
      <div class="clean-faq-section occ-faq">
        <h2 class="occ-h2">Questions</h2>
        ${p.faqs.map(([q, a]) => `<div class="clean-faq-item">
          <button class="clean-faq-trigger" type="button"><span>${esc(q)}</span><span class="faq-toggle-icon">+</span></button>
          <div class="clean-faq-content">${esc(a)}</div>
        </div>`).join('\n        ')}
      </div>
    </section>

    <section class="occ-section container">
      <h2 class="occ-h2">Other occasions on Lady Alice</h2>
      <div class="occ-related">
        ${p.related.map(s => bySlug[s]).filter(Boolean).map(r => `<a href="/occasions/${r.slug}" class="occ-related-card">
          <img src="/assets/images/${r.image}" alt="${esc(r.imageAlt)}" loading="lazy" width="400" height="260">
          <span>${esc(r.navLabel)}</span>
        </a>`).join('\n        ')}
      </div>
      <p class="occ-small"><a href="/occasions">See all occasions</a> · <a href="/gallery">Photo gallery</a> · <a href="/about">About Lady Alice</a></p>
    </section>

    <section class="occ-final container">
      <h2 class="occ-h2">Ready to pick a date?</h2>
      <p>See which times are free, send your request, and our team confirms everything with you on WhatsApp.</p>
      <a href="${bookUrl}" class="occ-btn occ-btn-primary">Check available dates</a>
    </section>
  </main>

${footer}

  ${jsonLd(schema)}
  <script type="module" src="/subpages.js"></script>
  <script type="module" src="/whatsapp-button.js"></script>
</body>
</html>
`;
}

function hubPage() {
  const path = '/occasions';
  const title = 'Yacht Party & Celebration Ideas in Mumbai | Black Pearl · Lady Alice';
  const description = 'Proposals, birthdays, corporate events, engagements, bachelorette parties and harbour cruises on Lady Alice, a private yacht for up to 100 guests in Mumbai.';
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', name: 'Occasions on Lady Alice', url: `${SITE_URL}${path}`, description,
        mainEntity: { '@type': 'ItemList', itemListElement: occasionPages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.navLabel, url: `${SITE_URL}/occasions/${p.slug}` })) }
      },
      breadcrumbs([['Home', '/'], ['Occasions', path]])
    ]
  };
  return `${head({ title, description, path, image: 'lady-alice-mumbai-night-skyline.jpg' })}
<body class="subpage-body">

${header}

  <main class="subpage-main occ-page">
    <nav class="occ-breadcrumb container" aria-label="Breadcrumb">
      <a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Occasions</span>
    </nav>

    <section class="minimal-page-header">
      <div class="container">
        <span class="minimal-kicker">Occasions</span>
        <h1 class="minimal-title">Celebrations on a Private Yacht in Mumbai</h1>
        <p class="minimal-subtitle">One yacht, one booking at a time, up to 100 guests. Choose your occasion to see ideas and timings.</p>
      </div>
    </section>

    <section class="occ-section container">
      <div class="occ-hub-grid">
        ${occasionPages.map(p => `<a href="/occasions/${p.slug}" class="occ-hub-card">
          <img src="/assets/images/${p.image}" alt="${esc(p.imageAlt)}" loading="lazy" width="600" height="400">
          <span class="occ-hub-body">
            <span class="occ-hub-title">${esc(p.navLabel)}</span>
            <span class="occ-hub-desc">${esc(p.intro[0])}</span>
          </span>
        </a>`).join('\n        ')}
      </div>
    </section>

    <section class="occ-final container">
      <h2 class="occ-h2">Something else in mind?</h2>
      <p>Lady Alice hosts any private celebration. Tell us what you are planning.</p>
      <a href="/book?occasion=Private%20Event" class="occ-btn occ-btn-primary">Plan a custom charter</a>
    </section>
  </main>

${footer}

  ${jsonLd(schema)}
  <script type="module" src="/subpages.js"></script>
  <script type="module" src="/whatsapp-button.js"></script>
</body>
</html>
`;
}

function write(rel, content) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log('wrote', rel);
}

write('occasions/index.html', hubPage());
for (const p of occasionPages) write(`occasions/${p.slug}/index.html`, occasionPage(p));

// Sitemap (public pages only; admin, verify and api are excluded)
const pages = [
  ['/', '1.0', ['lady-alice-mumbai-night-skyline.jpg', 'lady-alice-sunset-poster.jpg', 'lady-alice-lounge-deck.jpg']],
  ['/book', '0.9'],
  ['/occasions', '0.9'],
  ...occasionPages.map(p => [`/occasions/${p.slug}`, '0.8', [p.image]]),
  ['/gallery', '0.7', ['lady-alice-turf-deck.jpg', 'private-dining.jpg', 'master-suite.jpg']],
  ['/about', '0.7'],
  ['/contact', '0.7'],
  ['/cancellation', '0.3'],
  ['/terms', '0.3'],
  ['/privacy', '0.3']
];
write('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map(([path, priority, images = []]) => `  <url>
    <loc>${SITE_URL}${path === '/' ? '/' : path}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${priority}</priority>${images.map(img => `
    <image:image><image:loc>${SITE_URL}/assets/images/${img}</image:loc></image:image>`).join('')}
  </url>`).join('\n')}
</urlset>
`);

write('public/robots.txt', `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /verify

Sitemap: ${SITE_URL}/sitemap.xml
`);
