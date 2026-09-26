#!/usr/bin/env node
/* Preview a built catalog on your laptop before you send the link.
 *
 *   node scripts/serve.js shree-furniture
 *   then open http://localhost:4000
 *
 * Serves dist/<slug>/ with clean URLs, exactly like Cloudflare Pages does.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const PORT = Number(process.argv[3] || 4000);

if (!slug) { console.log('Usage: node scripts/serve.js <client-slug> [port]'); process.exit(1); }

const BASE = path.join(ROOT, 'dist', slug);
if (!fs.existsSync(BASE)) { console.log(`Nothing built yet. Run: node scripts/build.js ${slug}`); process.exit(1); }

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css', '.js': 'text/javascript'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(BASE, p);

  if (!file.startsWith(BASE)) { res.writeHead(403).end('Forbidden'); return; }

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(file + '/index.html')) file = file + '/index.html';
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file = file + '.html';

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>');
    return;
  }

  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`\n${slug} preview:  http://localhost:${PORT}\n`);
});
