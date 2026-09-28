# Adding a client — the frozen procedure

Do not improvise on this. Same steps, same order, every time.
If a step fails, fix it and rerun that step. Do not skip ahead.

Time: under an hour once you have the photos and the details.

---

## Before you touch the computer

Collect all of this in ONE WhatsApp exchange. Chasing it in five messages is
what turns a one-hour job into a three-day job.

- [ ] Business name, exactly as it should appear
- [ ] One-line tagline
- [ ] WhatsApp number
- [ ] Phone number, if different
- [ ] Full address
- [ ] Google Maps link
- [ ] Opening hours
- [ ] Year the business started
- [ ] Areas they serve
- [ ] Logo file
- [ ] Product photos
- [ ] Product names, categories and prices
- [ ] A colour from their logo or shop board

**Agree the slug and write it down.** Lowercase, no spaces, hyphens only if
unavoidable. It becomes the folder name and the Sheet tab name.
**Agree the subdomain too.** It becomes `<subdomain>.onecatalog.in`. The
existing clients drop the hyphens (`shree-furniture` → `shreefurniture`).
**Neither can ever change once a link has been shared.**

For a paying client, collect the money before you build. ₹999 to book.

---

## Step 1: scaffold

```bash
node scripts/new-client.js <slug> "<Business Name>" 91XXXXXXXXXX
```

Creates `clients/<slug>/` and `raw/<slug>/`.

## Step 2: photos in

Copy their original product photos into `raw/<slug>/`. Any names, any format.
Never put raw photos anywhere else. Never commit them.

The logo is different: put it straight into `clients/<slug>/images/`, not
`raw/`. `photos.js` crops everything in `raw/` to a square, which would cut
the logo.

## Step 3: clean the photos

```bash
node scripts/photos.js <slug>
```

Add `--pad` instead of the default crop when products must not be cut:
tall almirahs, full-length mirrors, banners, anything long and thin.

Look at the output. Re-request anything that comes out blurry or badly cut.

## Step 4: products

Open `clients/<slug>/products.csv`. One row per product.

Required: `name`, `image_url`, and a `slug` you will never change.
`image_url` must exactly match a file in `clients/<slug>/images/`, ending
`.webp`. Several photos for one product: separate them with `|`.

Blank `price` renders as "Price on request". That is fine. Text prices work
too: `From 1500`, `50 per sq ft`, `Quote after site visit`.
Categories must be spelled identically across every row.

**Demo client: stop here, use the local CSV.**
**Paying client: also set up the Google Sheet (see below).**

## Step 5: business details

Open `clients/<slug>/config.json` and fill in:

`name`, `whatsapp` (91 + 10 digits), `tagline`, `phone`, `phoneDisplay`,
`address`, `city`, `state`, `pincode`, `mapsUrl`, `hours`, `since`,
`areasServed`, `about`, `logo` (the filename in `images/`), `accent`, `theme`,
`subdomain`, `metaDescription`.

Optional: `reviewUrl` (their Google review link) adds a "Rate us on Google"
button. `announcement` shows a coloured bar at the top of every page, for an
offer or a holiday closure, linked to `announcementUrl` if set.

`theme` is `warm`, `cool`, `dark` or `sharp`. `layout` is `grid` or
`grid-large`.

## Step 6: build

```bash
node scripts/build.js <slug>
```

It refuses to publish anything broken and names the exact row and problem.
Fix and rerun. Never work around a validation error.

## Step 7: look at it on a phone

```bash
node scripts/serve.js <slug>
```

Open it on an actual phone, not the laptop browser. The phone must be on the
same Wi-Fi as the laptop. Open `http://<laptop IP>:4000` on the phone. Find
the laptop IP with `ipconfig` (the IPv4 address). If it does not load, allow
Node through Windows Firewall when asked. Check:

- [ ] Loads fast
- [ ] Category chips filter the grid
- [ ] A product page opens
- [ ] The WhatsApp button pre-fills the product name
- [ ] The footer phone number dials
- [ ] "Get directions" opens the right place
- [ ] "Rate us on Google" opens their review box, if `reviewUrl` is set

## Step 8: commit and push — this is the deploy

```bash
git add -A
git commit -m "add <slug>"
git push
```

Pushing to `main` deploys. Cloudflare runs the build itself and publishes it,
usually within a minute. Nothing else to run, and no Cloudflare or DNS step
for a new subdomain.

Then open `https://<subdomain>.onecatalog.in` and confirm it is live.

GitHub is also your backup and history. If your laptop dies, the client
configs and cleaned images are the business.

---

## Google Sheet, paying clients only

1. Open the `OneCatalog Master` Sheet
2. Duplicate any client tab, rename it to the new slug
3. Paste in the rows from `products.csv`
4. File → Share → Publish to web → pick **that tab** → **CSV** → Publish
5. Copy the link into `config.json` as `sheetCsvUrl`
6. Rebuild. The log should say `sheet fetched`

Each tab needs its own publish. Publishing one does not publish the others.

Do not give the client edit access in the first few months.

A price change in the Sheet only goes live on the next deploy. To publish one
straight away, push any commit, or open the Worker in Cloudflare → Deployments
and retry the latest build.

---

## Updating a client later

1. New photos into `raw/<slug>/`
2. `node scripts/photos.js <slug>`
3. Add the rows to their Sheet tab, or their `products.csv`
4. `node scripts/build.js <slug>` and check it
5. Commit and push

Four minutes. Batch these on a Friday rather than doing them as they arrive.

---

## Moving a client to their own domain

1. Buy the domain in the client's name
2. Add the domain to Cloudflare and point its nameservers at Cloudflare.
   Wait until Cloudflare shows it as Active.
3. Set `customDomain` in their `config.json`, e.g. `shreefurniture.com`
4. In `wrangler.jsonc`, add two entries to `routes`:
   ```jsonc
   { "pattern": "shreefurniture.com", "custom_domain": true },
   { "pattern": "www.shreefurniture.com", "custom_domain": true }
   ```
   Cloudflare creates the DNS records for these itself. Do not add a CNAME.
5. `node scripts/build.js <slug>`, then commit and push

Their subdomain keeps working and 301s to the new domain, so links already
shared on WhatsApp do not break.

---

## The five rules

1. **Never change a slug or subdomain** after a link has been shared.
2. **Never commit raw photos.** Only `clients/*/images/*` files go in git.
3. **Never edit `dist/` or `worker/`.** Both are generated every build.
4. **Fix the template, not the client.** A layout request gets a theme or
   accent change. Anything more is quoted separately.
5. **Check before you push.** A push goes live within a minute. Build and
   look at it locally first.
