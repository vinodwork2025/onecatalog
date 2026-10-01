# OneCatalog SEO audit, 2026-10-01

## A) Audit summary

**Scope:** full site. Two surfaces:

1. **onecatalog.in**, the marketing site: 19 pages (17 indexable, privacy and terms noindex on purpose).
2. **Client catalogs** on `*.onecatalog.in`: 5 catalogs, 83 pages. Each has a home page, category pages, product pages and an about page.

**Evidence:** local build in `dist/` (every HTML page parsed), live HTTP checks on onecatalog.in and rasofa.onecatalog.in, local Lighthouse 12 (mobile), and a unit test of the generated router.

**Overall:** about 78/100 before fixes and about 89/100 after them (Good). Score confidence: Medium, because there is no field data (CrUX) yet and Search Console is not connected.

| | Before | After fixes in this pass |
|---|---|---|
| Technical SEO (25%) | 68 | 92 |
| Content quality (20%) | 74 | 78 |
| On-page SEO (15%) | 80 | 95 |
| Schema (15%) | 76 | 93 |
| Performance (10%) | 96 | 96 |
| Images (10%) | 92 | 92 |
| AI search readiness (5%) | 92 | 92 |

**Top 3 issues found:**
1. Every page also answered on `http://`, and every catalog page also answered with a trailing slash. Google saw two or three copies of each URL.
2. Catalog product pages with no price still had an `Offer` with no `price`. Search Console reports that as an error, and it affects every Ra Sofa and Best Wood product.
3. Three demo catalogs with placeholder photos and made-up shop addresses were indexable, with `LocalBusiness` schema.

**Top 3 opportunities:**
1. Connect Google Search Console (domain property) and submit each catalog sitemap. Nothing is verified yet (`gscToken` is empty).
2. Add a short intro to each catalog category page. They hold only about 90 to 115 words.
3. Build off-site entity signals for OneCatalog: a Google Business Profile and a LinkedIn page, then `sameAs` in the schema.

## B) Findings

| Area | Finding | Evidence | Impact | Fix | Severity | Confidence | Status |
|---|---|---|---|---|---|---|---|
| Technical | HTTP not redirected to HTTPS | `curl http://onecatalog.in/` and `http://rasofa.onecatalog.in/` both returned 200 | Duplicate URLs, split signals, insecure first visit | Router 301s every known host to `https://` | Critical | Confirmed | **Fixed** |
| Technical | Catalog trailing-slash duplicates | `https://rasofa.onecatalog.in/chesterfield-tufted-corner-sofa-set/` returned 200. The canonical has no slash | Duplicate URLs on every catalog page | Router 301s trailing slashes on all hosts, as it already did on onecatalog.in | Warning | Confirmed | **Fixed** |
| Technical | No HSTS header | Response headers show only nosniff and referrer-policy | Browsers do not remember HTTPS | `Strict-Transport-Security: max-age=31536000` in `_headers` | Warning | Confirmed | **Fixed** |
| Technical | Catalog 404 was plain text | Router returned `text/plain` "Not found" | A dead product link from WhatsApp was a dead end | HTML 404 with a link back to the catalog, noindex | Info | Confirmed | **Fixed** |
| Technical | Catalog sitemap lastmod = build date | Every URL showed `<lastmod>2026-10-01</lastmod>` on every build | Google learns to ignore lastmod | Dropped lastmod and priority (Google ignores priority) | Warning | Confirmed | **Fixed** |
| Indexing | Demo catalogs indexable | shreefurniture, hosurtiles and varnamsarees: placeholder photos, invented addresses, `LocalBusiness` schema, `index,follow` | Thin pages and fake local-business markup on the domain | New `noindex: true` config field: noindex tag, no sitemap. Set on the 3 demos | Warning | Confirmed | **Fixed** |
| Schema | Offer without price | Ra Sofa and Best Wood products: `offers` with `priceCurrency` but no `price` | Search Console Product and Merchant errors | `offers` only when the price is a plain number | Critical | Confirmed | **Fixed** |
| Schema | Category pages had breadcrumb schema only | Types: `BreadcrumbList` | Weaker understanding of the listing | Added an `ItemList` of the category's products | Warning | Confirmed | **Fixed** |
| Schema | Catalog about pages had no schema | 0 JSON-LD blocks | Missed entity link | `AboutPage` pointing to the `LocalBusiness` `@id` | Warning | Confirmed | **Fixed** |
| Schema | LocalBusiness had no image, @id or map | Only `name`, `url`, `telephone`, `address` | Weaker local entity | Added `@id`, `image` (logo or first product photo) and `hasMap` from `mapsUrl` | Warning | Confirmed | **Fixed** |
| Schema | Product missing url, category, colour and material | Data was in the CSV but not in the schema | Less product detail | Added from the CSV columns | Info | Confirmed | **Fixed** |
| On-page | Catalog titles too long | 53 of 83 catalog pages were over 60 characters, up to 90 (`ra-sofa/l-shaped-sofa…` was 90) | Truncated in search results | `fitTitle()` uses the longest form that fits: name, shop, city, then shorter | Warning | Confirmed | **Fixed** |
| On-page | City repeated in the title | "Furniture maker in Hafeezpet, Hyderabad, Hyderabad" | Looks careless in search results | City added only if it is not already in the text | Warning | Confirmed | **Fixed** |
| On-page | Descriptions up to 300 characters | About pages were 201 to 300, product pages were cut at 300 | Cut off, sometimes mid-word | `clip()` keeps whole sentences up to 155, or cuts at a word | Warning | Confirmed | **Fixed** |
| On-page | Descriptions claimed "with prices" | Ra Sofa and Best Wood have no prices but said "products with prices" | Misleading snippet | "with photos", plus "and prices" only when a product has a price | Warning | Confirmed | **Fixed** |
| On-page | Short product descriptions | Two Varnam products at 67 to 68 characters | Weak snippet | Product description plus price line plus shop and city | Info | Confirmed | **Fixed** |
| Social | Catalog about pages had no og:image or Twitter card | Missing tags | Blank share preview on WhatsApp | Falls back to the first product photo. Added og:site_name and og:locale | Warning | Confirmed | **Fixed** |
| Images | `max-image-preview` not set | robots meta was `index,follow` | Small image previews in Discover and Images | `max-image-preview:large` | Info | Confirmed | **Fixed** |
| E-E-A-T | Author shown as "Vinod Kumar (Hari)", as a one-person business | config author, about page | Mixed identity signals | "Vinod Kumar and his team", alias removed, OptiScale Advisors founder note on /about | Warning | Confirmed | **Fixed** |
| Freshness | Home `updated` date was stale after the showcase change | home.json `2026-09-29` | Sitemap lastmod out of date | Set to 2026-10-01 | Info | Confirmed | **Fixed** |
| Content | Thin catalog category pages | 83 to 117 words each | Weak ranking for "<category> in <city>" | Optional per-category intro in config (see action plan) | Warning | Confirmed | Open |
| Content | Thin catalog product pages | 109 to 160 words | Limited long-tail reach | Fuller descriptions in the client sheet: size, use, care | Warning | Confirmed | Open |
| Entity | No `sameAs` profiles for OneCatalog | Organization schema has no `sameAs` | Weaker entity recognition by Google and AI | Create Google Business Profile and LinkedIn, then add `sameAs` | Warning | Confirmed | Open |
| Measurement | Search Console and GA4 not connected | `gscToken` and `ga4Id` empty | No index or query data | Search Console domain property via Cloudflare DNS TXT | Critical | Confirmed | Open |
| Links | Catalogs do not link to onecatalog.in | No onecatalog.in link in catalog footers | Missed discovery and brand mentions | Optional "Catalog by OneCatalog" footer credit (needs your decision) | Info | Confirmed | Open |
| Schema | FAQPage on a commercial site | Home, pricing, industry and guide pages | No FAQ rich results (restricted since 2023). Still useful for AI answers | Keep as is | Info | Confirmed | No change |

### What already passes
- **Landing site:** all 17 indexable pages pass the build's own checks:
  - title 60 characters or less, description 110 to 155
  - keyword placement, internal links, one H1
  - canonical, OG and Twitter tags, `lang`
- **Schema on the landing site:**
  - Organization, WebSite, Service with one Offer per plan, Article with Person author on guides, BreadcrumbList
- **Crawlers:** robots.txt allows Googlebot, Bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot and Google-Extended.
- **AI files:** `llms.txt` is published and lists the live sample catalogues.
- **Redirects and errors:**
  - `www` and trailing slash 301 on onecatalog.in
  - unknown paths give a real 404
  - unknown subdomains give a 404 that does not list clients
- **Images:** every catalog image is WebP with width and height and alt text. Product grids use a 400px `srcset`. The first image is never lazy-loaded.
- **Lighthouse mobile (local):**

  | Page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
  |---|---|---|---|---|---|---|---|
  | onecatalog.in home | 96 | 100 | 100 | 100 | 1.9 s | 0 | 220 ms |
  | rasofa catalog home | 100 | 100 | 100 | 100 | 1.3 s | 0 | 0 ms |
  | rasofa product page | 100 | 100 | 100 | 100 | 1.2 s | 0 | 0 ms |

## C) Environment limitations
- The PageSpeed Insights API daily quota was used up, so there is no field (CrUX) data. Lighthouse was run locally instead. Local runs vary by ±5 points.
- The Python scripts bundled with the audit tool could not run, because the system Python `requests` package is broken (circular `idna` import). The same checks were done with a Node script over every built page, plus curl.
- No Search Console access, so index coverage, queries and manual actions are unknown.
- The live site still runs the old code. Fixes reach production on the next push to `main`.
