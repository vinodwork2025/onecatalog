#!/usr/bin/env node
/* Build every client catalog, or one named client.
 *
 *   node scripts/build.js                 build all clients
 *   node scripts/build.js shree-furniture build one client
 *   node scripts/build.js --local         ignore Google Sheets, use products.csv
 *   node scripts/build.js --no-images     skip image processing (fast HTML rebuild)
 *
 * Output: dist/<client-slug>/  — a complete static website per client.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseCsvObjects } from './csv.js';
import { buildCss } from '../template/themes.js';
import {
  renderIndex, renderCategory, renderProduct, renderAbout, slugify
} from '../template/render.js';
import { renderHome, renderLlmsTxt, checkHome } from '../site/render.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENTS = path.join(ROOT, 'clients');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache');
const SITE = path.join(ROOT, 'site');

const args = process.argv.slice(2);
const FLAGS = new Set(args.filter(a => a.startsWith('--')));
const ONLY = args.filter(a => !a.startsWith('--'));
const LOCAL_ONLY = FLAGS.has('--local');
const SKIP_IMAGES = FLAGS.has('--no-images');

const GRID_W = 400;
const FULL_W = 800;
const QUALITY = 80;

const log = (...m) => console.log(...m);
const warn = (...m) => console.log('   !', ...m);

// ---------------------------------------------------------------- products

function normaliseProducts(rows, cfg, clientDir) {
  const seenSlug = new Set();
  const seenId = new Set();
  const problems = [];
  const products = [];

  rows.forEach((r, idx) => {
    const line = idx + 2; // +1 header, +1 to 1-index
    const name = r.name || r.product || r.product_name || '';
    if (!name) return; // blank row, skip silently

    const hidden = ['no', 'false', '0', 'hide', 'hidden'].includes((r.show ?? 'yes').toLowerCase());
    if (hidden) return;

    const id = r.id || slugify(name);
    if (seenId.has(id)) problems.push(`row ${line}: duplicate id "${id}"`);
    seenId.add(id);

    // Slug is frozen in the sheet so URLs never change when a name is edited.
    const slug = slugify(r.slug || name);
    if (!slug) { problems.push(`row ${line}: cannot build a URL from "${name}"`); return; }
    if (seenSlug.has(slug)) problems.push(`row ${line}: duplicate URL "/${slug}" — set a unique slug`);
    seenSlug.add(slug);

    const images = String(r.image_url || r.image || r.images || '')
      .split(/[|;,]/).map(s => s.trim()).filter(Boolean);

    if (!images.length) problems.push(`row ${line}: "${name}" has no image`);
    images.forEach(f => {
      if (!fs.existsSync(path.join(clientDir, 'images', f))) {
        problems.push(`row ${line}: image not found — clients/${path.basename(clientDir)}/images/${f}`);
      }
    });

    const category = r.category || '';
    products.push({
      id,
      slug,
      name,
      description: r.description || '',
      price: r.price || '',
      category,
      categorySlug: category ? slugify(category) : '',
      images,
      sku: r.sku || '',
      inStock: !['no', 'false', '0', 'out'].includes((r.in_stock ?? 'yes').toLowerCase()),
      sortOrder: Number(r.sort_order || 9999),
      specs: {
        ...(r.size ? { Size: r.size } : {}),
        ...(r.material ? { Material: r.material } : {}),
        ...(r.colour || r.color ? { Colour: r.colour || r.color } : {}),
        ...(r.brand ? { Brand: r.brand } : {}),
        ...(r.moq ? { 'Minimum order': r.moq } : {}),
        ...(r.warranty ? { Warranty: r.warranty } : {})
      }
    });
  });

  // Catch "Almirah" vs "almirah" before it splits a category in two.
  const byLower = new Map();
  products.forEach(p => {
    if (!p.category) return;
    const k = p.category.toLowerCase().trim();
    if (!byLower.has(k)) byLower.set(k, new Set());
    byLower.get(k).add(p.category);
  });
  byLower.forEach((set, k) => {
    if (set.size > 1) problems.push(`category "${k}" is spelled ${set.size} ways: ${[...set].join(' / ')}`);
  });

  products.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return { products, problems };
}

function buildCategories(products) {
  const map = new Map();
  products.forEach(p => {
    if (!p.category) return;
    if (!map.has(p.categorySlug)) map.set(p.categorySlug, { name: p.category, slug: p.categorySlug, count: 0 });
    map.get(p.categorySlug).count++;
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- data source

async function fetchSheet(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error('got HTML, not CSV — re-check the published link');
  return text;
}

async function loadRows(cfg, clientDir, slug) {
  const localPath = path.join(clientDir, 'products.csv');
  const cachePath = path.join(CACHE, `${slug}.csv`);

  if (cfg.sheetCsvUrl && !LOCAL_ONLY) {
    try {
      const text = await fetchSheet(cfg.sheetCsvUrl);
      await fsp.mkdir(CACHE, { recursive: true });
      await fsp.writeFile(cachePath, text);
      log('   sheet fetched');
      return parseCsvObjects(text);
    } catch (e) {
      warn(`sheet fetch failed (${e.message})`);
      if (fs.existsSync(cachePath)) { warn('using last good cached sheet'); return parseCsvObjects(await fsp.readFile(cachePath, 'utf8')); }
      if (fs.existsSync(localPath)) { warn('using local products.csv'); return parseCsvObjects(await fsp.readFile(localPath, 'utf8')); }
      throw new Error('no sheet, no cache, no local CSV');
    }
  }

  if (fs.existsSync(localPath)) return parseCsvObjects(await fsp.readFile(localPath, 'utf8'));
  if (fs.existsSync(cachePath)) return parseCsvObjects(await fsp.readFile(cachePath, 'utf8'));
  throw new Error('no products.csv and no sheetCsvUrl in config.json');
}

// ---------------------------------------------------------------- images

async function processImages(clientDir, outDir, wanted, cfg) {
  const srcDir = path.join(clientDir, 'images');
  const dstDir = path.join(outDir, 'img');
  await fsp.mkdir(dstDir, { recursive: true });

  let made = 0, skipped = 0;
  for (const file of wanted) {
    const src = path.join(srcDir, file);
    if (!fs.existsSync(src)) continue;
    const out = path.join(dstDir, file);

    // Reuse an output that is newer than its source. Keeps a 150-client
    // rebuild at seconds rather than minutes.
    if (fs.existsSync(out)) {
      const [a, b] = [fs.statSync(src).mtimeMs, fs.statSync(out).mtimeMs];
      if (b >= a) { skipped++; continue; }
    }

    const isLogo = file === cfg.logo;
    const img = sharp(src).rotate();
    if (isLogo) {
      await img.resize(176, 176, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 }).toFile(out);
    } else {
      await img.resize(FULL_W, FULL_W, { fit: 'cover', position: 'centre', withoutEnlargement: true })
        .webp({ quality: QUALITY }).toFile(out);
    }
    made++;
  }
  return { made, skipped, pruned: 0 };
}

// ---------------------------------------------------------------- output

async function writePage(outDir, relPath, html) {
  const full = path.join(outDir, relPath);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, html);
}

function sitemap(cfg, products, categories) {
  const now = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: cfg.siteUrl + '/', pri: '1.0' },
    ...categories.map(c => ({ loc: `${cfg.siteUrl}/category/${c.slug}`, pri: '0.8' })),
    ...products.map(p => ({ loc: `${cfg.siteUrl}/${p.slug}`, pri: '0.7' })),
    { loc: `${cfg.siteUrl}/about`, pri: '0.4' }
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${u.loc}</loc><lastmod>${now}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>`;
}

// ---------------------------------------------------------------- one client

async function buildClient(slug, rawCss) {
  const clientDir = path.join(CLIENTS, slug);
  const cfgPath = path.join(clientDir, 'config.json');
  if (!fs.existsSync(cfgPath)) throw new Error(`missing clients/${slug}/config.json`);

  const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
  cfg.slug = slug;

  // Site URL: custom domain when set, otherwise the subdomain. Canonical
  // always points at the one we publish as primary.
  const sub = cfg.subdomain || slug;
  cfg.subdomainUrl = `https://${sub}.${cfg.platformDomain || 'onecatalog.in'}`;
  cfg.siteUrl = (cfg.customDomain ? `https://${cfg.customDomain}` : cfg.subdomainUrl).replace(/\/$/, '');

  // Hard validation of the config itself.
  const cfgProblems = [];
  if (!cfg.name) cfgProblems.push('config: name is missing');
  const wa = String(cfg.whatsapp || '').replace(/\D/g, '');
  if (!/^\d{12}$/.test(wa)) cfgProblems.push(`config: whatsapp must be country code + 10 digits, e.g. 919876543210 (got "${cfg.whatsapp}")`);
  cfg.whatsapp = wa;
  if (cfg.logo && !fs.existsSync(path.join(clientDir, 'images', cfg.logo))) cfgProblems.push(`config: logo not found — images/${cfg.logo}`);

  const rows = await loadRows(cfg, clientDir, slug);
  const { products, problems } = normaliseProducts(rows, cfg, clientDir);
  const all = [...cfgProblems, ...problems];

  if (all.length) {
    log(`\n   BUILD STOPPED for ${slug}:`);
    all.forEach(p => log('     - ' + p));
    return { slug, ok: false, problems: all };
  }
  if (!products.length) {
    log(`\n   BUILD STOPPED for ${slug}: no products found`);
    return { slug, ok: false, problems: ['no products'] };
  }

  const categories = buildCategories(products);
  const css = buildCss(rawCss, cfg);
  const outDir = path.join(DIST, slug);

  // Clear the old pages but keep dist/<slug>/img — those files are expensive to
  // rebuild and are reused by mtime. Orphans are pruned after the copy below.
  await fsp.mkdir(outDir, { recursive: true });
  for (const entry of await fsp.readdir(outDir)) {
    if (entry === 'img') continue;
    await fsp.rm(path.join(outDir, entry), { recursive: true, force: true });
  }

  const wantedImages = new Set(products.flatMap(p => p.images));
  [cfg.logo, cfg.shopPhoto].filter(Boolean).forEach(f => wantedImages.add(f));

  let imgStats = { made: 0, skipped: 0, pruned: 0 };
  if (SKIP_IMAGES) {
    const missing = [...wantedImages].filter(f => !fs.existsSync(path.join(outDir, 'img', f)));
    if (missing.length) warn(`--no-images: ${missing.length} image(s) not in dist yet, run a full build`);
  } else {
    imgStats = await processImages(clientDir, outDir, wantedImages, cfg);
    const imgDir = path.join(outDir, 'img');
    if (fs.existsSync(imgDir)) {
      for (const f of await fsp.readdir(imgDir)) {
        if (!wantedImages.has(f)) { await fsp.rm(path.join(imgDir, f), { force: true }); imgStats.pruned++; }
      }
    }
  }

  await writePage(outDir, 'index.html', renderIndex(cfg, products, categories, css));
  await writePage(outDir, 'about/index.html', renderAbout(cfg, products, categories, css));

  for (const c of categories) {
    const inCat = products.filter(p => p.categorySlug === c.slug);
    await writePage(outDir, `category/${c.slug}/index.html`, renderCategory(cfg, c, inCat, categories, css));
  }

  for (const p of products) {
    const related = products
      .filter(r => r.slug !== p.slug && (p.categorySlug ? r.categorySlug === p.categorySlug : true))
      .slice(0, 4);
    await writePage(outDir, `${p.slug}/index.html`, renderProduct(cfg, p, related, categories, css));
  }

  await fsp.writeFile(path.join(outDir, 'sitemap.xml'), sitemap(cfg, products, categories));
  await fsp.writeFile(path.join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);

  const bytes = fs.statSync(path.join(outDir, 'index.html')).size;
  log(`   ${products.length} products, ${categories.length} categories, index ${(bytes / 1024).toFixed(0)}KB, images +${imgStats.made} (${imgStats.skipped} reused${imgStats.pruned ? ', ' + imgStats.pruned + ' pruned' : ''})`);
  log(`   live at ${cfg.siteUrl}`);

  return {
    slug, ok: true, products: products.length, url: cfg.siteUrl,
    host: `${sub}.${cfg.platformDomain || 'onecatalog.in'}`,
    customDomain: cfg.customDomain || ''
  };
}

// ---------------------------------------------------------------- home page

/* onecatalog.in itself. Copy lives in site/config.json, layout in
 * site/render.js. Output goes to dist/_home, which the router serves on the
 * bare platform domain. Built on full runs, or with: build.js _home */
async function buildHome() {
  const cfg = JSON.parse(await fsp.readFile(path.join(SITE, 'config.json'), 'utf8'));
  const outDir = path.join(DIST, '_home');
  await fsp.rm(outDir, { recursive: true, force: true });
  await fsp.mkdir(outDir, { recursive: true });

  const url = cfg.url.replace(/\/$/, '');
  await fsp.writeFile(path.join(outDir, 'index.html'), renderHome(cfg));
  await fsp.writeFile(path.join(outDir, 'llms.txt'), renderLlmsTxt(cfg));
  await fsp.writeFile(path.join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`);
  await fsp.writeFile(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${url}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><priority>1.0</priority></url>
</urlset>`);

  const bytes = fs.statSync(path.join(outDir, 'index.html')).size;
  log(`   index ${(bytes / 1024).toFixed(1)}KB, llms.txt, robots.txt, sitemap.xml`);
  if (bytes > 40 * 1024) warn('home page is over 40KB');
  const todo = checkHome(cfg);
  if (todo.length) {
    warn(`${todo.length} thing(s) to fill in site/config.json before launch (page is noindex until then):`);
    todo.forEach(t => log('     - ' + t));
  }
  log(`   live at ${url}/`);
}

// ---------------------------------------------------------------- main

async function main() {
  const rawCss = await fsp.readFile(path.join(ROOT, 'template', 'styles.css'), 'utf8');

  const wantHome = !ONLY.length || ONLY.includes('_home');
  let slugs = ONLY.length
    ? ONLY.filter(s => s !== '_home')
    : (await fsp.readdir(CLIENTS, { withFileTypes: true }))
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map(d => d.name);

  const t0 = Date.now();
  let homeFailed = false;
  if (wantHome && fs.existsSync(path.join(SITE, 'config.json'))) {
    log('\n>> home page (onecatalog.in)');
    try { await buildHome(); } catch (e) { log(`   FAILED: ${e.message}`); homeFailed = true; process.exitCode = 1; }
  }

  if (!slugs.length) {
    if (!wantHome) log('No clients found in clients/');
    await writeRouter();
    return;
  }

  const results = [];
  for (const slug of slugs) {
    log(`\n>> ${slug}`);
    try {
      results.push(await buildClient(slug, rawCss));
    } catch (e) {
      log(`   FAILED: ${e.message}`);
      results.push({ slug, ok: false, problems: [e.message] });
    }
  }

  const ok = results.filter(r => r.ok);
  const bad = results.filter(r => !r.ok);

  // The router is rebuilt from every client folder, not just the ones in this
  // run, so building a single client never knocks the others offline.
  await writeRouter();

  log(`\n${'-'.repeat(52)}`);
  if (homeFailed) log('Home page FAILED');
  log(`Built ${ok.length}/${results.length} catalogs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (bad.length) {
    log(`Failed: ${bad.map(b => b.slug).join(', ')}`);
    process.exitCode = 1;
  }
}

/* One Cloudflare Worker serves every client. The router below is generated
 * into worker/index.js (gitignored, wrangler.jsonc points at it): it reads
 * the Host header, finds the client folder in dist/, and serves from it. The
 * bare platform domain gets the landing page from dist/_home. A client on a
 * custom domain gets a 301 from their subdomain so Google indexes one URL. */
async function writeRouter() {
  const dirs = (await fsp.readdir(CLIENTS, { withFileTypes: true }))
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map(d => d.name);

  const map = {};
  let platform = 'onecatalog.in';
  for (const slug of dirs) {
    const p = path.join(CLIENTS, slug, 'config.json');
    if (!fs.existsSync(p)) continue;
    const cfg = JSON.parse(await fsp.readFile(p, 'utf8'));
    const sub = cfg.subdomain || slug;
    platform = cfg.platformDomain || platform;
    map[`${sub}.${platform}`] = { slug, canonical: cfg.customDomain || '' };
    if (cfg.customDomain) map[cfg.customDomain.toLowerCase()] = { slug, canonical: '' };
  }

  // The bare platform domain serves the OneCatalog landing page.
  if (fs.existsSync(path.join(DIST, '_home', 'index.html'))) map[platform] = { slug: '_home', canonical: '' };

  await fsp.mkdir(DIST, { recursive: true });
  await fsp.writeFile(path.join(DIST, '_headers'),
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/*/img/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

  // Earlier builds wrote the router into dist/, where it would now be
  // uploaded as a public asset. Remove it.
  await fsp.rm(path.join(DIST, '_worker.js'), { force: true });

  await fsp.mkdir(path.join(ROOT, 'worker'), { recursive: true });
  await fsp.writeFile(path.join(ROOT, 'worker', 'index.js'), `// Generated by scripts/build.js — do not edit by hand.
const MAP = ${JSON.stringify(map, null, 2)};
const PLATFORM = ${JSON.stringify(platform)};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase().replace(/^www\\./, '');
    const entry = MAP[host];

    // Serve url.pathname from dist/<prefix>/, trying clean-URL variants.
    // Only a real hit counts: the asset server answers /x/index.html with a
    // redirect to /x/, and passing that on would leak the internal path.
    const asset = async (prefix) => {
      const p = url.pathname === '/' ? '/' : url.pathname;
      const tries = p.endsWith('/')
        ? [prefix + p + 'index.html', prefix + p]
        : [prefix + p, prefix + p + '/index.html', prefix + p + '/'];
      for (const candidate of tries) {
        const u = new URL(url);
        u.pathname = candidate;
        const res = await env.ASSETS.fetch(new Request(u, request));
        if (res.ok || res.status === 304) return res;
      }
      return null;
    };

    // Bare platform domain: the OneCatalog landing page.
    if (host === PLATFORM) {
      return (await asset('/_home')) || new Response('Not found', { status: 404 });
    }

    // Unknown hostname. Usually the workers.dev preview URL, or DNS that has
    // not propagated yet. Show what IS wired up rather than a bare 404, so the
    // wildcard setup can be checked at a glance.
    if (!entry) {
      const rows = Object.keys(MAP).sort()
        .map(h => '<li><a href="https://' + h + '/">' + h + '</a></li>').join('');
      return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>Catalogs</title><meta name="robots" content="noindex">'
        + '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#222}'
        + 'h1{font-size:20px}code{background:#f2f2f2;padding:2px 5px;border-radius:4px}'
        + 'li{margin:6px 0}a{color:#06c}</style>'
        + '<h1>No catalog on ' + host.replace(/[<>&]/g, '') + '</h1>'
        + '<p>This hostname is not mapped. ' + Object.keys(MAP).length + ' catalog(s) are live:</p>'
        + '<ul>' + rows + '</ul>'
        + '<p>If a link above does not load, the wildcard <code>CNAME *</code> record or the '
        + '<code>*.' + PLATFORM + '</code> custom domain is missing in Cloudflare.</p>',
        { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    // Subdomain -> custom domain, once the client has bought one.
    if (entry.canonical && host !== entry.canonical.toLowerCase()) {
      return Response.redirect('https://' + entry.canonical + url.pathname + url.search, 301);
    }

    return (await asset('/' + entry.slug)) || new Response('Not found', { status: 404 });
  }
};
`);
  log(`\nRouter: ${Object.keys(map).length} hostnames -> ${dirs.length} clients (platform ${platform})`);
}

main();
