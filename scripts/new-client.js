#!/usr/bin/env node
/* Create a new client folder with a config skeleton and a starter CSV.
 *
 *   node scripts/new-client.js shree-furniture "Shree Furniture" 919876543210
 *
 * Then: drop photos in raw/<slug>/, run scripts/photos.js, fill the Sheet, build.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [slug, name, whatsapp] = process.argv.slice(2);

if (!slug || !name) {
  console.log('Usage: node scripts/new-client.js <slug> "<Business Name>" [whatsapp]');
  console.log('Example: node scripts/new-client.js shree-furniture "Shree Furniture" 919876543210');
  process.exit(1);
}

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.log('Slug must be lowercase letters, numbers and single hyphens. It becomes the subdomain and never changes.');
  process.exit(1);
}

const dir = path.join(ROOT, 'clients', slug);
if (fs.existsSync(dir)) { console.log(`clients/${slug} already exists.`); process.exit(1); }

const config = {
  name,
  tagline: '',
  whatsapp: whatsapp || '9100000000000',
  phone: '',
  phoneDisplay: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  country: 'IN',
  mapsUrl: '',
  reviewUrl: '',
  announcement: '',
  announcementUrl: '',
  hours: '',
  since: '',
  areasServed: '',
  about: '',
  logo: '',
  shopPhoto: '',
  theme: 'warm',
  layout: 'grid',
  accent: '#C0392B',
  subdomain: slug,
  platformDomain: 'onecatalog.in',
  customDomain: '',
  sheetCsvUrl: '',
  currency: 'INR',
  currencySymbol: '₹',
  metaHeadline: '',
  metaDescription: '',
  waGreeting: '',
  plan: 'annual',
  startedOn: new Date().toISOString().slice(0, 10)
};

const starterCsv = `id,category,name,slug,description,price,image_url,in_stock,sort_order,size,material,colour,sku,show
1,Example,Example Product,example-product,"Two short lines about the product.",4500,example.webp,yes,10,,,,,yes
`;

await fsp.mkdir(path.join(dir, 'images'), { recursive: true });
await fsp.mkdir(path.join(ROOT, 'raw', slug), { recursive: true });
await fsp.writeFile(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n');
await fsp.writeFile(path.join(dir, 'products.csv'), starterCsv);

console.log(`
Created clients/${slug}/
  config.json      fill in name, whatsapp, address, theme, accent
  products.csv     fallback data if no Sheet
  images/          cleaned WebP files land here
Created raw/${slug}/   put the client's original photos here

Next:
  1. Put the client's photos in raw/${slug}/
  2. node scripts/photos.js ${slug}
  3. Duplicate a tab in the master Sheet, name it "${slug}", paste the rows
  4. Put the published CSV link into config.json as sheetCsvUrl
  5. node scripts/build.js ${slug}
  6. git add -A && git commit -m "add ${slug}" && git push
`);
