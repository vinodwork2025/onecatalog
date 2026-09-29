/* Marketing site for onecatalog.in. Pure functions: config + page data in,
   HTML strings out. Every word lives in site/config.json (shared facts) and
   site/pages/**.json (one file per page). This file only arranges it and
   checks it.

   One self-contained HTML file per page: inline CSS, system fonts, no CDNs.
   The only script handles the FAQ accordion, the mobile sticky bar and
   optional GA4 click events. All content is in the HTML without it. */

import { esc } from '../template/render.js';
import { darken } from '../template/themes.js';

const PLACEHOLDER = /\bTODO\b|\[CONFIRM\]|\[[A-Z0-9_]{3,}\]/;

// Words the copy rules ban. Matched as whole words, case-insensitive.
const BANNED = ['leverage', 'synergy', 'cutting-edge', 'revolutionary', 'seamless', 'seamlessly',
  'robust', 'empower', 'empowers', 'unlock', 'unlocks', 'game-changer', 'game changer', 'next-level',
  'elevate', 'supercharge', 'in person'];

// Keyword matching ignores these, and treats catalog/catalogue as one word.
const STOP = new Set(['a', 'an', 'the', 'to', 'for', 'in', 'of', 'on', 'my', 'your', 'how', 'and', 'is', 'do', 'i']);

export function rupees(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

const waDigits = cfg => String(cfg.whatsapp || '').replace(/\D/g, '');
const waLink = (cfg, text) => `https://wa.me/${waDigits(cfg)}?text=${encodeURIComponent(text || cfg.waMessage || '')}`;
const abs = (cfg, p) => cfg.url.replace(/\/$/, '') + (p === '/' ? '/' : p);
const ldScript = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const featured = cfg => cfg.pricing.tiers[cfg.pricing.featured ?? 0];

/* ------------------------------------------------------------------ inline text
   Copy may carry [anchor](/path) links and **bold**. Everything else is escaped. */
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
      const ext = /^https?:/.test(h);
      return `<a href="${h}"${ext ? ' rel="noopener"' : ''}>${t}</a>`;
    });
}
const plain = s => String(s ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

/* ------------------------------------------------------------------ text helpers */

function norm(s) {
  return plain(s).toLowerCase().replace(/catalogues?\b/g, 'catalog').replace(/catalogs\b/g, 'catalog')
    .replace(/[^a-z0-9₹ ]+/g, ' ').split(/\s+/).filter(Boolean).map(w => w.length > 3 ? w.replace(/s$/, '') : w);
}
function kwWords(kw) {
  return norm(kw).filter(w => !STOP.has(w));
}
function hasKeyword(text, kw) {
  const have = new Set(norm(text));
  return kwWords(kw).every(w => have.has(w));
}

/** All visible strings of a page, in reading order (for checks and word counts). */
function pageStrings(page) {
  const out = [page.h1, page.answer, page.sub];
  for (const s of page.sections || []) {
    out.push(s.h2);
    for (const b of s.blocks || []) collectBlock(b, out);
  }
  if (page.faq) { out.push(page.faq.heading); page.faq.items.forEach(f => out.push(f.q, f.a)); }
  if (page.cta) out.push(page.cta.heading, page.cta.text);
  if (page.note) out.push(page.note);
  return out.filter(Boolean);
}
function collectBlock(b, out) {
  const walk = v => typeof v === 'string' ? out.push(v) : Array.isArray(v) ? v.forEach(walk)
    : v && typeof v === 'object' ? Object.entries(v).forEach(([k, x]) => k !== 'href' && walk(x)) : null;
  walk(b);
}
function bodyWords(page) {
  return pageStrings(page).map(plain).join(' ').split(/\s+/).filter(Boolean).length;
}
function linksIn(page) {
  const all = [];
  for (const s of pageStrings(page)) for (const m of s.matchAll(/\]\(([^)\s]+)\)/g)) all.push(m[1]);
  for (const s of page.sections || []) for (const b of s.blocks || []) {
    if (b.cards) b.cards.forEach(c => c.href && all.push(c.href));
  }
  return all;
}

/* ------------------------------------------------------------------ checks */

/** Problems in the shared config. */
export function checkConfig(cfg) {
  const out = [];
  if (!/^\d{12}$/.test(waDigits(cfg))) out.push('config: whatsapp must be country code + 10 digits');
  const walk = (v, p) => {
    if (typeof v === 'string') { if (PLACEHOLDER.test(v)) out.push(`config: ${p} is still a placeholder`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, p ? `${p}.${k}` : k));
  };
  const { ga4Id, gscToken, ...rest } = cfg; // these two may stay empty
  walk(rest, '');
  if (!cfg.entity.includes(rupees(featured(cfg).price))) out.push(`config: entity should state the lead price ${rupees(featured(cfg).price)}`);
  return out;
}

/** Problems on one page. A page with problems is published noindex and left out of the sitemap. */
export function checkPage(cfg, page, allPages, ogFiles = new Set()) {
  const out = [];
  const t = page.title || '', d = page.description || '';
  if (t.length > 60) out.push(`title is ${t.length} characters, max 60`);
  if (d.length > 155 || d.length < 110) out.push(`description is ${d.length} characters, keep it 110 to 155`);

  const strings = [t, d, ...pageStrings(page)];
  for (const s of strings) {
    if (PLACEHOLDER.test(s)) out.push(`placeholder left: "${s.slice(0, 60)}"`);
    if (/—/.test(s)) out.push(`em-dash in: "${s.slice(0, 60)}"`);
    if (/;/.test(plain(s))) out.push(`semicolon in: "${s.slice(0, 60)}"`);
    for (const w of BANNED) if (new RegExp(`\\b${w}\\b`, 'i').test(plain(s))) out.push(`banned word "${w}" in: "${s.slice(0, 60)}"`);
  }

  // Same prices everywhere: every ₹ amount must be a configured price.
  const P = cfg.pricing;
  const known = new Set([...P.tiers.flatMap(x => [x.price, x.renewal]), P.booking, P.extraBatch].map(rupees));
  for (const amt of new Set(strings.flatMap(s => s.match(/₹\d{1,3}(?:,\d{2,3})*/g) || []))) {
    if (!known.has(amt)) out.push(`${amt} is not a configured price`);
  }

  // One primary keyword per page, placed where search engines look for it.
  if (page.keyword) {
    const kw = page.keyword;
    if (!hasKeyword(t, kw)) out.push(`keyword "${kw}" missing from title`);
    if (!hasKeyword(page.h1, kw)) out.push(`keyword "${kw}" missing from H1`);
    if (!hasKeyword(d, kw)) out.push(`keyword "${kw}" missing from description`);
    const first100 = pageStrings(page).slice(1).map(plain).join(' ').split(/\s+/).slice(0, 100).join(' ');
    if (!hasKeyword(first100, kw)) out.push(`keyword "${kw}" missing from the first 100 words`);
    const h2s = [...(page.sections || []).map(s => s.h2), page.faq?.heading].filter(Boolean);
    if (!h2s.some(h => hasKeyword(h, kw))) out.push(`keyword "${kw}" missing from every H2`);
    if (page.path !== '/') {
      const pw = new Set(norm(page.path.replace(/[/-]/g, ' ')));
      const hit = kwWords(kw).filter(w => pw.has(w)).length;
      if (hit * 2 < kwWords(kw).length) out.push(`keyword "${kw}" barely in the URL`);
    }
    const dup = allPages.find(p => p !== page && p.keyword && p.keyword.toLowerCase() === kw.toLowerCase());
    if (dup) out.push(`keyword "${kw}" is also the target of ${dup.path}`);
  }

  // Internal links must resolve, and content pages need at least 2 in the body.
  const paths = new Set(allPages.map(p => p.path));
  const links = linksIn(page);
  for (const h of links) {
    if (h.startsWith('/') && !paths.has(h.split('#')[0])) out.push(`link to ${h} goes nowhere`);
  }
  const inBody = new Set(links.filter(h => h.startsWith('/') && h.split('#')[0] !== page.path));
  if (page.type !== 'legal' && inBody.size < 2) out.push(`only ${inBody.size} internal link(s) in the body, need 2+`);
  if (page.type === 'guide') {
    if (!inBody.has('/whatsapp-catalogue')) out.push('guide must link to /whatsapp-catalogue');
    if (![...inBody].some(h => h.startsWith('/guides/'))) out.push('guide must link to another guide');
  }
  if (page.type === 'industry') {
    for (const need of ['/pricing', '/whatsapp-catalogue']) if (!inBody.has(need)) out.push(`industry page must link to ${need}`);
  }
  if (page.path === '/') {
    for (const p of allPages) if (p.hub && !inBody.has(p.path)) out.push(`home must link to hub page ${p.path}`);
  }
  if (!ogFiles.has(ogName(page) + '.png')) out.push(`no OG image og/${ogName(page)}.png, run node scripts/og.js`);
  return out;
}

/* ------------------------------------------------------------------ schema */

function orgSchema(cfg) {
  const url = cfg.url;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': url + '#org',
    name: cfg.name,
    url,
    logo: abs(cfg, '/og/logo.png'),
    description: cfg.entity,
    areaServed: { '@type': 'Country', name: cfg.serviceArea },
    telephone: '+' + waDigits(cfg),
    email: cfg.email,
    founder: { '@type': 'Person', name: cfg.author.name }
  };
}

function serviceSchema(cfg, pageUrl) {
  const P = cfg.pricing, lead = featured(cfg);
  const tierText = t => `${t.products}: ${rupees(t.price)} for the first year, then ${rupees(t.renewal)} a year. ${t.domainNote}.`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': cfg.url + '#service',
    name: `${cfg.name} online catalogue service`,
    serviceType: 'Online product catalogue for WhatsApp',
    description: cfg.entity,
    provider: { '@id': cfg.url + '#org' },
    areaServed: { '@type': 'Country', name: cfg.serviceArea },
    audience: { '@type': 'BusinessAudience', audienceType: 'Small businesses, wholesalers and resellers' },
    offers: [lead, ...P.tiers.filter(t => t !== lead)].map(t => ({
      '@type': 'Offer',
      name: t.label ? `${t.label}, ${t.products}` : t.products,
      price: String(t.price),
      priceCurrency: 'INR',
      description: `${tierText(t)} ${P.everyPlan}`,
      url: pageUrl,
      availability: 'https://schema.org/InStock'
    }))
  };
}

function crumbList(cfg, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(cfg, c.path) }))
  };
}

function faqSchema(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.items.map(f => ({ '@type': 'Question', name: plain(f.q), acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } }))
  };
}

function schemaFor(cfg, page, trail) {
  const url = abs(cfg, page.path);
  const out = [];
  if (page.path === '/') {
    out.push(orgSchema(cfg), {
      '@context': 'https://schema.org', '@type': 'WebSite', '@id': cfg.url + '#site',
      name: cfg.name, url: cfg.url, inLanguage: 'en-IN', publisher: { '@id': cfg.url + '#org' }
    }, serviceSchema(cfg, url));
  } else if (page.type === 'guide') {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.h1,
      description: page.description,
      url,
      mainEntityOfPage: url,
      inLanguage: 'en-IN',
      image: abs(cfg, `/og/${ogName(page)}.png`),
      datePublished: page.published,
      dateModified: page.updated,
      author: { '@type': 'Person', name: cfg.author.name, url: abs(cfg, '/about') },
      publisher: { '@id': cfg.url + '#org', '@type': 'Organization', name: cfg.name, url: cfg.url }
    });
  } else {
    const type = { about: 'AboutPage', contact: 'ContactPage' }[page.type] || 'WebPage';
    out.push({
      '@context': 'https://schema.org', '@type': type, name: page.title, url, description: page.description,
      inLanguage: 'en-IN', isPartOf: { '@id': cfg.url + '#site' }, dateModified: page.updated
    });
    if (page.type === 'about') out.push(orgSchema(cfg));
    if (page.path === '/pricing') out.push(serviceSchema(cfg, url));
  }
  if (page.faq) out.push(faqSchema(page));
  if (trail.length > 1) out.push(crumbList(cfg, trail));
  return out;
}

/* ------------------------------------------------------------------ icons */

const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.3-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.4-.5-.6-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 1.9 3 4.7 4.1 2.3.9 2.8.8 3.3.7.5-.1 1.6-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.2-.2-.5-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.2-1.3c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.9-1.4-1.3-2.9-1.3-4.5 0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.6 8.4-7.9 8.4z"/></svg>';
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

/* ------------------------------------------------------------------ css */

function css(cfg) {
  const a = cfg.accent || '#1E4D7A';
  return `
:root{--accent:${a};--accent-dark:${darken(a, 0.25)};--bg:#FAF8F5;--card:#fff;--text:#1C1A17;--muted:#5A534B;--line:#E6E0D8;--wa:#15803D;--wa-dark:#116A33;--tint:#F1EEE9;--max:720px}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:var(--bg);color:var(--text);font-size:17px;line-height:1.6;overflow-wrap:break-word}
a{color:var(--accent-dark);text-underline-offset:2px}
.wrap{max-width:var(--max);margin:0 auto;padding:0 16px}
.skip{position:absolute;left:-999px;top:0;background:#fff;padding:10px 14px;z-index:99}
.skip:focus{left:8px;top:8px}
.site-head{background:var(--card);border-bottom:1px solid var(--line)}
.head-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px}
.wordmark{font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--text);text-decoration:none;display:inline-flex;align-items:center;min-height:44px}
.wordmark span{color:var(--accent)}
.head-cta{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border-radius:10px;background:var(--wa);color:#fff;font-weight:700;font-size:15px;text-decoration:none}
.head-cta svg{width:18px;height:18px;fill:currentColor}
.nav{display:flex;gap:4px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
.nav a{flex:0 0 auto;display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-radius:8px;font-size:15px;font-weight:600;color:var(--text);text-decoration:none}
.nav a[aria-current]{background:var(--tint);color:var(--accent-dark)}
.crumbs{font-size:14px;color:var(--muted);padding-top:14px}
.crumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:4px}
.crumbs li+li::before{content:"/";margin-right:4px;color:var(--line)}
.crumbs a{display:inline-flex;min-height:32px;align-items:center}
section{padding:40px 0;border-bottom:1px solid var(--line)}
section.alt{background:var(--card)}
h1{font-size:clamp(28px,7.4vw,40px);line-height:1.15;letter-spacing:-.02em;font-weight:800}
h2{font-size:clamp(22px,5.6vw,28px);line-height:1.25;letter-spacing:-.01em;font-weight:800;margin-bottom:12px}
h3{font-size:18px;line-height:1.35;font-weight:700}
section p,section ul,section ol,section table,section .cards,section .callout{margin-top:14px}
section h2+p,section h2+ul,section h2+ol{margin-top:0}
section ul:not([class]),section ol:not([class]){padding-left:22px;display:grid;gap:6px}
.hero{padding:28px 0 36px;background:var(--card)}
.hero .answer{margin-top:16px;font-size:18px}
.hero .sub{margin-top:10px;color:var(--muted)}
.btn-row{display:grid;gap:10px;margin-top:22px}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:12px 20px;border-radius:12px;background:var(--wa);color:#fff;font-size:17px;font-weight:700;text-decoration:none;text-align:center;line-height:1.3}
.btn:hover{background:var(--wa-dark)}
.btn svg{width:22px;height:22px;flex:0 0 22px;fill:currentColor}
.btn.ghost{background:var(--card);color:var(--accent-dark);border:2px solid var(--accent)}
.btn.ghost:hover{background:var(--tint)}
a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.hero-grid{display:grid;gap:28px}
.phone{justify-self:center;width:230px;border:10px solid #1C1A17;border-radius:32px;background:#fff;padding:14px 10px 18px;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.phone .ph-bar{height:6px;width:60px;border-radius:6px;background:#1C1A17;margin:0 auto 12px}
.phone .ph-shop{font-weight:800;font-size:14px;text-align:center}
.phone .ph-tag{font-size:11px;color:var(--muted);text-align:center;margin-bottom:10px}
.phone .ph-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.phone .ph-item{border:1px solid var(--line);border-radius:10px;padding:6px}
.phone .ph-img{height:62px;border-radius:6px;background:linear-gradient(135deg,var(--tint),#E2DCD2)}
.phone .ph-name{font-size:11px;font-weight:600;margin-top:4px;line-height:1.3}
.phone .ph-price{font-size:11px;color:var(--accent-dark);font-weight:700}
.phone .ph-wa{margin-top:4px;font-size:10px;background:var(--wa);color:#fff;border-radius:6px;text-align:center;padding:3px 0}
.pain{list-style:none;display:grid;gap:10px}
.pain li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:grid;grid-template-columns:28px 1fr;gap:10px}
.pain li::before{content:"!";width:28px;height:28px;border-radius:50%;background:#FDECEC;color:#A12B2B;font-weight:800;display:flex;align-items:center;justify-content:center}
.steps{list-style:none;display:grid;gap:20px;counter-reset:s}
.steps li{display:grid;grid-template-columns:42px 1fr;gap:14px;counter-increment:s}
.steps li::before{content:counter(s);width:42px;height:42px;border-radius:50%;background:var(--accent);color:#fff;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center}
.steps p{margin-top:4px;color:var(--muted)}
.cards{display:grid;gap:12px}
.card{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;color:var(--text);text-decoration:none}
a.card h3{color:var(--accent-dark);text-decoration:underline;text-underline-offset:3px}
.card p{margin-top:6px;color:var(--muted);font-size:16px}
.callout{background:var(--tint);border-left:4px solid var(--accent);border-radius:8px;padding:14px 16px}
.tbl{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:15.5px;line-height:1.45}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
thead th{font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
tbody th{font-weight:700}
caption{text-align:left;font-weight:700;padding-bottom:6px}
tr.is-lead th,tr.is-lead td{color:var(--accent-dark);font-weight:800}
.price-card{background:var(--card);border:2px solid var(--accent);border-radius:16px;padding:20px 18px}
.price{font-size:38px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.price small{display:block;margin-top:6px;font-size:16px;font-weight:600;color:var(--muted);letter-spacing:0}
.incl{list-style:none;display:grid;gap:10px}
.incl li{display:grid;grid-template-columns:22px 1fr;gap:10px;font-size:16px}
.incl svg{width:22px;height:22px;fill:var(--wa);margin-top:2px}
.risk{background:var(--tint);border-radius:12px;padding:14px 16px;font-weight:700}
.faq{border-top:1px solid var(--line)}
.faq-item{border-bottom:1px solid var(--line);padding:4px 0}
.faq-q{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:52px;padding:10px 0;background:none;border:0;font:inherit;font-size:17px;font-weight:700;color:var(--text);text-align:left;cursor:pointer}
.faq-q::after{content:"+";flex:0 0 auto;font-size:26px;font-weight:400;color:var(--accent);line-height:1}
.faq-q[aria-expanded="true"]::after{content:"\\2212"}
.faq-a{padding:0 0 14px;color:var(--muted)}
.faq-a[hidden]{display:none}
.author{display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;font-size:15.5px}
.author .av{width:48px;height:48px;border-radius:50%;background:var(--accent);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}
.author p{margin-top:2px;color:var(--muted)}
.meta{font-size:14px;color:var(--muted);margin-top:10px}
.sources{font-size:14.5px;color:var(--muted)}
.tm{font-size:13.5px;color:var(--muted)}
.final{background:var(--card);text-align:center}
.final p{color:var(--muted)}
.final .btn-row{justify-content:center}
.foot{padding:32px 0 110px;font-size:15px;color:var(--muted);background:var(--card)}
.foot-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.foot h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--text);margin-bottom:6px}
.foot ul{list-style:none}
.foot li a{display:inline-flex;align-items:center;min-height:40px;color:var(--muted)}
.foot .about{margin-top:26px;display:grid;gap:4px}
.foot .about strong{color:var(--text)}
.foot .about a{display:inline-flex;align-items:center;min-height:40px}
.sticky{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:1fr auto;gap:8px;background:rgba(255,255,255,.97);border-top:1px solid var(--line);padding:10px 12px calc(10px + env(safe-area-inset-bottom));transition:transform .2s}
.sticky .btn{min-height:48px;font-size:16px;padding:8px 14px}
.js .sticky{transform:translateY(110%)}
.js.show-sticky .sticky{transform:none}
@media (min-width:760px){section{padding:60px 0}.hero{padding:44px 0 56px}.hero-grid{grid-template-columns:1fr 250px;align-items:center}.btn-row{display:flex;flex-wrap:wrap}.btn{min-width:260px}.cards.two{grid-template-columns:1fr 1fr}.foot-grid{grid-template-columns:repeat(4,1fr)}.sticky{display:none}.foot{padding-bottom:40px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`.replace(/\n/g, '');
}

/* ------------------------------------------------------------------ blocks */

function mockup(m) {
  const items = m.items.map(i => `<div class="ph-item"><div class="ph-img"></div><div class="ph-name">${esc(i.name)}</div><div class="ph-price">${esc(i.price)}</div><div class="ph-wa">Enquire on WhatsApp</div></div>`).join('');
  return `<div class="phone" role="img" aria-label="${esc(m.label)}"><div class="ph-bar"></div><div class="ph-shop">${esc(m.shop)}</div><div class="ph-tag">${esc(m.tag || 'Sample catalogue')}</div><div class="ph-grid">${items}</div></div>`;
}

function pricingBlock(cfg, mode, wa) {
  const P = cfg.pricing, lead = featured(cfg), e = esc;
  const rows = P.tiers.map(t => `<tr${t === lead ? ' class="is-lead"' : ''}><th scope="row">${e(t.products)}<br><small>${e(t.label ? `${t.label}. ${t.domainNote}` : t.domainNote)}</small></th><td>${e(rupees(t.price))}</td><td>${e(rupees(t.renewal))}</td></tr>`).join('')
    + (P.overflow ? `<tr><th scope="row">${e(P.overflow.products)}</th><td colspan="2">${e(P.overflow.text)}</td></tr>` : '');
  const table = `<div class="tbl"><table><caption>${e(P.tableHeading)}</caption><thead><tr><th scope="col">Products</th><th scope="col">First year</th><th scope="col">Renewal</th></tr></thead><tbody>${rows}</tbody></table></div><p>${e(P.tableNote)}</p><p>${e(P.everyPlan)}</p>`;
  if (mode === 'table') return table;
  const card = `<div class="price-card"><p class="price">${e(rupees(lead.price))} <small>for the first year, then ${e(rupees(lead.renewal))} a year. ${e(lead.products)}.</small></p><ul class="incl">${P.includes.map(i => `<li>${TICK}<span>${e(i)}</span></li>`).join('')}</ul><p class="risk">${e(P.riskReversal)}</p><div class="btn-row">${waBtn(cfg.cta.primary, wa)}</div></div>`;
  return mode === 'card' ? card : card + table;
}

function samplesBlock(cfg) {
  return `<div class="cards two">${cfg.samples.map(s => `<a class="card" href="${esc(s.url)}" rel="noopener"><h3>${esc(s.label)}</h3><p>${esc(s.detail)}</p></a>`).join('')}</div>`;
}

function block(cfg, b, wa) {
  if (b.p) return `<p>${inline(b.p)}</p>`;
  if (b.ul) return `<ul>${b.ul.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
  if (b.ol) return `<ol>${b.ol.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`;
  if (b.pain) return `<ul class="pain">${b.pain.map(x => `<li><span>${inline(x)}</span></li>`).join('')}</ul>`;
  if (b.steps) return `<ol class="steps">${b.steps.map(s => `<li><div><h3>${inline(s.title)}</h3><p>${inline(s.text)}</p></div></li>`).join('')}</ol>`;
  if (b.cards) return `<div class="cards${b.cards.length > 1 ? ' two' : ''}">${b.cards.map(c => c.href
    ? `<a class="card" href="${esc(c.href)}"><h3>${esc(c.title)}</h3>${c.text ? `<p>${esc(plain(c.text))}</p>` : ''}</a>`
    : `<div class="card"><h3>${inline(c.title)}</h3>${c.text ? `<p>${inline(c.text)}</p>` : ''}</div>`).join('')}</div>`;
  if (b.table) {
    const T = b.table;
    return `<div class="tbl"><table>${T.caption ? `<caption>${inline(T.caption)}</caption>` : ''}<thead><tr>${T.head.map(h => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead><tbody>${T.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if (b.callout) return `<div class="callout"><p>${inline(b.callout)}</p></div>`;
  if (b.pricing) return pricingBlock(cfg, b.pricing, wa);
  if (b.samples) return samplesBlock(cfg);
  if (b.note) return `<p class="tm">${inline(b.note)}</p>`;
  if (b.cta) return `<div class="btn-row">${waBtn(cfg.cta.primary, wa)}</div>`;
  throw new Error('unknown block: ' + JSON.stringify(b).slice(0, 80));
}

function waBtn(label, href, cls = '') {
  return `<a class="btn${cls}" href="${esc(href)}" rel="noopener" data-cta="whatsapp">${WA_ICON}<span>${esc(label)}</span></a>`;
}

function ogName(page) {
  return page.path === '/' ? 'home' : page.path.slice(1).replace(/\//g, '-');
}

/* ------------------------------------------------------------------ page */

export function renderPage(cfg, page, allPages, problems = []) {
  const e = esc;
  const url = abs(cfg, page.path);
  const wa = waLink(cfg, page.waText);
  const indexable = !problems.length && !page.noindex;
  const byPath = Object.fromEntries(allPages.map(p => [p.path, p]));

  // Breadcrumb trail: Home > parent hub (if any) > this page.
  const trail = [{ name: 'Home', path: '/' }];
  if (page.parent && byPath[page.parent]) trail.push({ name: byPath[page.parent].crumb, path: page.parent });
  if (page.path !== '/') trail.push({ name: page.crumb, path: page.path });

  const nameHtml = e(cfg.name).replace(/^One/, 'One<span>') + '</span>';
  const nav = cfg.nav.map(n => `<a href="${e(n.href)}"${n.href === page.path || n.href === page.parent ? ' aria-current="page"' : ''}>${e(n.label)}</a>`).join('');
  const secondary = page.secondary || cfg.cta.secondary;

  const hero = `<section class="hero"><div class="wrap">
${trail.length > 1 ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail.map((c, i) => i === trail.length - 1 ? `<li aria-current="page">${e(c.name)}</li>` : `<li><a href="${e(c.path)}">${e(c.name)}</a></li>`).join('')}</ol></nav>` : ''}
<div class="hero-grid"><div>
<h1${trail.length > 1 ? ' style="margin-top:12px"' : ''}>${e(page.h1)}</h1>
${page.answer ? `<p class="answer">${inline(page.answer)}</p>` : ''}
${page.sub ? `<p class="sub">${inline(page.sub)}</p>` : ''}
${page.type === 'guide' ? `<p class="meta">By ${e(cfg.author.name)}. Published <time datetime="${e(page.published)}">${e(fmtDate(page.published))}</time>. Updated <time datetime="${e(page.updated)}">${e(fmtDate(page.updated))}</time>.</p>` : ''}
${page.type === 'legal' ? '' : `<div class="btn-row">${waBtn(cfg.cta.primary, wa)}${secondary ? `<a class="btn ghost" href="${e(secondary.href)}" data-cta="secondary">${e(secondary.label)}</a>` : ''}</div>`}
</div>${page.mockup ? mockup(page.mockup) : ''}</div>
</div></section>`;

  const sections = (page.sections || []).map((s, i) => `
<section${i % 2 ? ' class="alt"' : ''} aria-labelledby="s${i}"><div class="wrap">
<h2 id="s${i}">${inline(s.h2)}</h2>
${(s.blocks || []).map(b => block(cfg, b, wa)).join('\n')}
</div></section>`).join('');

  const faq = page.faq ? `
<section aria-labelledby="h-faq"><div class="wrap">
<h2 id="h-faq">${inline(page.faq.heading)}</h2>
<div class="faq">${page.faq.items.map((f, i) => `
<div class="faq-item"><h3><button class="faq-q" type="button" aria-expanded="true" aria-controls="fa${i}" id="fq${i}">${e(plain(f.q))}</button></h3>
<div class="faq-a" id="fa${i}" role="region" aria-labelledby="fq${i}"><p>${inline(f.a)}</p></div></div>`).join('')}
</div></div></section>` : '';

  const author = page.type === 'guide' ? `
<section aria-label="About the author"><div class="wrap">
<div class="author"><div class="av" aria-hidden="true">${e(cfg.author.initials)}</div><div><strong>Written by ${e(cfg.author.name)}, ${e(cfg.author.role)}</strong><p>${inline(cfg.author.bio)}</p></div></div>
${page.sources ? `<p class="sources" style="margin-top:14px">Sources: ${page.sources.map(s => `<a href="${e(s.url)}" rel="noopener">${e(s.label)}</a>`).join(', ')}. Checked ${e(fmtDate(page.updated))}.</p>` : ''}
${page.note ? `<p class="tm" style="margin-top:10px">${inline(page.note)}</p>` : ''}
</div></section>` : page.note ? `<section><div class="wrap"><p class="tm">${inline(page.note)}</p></div></section>` : '';

  const final = page.cta ? `
<section class="final" aria-labelledby="h-final"><div class="wrap">
<h2 id="h-final">${inline(page.cta.heading)}</h2>
<p>${inline(page.cta.text)}</p>
<div class="btn-row">${waBtn(cfg.cta.primary, wa)}</div>
</div></section>` : '';

  const footer = `<footer class="foot"><div class="wrap">
<div class="foot-grid">${cfg.footer.groups.map(g => `<div><h2>${e(g.title)}</h2><ul>${g.links.map(l => `<li><a href="${e(l.href)}">${e(l.label)}</a></li>`).join('')}</ul></div>`).join('')}</div>
<div class="about"><strong>${e(cfg.name)}</strong><span>${e(cfg.footer.line)}</span>
<a href="${e(waLink(cfg))}" rel="noopener" data-cta="whatsapp">WhatsApp: ${e(cfg.whatsappDisplay)}</a>
<a href="mailto:${e(cfg.email)}">Email: ${e(cfg.email)}</a>
<span class="tm">${e(cfg.footer.trademark)}</span>
<span class="tm">&copy; ${new Date().getFullYear()} ${e(cfg.name)}</span></div>
</div></footer>`;

  const ga = cfg.ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${e(cfg.ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${e(cfg.ga4Id)}');</script>` : '';

  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>document.documentElement.className='js'</script>
<title>${e(page.title)}</title>
<meta name="description" content="${e(page.description)}">
<link rel="canonical" href="${e(url)}">
<meta name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}">
${cfg.gscToken ? `<meta name="google-site-verification" content="${e(cfg.gscToken)}">` : ''}
<meta name="theme-color" content="${e(cfg.accent)}">
<meta property="og:type" content="${page.type === 'guide' ? 'article' : 'website'}">
<meta property="og:site_name" content="${e(cfg.name)}">
<meta property="og:title" content="${e(page.title)}">
<meta property="og:description" content="${e(page.description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(abs(cfg, `/og/${ogName(page)}.png`))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(page.title)}">
<meta name="twitter:description" content="${e(page.description)}">
<meta name="twitter:image" content="${e(abs(cfg, `/og/${ogName(page)}.png`))}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${css(cfg)}</style>
${schemaFor(cfg, page, trail).map(ldScript).join('\n')}
${ga}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">
<div class="head-row"><a class="wordmark" href="/">${nameHtml}</a><a class="head-cta" href="${e(wa)}" rel="noopener" data-cta="whatsapp">${WA_ICON}<span>${e(cfg.cta.short)}</span></a></div>
<nav class="nav" aria-label="Main">${nav}</nav>
</div></header>
<main id="main">
${hero}
${sections}
${faq}
${author}
${final}
</main>
${footer}
${page.type === 'legal' ? '' : `<div class="sticky">${waBtn(cfg.cta.short, wa)}<a class="btn ghost" href="/pricing" data-cta="secondary">Prices</a></div>`}
<script>
(function(){
document.querySelectorAll('.faq-q').forEach(function(b){var a=document.getElementById(b.getAttribute('aria-controls'));b.setAttribute('aria-expanded','false');a.hidden=true;b.addEventListener('click',function(){var o=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!o));a.hidden=o;});});
var s=document.querySelector('.sticky');if(s){var f=function(){var h=document.documentElement;if((h.scrollTop||document.body.scrollTop)/Math.max(1,h.scrollHeight-h.clientHeight)>0.3){h.classList.add('show-sticky');removeEventListener('scroll',f);}};addEventListener('scroll',f,{passive:true});}
document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('[data-cta]');if(a&&window.gtag)gtag('event',a.getAttribute('data-cta')==='whatsapp'?'whatsapp_click':'cta_click',{page_path:location.pathname});});
})();
</script>
</body>
</html>
`;
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* ------------------------------------------------------------------ 404, llms, robots, sitemap */

export function render404(cfg, allPages) {
  const page = {
    path: '/404', title: `Page not found | ${cfg.name}`, description: 'This page does not exist.', crumb: 'Not found',
    h1: 'This page does not exist', type: 'legal',
    answer: 'The link may be old or mistyped. Try one of these instead.',
    sections: [{ h2: 'Where to go next', blocks: [{ cards: [
      { title: 'OneCatalog home', href: '/' },
      { title: 'WhatsApp catalogue guides', href: '/guides' },
      { title: 'Prices', href: '/pricing' },
      { title: 'Chat with us on WhatsApp', href: waLink(cfg) }
    ] }] }]
  };
  return renderPage(cfg, page, allPages, ['404']).replace(/<link rel="canonical"[^>]*>\n/, '');
}

export function renderLlmsTxt(cfg, pages) {
  const P = cfg.pricing;
  const groups = [['Main pages', p => ['home', 'page', 'about', 'contact'].includes(p.type) && p.path !== '/'],
    ['Industries', p => p.type === 'industry'], ['Guides', p => p.type === 'guide' || p.path === '/guides']];
  const lines = [`# ${cfg.name}`, '', `> ${cfg.entity}`, '',
    `${cfg.name} works with businesses ${cfg.serviceAreaPhrase}. Everything happens on WhatsApp.`, '',
    '## Price',
    ...P.tiers.map(t => `- ${t.products}: ${rupees(t.price)} first year, ${rupees(t.renewal)} a year after. ${t.domainNote}.`),
    ...(P.overflow ? [`- ${P.overflow.products}: ${P.overflow.text}.`] : []),
    P.everyPlan, P.riskReversal, '',
    ...pages.filter(p => p.path === '/').map(p => `- [Home](${cfg.url}): ${p.description}`)];
  for (const [title, test] of groups) {
    lines.push('', `## ${title}`);
    for (const p of pages.filter(test)) lines.push(`- [${p.crumb}](${abs(cfg, p.path)}): ${p.description}`);
  }
  lines.push('', '## Sample catalogues', ...cfg.samples.map(s => `- [${s.label}](${s.url}): ${s.detail}`),
    '', '## Contact', `- WhatsApp: ${cfg.whatsappDisplay} (https://wa.me/${waDigits(cfg)})`, `- Email: ${cfg.email}`,
    `- Run by: ${cfg.author.name}, ${cfg.author.role}`, '');
  return lines.join('\n');
}

export function renderRobots(cfg) {
  const bots = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Claude-SearchBot', 'Google-Extended'];
  return ['User-agent: *', 'Allow: /', '', ...bots.flatMap(b => [`User-agent: ${b}`, 'Allow: /', '']),
    `Sitemap: ${abs(cfg, '/sitemap.xml')}`, ''].join('\n');
}

export function renderSitemap(cfg, pages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `<url><loc>${abs(cfg, p.path)}</loc><lastmod>${p.updated}</lastmod></url>`).join('\n')}
</urlset>
`;
}

export { ogName, bodyWords };
