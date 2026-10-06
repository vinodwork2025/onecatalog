/* Page renderer. Pure functions: data in, HTML string out.
   Products are written into the HTML at build time, so the catalog
   works with JavaScript switched off and Google indexes everything.
   The inline scripts only add polish: filtering, reveals, gallery, share. */

// ---------- helpers ----------

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

export function money(cfg, value) {
  if (value === '' || value == null) return null;
  const raw = String(value).trim();

  // Services rarely have one number. "From 1500", "50 per sq ft" and
  // "Quote after site visit" all pass through as written, so a furniture shop
  // can list sofa repair next to sofas.
  if (/[a-z]/i.test(raw)) {
    return raw.replace(/(?:^|(?<=\s))(\d[\d,]*)/g, (m) => (cfg.currencySymbol || '₹') + m);
  }

  const n = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return (cfg.currencySymbol || '₹') + n.toLocaleString('en-IN');
}

// Search results cut titles at about 60 characters. Use the longest
// candidate that fits, falling back to the shortest.
function fitTitle(...candidates) {
  const list = candidates.filter(Boolean);
  return list.find(t => t.length <= 60) || list[list.length - 1];
}

// Whole sentences up to 155 characters. If that leaves the text short
// (under 110), the next sentence is cut at a word instead.
function clip(text, max = 155) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  let out = '';
  for (const sentence of t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || []) {
    if ((out + sentence).trim().length > max) break;
    out += sentence;
  }
  if (out.trim().length >= 110) return out.trim();
  return t.slice(0, max - 1).replace(/[\s,:;]+\S*$/, '') + '…';
}

// "Ra Sofa and Furniture, Hyderabad" unless the city is already in the text.
function withCity(cfg, text) {
  return cfg.city && !String(text).toLowerCase().includes(cfg.city.toLowerCase()) ? `${text}, ${cfg.city}` : text;
}

// A plain number is a real price. Text such as "From 1500" is shown on the
// page but never put in schema.
function numericPrice(p) {
  const raw = String(p.price || '').trim();
  return /^[\d.,\s]+$/.test(raw) && Number(raw.replace(/[^0-9.]/g, '')) > 0 ? String(Number(raw.replace(/[^0-9.]/g, ''))) : '';
}

const anyPrice = products => products.some(p => money({}, p.price));

function bizId(cfg) { return cfg.siteUrl + '/#business'; }

// Phone link in international form. Without the + a phone may dial
// 919876543210 as a local number and the call fails.
function telHref(cfg) {
  return 'tel:+' + String(cfg.phone || cfg.whatsapp).replace(/\D/g, '');
}

// The WhatsApp message a product's Enquire button pre-fills. A product's own
// "enquiry" column wins, then the client's enquiryTemplate ({item} becomes the
// product name), then the standard message with the product code.
function enquiryText(cfg, p) {
  if (p.enquiry) return p.enquiry;
  if (cfg.enquiryTemplate) return cfg.enquiryTemplate.replace(/\{item\}/g, p.name);
  return `Hi ${cfg.name}, I'm interested in ${p.name}${p.sku ? ' (' + p.sku + ')' : ''}. Please share details.`;
}

function waLink(cfg, text) {
  return `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;
}

// ---------- icons ----------

const ICON = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.3-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.4-.5-.6-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 1.9 3 4.7 4.1 2.3.9 2.8.8 3.3.7.5-.1 1.6-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.2-.2-.5-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.2-1.3c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.9-1.4-1.3-2.9-1.3-4.5 0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.6 8.4-7.9 8.4z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.1 2.2 3 4 5.2 5.2l1.7-1.7c.2-.2.5-.3.8-.2 1 .3 2 .5 3.1.5.4 0 .7.3.7.7v2.8c0 .4-.3.7-.7.7C9.5 18.8 5 14.3 5 8.7 5 8.3 5.3 8 5.7 8h2.8c.4 0 .7.3.7.7 0 1.1.2 2.1.5 3.1.1.3 0 .6-.2.8l-1.7 1.7z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17.3-6.2 3.7 1.7-7L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.5 4.8 1.7 7z"/></svg>',
  nav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3 10.5l7.5 3L13.5 21z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h-4v-2h2V7h2v6z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7c0 .3 0 .6.1.8L8.4 11.2a3 3 0 1 0 0 3.6l6.7 3.4A3 3 0 1 0 18 16z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v2H4v17h16V4h-3V2h-2v2H9V2zm-1 7h12v10H6z"/></svg>'
};

// ---------- images ----------

// Photo sizes written by build.js. Square by default; "imageShape": "portrait"
// (clothes) gives 3:4. Thumbnails in img/sm/, full photos in img/.
function shape(cfg) {
  return cfg.imageShape === 'portrait' ? { w: 300, h: 400, W: 600, H: 800 } : { w: 400, h: 400, W: 800, H: 800 };
}

// Grid and related cards use the thumbnail, with the full image as the 2x
// source. The product page uses the full image.
function cardImg(cfg, p, name, eager) {
  const f = esc(p.images[0]);
  const s = shape(cfg);
  return `<img class="card-img" src="/img/sm/${f}" srcset="/img/sm/${f} ${s.w}w, /img/${f} ${s.W}w" sizes="(min-width:960px) 25vw, (min-width:560px) 33vw, 50vw" alt="${esc(name)}" width="${s.w}" height="${s.h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------- shell ----------

// Two-letter badge from the shop name, skipping filler words, so
// "The Best Wood Handicrafts" gives "BW" and "Ra Sofa and Furniture" gives "RS".
function initialsOf(name) {
  const words = String(name || '?').split(/\s+/).filter(w => /[a-z0-9]/i.test(w));
  const main = words.filter(w => !/^(the|and|of|&)$/i.test(w));
  return (main.length ? main : words).map(w => w.replace(/[^a-z0-9]/gi, '')[0] || '').join('').slice(0, 2).toUpperCase() || '?';
}

// The badge shown when there is no logo. "initials" in config (up to 3
// characters, e.g. "A-Z") overrides the letters taken from the name.
function badgeOf(cfg) {
  return String(cfg.initials || '').trim().slice(0, 3) || initialsOf(cfg.name);
}

// No logo yet: an inline initials icon in the client's accent colour, so the
// browser tab has an icon and never requests a missing /favicon.ico.
function favicon(cfg) {
  const initials = badgeOf(cfg);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${cfg.accent || '#C0392B'}"/><text x="32" y="${initials.length > 2 ? 40 : 42}" font-family="Arial,sans-serif" font-size="${initials.length > 2 ? 20 : 26}" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials)}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function head(cfg, { title, description, canonical, jsonld, css, image, bodyClass = '' }) {
  const ld = (jsonld || []).map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
  // Share preview: the logo if there is one, otherwise the page's own product photo.
  const og = image || (cfg.logo ? cfg.logo : '');
  return `<!doctype html>
<html lang="${esc(cfg.lang || 'en-IN')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<script>document.documentElement.className='js'</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:locale" content="en_IN">
<meta property="og:url" content="${esc(canonical)}">
${og ? `<meta property="og:image" content="${esc(cfg.siteUrl)}/img/${esc(og)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="robots" content="${cfg.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<meta name="theme-color" content="${esc(cfg.accent)}">
${cfg.logo ? `<link rel="icon" href="/img/${esc(cfg.logo)}">` : `<link rel="icon" href="${favicon(cfg)}">`}
<style>${css}</style>
${ld}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>`;
}

function header(cfg, { home = false } = {}) {
  const initials = badgeOf(cfg);
  const logo = cfg.logo
    ? `<img class="site-logo" src="/img/${esc(cfg.logo)}" alt="${esc(cfg.name)} logo" width="44" height="44">`
    : `<div class="site-logo site-logo-fallback${initials.length > 2 ? ' is-long' : ''}" aria-hidden="true">${esc(initials)}</div>`;
  const nameEl = home ? esc(cfg.name) : `<a href="/">${esc(cfg.name)}</a>`;
  return `<header class="site-head"><div class="wrap">
${home ? logo : `<a href="/" aria-label="${esc(cfg.name)} catalog home">${logo}</a>`}
<div><div class="site-name">${nameEl}</div>${cfg.tagline ? `<div class="site-tag">${esc(cfg.tagline)}</div>` : ''}</div>
<a class="head-call" href="${telHref(cfg)}" aria-label="Call ${esc(cfg.name)}">${ICON.phone}</a>
</div></header>`;
}

function announce(cfg) {
  if (!cfg.announcement) return '';
  const text = esc(cfg.announcement);
  return cfg.announcementUrl
    ? `<a class="announce" href="${esc(cfg.announcementUrl)}">${text}</a>`
    : `<div class="announce">${text}</div>`;
}

function footer(cfg, categories) {
  const catLinks = categories.slice(0, 8)
    .map(c => `<a href="/category/${c.slug}">${esc(c.name)}</a>`).join('');
  const buttons = [
    cfg.mapsUrl ? `<a class="btn btn-ghost" href="${esc(cfg.mapsUrl)}" rel="noopener">${ICON.nav}<span>Get directions</span></a>` : '',
    cfg.reviewUrl ? `<a class="btn btn-review" href="${esc(cfg.reviewUrl)}" rel="noopener">${ICON.star}<span>Rate us on Google</span></a>` : ''
  ].join('');
  return `<footer class="site-foot"><div class="wrap">
<div class="foot-grid">
<div class="foot-card">
<div class="foot-name">${esc(cfg.name)}</div>
<div class="foot-row">${ICON.phone}<div><div class="foot-label">Call or WhatsApp</div><a href="${telHref(cfg)}">${esc(cfg.phoneDisplay || cfg.phone || cfg.whatsapp)}</a></div></div>
${cfg.address ? `<div class="foot-row">${ICON.pin}<div><div class="foot-label">Address</div>${esc(cfg.address)}</div></div>` : ''}
${cfg.hours ? `<div class="foot-row">${ICON.clock}<div><div class="foot-label">Open</div>${esc(cfg.hours)}</div></div>` : ''}
${buttons ? `<div class="foot-btns">${buttons}</div>` : ''}
</div>
<div class="foot-card">
${catLinks ? `<div><div class="foot-label">Categories</div><div class="foot-links">${catLinks}</div></div>` : ''}
<div><div class="foot-label">Pages</div><div class="foot-links"><a href="/">Catalog</a><a href="/about">About us</a></div></div>
</div>
</div>
<div class="foot-credit">&copy; ${new Date().getFullYear()} ${esc(cfg.name)}${cfg.address ? ', ' + esc(cfg.city || '') : ''}.${cfg.hidePrices ? '' : ' All prices subject to change.'}${cfg.footerNote ? `<br>${cfg.footerNoteUrl ? `<a href="${esc(cfg.footerNoteUrl)}" rel="noopener">${esc(cfg.footerNote)}</a>` : esc(cfg.footerNote)}` : `<br><a href="https://${esc(cfg.platformDomain || 'onecatalog.in')}/">Catalogue made with OneCatalog</a>`}</div>
${cfg.mapEmbed && cfg.address ? `<iframe class="foot-map" title="Map to ${esc(cfg.name)}" src="https://www.google.com/maps?q=${encodeURIComponent([cfg.name, cfg.address, cfg.city, cfg.pincode].filter(Boolean).join(', '))}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
</div></footer>`;
}

function fab(cfg, text) {
  return `<div class="fab-row"><a class="fab-call" href="${telHref(cfg)}" aria-label="Call ${esc(cfg.name)}">${ICON.phone}</a><a class="fab" href="${waLink(cfg, text)}" rel="noopener">${ICON.wa}<span>WhatsApp</span></a></div>`;
}

// ---------- cards ----------

function card(cfg, p, i = 99) {
  const price = money(cfg, p.price);
  const priceEl = cfg.hidePrices ? '' : price
    ? `<div class="card-price">${esc(price)}</div>`
    : `<div class="card-price on-request">Price on request</div>`;
  // Clothes: the sizes (sold-out ones struck through) and how many colours.
  const sizesEl = p.sizes?.length
    ? `<div class="card-sizes">${p.sizes.map(x => p.sizesOut.includes(x) ? `<s>${esc(x)}</s>` : esc(x)).join(' ')}</div>`
    : '';
  const moreEl = p.groupSize > 1 ? `<div class="card-more">${p.groupSize} colours</div>` : '';
  const inner = `<div class="card-media">${cardImg(cfg, p, p.name, i < 2)}${p.inStock ? '' : '<span class="badge-out">Out of stock</span>'}</div>
<div class="card-body">
<div class="card-name">${esc(p.name)}</div>
${sizesEl}${moreEl}${priceEl}
</div>`;
  const data = `data-cat="${esc(p.categorySlug)}" data-name="${esc(p.name.toLowerCase())}"`;
  // With cardWhatsApp, every card also gets its own Enquire button. Links
  // cannot nest, so the card becomes a box holding two links.
  if (cfg.cardWhatsApp) {
    return `<div class="card card-has-wa" ${data}><a class="card-main" href="/${p.slug}">${inner}</a><a class="card-wa" href="${waLink(cfg, enquiryText(cfg, p))}" rel="noopener" aria-label="Enquire on WhatsApp about ${esc(p.name)}">${ICON.wa}<span>Enquire</span></a></div>`;
  }
  return `<a class="card" href="/${p.slug}" ${data}>
${inner}</a>`;
}

// ---------- pages ----------

export function renderIndex(cfg, products, categories, css) {
  const showSearch = products.length >= 40;
  const jsonld = [
    {
      '@context': 'https://schema.org',
      // A more exact subtype when the client has one (FurnitureStore,
      // HomeGoodsStore, ClothingStore...). LocalBusiness otherwise.
      '@type': cfg.businessType || 'LocalBusiness',
      '@id': bizId(cfg),
      name: cfg.name,
      description: cfg.tagline || cfg.about || cfg.name,
      url: cfg.siteUrl,
      telephone: '+' + String(cfg.whatsapp),
      ...(cfg.logo || products[0] ? { image: `${cfg.siteUrl}/img/${cfg.logo || products[0].images[0]}` } : {}),
      ...(cfg.mapsUrl ? { hasMap: cfg.mapsUrl } : {}),
      ...(cfg.address ? {
        address: {
          '@type': 'PostalAddress',
          streetAddress: cfg.address,
          addressLocality: cfg.city || '',
          addressRegion: cfg.state || '',
          postalCode: cfg.pincode || '',
          addressCountry: cfg.country || 'IN'
        }
      } : {}),
      // Schema wants "Mo-Su 10:30-21:30". "openingHours" in config gives that;
      // the free-text "hours" is only the fallback.
      ...(cfg.openingHours || cfg.hours ? { openingHours: cfg.openingHours || cfg.hours } : {}),
      ...(cfg.areasServed ? { areaServed: cfg.areasServed.split(',').map(s => s.trim()).filter(Boolean) } : {})
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${cfg.name} product catalog`,
      numberOfItems: products.length,
      itemListElement: products.slice(0, 100).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${cfg.siteUrl}/${p.slug}`,
        name: p.name
      }))
    }
  ];

  // With mainCategory set: "[Shop] | [Main category] in [Area, City]", shortened
  // to fit 60 characters. Without it, the older pattern from metaHeadline.
  const lead = cfg.metaHeadline || cfg.tagline || 'Product Catalog';
  const place = [cfg.area, cfg.city].filter(Boolean);
  const title = cfg.mainCategory
    ? fitTitle(
      place.length ? `${cfg.name} | ${cfg.mainCategory} in ${place.join(', ')}` : '',
      place.length ? `${cfg.name} | ${cfg.mainCategory} in ${place[0]}` : '',
      `${cfg.name} | ${cfg.mainCategory}`,
      withCity(cfg, `${cfg.name} Catalog`), cfg.name)
    : fitTitle(withCity(cfg, `${cfg.name} | ${lead}`), `${cfg.name} | ${lead}`, withCity(cfg, `${cfg.name} Catalog`), cfg.name);
  const description = clip(cfg.metaDescription
    || `Browse the product catalog of ${cfg.name}${cfg.city ? ' in ' + cfg.city : ''}. ${products.length} products with photos${anyPrice(products) ? ' and prices' : ''}. Enquire directly on WhatsApp.`);

  const chips = [`<button class="chip is-on" data-filter="all" aria-pressed="true">All <span class="n">${products.length}</span></button>`]
    .concat(categories.map(c => `<button class="chip" data-filter="${esc(c.slug)}" aria-pressed="false">${esc(c.name)} <span class="n">${c.count}</span></button>`))
    .join('');

  const pills = [
    cfg.city ? `<li>${ICON.pin}${esc(cfg.city)}</li>` : '',
    cfg.since ? `<li>${ICON.cal}Since ${esc(cfg.since)}</li>` : '',
    `<li>${ICON.grid}${products.length} products</li>`,
    cfg.hours ? `<li class="wide-only">${ICON.clock}${esc(cfg.hours)}</li>` : ''
  ].join('');

  const greeting = cfg.waGreeting || `Hi ${cfg.name}, I saw your catalog.`;
  const hero = `<section class="hero"><div class="wrap">
<h1>${esc(cfg.h1 || cfg.metaHeadline || cfg.tagline || cfg.name)}</h1>
${cfg.metaHeadline && cfg.tagline && cfg.tagline.toLowerCase() !== cfg.metaHeadline.toLowerCase() ? `<p class="hero-sub">${esc(cfg.tagline)}</p>` : ''}
<ul class="pills">${pills}</ul>
<div class="hero-actions">
<a class="btn btn-wa" href="${waLink(cfg, greeting)}" rel="noopener">${ICON.wa}<span>Chat on WhatsApp</span></a>
<a class="btn btn-ghost" href="${telHref(cfg)}" style="margin-top:0">${ICON.phone}<span>Call</span></a>
</div>
</div></section>`;

  return head(cfg, { title, description, canonical: cfg.siteUrl + '/', jsonld, css, image: products[0]?.images[0], bodyClass: 'has-fab' })
    + header(cfg, { home: true })
    + announce(cfg)
    + hero
    + (categories.length > 1 ? `<nav class="cats" aria-label="Categories"><div class="cats-scroll">${chips}</div></nav>` : '')
    + (showSearch ? `<div class="search-row">${ICON.search}<input id="q" type="search" placeholder="Search ${products.length} products" aria-label="Search products"></div>` : '')
    + `<main id="main"><div class="grid ${cfg.layout === 'grid-large' ? 'layout-large' : ''}" id="grid">${products.map((p, i) => card(cfg, p, i)).join('')}</div>
<p class="empty" id="empty" hidden>No products match that. Try another category.</p></main>`
    + footer(cfg, categories)
    + fab(cfg, greeting)
    + indexScript()
    + revealScript()
    + `</body></html>`;
}

export function renderCategory(cfg, cat, products, categories, css) {
  // "[Category] in [Area or City] | [Shop]", shortened to fit 60 characters.
  const where = cfg.area || cfg.city;
  const title = fitTitle(
    where ? `${cat.name} in ${where} | ${cfg.name}` : '',
    cfg.area && cfg.city ? `${cat.name} in ${cfg.city} | ${cfg.name}` : '',
    `${cat.name} | ${cfg.name}`,
    where ? `${cat.name} in ${where}` : '',
    cat.name);
  // Optional intro paragraph per category ("categoryIntros" in config, keyed by
  // category name). It also becomes the page's meta description.
  const intro = (cfg.categoryIntros || {})[cat.name] || '';
  const description = clip(intro || `${cat.name} at ${withCity(cfg, cfg.name)}. ${products.length} option${products.length === 1 ? '' : 's'} with photos${anyPrice(products) ? ' and prices' : ''}: ${products.slice(0, 3).map(p => p.name).join(', ')}. Enquire on WhatsApp.`);
  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cat.name} at ${cfg.name}`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${cfg.siteUrl}/${p.slug}`, name: p.name }))
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Catalog', item: cfg.siteUrl + '/' },
      { '@type': 'ListItem', position: 2, name: cat.name, item: `${cfg.siteUrl}/category/${cat.slug}` }
    ]
  }];
  const others = categories.filter(c => c.slug !== cat.slug);
  return head(cfg, { title, description, canonical: `${cfg.siteUrl}/category/${cat.slug}`, jsonld, css, image: products[0]?.images[0], bodyClass: 'has-fab' })
    + header(cfg)
    + announce(cfg)
    + `<nav class="crumb" aria-label="Breadcrumb"><a href="/">Catalog</a> / ${esc(cat.name)}</nav>`
    + `<div class="sec-head"><h1>${esc(cat.name)}</h1><p>${products.length} product${products.length === 1 ? '' : 's'} at ${esc(cfg.name)}</p>${intro ? `<p class="cat-intro">${esc(intro)}</p>` : ''}</div>`
    + (others.length ? `<nav class="cats" aria-label="Other categories" style="position:static;background:none;border:0;padding-bottom:0"><div class="cats-scroll"><a class="chip" href="/">All</a>${others.map(c => `<a class="chip" href="/category/${esc(c.slug)}">${esc(c.name)} <span class="n">${c.count}</span></a>`).join('')}</div></nav>` : '')
    + `<main id="main"><div class="grid ${cfg.layout === 'grid-large' ? 'layout-large' : ''}">${products.map((p, i) => card(cfg, p, i)).join('')}</div></main>`
    + footer(cfg, categories)
    + fab(cfg, `Hi ${cfg.name}, I'm looking at your ${cat.name}.`)
    + revealScript()
    + `</body></html>`;
}

export function renderProduct(cfg, p, related, categories, css, colours = []) {
  const price = money(cfg, p.price);
  const title = fitTitle(withCity(cfg, `${p.name} | ${cfg.name}`), `${p.name} | ${cfg.name}`, p.name);
  const description = clip(`${p.description ? p.description.replace(/([^.!?])$/, '$1.') + ' ' : ''}${price ? 'Price ' + price + '.' : 'Price on request.'} Enquire on WhatsApp with ${withCity(cfg, cfg.name)}.`);

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      url: `${cfg.siteUrl}/${p.slug}`,
      ...(p.category ? { category: p.category } : {}),
      ...(p.specs?.Colour ? { color: p.specs.Colour } : {}),
      ...(p.specs?.Material ? { material: p.specs.Material } : {}),
      ...(p.sizes?.length ? { size: p.sizes.filter(x => !p.sizesOut.includes(x)).join(', ') } : {}),
      ...(p.description ? { description: p.description } : {}),
      image: p.images.map(f => `${cfg.siteUrl}/img/${f}`),
      ...(p.sku ? { sku: p.sku } : {}),
      brand: { '@type': 'Brand', name: cfg.name },
      ...(numericPrice(p) ? { offers: {
        '@type': 'Offer',
        url: `${cfg.siteUrl}/${p.slug}`,
        priceCurrency: cfg.currency || 'INR',
        price: numericPrice(p),
        availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: cfg.name }
      } } : {})
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Catalog', item: cfg.siteUrl + '/' },
        ...(p.category ? [{ '@type': 'ListItem', position: 2, name: p.category, item: `${cfg.siteUrl}/category/${p.categorySlug}` }] : []),
        { '@type': 'ListItem', position: p.category ? 3 : 2, name: p.name, item: `${cfg.siteUrl}/${p.slug}` }
      ]
    }
  ];

  const specs = Object.entries(p.specs || {}).filter(([, v]) => v);
  const s = shape(cfg);
  const out = p.inStock ? '' : '<span class="badge-out" style="position:absolute;top:14px;left:14px">Out of stock</span>';
  // One photo: a plain image. Several: a swipe track, with small photos
  // underneath that jump to each one.
  const media = p.images.length > 1
    ? `<div class="pd-frame"><div class="pd-track" id="track" tabindex="0" aria-label="Photos of ${esc(p.name)}, swipe for more">${p.images.map((f, i) => `<img class="pd-img" src="/img/${esc(f)}" alt="${esc(p.name)}${i ? ', photo ' + (i + 1) : ''}" width="${s.W}" height="${s.H}" ${i ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}>`).join('')}</div>${out}</div>`
      + `<div class="pd-strip" role="group" aria-label="More photos">${p.images.map((f, i) => `<button type="button" aria-label="Show photo ${i + 1} of ${p.images.length}"${i === 0 ? ' aria-current="true"' : ''}><img src="/img/sm/${esc(f)}" alt="" width="68" height="${Math.round(68 * s.h / s.w)}" loading="lazy" decoding="async"></button>`).join('')}</div>`
    : `<div class="pd-frame"><img class="pd-img" id="hero" src="/img/${esc(p.images[0])}" alt="${esc(p.name)}" width="${s.W}" height="${s.H}" fetchpriority="high">${out}</div>`;

  // Colours of the same design (rows sharing a "group"), each its own page.
  const colourEl = colours.length > 1
    ? `<div class="pd-opt"><div class="pd-label">Colour: <b>${esc(p.colour)}</b></div><div class="swatches">${colours.map(c => `<a class="swatch" href="/${esc(c.slug)}"${c.slug === p.slug ? ' aria-current="page"' : ''}><img src="/img/sm/${esc(c.images[0])}" alt="" width="44" height="${Math.round(44 * s.h / s.w)}" loading="lazy" decoding="async"><span>${esc(c.colour)}</span></a>`).join('')}</div></div>`
    : '';

  // Sizes: tap one and the WhatsApp message says which. Sold-out sizes are
  // crossed out and cannot be picked.
  const sizesEl = p.sizes?.length
    ? `<div class="pd-opt"><div class="pd-label">Size<span id="size-picked"></span>${p.sizeChart ? '<a class="pd-chart-link" href="#size-chart">Size chart</a>' : ''}</div><div class="sizes" role="radiogroup" aria-label="Size">${p.sizes.map(x => p.sizesOut.includes(x)
        ? `<button type="button" class="size" role="radio" aria-checked="false" disabled title="Sold out"><s>${esc(x)}</s><span class="sr"> sold out</span></button>`
        : `<button type="button" class="size" role="radio" aria-checked="false" data-size="${esc(x)}">${esc(x)}</button>`).join('')}</div><p class="size-hint">Pick your size and it goes into your WhatsApp message.${p.sizesOut.length ? ' Crossed out sizes are sold out.' : ''}</p></div>`
    : '';
  const chartEl = p.sizeChart
    ? `<details class="pd-chart" id="size-chart"><summary>Size chart</summary><img src="/img/${esc(p.sizeChart)}" alt="Size chart" loading="lazy" decoding="async"></details>`
    : '';
  const detailsEl = p.details?.length ? `<ul class="pd-details">${p.details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : '';

  const waText = enquiryText(cfg, p);
  const wa = waLink(cfg, waText);
  const tel = `${telHref(cfg)}`;
  const waData = p.sizes?.length ? ` data-wa="${esc(waText)}"` : '';

  // How to order, from the shop's own details. Off with "howToOrder": false.
  const steps = [
    `Tap <b>Enquire on WhatsApp</b>. The message already has the product name${p.sizes?.length ? ' and your size' : ''}.`,
    cfg.phoneDisplay ? `Or call us on <a href="${tel}">${esc(cfg.phoneDisplay)}</a>.` : '',
    cfg.address ? `Or visit us at ${esc(cfg.address)}${cfg.city ? ', ' + esc(cfg.city) : ''}.${cfg.hours ? ' Open ' + esc(cfg.hours.replace(/\.$/, '')) + '.' : ''}` : '',
    cfg.areasServed ? `We serve ${esc(cfg.areasServed)}.` : ''
  ].filter(Boolean);
  const howEl = cfg.howToOrder === false ? '' : `<section class="pd-how" aria-labelledby="how-h"><h2 id="how-h">How to order</h2><ol>${steps.map(x => `<li>${x}</li>`).join('')}</ol></section>`;

  return head(cfg, { title, description, canonical: `${cfg.siteUrl}/${p.slug}`, jsonld, css, image: p.images[0], bodyClass: 'has-bar' })
    + header(cfg)
    + announce(cfg)
    + `<nav class="crumb" aria-label="Breadcrumb"><a href="/">Catalog</a>${p.category ? ` / <a href="/category/${esc(p.categorySlug)}">${esc(p.category)}</a>` : ''}</nav>`
    + `<div class="pd">
<div class="pd-media">${media}</div>
<main class="pd-body" id="main">
${p.category ? `<a class="pd-cat" href="/category/${esc(p.categorySlug)}">${esc(p.category)}</a>` : ''}
<h1>${esc(p.name)}</h1>
${cfg.hidePrices ? '' : price ? `<div class="pd-price">${esc(price)}</div>` : `<div class="pd-price on-request">Price on request</div>`}
${p.inStock && !cfg.hideStock ? '<div class="pd-stock">In stock</div>' : ''}
${p.description ? `<p class="pd-desc">${esc(p.description)}</p>` : ''}
${colourEl}${sizesEl}${detailsEl}
${specs.length ? `<table class="spec-table">${specs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
${chartEl}<div class="pd-actions">
<a class="btn btn-wa" href="${wa}"${waData} rel="noopener">${ICON.wa}<span>Enquire on WhatsApp</span></a>
<div class="pd-row">
<a class="btn btn-ghost" href="${tel}" style="margin-top:0">${ICON.phone}<span>Call</span></a>
<button class="btn btn-ghost" type="button" id="share" data-title="${esc(p.name)}" style="margin-top:0">${ICON.share}<span>Share</span></button>
</div>
<a class="btn btn-soft" href="/">${ICON.back}<span>Back to catalog</span></a>
</div>
${howEl}
</main>
</div>`
    + (related.length ? `<section class="rel" aria-labelledby="rel-h"><div class="sec-head"><h2 id="rel-h">More in ${esc(p.category || cfg.name)}</h2></div><div class="rel-row">${related.map(r => card(cfg, r)).join('')}</div></section>` : '')
    + footer(cfg, categories)
    + `<div class="pd-bar"><a class="btn btn-ghost btn-icon" href="${tel}" aria-label="Call ${esc(cfg.name)}">${ICON.phone}</a><a class="btn btn-wa" href="${wa}"${waData} rel="noopener">${ICON.wa}<span>Enquire on WhatsApp</span></a></div>`
    + productScript()
    + revealScript()
    + `</body></html>`;
}

export function renderAbout(cfg, products, categories, css) {
  const title = fitTitle(withCity(cfg, `About ${cfg.name}`), `About ${cfg.name}`);
  const description = clip(cfg.about || `${withCity(cfg, cfg.name)}. ${cfg.tagline || ''}`);
  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: `${cfg.siteUrl}/about`,
    name: title,
    about: { '@id': bizId(cfg) }
  }];
  return head(cfg, { title, description, canonical: `${cfg.siteUrl}/about`, jsonld, css, image: cfg.shopPhoto || products[0]?.images[0], bodyClass: 'has-fab' })
    + header(cfg)
    + announce(cfg)
    + `<main class="about-body" id="main">
<h1>About ${esc(cfg.name)}</h1>
${(cfg.about || cfg.tagline || '').split('\n').filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}
${cfg.shopPhoto ? `<img class="about-img" src="/img/${esc(cfg.shopPhoto)}" alt="${esc(cfg.name)} shop" loading="lazy" decoding="async">` : ''}
<div class="about-facts">
${cfg.since ? `<div><span>In business since</span> ${esc(cfg.since)}</div>` : ''}
${cfg.areasServed ? `<div><span>Areas served</span> ${esc(cfg.areasServed)}</div>` : ''}
<div><span>Products in catalog</span> ${products.length}</div>
${cfg.hours ? `<div><span>Open</span> ${esc(cfg.hours)}</div>` : ''}
</div>
<a class="btn btn-wa" href="${waLink(cfg, `Hi ${cfg.name}, I have a question.`)}" rel="noopener">${ICON.wa}<span>Message us on WhatsApp</span></a>
<a class="btn btn-ghost" href="/">${ICON.back}<span>View catalog</span></a>
</main>`
    + footer(cfg, categories)
    + fab(cfg, `Hi ${cfg.name}, I have a question.`)
    + revealScript()
    + `</body></html>`;
}

// ---------- inline scripts (progressive enhancement only) ----------

// Reveals cards and sections that start below the first screen. Anything
// visible on load is never hidden, so the first paint and LCP are untouched.
function revealScript() {
  return `<script>
(function(){
if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var h=innerHeight,els=[].slice.call(document.querySelectorAll('.grid .card,.rel-row .card,.spec-table,.about-facts div,.sec-head')).filter(function(e){return e.getBoundingClientRect().top>h;});
var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},{rootMargin:'0px 0px -6% 0px'});
els.forEach(function(e,i){e.style.setProperty('--i',i%4);e.classList.add('pre');io.observe(e);});
})();
</script>`;
}

function indexScript() {
  return `<script>
(function(){
var grid=document.getElementById('grid');if(!grid)return;
var cards=[].slice.call(grid.children),chips=[].slice.call(document.querySelectorAll('.chip'));
var q=document.getElementById('q'),empty=document.getElementById('empty'),cat='all';
function apply(){
  var term=q&&q.value?q.value.trim().toLowerCase():'';var shown=0;
  cards.forEach(function(c){
    var ok=(cat==='all'||c.dataset.cat===cat)&&(!term||c.dataset.name.indexOf(term)>-1);
    c.hidden=!ok;if(ok){shown++;c.classList.remove('pre');}
  });
  if(empty)empty.hidden=shown>0;
}
function run(){if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.startViewTransition(apply);else apply();}
chips.forEach(function(b){b.addEventListener('click',function(){
  chips.forEach(function(x){x.classList.remove('is-on');x.setAttribute('aria-pressed','false');});
  b.classList.add('is-on');b.setAttribute('aria-pressed','true');cat=b.dataset.filter;run();
  var top=grid.getBoundingClientRect().top+scrollY-140;if(scrollY>top)window.scrollTo({top:top,behavior:'smooth'});
});});
if(q)q.addEventListener('input',apply);
})();
</script>`;
}

function productScript() {
  return `<script>
(function(){
var track=document.getElementById('track'),thumbs=[].slice.call(document.querySelectorAll('.pd-strip button'));
if(track){
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches,raf;
  thumbs.forEach(function(t,i){t.addEventListener('click',function(){track.scrollTo({left:i*track.clientWidth,behavior:still?'auto':'smooth'});});});
  track.addEventListener('scroll',function(){cancelAnimationFrame(raf);raf=requestAnimationFrame(function(){
    var n=Math.round(track.scrollLeft/track.clientWidth);
    thumbs.forEach(function(x,j){if(j===n)x.setAttribute('aria-current','true');else x.removeAttribute('aria-current');});
  });},{passive:true});
}
var sizes=[].slice.call(document.querySelectorAll('.size[data-size]')),was=[].slice.call(document.querySelectorAll('[data-wa]')),picked=document.getElementById('size-picked');
sizes.forEach(function(b){b.addEventListener('click',function(){
  sizes.forEach(function(x){x.setAttribute('aria-checked','false');});b.setAttribute('aria-checked','true');
  if(picked)picked.textContent=': '+b.dataset.size;
  was.forEach(function(a){a.href=a.href.split('?')[0]+'?text='+encodeURIComponent(a.dataset.wa+'\\nSize: '+b.dataset.size);});
});});
var cl=document.querySelector('.pd-chart-link'),ch=document.getElementById('size-chart');
if(cl&&ch)cl.addEventListener('click',function(){ch.open=true;});
var s=document.getElementById('share');
if(s)s.addEventListener('click',function(){
  var d={title:s.dataset.title,url:location.href};
  if(navigator.share){navigator.share(d).catch(function(){});}
  else{location.href='https://wa.me/?text='+encodeURIComponent(d.title+' '+d.url);}
});
})();
</script>`;
}
