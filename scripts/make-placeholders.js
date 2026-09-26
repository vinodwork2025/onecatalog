#!/usr/bin/env node
/* Dev helper only. Makes labelled placeholder photos so you can test a build
 * before the client sends real images. Delete these before going live. */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const names = process.argv.slice(3);

if (!slug || !names.length) {
  console.log('Usage: node scripts/make-placeholders.js <slug> <name> <name> ...');
  process.exit(1);
}

const dir = path.join(ROOT, 'raw', slug);
await fsp.mkdir(dir, { recursive: true });

const palette = ['#8C6239', '#4A5B6A', '#6B7A4F', '#8A4B3C', '#4F5B75', '#7A6248'];

for (let i = 0; i < names.length; i++) {
  const n = names[i];
  const bg = palette[i % palette.length];
  const label = n.replace(/-/g, ' ').toUpperCase();
  const lines = label.match(/.{1,16}(\s|$)/g) || [label];
  const svg = `<svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
<rect width="1200" height="1200" fill="${bg}"/>
<rect x="60" y="60" width="1080" height="1080" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="6"/>
${lines.map((t, j) => `<text x="600" y="${560 + j * 84}" font-family="Helvetica,Arial,sans-serif" font-size="66" font-weight="bold" fill="#fff" text-anchor="middle">${t.trim()}</text>`).join('')}
<text x="600" y="1080" font-family="Helvetica,Arial,sans-serif" font-size="38" fill="rgba(255,255,255,.7)" text-anchor="middle">PLACEHOLDER</text>
</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(path.join(dir, `${n}.jpg`));
}

console.log(`${names.length} placeholders written to raw/${slug}/`);
