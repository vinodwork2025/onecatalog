# SEO plan, phase 1

Brief: `onecatalog-seo-build-prompt (2).md` (6 Oct 2026). This file is the working plan. `SEO_CHANGES.md` will hold the final report.

## How the site works (Step 0 findings)

- **Stack:** plain Node. `node scripts/build.js` renders everything to `dist/`. One Cloudflare Worker (`worker/index.js`, generated) routes `onecatalog.in` to `dist/_home` and each `*.onecatalog.in` subdomain to `dist/<client>`. A push to `main` deploys.
- **Marketing site pages:** one JSON file per page in `site/pages/` (guides in `site/pages/guides/`, industry pages in `site/pages/catalogue-maker/`). Shared facts in `site/config.json`. `site/render.js` renders and checks every page.
- **Built-in page checks** (a failing page is published `noindex` and left out of the sitemap): title 60 characters or less, description 110 to 155, no em-dash, semicolon or banned word, one target `keyword` in title, H1, description, first 100 words, at least one H2 and the URL. Every ₹ amount must be a configured price. Internal links must resolve. Guides must link to `/whatsapp-catalogue` and another guide.
- **Already in place:** server-rendered HTML (no JS needed for content). Article schema on guides, FAQPage schema, BreadcrumbList, Organization and WebSite on home, Service schema on home and pricing. Answer box ("Quick answer") on guides. Author box and a sources line on guides. `llms.txt`, `robots.txt` (AI bots allowed, Applebot missing), sitemap with lastmod. Per-page OG images (`node scripts/og.js`).
- **Client catalogues:** `template/render.js`. LocalBusiness schema with address, geo-free, `openingHours` (machine format since 5 Oct), Product schema (Offer only with a numeric price), BreadcrumbList, ItemList on category pages, per-client sitemap and robots.
- **Brand spelling:** "OneCatalog". Guides use both "catalogue" and "catalog". The checks treat them as one word.
- **CTA and signup:** there is no signup form. Every CTA is a WhatsApp chat with OneCatalog (`data-cta` attributes). Click tracking code already exists (GA4 event `whatsapp_click` / `cta_click` with `page_path`), but `ga4Id` in `site/config.json` is empty, so nothing is recorded yet.

## Decisions and blockers (need Vinod)

1. **hosurtiles and shreefurniture are demos, not real shops.** Their names, addresses and photos are made up, and both are `noindex`. Task 7 asks to push hosurtiles as "sales proof" with its "real shop name", and Task 5 lists both as live examples. Presenting them as real shops would break the "no made-up clients" rule. Plan: leave them out of Task 5 and 7 until a real tiles or sanitaryware client exists. The tiles page can be built without a live example. Tell me if hosurtiles is in fact a real shop.
2. **Author name.** The brief says "Vinod Kumar (Hari)". The site dropped "Hari" from public pages on 1 Oct. Plan: keep "Vinod Kumar". Add the bio fact from the brief: 16 years in operations and supply chain.
3. **"WhatsApp Business app version tested".** I can read the WhatsApp Help Center, but I cannot test the app. Plan: show "Last checked against the WhatsApp Help Center on [date]". Send me the app version you test with (Settings, Help, App info) and I will add it.
4. **Analytics.** Click tracking is ready but needs a GA4 measurement ID in `site/config.json` → `ga4Id`.
5. **Title length.** Task 1's title is 61 characters. The site caps titles at 60. Plan: drop the brackets: `WhatsApp Catalogue Not Showing or Not Working? 7 Fixes 2026` (59).
6. **Task 1 links to the Task 3 guide**, which does not exist yet. A link to a missing page fails the build check. Plan: Task 1 answers the error briefly now, and the link goes in when Task 3 is built.
7. **luxuryhomesfurniture** is left alone apart from shared template changes, as asked.

## Files

| Task | Files |
|---|---|
| 1 | `site/pages/guides/whatsapp-catalog-not-showing.json`, `site/render.js` (screenshot block, FAQ schema from question sections, "last checked" line), `site/config.json` (author bio), `SCREENSHOTS_NEEDED.md` |
| 2 | `site/pages/guides/whatsapp-catalog-approval-time.json` |
| 3 | new `site/pages/guides/whatsapp-item-wasnt-saved-error.json`, link from Task 1 |
| 4 | 5 new guides, 3 rewritten (`bulk-upload`, `add-catalog-to-whatsapp-business`, `categories`) |
| 5 | new `catalogue-maker/furniture`, `tiles-sanitaryware`, `handicrafts`, audit of the 4 existing ones |
| 6 | `template/render.js`, `template/themes.js` (titles, schema subtype, footer credit) |
| 7 | sofasquare title and H1 (hosurtiles parked, see blocker 1) |
| 8 | shared CTA in `site/render.js` |
| 9 | `site/render.js` (robots: Applebot, Article author details, guides index groups), `llms.txt` |

New pages also need `node scripts/og.js` for their share images.

## Screenshots

Guide pages get named screenshot slots (`/img/guides/<name>.png`). A slot renders nothing until its file exists in `site/img/guides/`, so live pages never show a broken image. Every slot is listed in `SCREENSHOTS_NEEDED.md`.

## Process

Work on branch `seo-phase1`. Commit after each task. Nothing goes live until it is merged to `main`. Stop after Task 1 for a voice check.
