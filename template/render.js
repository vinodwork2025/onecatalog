/* Page renderer. Pure functions: data in, HTML string out.
   Products are written into the HTML at build time, so the catalog
   works with JavaScript switched off and Google indexes everything. */

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
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>'
};

// ---------- shell ----------

function head(cfg, { title, description, canonical, jsonld, css }) {
  const ld = (jsonld || []).map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('');
  return `<!doctype html>
<html lang="${esc(cfg.lang || 'en-IN')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
${cfg.logo ? `<meta property="og:image" content="${esc(cfg.siteUrl)}/img/${esc(cfg.logo)}">` : ''}
<meta name="robots" content="index,follow">
<meta name="theme-color" content="${esc(cfg.accent)}">
<style>${css}</style>
${ld}
</head>
<body>`;
}

function header(cfg, { home = false } = {}) {
  const initials = (cfg.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const logo = cfg.logo
    ? `<img class="site-logo" src="/img/${esc(cfg.logo)}" alt="${esc(cfg.name)} logo" width="44" height="44">`
    : `<div class="site-logo site-logo-fallback">${esc(initials)}</div>`;
  const nameEl = home ? esc(cfg.name) : `<a href="/">${esc(cfg.name)}</a>`;
  return `<header class="site-head"><div class="wrap">
${logo}
<div><div class="site-name">${nameEl}</div>${cfg.tagline ? `<div class="site-tag">${esc(cfg.tagline)}</div>` : ''}</div>
<a class="head-call" href="tel:${esc(cfg.phone || cfg.whatsapp)}" aria-label="Call ${esc(cfg.name)}">${ICON.phone}</a>
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
  return `<footer class="site-foot"><div class="wrap">
<div class="foot-row">${ICON.phone}<div><div class="foot-label">Call or WhatsApp</div><a href="tel:${esc(cfg.phone || cfg.whatsapp)}">${esc(cfg.phoneDisplay || cfg.phone || cfg.whatsapp)}</a></div></div>
${cfg.address ? `<div class="foot-row">${ICON.pin}<div><div class="foot-label">Address</div>${esc(cfg.address)}</div></div>` : ''}
${cfg.hours ? `<div class="foot-row">${ICON.clock}<div><div class="foot-label">Open</div>${esc(cfg.hours)}</div></div>` : ''}
${cfg.mapsUrl ? `<a class="btn btn-ghost" href="${esc(cfg.mapsUrl)}" rel="noopener">${ICON.nav}<span>Get directions</span></a>` : ''}
${cfg.reviewUrl ? `<a class="btn btn-review" href="${esc(cfg.reviewUrl)}" rel="noopener">${ICON.star}<span>Rate us on Google</span></a>` : ''}
${catLinks ? `<div class="foot-links">${catLinks}</div>` : ''}
<div class="foot-links"><a href="/">Catalog</a><a href="/about">About us</a></div>
<div class="foot-credit">&copy; ${new Date().getFullYear()} ${esc(cfg.name)}${cfg.address ? ', ' + esc(cfg.city || '') : ''}. All prices subject to change.</div>
</div></footer>`;
}

function fab(cfg, text) {
  return `<a class="fab" href="${waLink(cfg, text)}" rel="noopener">${ICON.wa}<span>WhatsApp</span></a>`;
}

// ---------- cards ----------

function card(cfg, p) {
  const price = money(cfg, p.price);
  const priceEl = price
    ? `<div class="card-price">${esc(price)}</div>`
    : `<div class="card-price on-request">Price on request</div>`;
  return `<a class="card" href="/${p.slug}" data-cat="${esc(p.categorySlug)}" data-name="${esc(p.name.toLowerCase())}">
<img class="card-img" src="/img/${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy" width="400" height="400">
<div class="card-body">
<div class="card-name">${esc(p.name)}</div>
${p.inStock ? '' : '<span class="badge-out">Out of stock</span>'}
${priceEl}
</div></a>`;
}

// ---------- pages ----------

export function renderIndex(cfg, products, categories, css) {
  const showSearch = products.length >= 40;
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: cfg.name,
      description: cfg.tagline || cfg.about || cfg.name,
      url: cfg.siteUrl,
      telephone: '+' + String(cfg.whatsapp),
      ...(cfg.logo ? { image: `${cfg.siteUrl}/img/${cfg.logo}` } : {}),
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
      ...(cfg.hours ? { openingHours: cfg.hours } : {})
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

  const title = `${cfg.name} — ${cfg.metaHeadline || (cfg.tagline || 'Product Catalog')}${cfg.city ? ', ' + cfg.city : ''}`;
  const description = cfg.metaDescription
    || `Browse the full product catalog of ${cfg.name}${cfg.city ? ' in ' + cfg.city : ''}. ${products.length} products with prices. Enquire directly on WhatsApp.`;

  const chips = [`<button class="chip is-on" data-filter="all" aria-pressed="true">All</button>`]
    .concat(categories.map(c => `<button class="chip" data-filter="${esc(c.slug)}" aria-pressed="false">${esc(c.name)} <span style="opacity:.6;margin-left:5px">${c.count}</span></button>`))
    .join('');

  return head(cfg, { title, description, canonical: cfg.siteUrl + '/', jsonld, css })
    + header(cfg, { home: true })
    + announce(cfg)
    + (categories.length > 1 ? `<nav class="cats" aria-label="Categories"><div class="cats-scroll">${chips}</div></nav>` : '')
    + (showSearch ? `<div class="search-row"><input id="q" type="search" placeholder="Search products" aria-label="Search products"></div>` : '')
    + `<main><div class="grid ${cfg.layout === 'grid-large' ? 'layout-large' : ''}" id="grid">${products.map(p => card(cfg, p)).join('')}</div>
<p class="empty" id="empty" hidden>No products match that. Try another category.</p></main>`
    + footer(cfg, categories)
    + fab(cfg, cfg.waGreeting || `Hi ${cfg.name}, I saw your catalog.`)
    + indexScript()
    + `</body></html>`;
}

export function renderCategory(cfg, cat, products, categories, css) {
  const title = `${cat.name} — ${cfg.name}${cfg.city ? ', ' + cfg.city : ''}`;
  const description = `${cat.name} available at ${cfg.name}${cfg.city ? ', ' + cfg.city : ''}. ${products.length} options with prices. Enquire on WhatsApp.`;
  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Catalog', item: cfg.siteUrl + '/' },
      { '@type': 'ListItem', position: 2, name: cat.name, item: `${cfg.siteUrl}/category/${cat.slug}` }
    ]
  }];
  return head(cfg, { title, description, canonical: `${cfg.siteUrl}/category/${cat.slug}`, jsonld, css })
    + header(cfg)
    + announce(cfg)
    + `<div class="crumb"><a href="/">Catalog</a> / ${esc(cat.name)}</div>`
    + `<div class="sec-head"><h2>${esc(cat.name)}</h2><p>${products.length} product${products.length === 1 ? '' : 's'} at ${esc(cfg.name)}</p></div>`
    + `<main><div class="grid ${cfg.layout === 'grid-large' ? 'layout-large' : ''}">${products.map(p => card(cfg, p)).join('')}</div></main>`
    + footer(cfg, categories)
    + fab(cfg, `Hi ${cfg.name}, I'm looking at your ${cat.name}.`)
    + `</body></html>`;
}

export function renderProduct(cfg, p, related, categories, css) {
  const price = money(cfg, p.price);
  const title = `${p.name}${p.category ? ' — ' + p.category : ''} | ${cfg.name}${cfg.city ? ', ' + cfg.city : ''}`;
  const description = (p.description || `${p.name} available at ${cfg.name}${cfg.city ? ' in ' + cfg.city : ''}.${price ? ' Price ' + price + '.' : ''} Enquire on WhatsApp for details.`).slice(0, 300);

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      image: p.images.map(f => `${cfg.siteUrl}/img/${f}`),
      ...(p.sku ? { sku: p.sku } : {}),
      brand: { '@type': 'Brand', name: cfg.name },
      offers: {
        '@type': 'Offer',
        url: `${cfg.siteUrl}/${p.slug}`,
        priceCurrency: cfg.currency || 'INR',
        // Only a clean number belongs in schema. "From 1500" or
        // "Quote after site visit" would produce a meaningless price.
        ...(/^[\d.,\s]+$/.test(String(p.price || '').trim()) && Number(String(p.price).replace(/[^0-9.]/g, '')) > 0
          ? { price: String(Number(String(p.price).replace(/[^0-9.]/g, ''))) }
          : {}),
        availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: cfg.name }
      }
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
  const strip = p.images.length > 1
    ? `<div class="pd-strip">${p.images.map((f, i) => `<img src="/img/${esc(f)}" alt="${esc(p.name)} view ${i + 1}" width="64" height="64" data-full="/img/${esc(f)}"${i === 0 ? ' aria-current="true"' : ''}>`).join('')}</div>`
    : '';

  const waText = `Hi ${cfg.name}, I'm interested in ${p.name}${p.sku ? ' (' + p.sku + ')' : ''}. Please share details.`;

  return head(cfg, { title, description, canonical: `${cfg.siteUrl}/${p.slug}`, jsonld, css })
    + header(cfg)
    + announce(cfg)
    + `<div class="crumb"><a href="/">Catalog</a>${p.category ? ` / <a href="/category/${esc(p.categorySlug)}">${esc(p.category)}</a>` : ''}</div>`
    + `<div class="pd-media"><img class="pd-img" id="hero" src="/img/${esc(p.images[0])}" alt="${esc(p.name)}" width="800" height="800">${strip}</div>`
    + `<main class="pd-body">
<h1>${esc(p.name)}</h1>
${price ? `<div class="pd-price">${esc(price)}</div>` : `<div class="pd-price on-request">Price on request</div>`}
${p.inStock ? '' : '<p><span class="badge-out">Out of stock</span></p>'}
${p.description ? `<p class="pd-desc">${esc(p.description)}</p>` : ''}
${specs.length ? `<table class="spec-table">${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
<a class="btn btn-wa" href="${waLink(cfg, waText)}" rel="noopener">${ICON.wa}<span>Enquire on WhatsApp</span></a>
<a class="btn btn-ghost" href="/">${ICON.back}<span>Back to catalog</span></a>
</main>`
    + (related.length ? `<div class="sec-head"><h2>More in ${esc(p.category || cfg.name)}</h2></div><div class="grid">${related.map(r => card(cfg, r)).join('')}</div>` : '')
    + footer(cfg, categories)
    + fab(cfg, waText)
    + productScript()
    + `</body></html>`;
}

export function renderAbout(cfg, products, categories, css) {
  const title = `About ${cfg.name}${cfg.city ? ', ' + cfg.city : ''}`;
  const description = (cfg.about || `${cfg.name}${cfg.city ? ' in ' + cfg.city : ''}. ${cfg.tagline || ''}`).slice(0, 300);
  return head(cfg, { title, description, canonical: `${cfg.siteUrl}/about`, jsonld: [], css })
    + header(cfg)
    + announce(cfg)
    + `<main class="about-body">
<h1>About ${esc(cfg.name)}</h1>
${(cfg.about || cfg.tagline || '').split('\n').filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}
${cfg.shopPhoto ? `<img class="about-img" src="/img/${esc(cfg.shopPhoto)}" alt="${esc(cfg.name)} shop" loading="lazy">` : ''}
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
    + `</body></html>`;
}

// ---------- inline scripts (progressive enhancement only) ----------

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
    c.hidden=!ok;if(ok)shown++;
  });
  if(empty)empty.hidden=shown>0;
}
chips.forEach(function(b){b.addEventListener('click',function(){
  chips.forEach(function(x){x.classList.remove('is-on');x.setAttribute('aria-pressed','false');});
  b.classList.add('is-on');b.setAttribute('aria-pressed','true');cat=b.dataset.filter;apply();
  window.scrollTo({top:0,behavior:'smooth'});
});});
if(q)q.addEventListener('input',apply);
})();
</script>`;
}

function productScript() {
  return `<script>
(function(){
var hero=document.getElementById('hero'),thumbs=[].slice.call(document.querySelectorAll('.pd-strip img'));
thumbs.forEach(function(t){t.addEventListener('click',function(){
  hero.src=t.dataset.full;
  thumbs.forEach(function(x){x.removeAttribute('aria-current');});
  t.setAttribute('aria-current','true');
});});
})();
</script>`;
}
