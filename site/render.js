/* Landing page for onecatalog.in. Pure function: config in, HTML string out.
   Every word lives in site/config.json. This file only arranges it.
   One self-contained file: inline CSS, no fonts, no CDNs, no analytics.
   The only script is the FAQ accordion, and the answers are in the HTML
   and visible without it. */

import { esc } from '../template/render.js';
import { darken } from '../template/themes.js';

const TODO = /\bTODO\b/;

export function rupees(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function waDigits(cfg) {
  return String(cfg.whatsapp || '').replace(/\D/g, '');
}

function waLink(cfg) {
  return `https://wa.me/${waDigits(cfg)}?text=${encodeURIComponent(cfg.waMessage || '')}`;
}

// JSON inside <script> must never contain "</script>" or a stray "<!--".
function ldScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

/** Problems worth fixing before this goes live. The build prints them. */
export function checkHome(cfg) {
  const out = [];
  const walk = (v, p) => {
    if (typeof v === 'string') { if (TODO.test(v)) out.push(`${p} still says TODO`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, p ? `${p}.${k}` : k));
  };
  walk(cfg, '');
  if (!/^\d{12}$/.test(waDigits(cfg))) out.push('whatsapp must be country code + 10 digits, e.g. 919876543210');
  if ((cfg.title || '').length >= 60) out.push(`title is ${cfg.title.length} characters, keep it under 60`);
  const d = (cfg.metaDescription || '').length;
  if (d < 150 || d > 160) out.push(`metaDescription is ${d} characters, keep it 150 to 160`);
  // Same prices everywhere, or search engines stop trusting the entity.
  // The lead plan's price must appear in the summary text, and every rupee
  // amount written anywhere in the copy must be one of the configured prices.
  const P = cfg.pricing;
  const lead = rupees(featured(cfg).price);
  for (const [k, v] of [['metaDescription', cfg.metaDescription], ['definition.text', cfg.definition.text], ['pricing.lead', P.lead]]) {
    if (!String(v).includes(lead)) out.push(`${k} should state the lead price ${lead}`);
  }
  const known = new Set([...P.tiers.flatMap(t => [t.price, t.renewal]), P.booking, P.extraBatch].map(rupees));
  const strings = [];
  const collect = v => typeof v === 'string' ? strings.push(v) : v && typeof v === 'object' && Object.values(v).forEach(collect);
  collect(cfg);
  for (const amt of new Set(strings.flatMap(s => s.match(/₹\d{1,3}(?:,\d{2,3})*/g) || []))) {
    if (!known.has(amt)) out.push(`${amt} appears in the copy but is not a configured price`);
  }
  // We serve all of India remotely. The page must never suggest a visit.
  if (strings.some(s => /in person/i.test(s))) out.push('copy says "in person" somewhere, remove it');
  return out;
}

function featured(cfg) {
  return cfg.pricing.tiers[cfg.pricing.featured ?? 0];
}

function tierText(t) {
  return `${t.products}: ${rupees(t.price)} for the first year, then ${rupees(t.renewal)} a year to renew. ${t.domainNote}.`;
}

function schema(cfg) {
  const url = cfg.url;
  const country = { '@type': 'Country', name: cfg.serviceArea };
  const wa = waDigits(cfg);
  const real = v => v && !TODO.test(v);

  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': url + '#org',
    name: cfg.name,
    url,
    description: cfg.definition.text,
    areaServed: country,
    ...(/^\d{12}$/.test(wa) ? { telephone: '+' + wa } : {}),
    ...(real(cfg.email) ? { email: cfg.email } : {})
  };

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': url + '#service',
    name: `${cfg.name} WhatsApp product catalog`,
    serviceType: 'WhatsApp product catalog website',
    description: cfg.definition.text,
    provider: { '@id': url + '#org' },
    areaServed: country,
    audience: { '@type': 'BusinessAudience', audienceType: 'Small and medium businesses' },
    category: cfg.trades.items,
    // One Offer per priced plan, lead plan first. Prices match the page table.
    offers: [featured(cfg), ...cfg.pricing.tiers.filter(t => t !== featured(cfg))].map(t => ({
      '@type': 'Offer',
      name: t.label ? `${t.label}, ${t.products}` : t.products,
      price: String(t.price),
      priceCurrency: 'INR',
      description: `${tierText(t)} ${t === featured(cfg)
        ? `Includes: ${cfg.pricing.includes.join('. ')}.`
        : cfg.pricing.everyPlan}`,
      url,
      availability: 'https://schema.org/InStock',
      areaServed: country
    }))
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: cfg.faq.items.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: cfg.name, item: url }]
  };

  return [org, service, faq, crumbs];
}

const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.3-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.4-.5-.6-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 1.9 3 4.7 4.1 2.3.9 2.8.8 3.3.7.5-.1 1.6-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.2-.2-.5-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.2-1.3c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.9-1.4-1.3-2.9-1.3-4.5 0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.6 8.4-7.9 8.4z"/></svg>';

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

function css(cfg) {
  const accent = cfg.accent || '#1E4D7A';
  return `
:root{--accent:${accent};--accent-dark:${darken(accent, 0.25)};--bg:#FAF8F5;--card:#fff;--text:#1C1A17;--muted:#5E574F;--line:#E6E0D8;--wa:#15803D;--wa-dark:#116A33;--tint:#F1EEE9;--max:680px}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:var(--bg);color:var(--text);font-size:17px;line-height:1.6;padding-bottom:84px;overflow-wrap:break-word}
a{color:var(--accent-dark)}
.wrap{max-width:var(--max);margin:0 auto;padding:0 16px}
.site-head{background:var(--card);border-bottom:1px solid var(--line)}
.site-head .wrap{display:flex;align-items:center;min-height:56px}
.wordmark{font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--text)}
.wordmark span{color:var(--accent)}
section{padding:44px 0;border-bottom:1px solid var(--line)}
section.alt{background:var(--card)}
h1{font-size:clamp(28px,7.6vw,40px);line-height:1.15;letter-spacing:-.02em;font-weight:800}
h2{font-size:clamp(23px,5.6vw,29px);line-height:1.25;letter-spacing:-.01em;font-weight:800}
h3{font-size:18px;line-height:1.35;font-weight:700}
.lead{margin-top:12px;color:var(--muted)}
.hero{padding:40px 0 36px;background:var(--card)}
.hero .sub{margin-top:16px;font-size:18.5px;color:var(--muted)}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;width:100%;padding:12px 20px;border-radius:12px;background:var(--wa);color:#fff;font-size:17.5px;font-weight:700;text-decoration:none;text-align:center;line-height:1.3}
.btn:hover{background:var(--wa-dark)}
.btn:focus-visible,.faq-q:focus-visible,.sample:focus-visible,.foot a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.btn svg{width:24px;height:24px;flex:0 0 24px;fill:currentColor}
.hero .btn{margin-top:26px}
.note{margin-top:12px;font-size:15px;color:var(--muted);text-align:center}
.define{padding:28px 0}
.define .box{border-left:4px solid var(--accent);padding:4px 0 4px 16px}
.define h2{font-size:19px}
.define p{margin-top:8px}
.pain{list-style:none;margin-top:20px;display:grid;gap:12px}
.pain li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.steps{list-style:none;margin-top:24px;display:grid;gap:22px;counter-reset:s}
.steps li{display:grid;grid-template-columns:44px 1fr;gap:14px;counter-increment:s}
.steps li::before{content:counter(s);width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;font-weight:800;font-size:19px;display:flex;align-items:center;justify-content:center}
.steps p{margin-top:4px;color:var(--muted)}
.samples{list-style:none;margin-top:22px;display:grid;gap:12px}
.sample{display:flex;flex-direction:column;justify-content:center;min-height:72px;padding:14px 44px 14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--card);text-decoration:none;position:relative}
.sample strong{color:var(--accent-dark);font-size:17px;text-decoration:underline;text-underline-offset:3px}
.sample span{font-size:15px;color:var(--muted)}
.sample::after{content:"\\2192";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:20px;color:var(--accent)}
.trades{list-style:none;margin-top:20px;display:flex;flex-wrap:wrap;gap:8px}
.trades li{padding:8px 14px;border-radius:100px;background:var(--tint);font-size:15.5px;font-weight:600}
.points{margin-top:24px;display:grid;gap:14px}
.point{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.point p{margin-top:6px;color:var(--muted)}
.price-card{margin-top:22px;background:var(--card);border:2px solid var(--accent);border-radius:16px;padding:22px 18px}
.price{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.price small{display:block;margin-top:8px;line-height:1.4;font-size:17px;font-weight:600;color:var(--muted);letter-spacing:0}
.incl{list-style:none;margin-top:16px;display:grid;gap:10px}
.incl li{display:grid;grid-template-columns:22px 1fr;gap:10px;font-size:16px}
.incl svg{width:22px;height:22px;fill:var(--wa);margin-top:2px}
.risk{margin-top:18px;padding:14px 16px;border-radius:12px;background:var(--tint);font-weight:700}
.price-card .btn{margin-top:18px}
.plans{margin-top:30px}
.plans h3{font-size:17px}
.tiers{width:100%;margin-top:10px;border-collapse:collapse;font-size:15px;line-height:1.4}
.tiers th,.tiers td{text-align:left;padding:10px 6px 10px 0;border-bottom:1px solid var(--line);vertical-align:top}
.tiers thead th{font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.tiers td:not(:first-child),.tiers thead th:not(:first-child){text-align:right;white-space:nowrap;padding-right:0;padding-left:6px}
.tiers tbody th{font-weight:600}
.tiers tbody th small{display:block;font-size:13px;font-weight:400;color:var(--muted)}
.tiers tr.is-lead th,.tiers tr.is-lead td{font-weight:800;color:var(--accent-dark)}
.plans p{margin-top:12px;font-size:15.5px;color:var(--muted)}
.plans p.plain{color:var(--text);font-weight:600}
.faq{margin-top:20px;border-top:1px solid var(--line)}
.faq-item{border-bottom:1px solid var(--line);padding:6px 0}
.faq-q{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:52px;padding:10px 0;background:none;border:0;font:inherit;font-size:17.5px;font-weight:700;color:var(--text);text-align:left;cursor:pointer}
.faq-q::after{content:"+";flex:0 0 auto;font-size:26px;font-weight:400;color:var(--accent);line-height:1}
.faq-q[aria-expanded="true"]::after{content:"\\2212"}
.faq-a{padding:0 0 14px;color:var(--muted)}
.faq-a[hidden]{display:none}
.final{background:var(--card);text-align:center}
.final p{margin-top:10px;color:var(--muted)}
.final .btn{margin-top:22px}
.foot{padding:28px 0 32px;font-size:15.5px;color:var(--muted)}
.foot .wrap{display:grid;gap:4px}
.foot strong{color:var(--text);font-size:17px}
.foot a{display:inline-flex;align-items:center;min-height:44px}
.sticky{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(255,255,255,.96);border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
.sticky .btn{max-width:var(--max);margin:0 auto;min-height:52px}
@media (min-width:720px){section{padding:64px 0}.hero{padding:64px 0 56px}.points{grid-template-columns:1fr 1fr}.btn{width:auto;min-width:320px}.hero .btn,.final .btn{display:inline-flex}.note{text-align:left}.final .btn{margin-left:auto;margin-right:auto}.sticky .btn{width:100%}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
`.replace(/\n/g, '');
}

export function renderHome(cfg) {
  const e = esc;
  const wa = waLink(cfg);
  const P = cfg.pricing;
  const lead = featured(cfg);
  const tierRows = P.tiers.map(t => `<tr${t === lead ? ' class="is-lead"' : ''}><th scope="row">${e(t.products)}<small>${e(t.label ? `${t.label}. ${t.domainNote}` : t.domainNote)}</small></th><td>${e(rupees(t.price))}</td><td>${e(rupees(t.renewal))}</td></tr>`).join('')
    + (P.overflow ? `<tr><th scope="row">${e(P.overflow.products)}</th><td colspan="2">${e(P.overflow.text)}</td></tr>` : '');
  const hasTodo = checkHome(cfg).length > 0;
  const nameHtml = e(cfg.name).replace(/^One/, 'One<span>') + '</span>';
  const waBtn = (label, cls = '') =>
    `<a class="btn${cls}" href="${e(wa)}" rel="noopener">${WA_ICON}<span>${e(label)}</span></a>`;

  const faqItems = cfg.faq.items.map((f, i) => `
<div class="faq-item">
<h3><button class="faq-q" type="button" aria-expanded="true" aria-controls="faq-a${i}" id="faq-q${i}">${e(f.q)}</button></h3>
<div class="faq-a" id="faq-a${i}" role="region" aria-labelledby="faq-q${i}"><p>${e(f.a)}</p></div>
</div>`).join('');

  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(cfg.title)}</title>
<meta name="description" content="${e(cfg.metaDescription)}">
<link rel="canonical" href="${e(cfg.url)}">
<meta name="robots" content="${hasTodo ? 'noindex,nofollow' : 'index,follow'}">
<meta name="theme-color" content="${e(cfg.accent)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${e(cfg.name)}">
<meta property="og:title" content="${e(cfg.title)}">
<meta property="og:description" content="${e(cfg.metaDescription)}">
<meta property="og:url" content="${e(cfg.url)}">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${e(cfg.title)}">
<meta name="twitter:description" content="${e(cfg.metaDescription)}">
<style>${css(cfg)}</style>
${schema(cfg).map(ldScript).join('\n')}
</head>
<body>
<header class="site-head"><div class="wrap"><span class="wordmark">${nameHtml}</span></div></header>
<main>

<section class="hero"><div class="wrap">
<h1>${e(cfg.hero.headline)}</h1>
<p class="sub">${e(cfg.hero.subhead)}</p>
${waBtn(cfg.hero.button)}
<p class="note">${e(cfg.hero.note)}</p>
</div></section>

<section class="define" aria-labelledby="h-define"><div class="wrap"><div class="box">
<h2 id="h-define">${e(cfg.definition.heading)}</h2>
<p>${e(cfg.definition.text)}</p>
</div></div></section>

<section aria-labelledby="h-problem"><div class="wrap">
<h2 id="h-problem">${e(cfg.problem.heading)}</h2>
<ul class="pain">${cfg.problem.lines.map(l => `<li>${e(l)}</li>`).join('')}</ul>
</div></section>

<section class="alt" aria-labelledby="h-steps"><div class="wrap">
<h2 id="h-steps">${e(cfg.steps.heading)}</h2>
<p class="lead">${e(cfg.steps.intro)}</p>
<ol class="steps">${cfg.steps.items.map(s => `<li><div><h3>${e(s.title)}</h3><p>${e(s.text)}</p></div></li>`).join('')}</ol>
</div></section>

<section aria-labelledby="h-samples"><div class="wrap">
<h2 id="h-samples">${e(cfg.samples.heading)}</h2>
<p class="lead">${e(cfg.samples.intro)}</p>
<ul class="samples">${cfg.samples.items.map(s => `<li><a class="sample" href="${e(s.url)}"><strong>${e(s.label)}</strong><span>${e(s.detail)}</span></a></li>`).join('')}</ul>
</div></section>

<section class="alt" aria-labelledby="h-trades"><div class="wrap">
<h2 id="h-trades">${e(cfg.trades.heading)}</h2>
<p class="lead">${e(cfg.trades.intro)}</p>
<ul class="trades">${cfg.trades.items.map(t => `<li>${e(t)}</li>`).join('')}</ul>
</div></section>

<section aria-labelledby="h-compare"><div class="wrap">
<h2 id="h-compare">${e(cfg.compare.heading)}</h2>
<p class="lead">${e(cfg.compare.intro)}</p>
<div class="points">${cfg.compare.points.map(p => `<div class="point"><h3>${e(p.title)}</h3><p>${e(p.text)}</p></div>`).join('')}</div>
</div></section>

<section class="alt" aria-labelledby="h-price"><div class="wrap">
<h2 id="h-price">${e(P.heading)}</h2>
<p class="lead">${e(P.lead)}</p>
<div class="price-card">
<p class="price">${e(rupees(lead.price))} <small>for the first year, then ${e(rupees(lead.renewal))} a year. ${e(lead.products)}.</small></p>
<ul class="incl">${P.includes.map(i => `<li>${TICK}<span>${e(i)}</span></li>`).join('')}</ul>
<p class="risk">${e(P.riskReversal)}</p>
${waBtn(cfg.hero.button)}
</div>
<div class="plans">
<h3>${e(P.tableHeading)}</h3>
<table class="tiers">
<thead><tr><th scope="col">Products</th><th scope="col">First year</th><th scope="col">Renewal</th></tr></thead>
<tbody>${tierRows}</tbody>
</table>
<p class="plain">${e(P.tableNote)}</p>
<p>${e(P.everyPlan)}</p>
</div>
</div></section>

<section aria-labelledby="h-faq"><div class="wrap">
<h2 id="h-faq">${e(cfg.faq.heading)}</h2>
<div class="faq">${faqItems}
</div>
</div></section>

<section class="final" aria-labelledby="h-final"><div class="wrap">
<h2 id="h-final">${e(cfg.finalCta.heading)}</h2>
<p>${e(cfg.finalCta.text)}</p>
${waBtn(cfg.finalCta.button)}
</div></section>

</main>
<footer class="foot"><div class="wrap">
<strong>${e(cfg.name)}</strong>
<span>${e(cfg.footer.line)}</span>
<a href="${e(wa)}" rel="noopener">WhatsApp: ${e(cfg.whatsappDisplay)}</a>
<a href="mailto:${e(cfg.email)}">Email: ${e(cfg.email)}</a>
</div></footer>

<div class="sticky">${waBtn(cfg.stickyLabel)}</div>

<script>
document.querySelectorAll('.faq-q').forEach(function (b) {
  var a = document.getElementById(b.getAttribute('aria-controls'));
  b.setAttribute('aria-expanded', 'false'); a.hidden = true;
  b.addEventListener('click', function () {
    var open = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', String(!open)); a.hidden = open;
  });
});
</script>
</body>
</html>
`;
}

/** Plain-text summary for AI crawlers. Same facts as the page, same wording. */
export function renderLlmsTxt(cfg) {
  const lines = [
    `# ${cfg.name}`,
    '',
    `> ${cfg.definition.text}`,
    '',
    '## Who it is for',
    cfg.trades.intro,
    ...cfg.trades.items.map(t => `- ${t}`),
    '',
    '## Service area',
    `${cfg.name} works with businesses ${cfg.serviceAreaPhrase}. Everything happens on WhatsApp, so location does not matter.`,
    '',
    '## How it works',
    ...cfg.steps.items.map((s, i) => `${i + 1}. ${s.title}. ${s.text}`),
    '',
    '## Price',
    cfg.pricing.lead,
    '',
    `The ${rupees(featured(cfg).price)} plan includes:`,
    ...cfg.pricing.includes.map(i => `- ${i}`),
    '',
    'All plans:',
    ...cfg.pricing.tiers.map(t => `- ${t.label ? t.label + ', ' : ''}${tierText(t)}`),
    ...(cfg.pricing.overflow ? [`- ${cfg.pricing.overflow.products}: ${cfg.pricing.overflow.text}.`] : []),
    '',
    cfg.pricing.tableNote,
    cfg.pricing.everyPlan,
    cfg.pricing.riskReversal,
    '',
    '## Sample catalogs',
    ...cfg.samples.items.map(s => `- [${s.label}](${s.url}): ${s.detail}`),
    '',
    '## Contact',
    `- Website: ${cfg.url}`,
    `- WhatsApp: ${cfg.whatsappDisplay} (https://wa.me/${waDigits(cfg)})`,
    `- Email: ${cfg.email}`,
    ''
  ];
  return lines.join('\n');
}
