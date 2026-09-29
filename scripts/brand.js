/* Makes the OneCatalog logo files for the website from the master logo.
     node scripts/brand.js path/to/onecatalog-logo.png
   Writes site/brand/ (header, footer and icon sizes) and site/og/logo.png.
   Run it again only if the master logo changes, then commit site/brand/. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.log('Usage: node scripts/brand.js <master-logo.png>'); process.exit(1); }
const OUT = path.join(ROOT, 'site', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

// The master has a soft pale glow baked in under the icon. On the ivory site
// background it shows as a light box, so drop semi-transparent light pixels in
// the lower part. Opaque pixels (the icon's white panel) are untouched.
for (let y = Math.round(H * 0.55); y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4, [r, g, b, al] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
  if (al < 235 && (r + g + b) / 3 > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 40) data[i + 3] = 0;
}
const cleanSrc = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

// Measured on the master (1995x521): the icon ends at x~505, the wordmark ends at
// y~378 and the tagline sits below it from x~540. Scale if the master is resized.
const sx = W / 1995, sy = H / 521;
const ICON_W = Math.round(508 * sx), TAG_X0 = Math.round(540 * sx), TAG_X1 = Math.round(1850 * sx), TAG_Y = Math.round(400 * sy);

// Header version: icon + wordmark, tagline made transparent (unreadable at 40px).
const noTag = Buffer.from(data);
for (let y = TAG_Y; y < H; y++) for (let x = TAG_X0; x < TAG_X1; x++) noTag[(y * W + x) * 4 + 3] = 0;
const raw = { raw: { width: W, height: H, channels: 4 } };
const header = await sharp(noTag, raw).trim().png().toBuffer();

await sharp(header).resize({ height: 88 }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, 'logo.webp'));
await sharp(header).resize({ height: 88 }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'logo.png'));
// Footer version keeps the tagline.
await sharp(cleanSrc).trim().resize({ height: 120 }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, 'logo-tagline.webp'));

// Icon on its own, centred on a square canvas.
// Two steps: sharp would otherwise trim before extracting.
const iconArea = await sharp(cleanSrc).extract({ left: 0, top: 0, width: ICON_W, height: H }).png().toBuffer();
const icon = await sharp(iconArea).trim().png().toBuffer();
const square = async (size, bg) => {
  const pad = Math.round(size * 0.08);
  const inner = await sharp(icon).resize({ width: size - pad * 2, height: size - pad * 2, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg || { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'center' }]).png({ compressionLevel: 9, palette: true, quality: 90 });
};
await (await square(512)).toFile(path.join(OUT, 'icon-512.png'));
await (await square(180, { r: 255, g: 255, b: 255, alpha: 1 })).toFile(path.join(OUT, 'apple-touch-icon.png'));
await (await square(48)).toFile(path.join(OUT, 'favicon-48.png'));
await (await square(32)).toFile(path.join(OUT, 'favicon-32.png'));
fs.mkdirSync(path.join(ROOT, 'site', 'og'), { recursive: true });
fs.copyFileSync(path.join(OUT, 'icon-512.png'), path.join(ROOT, 'site', 'og', 'logo.png'));

for (const f of fs.readdirSync(OUT)) {
  const m = await sharp(path.join(OUT, f)).metadata();
  console.log(`${f.padEnd(22)} ${m.width}x${m.height}  ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1)}KB`);
}
