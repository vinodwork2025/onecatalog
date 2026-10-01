#!/usr/bin/env node
/* Clean a client's raw WhatsApp photos into catalog-ready images.
 *
 *   node scripts/photos.js shree-furniture
 *   node scripts/photos.js shree-furniture --from ~/catalog-raw/shree-furniture
 *   node scripts/photos.js shree-furniture --pad          white padding, no crop
 *   node scripts/photos.js shree-furniture --no-levels    skip auto brightness
 *
 * Reads raw photos, writes clean square WebP files into
 * clients/<slug>/images/ and prints a CSV block you can paste into the Sheet.
 *
 * Raw photos stay wherever they are. Nothing is deleted or overwritten in place.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const FLAGS = new Set(args.filter(a => a.startsWith('--')));
const POS = args.filter(a => !a.startsWith('--'));

const slug = POS[0];
if (!slug) {
  console.log('Usage: node scripts/photos.js <client-slug> [--from <raw folder>] [--pad] [--no-levels]');
  process.exit(1);
}

const fromIdx = args.indexOf('--from');
const RAW = fromIdx > -1 && args[fromIdx + 1]
  ? path.resolve(args[fromIdx + 1].replace(/^~/, process.env.HOME || '~'))
  : path.join(ROOT, 'raw', slug);

const OUT = path.join(ROOT, 'clients', slug, 'images');
const SIZE = 800;
const QUALITY = 80;
const PAD = FLAGS.has('--pad');
const LEVELS = !FLAGS.has('--no-levels');
const EXT = /\.(jpe?g|png|webp|heic|heif|tiff?|avif)$/i;

function cleanName(file) {
  // IMG_20260926_114233.jpg -> img-20260926-114233
  // "Steel Rack Model 4 (2).JPG" -> steel-rack-model-4-2
  return path.basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'photo';
}

/** Average colour of a photo's outer border (transparent areas count as white). */
async function edgeColour(file) {
  const N = 48;
  const { data } = await sharp(file).rotate().flatten({ background: '#ffffff' })
    .resize(N, N, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (x > 1 && x < N - 2 && y > 1 && y < N - 2) continue;
    const i = (y * N + x) * 3;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

async function main() {
  if (!fs.existsSync(RAW)) {
    console.log(`Raw folder not found: ${RAW}`);
    console.log(`Put the client's photos there, or pass --from <folder>.`);
    process.exit(1);
  }

  const files = (await fsp.readdir(RAW)).filter(f => EXT.test(f)).sort();
  if (!files.length) { console.log(`No photos in ${RAW}`); process.exit(1); }

  await fsp.mkdir(OUT, { recursive: true });
  console.log(`\n${files.length} photos  ${RAW}\n  ->  clients/${slug}/images/\n`);

  const used = new Set();
  const done = [];
  let failed = 0;

  for (const file of files) {
    let base = cleanName(file);
    let name = base, n = 2;
    while (used.has(name)) name = `${base}-${n++}`;
    used.add(name);

    const src = path.join(RAW, file);
    const dst = path.join(OUT, `${name}.webp`);

    try {
      let img = sharp(src).rotate(); // honour the phone's EXIF orientation
      const meta = await img.metadata();

      if (PAD) {
        // Pad with the photo's own edge colour, so a product shot on a grey or
        // cream backdrop does not get white bands above and below it.
        // A transparent cut-out has no backdrop: its edges are the product
        // itself, so it gets white.
        const bg = meta.hasAlpha ? { r: 255, g: 255, b: 255 } : await edgeColour(src);
        img = img.flatten({ background: bg }).resize(SIZE, SIZE, {
          fit: 'contain',
          background: { ...bg, alpha: 1 }
        });
      } else {
        img = img.resize(SIZE, SIZE, {
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: false
        });
      }

      // Shop-floor photos are usually dark and flat. normalise() stretches the
      // histogram, which fixes that without touching colour.
      // Clipping at the 2nd/98th percentile rather than the full range, so one
      // bright reflection or dark corner cannot wreck the whole photo.
      if (LEVELS) img = img.normalise({ lower: 2, upper: 98 });

      const info = await img.webp({ quality: QUALITY, effort: 4 }).toFile(dst);
      const kb = (info.size / 1024).toFixed(0);
      const low = meta.width && meta.width < 500 ? '  LOW-RES, check it' : '';
      console.log(`  ${file}  ->  ${name}.webp  ${kb}KB${low}`);
      done.push(name);
    } catch (e) {
      console.log(`  ${file}  FAILED: ${e.message}`);
      failed++;
    }
  }

  const csvPath = path.join(ROOT, 'raw', `${slug}-paste-into-sheet.csv`);
  await fsp.mkdir(path.dirname(csvPath), { recursive: true });
  const header = 'id,category,name,slug,description,price,image_url,in_stock,sort_order,size,material,colour,sku,show';
  const body = done.map((n, i) =>
    `${i + 1},,,${n},,,${n}.webp,yes,${(i + 1) * 10},,,,,yes`
  ).join('\n');
  await fsp.writeFile(csvPath, header + '\n' + body + '\n');

  console.log(`\n${done.length} cleaned, ${failed} failed.`);
  console.log(`Paste-ready rows: raw/${slug}-paste-into-sheet.csv`);
  console.log(`Next: fill in category, name and price in the Sheet, then run:`);
  console.log(`  node scripts/build.js ${slug}\n`);
}

main();
