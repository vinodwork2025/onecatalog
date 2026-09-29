/* Makes one 1200x630 Open Graph image per page of the onecatalog.in site,
   plus og/logo.png for the Organization schema.

   Run it on your PC after adding a page or changing an H1:
     node scripts/og.js
   Then commit site/og/. It is not run by the Cloudflare build on purpose:
   the build machine may have no fonts, which would give blank images. */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(SITE, 'og');

const cfg = JSON.parse(fs.readFileSync(path.join(SITE, 'config.json'), 'utf8'));
const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function pages(dir = path.join(SITE, 'pages')) {
  const out = [];
  for (const d of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...await pages(p));
    else if (d.name.endsWith('.json')) out.push(JSON.parse(await fsp.readFile(p, 'utf8')));
  }
  return out;
}

// Greedy word wrap by character budget. Good enough for a bold sans font.
function wrap(text, max) {
  const lines = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > max) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

// Same look as the site: ivory background, ink headline, green accent, real logo top-left.
function card(h1, label) {
  let size = 68, lines = wrap(h1, 28);
  if (lines.length > 3) { size = 56; lines = wrap(h1, 34); }
  const y0 = 330 - ((lines.length - 1) * size * 1.12) / 2;
  const text = lines.map((l, i) => `<text x="80" y="${y0 + i * size * 1.12}" font-size="${size}" font-weight="800" fill="#132235" letter-spacing="-1.5">${x(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs><radialGradient id="g" cx="0.9" cy="0.1" r="0.7"><stop offset="0" stop-color="#15803D" stop-opacity=".16"/><stop offset="1" stop-color="#15803D" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="630" fill="#FBF8F3"/>
<rect width="1200" height="630" fill="url(#g)"/>
<rect x="0" y="600" width="1200" height="30" fill="#15803D"/>
<g font-family="Segoe UI, Arial, Helvetica, sans-serif">
${label ? `<rect x="80" y="${y0 - size - 44}" rx="18" width="${label.length * 15 + 40}" height="36" fill="#E3F2E7"/><text x="100" y="${y0 - size - 19}" font-size="22" font-weight="700" fill="#0F6B32">${x(label)}</text>` : ''}
${text}
<text x="80" y="568" font-size="28" fill="#5C5850">onecatalog.in</text>
<text x="1120" y="568" font-size="28" fill="#5C5850" text-anchor="end">Catalogues for WhatsApp</text>
</g></svg>`;
}

const LOGO = path.join(SITE, 'brand', 'logo.png');
const logo = fs.existsSync(LOGO) ? await sharp(LOGO).resize({ height: 64 }).toBuffer() : null;

const name = p => p.path === '/' ? 'home' : p.path.slice(1).replace(/\//g, '-');

await fsp.mkdir(OUT, { recursive: true });
const all = await pages();
for (const p of all) {
  const label = p.type === 'guide' ? 'Guide' : p.type === 'industry' ? 'Industry' : '';
  const img = sharp(Buffer.from(card(p.h1, label)));
  if (logo) img.composite([{ input: logo, left: 80, top: 56 }]);
  await img.png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, name(p) + '.png'));
}
// og/logo.png (schema logo) is the icon made by scripts/brand.js.
if (fs.existsSync(path.join(SITE, 'brand', 'icon-512.png'))) fs.copyFileSync(path.join(SITE, 'brand', 'icon-512.png'), path.join(OUT, 'logo.png'));

// Remove images of pages that no longer exist.
const keep = new Set([...all.map(p => name(p) + '.png'), 'logo.png']);
for (const f of await fsp.readdir(OUT)) if (!keep.has(f)) await fsp.rm(path.join(OUT, f));
console.log(`OG images: ${all.length} pages + logo in site/og/`);
