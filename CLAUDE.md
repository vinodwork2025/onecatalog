# OneCatalog — working notes for Claude Code

This repo builds mobile catalog websites for small businesses. One template,
many clients. Static output. Deployed automatically by Cloudflare Pages on
every push to `main`.

Hari runs this solo. He is not a developer. Keep explanations short, do the
work rather than describing it, and always tell him the one next thing to do.

## How it fits together

- `template/` — the shared template. One change here reaches every client.
- `clients/<slug>/` — one folder per client: `config.json`, `products.csv`, `images/`
- `raw/<slug>/` — the client's original photos. Gitignored, never committed.
- `scripts/` — build, photo processing, scaffolding, local preview
- `dist/` — build output. Gitignored. Cloudflare builds it.

Product data comes from the client's Google Sheet when `sheetCsvUrl` is set in
their config, otherwise from their local `products.csv`. Demos use the local
CSV. Paying clients use the Sheet.

## Commands

```bash
node scripts/new-client.js <slug> "<Business Name>" 91XXXXXXXXXX
node scripts/photos.js <slug>              # clean raw photos into images/
node scripts/photos.js <slug> --pad        # no crop, white padding
node scripts/build.js                      # all clients
node scripts/build.js <slug>               # one client
node scripts/build.js --no-images          # HTML only, fast
node scripts/serve.js <slug>               # preview at localhost:4000
```

## Adding a client

1. `new-client.js` with the slug, business name and WhatsApp number
2. Copy their photos into `raw/<slug>/`
3. `photos.js <slug>` — prints the cleaned `.webp` filenames
4. Fill `clients/<slug>/products.csv`. Ask Hari for names, categories and
   prices rather than inventing them. Leave `price` blank if unknown; the page
   shows "Price on request".
5. Fill `clients/<slug>/config.json`: name, whatsapp, tagline, address, city,
   hours, about, theme, accent
6. `build.js <slug>`, then `serve.js <slug>` and tell him to check it on his phone
7. Commit and push. Cloudflare deploys in about two minutes.

## products.csv columns

`id, category, name, slug, description, price, image_url, in_stock,
sort_order, size, material, colour, brand, moq, warranty, sku, show`

- `image_url` must exactly match a file in `clients/<slug>/images/`, ending `.webp`
- `slug` is the URL. Once a catalog link has been shared, never change it.
- `price` is numbers only. Blank means "Price on request".
- Categories must be spelled identically across rows. The build refuses
  "Almirah" and "almirah" in the same file.

## config.json fields that matter

`name`, `whatsapp` (country code + 10 digits, e.g. `919876543210`), `tagline`,
`address`, `city`, `hours`, `since`, `about`, `accent` (hex), `theme`
(`warm` | `cool` | `dark` | `sharp`), `layout` (`grid` | `grid-large`),
`subdomain`, `customDomain`, `sheetCsvUrl`.

`subdomain` becomes `<subdomain>.onecatalog.in`. Never change it after a link
has been shared.

## Rules

1. **Never change a slug or subdomain** once a catalog link exists. Links live
   forever in WhatsApp chat history.
2. **Never commit raw photos.** Only `clients/*/images/*.webp` goes in git.
3. **Fix the template, not the client.** A client asking for a layout change
   gets a theme or accent change, nothing more. Tell Hari to quote custom work
   separately.
4. **Never edit `dist/` or `dist/_worker.js`.** Both are generated.
5. `.github/deploy.yml.later` is parked on purpose. Do not move it back into
   `.github/workflows/` without asking.

## When the build stops

It refuses to publish anything broken and names the row and the problem.
Common ones:

- `image not found` — the CSV filename does not match the file. It must end `.webp`.
- `duplicate URL` — two products share a slug. Give one a different slug.
- `category spelled 2 ways` — make the spelling identical.
- `whatsapp must be country code + 10 digits` — add the `91`.

Fix and rerun. Do not work around a validation error by disabling the check.

## Deploy

Push to `main`. Cloudflare Pages runs `npm ci && node scripts/build.js` and
publishes `dist`. There is nothing to run locally to deploy.
