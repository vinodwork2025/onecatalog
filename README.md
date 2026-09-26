# Catalog System

One template. Many clients. Static sites that load fast and rank on Google.

Data lives in a Google Sheet. Photos live in client folders. One command builds
every catalog. Push to GitHub and it deploys itself.

---

## First-time setup (once)

```bash
npm install
```

Then three accounts:

**1. Google Sheet**
Make one Sheet called `Catalog Master`. One tab per client. The tab name must
match the client folder name exactly. Copy the columns from
`clients/_SHEET-TEMPLATE.csv`.

For each tab: File → Share → Publish to web → pick that tab → CSV → Publish.
Copy the link. It goes into that client's `config.json` as `sheetCsvUrl`.

**2. Cloudflare**
- Buy or move `onecatalog.in` into Cloudflare.
- Pages → Create project → Connect to GitHub → pick this repo.
- Build command: `npm ci && node scripts/build.js`  Output directory: `dist`
- Add a DNS record: `CNAME  *  <your-project>.pages.dev`  (proxied, orange cloud)
- Pages → Custom domains → add `*.onecatalog.in`

The wildcard is the important bit. Once it's set, every new client subdomain
works with no DNS change. You add a folder, nothing else.

**3. GitHub**
Settings → Secrets and variables → Actions:
- Secret `CLOUDFLARE_API_TOKEN` (Cloudflare → My Profile → API Tokens → Edit Cloudflare Workers)
- Secret `CLOUDFLARE_ACCOUNT_ID`
- Variable `CF_PAGES_PROJECT` (your Pages project name)

---

## Adding a client (under an hour)

```bash
node scripts/new-client.js shree-furniture "Shree Furniture" 919876543210
```

The slug (`shree-furniture`) becomes the folder name, the Sheet tab name and the
subdomain. **Fix it at signup and never change it.** Links already shared on
WhatsApp live forever in chat history.

Then:

1. Put the client's original photos in `raw/shree-furniture/`
2. Clean them:
   ```bash
   node scripts/photos.js shree-furniture
   ```
   This writes square WebP files into `clients/shree-furniture/images/` and
   prints a paste-ready CSV block.
3. Duplicate a tab in the master Sheet, rename it `shree-furniture`, paste the
   rows, fill in category, name, price.
4. Publish that tab to web as CSV, put the link in `config.json` as `sheetCsvUrl`.
5. Fill in the rest of `config.json`: address, hours, theme, accent colour.
6. Build and look at it:
   ```bash
   node scripts/build.js shree-furniture
   node scripts/serve.js shree-furniture     # open http://localhost:4000
   ```
7. Ship it:
   ```bash
   git add -A && git commit -m "add shree-furniture" && git push
   ```

Live at `https://shreefurniture.onecatalog.in` in about two minutes.

---

## Daily commands

```bash
node scripts/build.js                      # every client
node scripts/build.js shree-furniture      # one client
node scripts/build.js --no-images          # HTML only, seconds
node scripts/build.js --local              # ignore Sheets, use products.csv
node scripts/serve.js shree-furniture      # preview before sending the link
```

**Update flow when a client sends new photos:**

1. Drop photos in `raw/<slug>/`
2. `node scripts/photos.js <slug>`
3. Add the rows to their Sheet tab
4. `git add -A && git commit -m "update <slug>" && git push`

Four minutes. That's what a ₹299 update batch actually costs you.

**Sheet-only change** (a price edit, nothing new to commit): the scheduled
build picks it up within 6 hours. To push it live now, go to the repo's
Actions tab → "Build and deploy catalogs" → Run workflow. Works from your phone.

---

## The Sheet columns

| Column | Required | Notes |
|---|---|---|
| `id` | yes | Any unique number. Duplicates stop the build. |
| `category` | no | Groups products and creates `/category/<name>` pages. Spell it identically every time — the build stops if you don't. |
| `name` | yes | Shown as the product title and the H1. |
| `slug` | **set once, never change** | The URL. If you rename a product, leave the slug alone or Google loses the page. |
| `description` | no | Two or three lines. Feeds the meta description. |
| `price` | no | Numbers only. Blank shows "Price on request". |
| `image_url` | yes | The filename in `clients/<slug>/images/`. Several photos: separate with `\|`. |
| `in_stock` | no | `no` shows an out-of-stock badge. Defaults to yes. |
| `sort_order` | no | Lower numbers come first. |
| `size`, `material`, `colour`, `brand`, `moq`, `warranty` | no | Any that are filled become a spec table on the product page. |
| `sku` | no | Goes into the WhatsApp message, so the owner knows exactly which item. |
| `show` | no | `no` hides the row without deleting it. |

Blank rows are skipped silently. Rows with no name are skipped.

---

## config.json

The only fields that must be right:

- `name` — the business name
- `whatsapp` — country code plus 10 digits, no spaces: `919876543210`
- `subdomain` — never change it after signup
- `accent` — their brand colour, hex

Optional but worth filling: `tagline`, `address`, `city`, `hours`, `since`,
`about`, `mapsUrl`, `metaDescription`, `logo`.

**Themes:** `warm`, `cool`, `dark`, `sharp` (see `template/themes.js`).
**Layouts:** `grid` (2 columns) or `grid-large` (1 big column).
Theme plus accent plus their own photos is enough that no two clients look alike.

**When they buy their own domain:** set `customDomain` in config, add it in
Cloudflare Pages → Custom domains, rebuild. The subdomain 301s to the new domain
automatically, so the links already shared on WhatsApp keep working and Google
indexes one URL.

---

## How the deploy works

One Cloudflare Pages project serves every client. `dist/_worker.js` is generated
on every build: it reads the incoming hostname, finds that client's folder and
serves from it.

That means adding a client needs no DNS change, no new project, no new
deployment target. A folder and a push.

---

## Photo script

```bash
node scripts/photos.js <slug>                          # from raw/<slug>/
node scripts/photos.js <slug> --from ~/Desktop/photos  # from anywhere
node scripts/photos.js <slug> --pad                    # white padding, no crop
node scripts/photos.js <slug> --no-levels              # skip brightness fix
```

Square crop, auto brightness, 800px, WebP at 80%. Roughly 15 seconds for 50
photos.

Use `--pad` when the product must not be cropped (tall almirahs, full-length
mirrors, banners). Default centre-crop suits most shop photos.

**Raw photos stay on your laptop.** Only the cleaned WebP files are committed,
so the repo stays small. Back `raw/` up to a drive or Google Drive — if it's lost
you can't re-crop later, though the live catalogs keep working.

For background removal, run `rembg p raw/<slug> raw/<slug>-clean` first, then
point `--from` at the cleaned folder.

---

## When the build stops

The build refuses to publish a broken catalog. It prints exactly what's wrong:

- `row 7: image not found` — the filename in the Sheet doesn't match the file
- `duplicate URL "/rack-a"` — two products want the same slug
- `category "almirah" is spelled 2 ways` — one is capitalised, one isn't
- `whatsapp must be country code + 10 digits` — missing the `91`

Fix and rerun. Nothing goes live until it's clean.

If a Sheet fetch fails, the build falls back to the last good cached copy, then
to the local `products.csv`, and says which it used. A Google outage never takes
a client's catalog down.

---

## Rules worth keeping

1. **Never change a slug or a subdomain** once a link has been shared.
2. **Don't give clients edit access to the Sheet** early on. One bad paste breaks
   their catalog. Later, use Protected Ranges so they can only touch the price
   column.
3. **Fix the template, not the client.** A change in `template/` reaches all 150
   clients on the next build. That's the whole point.
4. **No custom layouts under ₹15,000.** If a client wants a different design,
   quote it separately or say no. One exception becomes ten.
5. **Compress before committing.** Never commit raw phone photos.
