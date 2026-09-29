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

function card(h1, label) {
  let size = 72, lines = wrap(h1, 26);
  if (lines.length > 3) { size = 58; lines = wrap(h1, 33); }
  const y0 = 300 - ((lines.length - 1) * size * 1.15) / 2;
  const text = lines.map((l, i) => `<text x="80" y="${y0 + i * size * 1.15}" font-size="${size}" font-weight="800" fill="#fff">${x(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<rect width="1200" height="630" fill="${cfg.accent}"/>
<rect x="0" y="560" width="1200" height="70" fill="#000" opacity=".18"/>
<g font-family="Segoe UI, Arial, Helvetica, sans-serif">
<text x="80" y="110" font-size="44" font-weight="800" fill="#fff">One<tspan fill="#9CC3E6">Catalog</tspan></text>
${label ? `<text x="80" y="160" font-size="28" fill="#DCE8F3">${x(label)}</text>` : ''}
${text}
<text x="80" y="606" font-size="30" fill="#fff">onecatalog.in</text>
<text x="1120" y="606" font-size="30" fill="#fff" text-anchor="end">Catalogues for WhatsApp</text>
</g></svg>`;
}

const name = p => p.path === '/' ? 'home' : p.path.slice(1).replace(/\//g, '-');

await fsp.mkdir(OUT, { recursive: true });
const all = await pages();
for (const p of all) {
  const label = p.type === 'guide' ? 'Guide' : p.type === 'industry' ? 'Industry' : '';
  await sharp(Buffer.from(card(p.h1, label))).png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, name(p) + '.png'));
}
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="${cfg.accent}"/><text x="256" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="230" font-weight="800" fill="#fff" text-anchor="middle">1C</text></svg>`))
  .png().toFile(path.join(OUT, 'logo.png'));

// Remove images of pages that no longer exist.
const keep = new Set([...all.map(p => name(p) + '.png'), 'logo.png']);
for (const f of await fsp.readdir(OUT)) if (!keep.has(f)) await fsp.rm(path.join(OUT, f));
console.log(`OG images: ${all.length} pages + logo in site/og/`);
