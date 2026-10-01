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

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z"/></svg>';

/* ------------------------------------------------------------------ css
   Design system. One display face (self-hosted, headlines only) over the system
   body font. Warm ivory base, ink-navy text, WhatsApp green as the single action
   colour. Motion is transform/opacity only and switches off for reduced motion. */

function css(cfg) {
  const a = cfg.accent || '#1E4D7A';
  return `
@font-face{font-family:"Display";src:url(/fonts/bricolage-grotesque.woff2) format("woff2");font-weight:200 800;font-display:swap}
:root{--accent:${a};--accent-dark:${darken(a, 0.25)};--ink:#132235;--text:#1D2530;--muted:#5C5850;--bg:#FBF8F3;--surface:#F4EEE5;--card:#FFFFFF;--line:#E6DED2;--wa:#15803D;--wa-dark:#0F6B32;--wa-soft:#E3F2E7;--max:1120px;--read:680px;--r-sm:10px;--r-md:16px;--r-lg:24px;--shadow:0 1px 2px rgba(19,34,53,.06),0 8px 24px -8px rgba(19,34,53,.14);--shadow-lg:0 2px 4px rgba(19,34,53,.06),0 24px 48px -16px rgba(19,34,53,.28);--ease:cubic-bezier(.2,.7,.2,1);--display:"Display",ui-sans-serif,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:84px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:var(--bg);color:var(--text);font-size:17px;line-height:1.65;overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:3px;transition:color .2s}
a:hover{color:var(--ink)}
a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:6px}
.wrap{max-width:var(--max);margin:0 auto;padding:0 20px}
.skip{position:absolute;left:-999px;top:0;background:#fff;padding:10px 14px;z-index:100}
.skip:focus{left:8px;top:8px}
h1,h2,h3{font-family:var(--display);color:var(--ink);text-wrap:balance}
h1{font-size:clamp(34px,8.4vw,64px);line-height:1.04;letter-spacing:-.035em;font-weight:700}
h2{font-size:clamp(27px,5.6vw,42px);line-height:1.1;letter-spacing:-.03em;font-weight:700}
h3{font-size:19px;line-height:1.3;letter-spacing:-.01em;font-weight:650}
.progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:60;background:var(--wa);transform-origin:0 50%;transform:scaleX(0);pointer-events:none}
@supports (animation-timeline:scroll()){.progress{animation:grow linear both;animation-timeline:scroll(root)}@keyframes grow{to{transform:scaleX(1)}}}
.site-head{position:relative;z-index:40;background:rgba(251,248,243,.82);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid rgba(230,222,210,.7)}
.head-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px}
.wordmark{display:inline-flex;align-items:center;min-height:48px;flex:none;border-radius:10px}
.wordmark img{display:block;height:52px;width:auto}
.foot-logo{display:block;height:72px;width:auto;margin-bottom:8px}
@media (min-width:760px){.wordmark img{height:57px}}
.head-cta{white-space:nowrap;flex:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:9px 16px;border-radius:999px;background:var(--wa);color:#fff;font-weight:650;font-size:15px;text-decoration:none;transition:transform .2s var(--ease),background .2s}
.head-cta:hover{background:var(--wa-dark);color:#fff;transform:translateY(-1px)}
.head-cta svg{width:18px;height:18px;fill:currentColor}
@media (max-width:419px){.head-cta{width:44px;padding:0;justify-content:center}.head-cta span{position:absolute;clip:rect(0 0 0 0)}.head-cta svg{width:22px;height:22px}}
.nav{display:flex;gap:2px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;margin:0 -6px}
.nav::-webkit-scrollbar{display:none}
.nav a{flex:none;display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border-radius:999px;font-size:15px;font-weight:550;color:var(--text);text-decoration:none;transition:background .2s,color .2s}
.nav a:hover{background:var(--surface);color:var(--ink)}
.nav a[aria-current]{background:var(--ink);color:#fff}
.crumbs{font-size:14px;color:var(--muted);margin-bottom:18px}
.crumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.crumbs li+li::before{content:"/";margin-right:6px;color:#C9BFB0}
.crumbs a{display:inline-flex;min-height:32px;align-items:center;color:var(--muted)}
.hero{position:relative;overflow:hidden;padding:40px 0 64px}
.hero::before{content:"";position:absolute;inset:-20% -10% auto auto;width:70vmax;height:70vmax;z-index:-1;background:radial-gradient(closest-side,rgba(21,128,61,.13),transparent 70%)}
.hero::after{content:"";position:absolute;inset:auto auto -30% -20%;width:60vmax;height:60vmax;z-index:-1;background:radial-gradient(closest-side,rgba(30,77,122,.10),transparent 70%)}
.hero-grid{display:grid;gap:44px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:650;letter-spacing:.02em;color:var(--wa-dark);background:var(--wa-soft);padding:6px 12px;border-radius:999px;margin-bottom:18px}
.eyebrow::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--wa);box-shadow:0 0 0 4px rgba(21,128,61,.18)}
.hero .answer{margin-top:22px;font-size:clamp(17.5px,2.2vw,19.5px);line-height:1.6;max-width:36em;color:var(--text)}
.hero .sub{margin-top:12px;color:var(--muted);max-width:36em}
.meta{font-size:14.5px;color:var(--muted);margin-top:16px}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;margin-top:30px}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:14px 26px;border-radius:999px;background:var(--wa);color:#fff;font-size:17px;font-weight:650;text-decoration:none;text-align:center;line-height:1.25;box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 10px 24px -10px rgba(15,107,50,.65);transition:transform .25s var(--ease),box-shadow .25s var(--ease),background .2s}
.btn:hover{background:var(--wa-dark);color:#fff;transform:translateY(-2px);box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 16px 30px -12px rgba(15,107,50,.7)}
.btn:active{transform:translateY(0) scale(.98)}
.btn svg{width:22px;height:22px;flex:0 0 22px;fill:currentColor}
.link-arrow{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:650;color:var(--ink);text-decoration:none}
.link-arrow svg{width:18px;height:18px;fill:currentColor;transition:transform .25s var(--ease)}
.link-arrow:hover svg{transform:translateX(4px)}
.link-arrow span{background:linear-gradient(currentColor,currentColor) 0 100%/0 1.5px no-repeat;transition:background-size .3s var(--ease)}
.link-arrow:hover span{background-size:100% 1.5px}
.trust{list-style:none;display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:26px;font-size:14.5px;color:var(--muted)}
.trust li{display:inline-flex;align-items:center;gap:7px}
.trust svg{width:17px;height:17px;fill:var(--wa)}
.stage{--vh:372px;position:relative;justify-self:center;width:min(290px,80vw);padding:10px 0 40px}
.phone{position:relative;z-index:2;border-radius:40px;background:#101820;padding:9px;box-shadow:var(--shadow-lg);transform:rotate(-2.5deg)}
.phone .screen{position:relative;border-radius:32px;background:#fff;overflow:hidden;padding-bottom:12px}
.ph-static{padding:4px 10px 6px}
.ph-img{aspect-ratio:1;border-radius:9px;background:linear-gradient(145deg,hsl(var(--h) 45% 78%),hsl(var(--h) 38% 58%));position:relative;overflow:hidden}
.ph-img::after{content:"";position:absolute;inset:auto -20% -40% auto;width:70%;height:90%;border-radius:50%;background:rgba(255,255,255,.28)}
.ph-head{display:flex;align-items:center;gap:9px;padding:12px 14px 9px}
.ph-logo{flex:none;width:32px;height:32px;border-radius:10px;background:var(--c);color:#fff;font:700 12px/32px var(--display);text-align:center}
.ph-shop{font:700 14px/1.2 var(--display);color:var(--ink)}
.ph-tag{font-size:10.5px;color:var(--muted)}
.ph-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-bottom:8px}
.ph-item{border-radius:12px;background:#FAF7F2;padding:5px 5px 7px}
.ph-name{font-size:10.5px;font-weight:600;margin-top:6px;line-height:1.3;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em}
.ph-price{font-size:10px;color:var(--muted);font-weight:600;margin-top:2px}
.ph-wa{margin-top:5px;font-size:9.5px;font-weight:650;background:var(--wa);color:#fff;border-radius:999px;text-align:center;padding:3px 0}
.bubbles{position:absolute;z-index:3;right:-16px;bottom:0;width:224px;height:96px;pointer-events:none}
.bubble{position:absolute;right:0;bottom:0;width:100%;background:#DCF8C6;color:#1D2A1F;font-size:12.5px;line-height:1.4;padding:10px 12px 18px;border-radius:14px 14px 4px 14px;box-shadow:var(--shadow)}
.bubble+.bubble{opacity:0}
.bubble::after{content:"\\2713\\2713";position:absolute;right:10px;bottom:4px;font-size:10px;color:#34B7F1;letter-spacing:-2px}
@media (prefers-reduced-motion:no-preference){.phone{animation:float 7s ease-in-out infinite}.phone.back{animation:float-b 8s ease-in-out infinite}.ph-feed{animation:feed var(--t,14s) ease-in-out infinite alternate}.phone.back .ph-feed{animation-delay:-5s}.bubble{animation:say 12s var(--ease) infinite both}.bubble:nth-child(2){animation-delay:4s}.bubble:nth-child(3){animation-delay:8s}@keyframes float{50%{transform:rotate(-2.5deg) translateY(-8px)}}@keyframes float-b{0%,100%{transform:rotate(5deg) scale(.86)}50%{transform:rotate(5deg) scale(.86) translateY(8px)}}@keyframes feed{0%,10%{transform:none}90%,100%{transform:translateY(calc(var(--vh) - 100%))}}@keyframes say{0%{opacity:0;transform:translateY(14px) scale(.94)}5%,30%{opacity:1;transform:none}35%,100%{opacity:0;transform:translateY(-10px)}}}
section.sec{padding:72px 0;content-visibility:auto;contain-intrinsic-size:auto 900px}
.foot{content-visibility:auto;contain-intrinsic-size:auto 600px}
section.sec.tone{background:linear-gradient(180deg,rgba(244,238,229,.0),rgba(244,238,229,.85) 12%,rgba(244,238,229,.85) 88%,rgba(244,238,229,0))}
.sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:24px}
.sec-num{font:600 14px/1 var(--display);color:var(--wa-dark);letter-spacing:.04em;flex:none;padding-top:6px}
.split{display:grid;gap:8px 56px}
.flow{max-width:var(--read)}
.flow>*+*{margin-top:18px}
.flow ul:not([class]),.flow ol:not([class]){padding-left:22px;display:grid;gap:10px}
.flow li::marker{color:var(--wa-dark);font-weight:700}
.body>*+*{margin-top:22px}
.body>p{max-width:var(--read)}
.pain{list-style:none;display:grid;gap:14px;counter-reset:p}
.pain li{counter-increment:p;position:relative;background:var(--card);border-radius:var(--r-md);padding:22px 22px 22px 76px;box-shadow:var(--shadow);font-size:17.5px}
.pain li::before{content:counter(p,decimal-leading-zero);position:absolute;left:22px;top:18px;font:700 30px/1 var(--display);color:transparent;-webkit-text-stroke:1.5px var(--wa);letter-spacing:-.03em}
.steps{list-style:none;display:grid;gap:26px;counter-reset:s;position:relative}
.steps li{counter-increment:s;position:relative;display:grid;grid-template-columns:52px 1fr;gap:18px}
.steps li::before{content:counter(s);width:52px;height:52px;border-radius:16px;background:var(--ink);color:#fff;font:700 20px/52px var(--display);text-align:center;box-shadow:var(--shadow);position:relative;z-index:1}
.steps li:not(:last-child)::after{content:"";position:absolute;left:25px;top:56px;bottom:-26px;width:2px;background:repeating-linear-gradient(var(--line) 0 6px,transparent 6px 12px)}
.steps p{margin-top:6px;color:var(--muted)}
.cards{display:grid;gap:14px}
.card{position:relative;display:block;background:var(--card);border-radius:var(--r-md);padding:24px;color:var(--text);text-decoration:none;box-shadow:var(--shadow);transition:transform .3s var(--ease),box-shadow .3s var(--ease)}
.card p{margin-top:8px;color:var(--muted);font-size:16px}
a.card{padding-right:56px}
a.card::after{content:"";position:absolute;right:22px;top:26px;width:22px;height:22px;background:currentColor;color:var(--wa);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z'/%3E%3C/svg%3E") center/contain no-repeat;transition:transform .3s var(--ease)}
a.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg);color:var(--text)}
a.card:hover::after{transform:translateX(4px)}
a.card h3{color:var(--ink)}
.cards.bento .card:first-child{background:radial-gradient(circle at 88% 12%,rgba(21,128,61,.55),transparent 42%),radial-gradient(circle at 1px 1px,rgba(255,255,255,.10) 1px,transparent 0) 0 0/20px 20px,var(--ink);color:#fff}
.hero-grid.solo{grid-template-columns:1fr}
.hero-grid.solo>div{max-width:820px}
.hero.inner h1{font-size:clamp(32px,6.2vw,54px)}
.qa{margin-top:24px;background:var(--card);border-radius:var(--r-md);padding:20px 22px;box-shadow:var(--shadow);border-left:4px solid var(--wa);max-width:44em}
.qa b{display:block;font:650 13px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--wa-dark);margin-bottom:10px}
.qa p{font-size:18px;line-height:1.6;color:var(--text)}
.cards.bento .card:first-child h3{color:#fff}
.cards.bento .card:first-child p{color:rgba(255,255,255,.78)}
.callout{background:var(--wa-soft);border-radius:var(--r-md);padding:18px 20px;color:#16361F;max-width:var(--read)}
.tbl{overflow-x:auto;border-radius:var(--r-md);background:var(--card);box-shadow:var(--shadow);-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:15.5px;line-height:1.5;min-width:520px}
th,td{text-align:left;padding:14px 16px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
thead th{font-size:12.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:var(--surface);font-weight:650}
tbody th{font-weight:650;color:var(--ink)}
tbody tr{transition:background .2s}
tbody tr:hover{background:#FCFAF6}
caption{text-align:left;font:650 17px/1.3 var(--display);color:var(--ink);padding:16px 16px 12px}
td:nth-child(n+2){font-variant-numeric:tabular-nums}
tr.is-lead{background:var(--wa-soft)}
tr.is-lead th,tr.is-lead td{color:#0F4F27;font-weight:700}
.price-card{display:grid;gap:26px;background:var(--card);border-radius:var(--r-lg);padding:30px 24px;box-shadow:var(--shadow-lg);position:relative;overflow:hidden;outline:2px solid var(--wa);outline-offset:-2px}
.price-card::before{content:"Most shops choose this";position:absolute;top:0;right:0;background:var(--wa);color:#fff;font-size:12.5px;font-weight:650;padding:7px 14px;border-bottom-left-radius:14px}
.price{font:700 clamp(46px,9vw,64px)/1 var(--display);letter-spacing:-.04em;color:var(--ink);font-variant-numeric:tabular-nums;padding-top:10px}
.price small{display:block;margin-top:12px;font:600 16.5px/1.45 system-ui,sans-serif;color:var(--muted);letter-spacing:0}
.incl{list-style:none;display:grid;gap:12px}
.incl li{display:grid;grid-template-columns:24px 1fr;gap:12px;font-size:16px}
.incl svg{width:24px;height:24px;fill:var(--wa);background:var(--wa-soft);border-radius:50%;padding:4px}
.risk{background:var(--surface);border-radius:var(--r-sm);padding:16px 18px;font-weight:600;color:var(--ink)}
.price-card .actions{margin-top:0}
.faq{border-top:1px solid var(--line)}
.faq-item{border-bottom:1px solid var(--line)}
.faq-q{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-height:60px;padding:16px 0;background:none;border:0;font:650 18px/1.35 var(--display);letter-spacing:-.01em;color:var(--ink);text-align:left;cursor:pointer}
.faq-q::after{content:"";flex:0 0 28px;height:28px;border-radius:50%;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M11 5h2v14h-2zM5 11h14v2H5z' fill='%23132235'/%3E%3C/svg%3E") center/14px no-repeat;transition:transform .3s var(--ease),background-color .2s}
.faq-q:hover::after{background-color:var(--line)}
.faq-q[aria-expanded="true"]::after{transform:rotate(45deg)}
.faq-a{padding:0 44px 20px 0;color:var(--muted)}
.faq-a[hidden]{display:none}
.author{display:grid;grid-template-columns:56px 1fr;gap:16px;align-items:start;background:var(--card);border-radius:var(--r-md);padding:20px;box-shadow:var(--shadow);font-size:15.5px;max-width:var(--read)}
.author .av{width:56px;height:56px;border-radius:18px;background:var(--ink);color:#fff;font:700 18px/56px var(--display);text-align:center}
.author strong{color:var(--ink)}
.author p{margin-top:4px;color:var(--muted)}
.sources{font-size:14.5px;color:var(--muted);margin-top:16px;max-width:var(--read)}
.tm{font-size:13.5px;color:var(--muted)}
.final{padding:24px 0 80px}
.final-box{position:relative;overflow:hidden;border-radius:28px;background:var(--ink);color:#fff;padding:52px 26px;text-align:center;isolation:isolate}
.final-box::before{content:"";position:absolute;inset:-40% -20% auto;height:120%;z-index:-1;background:radial-gradient(closest-side,rgba(21,128,61,.55),transparent 70%)}
.final-box::after{content:"";position:absolute;inset:0;z-index:-1;opacity:.5;background:radial-gradient(circle at 1px 1px,rgba(255,255,255,.14) 1px,transparent 0) 0 0/22px 22px;-webkit-mask:linear-gradient(transparent,#000 40%,#000 60%,transparent);mask:linear-gradient(transparent,#000 40%,#000 60%,transparent)}
.final-box h2{color:#fff;max-width:18em;margin:0 auto}
.final-box p{margin:14px auto 0;color:rgba(255,255,255,.8);max-width:34em}
.final-box .actions{justify-content:center}
.final-box .btn{box-shadow:0 14px 34px -12px rgba(21,128,61,.9)}
.foot{padding:56px 0 120px;font-size:15px;color:var(--muted);border-top:1px solid var(--line);background:var(--surface)}
.foot-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.foot h2{font:650 13px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--ink);margin-bottom:10px}
.foot ul{list-style:none}
.foot li a{display:inline-flex;align-items:center;min-height:40px;color:var(--muted);text-decoration:none}
.foot li a:hover{color:var(--ink)}
.foot .about{margin-top:40px;padding-top:28px;border-top:1px solid var(--line);display:grid;gap:6px}
.foot .about strong{font:700 20px/1.2 var(--display);color:var(--ink);letter-spacing:-.02em}
.foot .about a{display:inline-flex;align-items:center;min-height:40px}
.sticky{position:fixed;left:12px;right:12px;bottom:12px;z-index:50;display:grid;grid-template-columns:1fr auto;gap:8px;background:rgba(255,255,255,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:999px;padding:6px;box-shadow:var(--shadow-lg);transition:transform .35s var(--ease),opacity .35s}
.sticky .btn{min-height:48px;font-size:16px;padding:8px 18px;box-shadow:none}
.sticky .link-arrow{padding:0 14px}
.js .sticky{transform:translateY(140%);opacity:0}
.js.show-sticky .sticky{transform:none;opacity:1}
.js [data-reveal]{opacity:0;transform:translateY(22px);transition:opacity .8s var(--ease),transform .8s var(--ease);transition-delay:calc(var(--i,0) * 80ms)}
.js [data-reveal].in{opacity:1;transform:none}
@media (min-width:760px){
.wrap{padding:0 32px}
.site-head{position:sticky;top:0}
.head-row{min-height:72px}
.head-inner{display:flex;align-items:center;gap:20px;min-height:72px}
.head-row{display:contents}
.wordmark{order:0}
.head-inner .nav{order:1;padding:0;margin:0 0 0 auto;overflow:visible}
.head-cta{order:2}
.hero{padding:64px 0 96px}
.hero-grid{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:56px}
section.sec{padding:104px 0}
.split{grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr)}
.split .sec-head{position:sticky;top:112px;align-self:start;margin-bottom:0}
.split h2{font-size:clamp(26px,2.9vw,36px)}
.cards.two{grid-template-columns:1fr 1fr}
.cards.three{grid-template-columns:repeat(3,1fr)}
.cards.bento{grid-template-columns:repeat(3,1fr)}
.cards.bento .card:first-child{grid-column:span 2;grid-row:span 2;display:flex;flex-direction:column;justify-content:flex-end;min-height:260px;padding:32px}
.cards.bento .card:first-child h3{font-size:clamp(24px,2.6vw,32px);letter-spacing:-.02em}
.cards.bento .card:first-child p{font-size:17px;max-width:30em}
.pain{grid-template-columns:repeat(3,1fr)}
.pain li{padding:76px 24px 26px}
.pain li::before{top:24px;font-size:40px}
.steps{grid-template-columns:repeat(var(--n,3),1fr);gap:28px}
.steps li{grid-template-columns:1fr;gap:18px}
.steps li:not(:last-child)::after{left:64px;right:-28px;top:25px;bottom:auto;width:auto;height:2px;background:repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 12px)}
.price-card{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);padding:44px 40px;gap:40px}
.final-box{padding:80px 48px}
.foot-grid{grid-template-columns:repeat(4,1fr)}
.foot{padding-bottom:56px}
.sticky{display:none}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}.js [data-reveal]{opacity:1;transform:none}}
`.replace(/\n/g, '');
}

// Live-catalog phones and the showcase cards. Only pages that use them get
// this CSS, so the other pages stay small.
const LIVE_CSS = `
.phone.back{display:none}
.ph-url{display:flex;align-items:center;justify-content:center;gap:6px;margin:12px 16px 0;padding:5px 10px;border-radius:999px;background:#F2EEE8;font-size:10.5px;color:#5C5850;white-space:nowrap;overflow:hidden}
.ph-chips{display:flex;gap:5px;padding:0 14px 10px;overflow:hidden;white-space:nowrap}
.ph-chips span{flex:none;font-size:9.5px;font-weight:650;padding:4px 9px;border-radius:999px;background:#F2EEE8;color:var(--ink)}
.ph-chips span:first-child{background:var(--c);color:#fff}
.ph-view{position:relative;height:var(--vh);overflow:hidden;padding:0 10px;mask:linear-gradient(#0000,#000 12px,#000 calc(100% - 36px),#0000)}
.ph-item img{display:block;width:100%;height:auto;aspect-ratio:1;border-radius:9px;background:#fff;object-fit:cover}
.ph-feed b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em;margin-top:6px;font-size:10.5px;font-weight:600;line-height:1.3;color:var(--ink)}
.ph-feed i{display:block;margin-top:2px;font-size:10px;font-style:normal;font-weight:600;color:var(--muted)}
.ph-feed i:empty::before{content:"Price on request"}
.ph-feed .ph-item::after{content:"Enquire on WhatsApp";display:block;margin-top:5px;padding:3px 0;border-radius:999px;background:var(--wa);color:#fff;font-size:9.5px;font-weight:650;text-align:center}
@media (min-width:960px){.stage{width:290px;margin-right:110px}.phone.back{display:block;position:absolute;z-index:1;top:-26px;right:-150px;width:100%;transform:rotate(5deg) scale(.86)}}
`.replace(/\n/g, '');
// Below-the-fold styles: the showcase cards. Written to
// /later.css by build.js and loaded without blocking the first paint.
export const LATER_CSS = `
.show{display:grid;gap:20px}
.show-card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;color:var(--text);text-decoration:none;box-shadow:var(--shadow);transition:transform .35s var(--ease),box-shadow .35s var(--ease)}
.show-card:hover{color:var(--text);transform:translateY(-4px);box-shadow:var(--shadow-lg)}
.show-pics{display:grid;grid-template-columns:2fr 1fr;gap:6px;padding:6px;background:color-mix(in srgb,var(--c) 16%,#fff)}
.show-pics span{display:block;overflow:hidden;border-radius:16px;background:#fff}
.show-pics span:first-child{grid-row:span 2}
.show-pics img{display:block;width:100%;height:100%;aspect-ratio:1;object-fit:cover;transition:transform .6s var(--ease)}
.show-card:hover .show-pics img{transform:scale(1.04)}
.show-body{display:flex;flex-direction:column;gap:10px;flex:1;padding:20px 22px 22px}
.show-body h3{font-size:21px}
.show-meta{font-size:14.5px;color:var(--muted)}
.show-tags{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.show-tags li{font-size:13px;line-height:1.4;padding:4px 10px;border-radius:999px;background:var(--surface);color:var(--ink)}
.show-go{margin-top:auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-height:44px;font-weight:650;color:var(--ink)}
.show-go svg{width:18px;height:18px;fill:currentColor;transition:transform .25s var(--ease)}
.show-card:hover .show-go svg{transform:translateX(4px)}
.show-go small{flex-basis:100%;font-size:13px;font-weight:500;color:var(--muted)}
@media (min-width:760px){.show{grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:24px}}
`.replace(/\n/g, '');
const blocksOf = page => (page.sections || []).flatMap(s => s.blocks || []);
const usesLater = page => blocksOf(page).some(b => b.samples);
const IMG_CARD_CSS = '.card.has-img{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;min-height:380px}.card-pic{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:left top}.card.has-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(19,34,53,.94) 80%)}.card.has-img>h3,.card.has-img>p{position:relative;z-index:1}';
const usesImgCard = page => blocksOf(page).some(b => b.cards?.some(c => c.img));
const usesLive = page => Boolean(page.mockup?.shops || (page.sections || []).some(s => (s.blocks || []).some(b => b.samples)));

/* ------------------------------------------------------------------ blocks */

// Initials for a shop's logo tile. "The Best Wood Handicrafts" gives "BW".
const initials = name => name.split(/\s+/).filter(w => !/^(the|and|&)$/i.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// One phone showing a live client catalog. Products come from clients/<slug>/
// (see loadClientSummary in scripts/build.js). The grid is written once and
// the feed glides down and back up.
function phone(shop, n, back) {
  const list = shop.products.slice(0, n);
  const grid = `<div class="ph-grid">${list.map(p => `<div class="ph-item"><img src="${esc(p.img.sm)}" width="120" height="120" alt=""${back ? ' loading="lazy"' : ''}><b>${esc(p.name)}</b><i>${esc(p.price || '')}</i></div>`).join('')}</div>`;
  const chips = shop.categories.slice(0, 3).map(c => `<span>${esc(c)}</span>`).join('');
  return `<div class="phone${back ? ' back' : ''}" style="--c:${esc(shop.accent)}" aria-hidden="true"><div class="screen"><div class="ph-url">${esc(shop.host)}</div><div class="ph-head"><div class="ph-logo">${esc(initials(shop.name))}</div><div><div class="ph-shop">${esc(shop.name)}</div><div class="ph-tag">${esc(shop.count)} products${shop.city ? ', ' + esc(shop.city) : ''}</div></div></div><div class="ph-chips">${chips}</div><div class="ph-view"><div class="ph-feed" style="--t:${list.length * 1.6}s">${grid}</div></div></div></div>`;
}

// Pages without real client photos (industry pages) show drawn example tiles.
// A stable hue per product name keeps the tiles warm and earthy.
const hue = s => 12 + [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 17) % 150;

function staticMockup(m) {
  const items = m.items.map(i => `<div class="ph-item"><div class="ph-img" style="--h:${hue(i.name)}"></div><div class="ph-name">${esc(i.name)}</div><div class="ph-price">${esc(i.price)}</div><div class="ph-wa">Enquire on WhatsApp</div></div>`).join('');
  return `<div class="stage" role="img" aria-label="${esc(m.label)}"><div class="phone" style="--c:var(--ink)" aria-hidden="true"><div class="screen"><div class="ph-head" style="padding-top:18px"><div class="ph-logo">${esc(initials(m.shop))}</div><div><div class="ph-shop">${esc(m.shop)}</div><div class="ph-tag">${esc(m.tag || 'Sample catalogue')}</div></div></div><div class="ph-grid ph-static">${items}</div></div></div><div class="bubbles" aria-hidden="true"><div class="bubble">Hi ${esc(m.shop)}, I'm interested in ${esc(m.items[0].name)}. Please share details.</div></div></div>`;
}

function mockup(m) {
  if (!m.shops) return staticMockup(m);
  const [front, back] = m.shops;
  const says = front.products.slice(0, 3).map(p => `<div class="bubble">Hi ${esc(front.name)}, I'm interested in ${esc(p.name)}. Please share details.</div>`).join('');
  return `<div class="stage" role="img" aria-label="${esc(m.label)}">${back ? phone(back, 4, true) : ''}${phone(front, 6, false)}<div class="bubbles" aria-hidden="true">${says}</div></div>`;
}

function pricingBlock(cfg, mode, wa) {
  const P = cfg.pricing, lead = featured(cfg), e = esc;
  const rows = P.tiers.map(t => `<tr${t === lead ? ' class="is-lead"' : ''}><th scope="row">${e(t.products)}<br><small>${e(t.label ? `${t.label}. ${t.domainNote}` : t.domainNote)}</small></th><td>${e(rupees(t.price))}</td><td>${e(rupees(t.renewal))}</td></tr>`).join('')
    + (P.overflow ? `<tr><th scope="row">${e(P.overflow.products)}</th><td colspan="2">${e(P.overflow.text)}</td></tr>` : '');
  const table = `<div class="tbl" data-reveal><table><caption>${e(P.tableHeading)}</caption><thead><tr><th scope="col">Products</th><th scope="col">First year</th><th scope="col">Renewal</th></tr></thead><tbody>${rows}</tbody></table></div><p data-reveal>${e(P.tableNote)} ${e(P.everyPlan)}</p>`;
  if (mode === 'table') return table;
  const card = `<div class="price-card" data-reveal><div><p class="price">${e(rupees(lead.price))}<small>for the first year, then ${e(rupees(lead.renewal))} a year. ${e(lead.products)}.</small></p><p class="risk" style="margin-top:22px">${e(P.riskReversal)}</p><div class="actions" style="margin-top:22px">${waBtn(cfg.cta.primary, wa)}</div></div><ul class="incl">${P.includes.map(i => `<li>${TICK}<span>${e(i)}</span></li>`).join('')}</ul></div>`;
  return mode === 'card' ? card : card + table;
}

// Pick up to 3 photos for a showcase card, one per category where possible.
function showPics(s) {
  const seen = new Set(), pick = [];
  for (const p of s.products) if (!seen.has(p.category)) { seen.add(p.category); pick.push(p); }
  for (const p of s.products) if (pick.length < 3 && !pick.includes(p)) pick.push(p);
  return pick.slice(0, 3);
}

function samplesBlock(cfg) {
  const cards = cfg.samples.map((s, i) => {
    const pics = showPics(s).map((p, j) => `<span><img src="${esc(j ? p.img.sm : p.img.md)}" width="${j ? 240 : 480}" height="${j ? 240 : 480}" alt="${esc(p.name)}" loading="lazy"></span>`).join('');
    const tags = s.categories.slice(0, 3).map(c => `<li>${esc(c)}</li>`).join('');
    return `<a class="show-card" href="${esc(s.url)}" data-reveal style="--i:${i};--c:${esc(s.accent)}"><div class="show-pics">${pics}</div><div class="show-body"><h3>${esc(s.name)}</h3><p class="show-meta">${esc(s.trade)}${s.city ? ', ' + esc(s.city) : ''}. ${esc(s.count)} products.</p><ul class="show-tags">${tags}</ul><span class="show-go">Open catalogue ${ARROW}<small>${esc(s.host)}</small></span></div></a>`;
  }).join('');
  return `<div class="show" style="--n:${cfg.samples.length}">${cards}</div>`;
}

function cardImg(g) {
  return `<img class="card-pic" src="${esc(g.src)}-720.webp" srcset="${esc(g.src)}-720.webp 720w, ${esc(g.src)}-1400.webp 1400w" sizes="(min-width:760px) 720px, 100vw" width="${g.width}" height="${g.height}" alt="${esc(g.alt)}" loading="lazy" decoding="async">`;
}

function cardsBlock(list) {
  const linked = list.every(c => c.href);
  const cls = !linked && list.length >= 5 ? 'bento' : list.length === 3 ? 'three' : list.length > 1 ? 'two' : '';
  return `<div class="cards ${cls}">${list.map((c, i) => c.href
    ? `<a class="card" href="${esc(c.href)}" data-reveal style="--i:${i % 3}"><h3>${esc(c.title)}</h3>${c.text ? `<p>${esc(plain(c.text))}</p>` : ''}</a>`
    : `<div class="card${c.img ? ' has-img' : ''}" data-reveal style="--i:${i % 3}">${c.img ? cardImg(c.img) : ''}<h3>${inline(c.title)}</h3>${c.text ? `<p>${inline(c.text)}</p>` : ''}</div>`).join('')}</div>`;
}

function block(cfg, b, wa) {
  const R = ' data-reveal';
  if (b.p) return `<p${R}>${inline(b.p)}</p>`;
  if (b.ul) return `<ul${R}>${b.ul.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
  if (b.ol) return `<ol${R}>${b.ol.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`;
  if (b.pain) return `<ul class="pain">${b.pain.map((x, i) => `<li data-reveal style="--i:${i}">${inline(x)}</li>`).join('')}</ul>`;
  if (b.steps) return `<ol class="steps" style="--n:${Math.min(b.steps.length, 5)}">${b.steps.map((s, i) => `<li data-reveal style="--i:${i}"><div><h3>${inline(s.title)}</h3><p>${inline(s.text)}</p></div></li>`).join('')}</ol>`;
  if (b.cards) return cardsBlock(b.cards);
  if (b.table) {
    const T = b.table;
    return `<div class="tbl"${R}><table>${T.caption ? `<caption>${inline(T.caption)}</caption>` : ''}<thead><tr>${T.head.map(h => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead><tbody>${T.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if (b.callout) return `<div class="callout"${R}><p>${inline(b.callout)}</p></div>`;
  if (b.pricing) return pricingBlock(cfg, b.pricing, wa);
  if (b.samples) return samplesBlock(cfg);
  if (b.note) return `<p class="tm">${inline(b.note)}</p>`;
  if (b.cta) return `<div class="actions"${R}>${waBtn(cfg.cta.primary, wa)}</div>`;
  throw new Error('unknown block: ' + JSON.stringify(b).slice(0, 80));
}

// Sections whose blocks are all prose read best as a sticky heading beside the text.
const WIDE = b => b.cards || b.table || b.pricing || b.samples || b.steps || b.pain;

function waBtn(label, href) {
  return `<a class="btn" href="${esc(href)}" rel="noopener" data-cta="whatsapp">${WA_ICON}<span>${esc(label)}</span></a>`;
}

function ogName(page) {
  return page.path === '/' ? 'home' : page.path.slice(1).replace(/\//g, '-');
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
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

  const nav = cfg.nav.map(n => `<a href="${e(n.href)}"${n.href === page.path || n.href === page.parent ? ' aria-current="page"' : ''}>${e(n.label)}</a>`).join('');
  const secondary = page.secondary || cfg.cta.secondary;
  const eyebrow = { guide: 'Guide', industry: 'For your trade', home: cfg.eyebrow, legal: 'Draft' }[page.type] || '';

  const answerHtml = !page.answer ? ''
    : page.type === 'guide' ? `<div class="qa"><b>Quick answer</b><p>${inline(page.answer)}</p></div>`
    : `<p class="answer">${inline(page.answer)}</p>`;
  const hero = `<section class="hero${page.path === '/' ? '' : ' inner'}"><div class="wrap">
${trail.length > 1 ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail.map((c, i) => i === trail.length - 1 ? `<li aria-current="page">${e(c.name)}</li>` : `<li><a href="${e(c.path)}">${e(c.name)}</a></li>`).join('')}</ol></nav>` : ''}
<div class="hero-grid${page.mockup ? '' : ' solo'}"><div>
${eyebrow ? `<p class="eyebrow">${e(eyebrow)}</p>` : ''}
<h1>${e(page.h1)}</h1>
${answerHtml}
${page.sub ? `<p class="sub">${inline(page.sub)}</p>` : ''}
${page.type === 'guide' ? `<p class="meta">By ${e(cfg.author.name)}. Published <time datetime="${e(page.published)}">${e(fmtDate(page.published))}</time>. Updated <time datetime="${e(page.updated)}">${e(fmtDate(page.updated))}</time>.</p>` : ''}
${page.type === 'legal' ? '' : `<div class="actions">${waBtn(cfg.cta.primary, wa)}${secondary ? `<a class="link-arrow" href="${e(secondary.href)}" data-cta="secondary"><span>${e(secondary.label)}</span>${ARROW}</a>` : ''}</div>`}
${page.mockup ? `<ul class="trust">${cfg.trust.map(t => `<li>${TICK}${e(t)}</li>`).join('')}</ul>` : ''}
</div>${page.mockup ? mockup(page.mockup) : ''}</div>
</div></section>`;

  let n = 0;
  const secBlock = (id, h2, inner, wide, tone) => {
    n++;
    const head = `<div class="sec-head"><span class="sec-num" aria-hidden="true">${String(n).padStart(2, '0')}</span><h2 id="${id}">${inline(h2)}</h2></div>`;
    return `
<section class="sec${tone ? ' tone' : ''}" aria-labelledby="${id}"><div class="wrap${wide ? '' : ' split'}">
${head}
<div class="${wide ? 'body' : 'flow'}">${inner}</div>
</div></section>`;
  };

  const sections = (page.sections || []).map((s, i) =>
    secBlock(`s${i}`, s.h2, (s.blocks || []).map(b => block(cfg, b, wa)).join('\n'), (s.blocks || []).some(WIDE), i % 2 === 1)).join('');

  const faq = page.faq ? secBlock('h-faq', page.faq.heading, `<div class="faq">${page.faq.items.map((f, i) => `
<div class="faq-item" data-reveal style="--i:${Math.min(i, 3)}"><h3><button class="faq-q" type="button" aria-expanded="true" aria-controls="fa${i}" id="fq${i}">${e(plain(f.q))}</button></h3>
<div class="faq-a" id="fa${i}" role="region" aria-labelledby="fq${i}"><p>${inline(f.a)}</p></div></div>`).join('')}</div>`, false, (page.sections || []).length % 2 === 1) : '';

  const author = page.type === 'guide' ? `
<section class="sec" aria-label="About the author" style="padding-top:0"><div class="wrap">
<div class="author" data-reveal><div class="av" aria-hidden="true">${e(cfg.author.initials)}</div><div><strong>Written by ${e(cfg.author.name)}, ${e(cfg.author.role)}</strong><p>${inline(cfg.author.bio)}</p></div></div>
${page.sources ? `<p class="sources">Sources: ${page.sources.map(s => `<a href="${e(s.url)}" rel="noopener">${e(s.label)}</a>`).join(', ')}. Checked ${e(fmtDate(page.updated))}.</p>` : ''}
${page.note ? `<p class="tm" style="margin-top:12px">${inline(page.note)}</p>` : ''}
</div></section>` : page.note ? `<section class="sec" style="padding:0 0 32px"><div class="wrap"><p class="tm">${inline(page.note)}</p></div></section>` : '';

  const final = page.cta ? `
<section class="final" aria-labelledby="h-final"><div class="wrap"><div class="final-box" data-reveal>
<h2 id="h-final">${inline(page.cta.heading)}</h2>
<p>${inline(page.cta.text)}</p>
<div class="actions">${waBtn(cfg.cta.primary, wa)}</div>
</div></div></section>` : '';

  const footer = `<footer class="foot"><div class="wrap">
<div class="foot-grid">${cfg.footer.groups.map(g => `<div><h2>${e(g.title)}</h2><ul>${g.links.map(l => `<li><a href="${e(l.href)}">${e(l.label)}</a></li>`).join('')}</ul></div>`).join('')}</div>
<div class="about"><img class="foot-logo" src="/brand/logo-tagline.webp" width="278" height="72" alt="${e(cfg.name)}. Your products. One catalog. Everywhere." loading="lazy" decoding="async"><span>${e(cfg.footer.line)}</span>
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
<meta name="theme-color" content="#FBF8F3">
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
<link rel="icon" href="/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/brand/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="preload" href="/brand/logo.webp" as="image" type="image/webp">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<style>${css(cfg)}${usesLive(page) ? LIVE_CSS : ''}${usesImgCard(page) ? IMG_CARD_CSS : ''}</style>${usesLater(page) ? '<link rel="stylesheet" href="/later.css" media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="/later.css"></noscript>' : ''}
${schemaFor(cfg, page, trail).map(ldScript).join('\n')}
${ga}
</head>
<body>
<div class="progress" aria-hidden="true"></div>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap head-inner">
<div class="head-row"><a class="wordmark" href="/" aria-label="${e(cfg.name)} home"><img src="/brand/logo.webp" width="220" height="57" alt="${e(cfg.name)}"></a><a class="head-cta" href="${e(wa)}" rel="noopener" data-cta="whatsapp">${WA_ICON}<span>${e(cfg.cta.short)}</span></a></div>
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
${page.type === 'legal' ? '' : `<div class="sticky">${waBtn(cfg.cta.short, wa)}<a class="link-arrow" href="/pricing" data-cta="secondary"><span>Prices</span></a></div>`}
<script>
(function(){
var d=document,h=d.documentElement;
d.querySelectorAll('.faq-q').forEach(function(b){var a=d.getElementById(b.getAttribute('aria-controls'));b.setAttribute('aria-expanded','false');a.hidden=true;b.addEventListener('click',function(){var o=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!o));a.hidden=o;});});
var els=[].slice.call(d.querySelectorAll('[data-reveal]'));
if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches){els.forEach(function(el){el.classList.add('in')});}
else{var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:.08});els.forEach(function(el){io.observe(el)});}
var s=d.querySelector('.sticky');if(s){var f=function(){if((h.scrollTop||d.body.scrollTop)/Math.max(1,h.scrollHeight-h.clientHeight)>0.3){h.classList.add('show-sticky');removeEventListener('scroll',f);}};addEventListener('scroll',f,{passive:true});}
d.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('[data-cta]');if(a&&window.gtag)gtag('event',a.getAttribute('data-cta')==='whatsapp'?'whatsapp_click':'cta_click',{page_path:location.pathname});});
})();
</script>
</body>
</html>
`;
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
  return renderPage(cfg, page, allPages, ['404'])
    .replace(/<link rel="canonical"[^>]*>\n/, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '')
    .replace('<p class="eyebrow">Draft</p>', '<p class="eyebrow">404</p>');
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
