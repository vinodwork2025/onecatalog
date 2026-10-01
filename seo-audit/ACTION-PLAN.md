# OneCatalog SEO action plan, 2026-10-01

## Done in this pass (goes live on the next push)

- **URLs and headers:** one URL per page on every host (https, no www, no trailing slash), an HSTS header, and an HTML 404 for catalogs.
- **Catalog pages:**
  - titles fitted to 60 characters, descriptions to 155
  - no false "with prices" wording, no repeated city
- **Schema:**
  - Offer only when a real price exists
  - ItemList on category pages, AboutPage on about pages
  - richer LocalBusiness and Product data
- **Sitemaps and robots:** catalog sitemaps without fake lastmod. `noindex` option, set on the 3 placeholder demos.
- **About and author:** "Vinod Kumar and his team", alias removed, OptiScale Advisors founder note on /about.

## Quick wins (high impact, low effort)

1. **Connect Google Search Console** (you, about 10 minutes).
   1. Add a Domain property for `onecatalog.in`.
   2. Add the TXT record in Cloudflare DNS. One property covers every client subdomain.
   3. Submit `https://onecatalog.in/sitemap.xml`, plus `https://rasofa.onecatalog.in/sitemap.xml` and `https://bestwoodhandicrafts.onecatalog.in/sitemap.xml`.
2. **Request indexing** of the home page and /about in Search Console after the push, so the new showcase and author details are picked up.
3. **Bing Webmaster Tools:** import from Search Console in one click. Bing also feeds ChatGPT search.

## Strategic (high impact, more effort)

4. **Category intros for catalogs.** Add an optional `categoryIntros` map in a client's config, with 2 or 3 plain sentences per category. Example: what sizes and materials, made to order or not, delivery area. This targets "<category> in <city>" searches, which is where shop catalogs can rank. I can add the template support whenever you want.
5. **Fuller product descriptions** in client sheets. Add 2 or 3 lines on size, use, material and care. Product pages are 110 to 160 words now.
6. **Entity profiles for OneCatalog.** Create a Google Business Profile (service-area business, no address shown) and a LinkedIn company page. Then add both URLs as `sameAs` in `site/config.json`.
7. **Real client proof.** Once Ra Sofa or Best Wood agree, add a one-line quote from the owner on the home showcase. Only use their actual words.

## Decisions needed from you

8. **"Catalog by OneCatalog" footer credit** on client catalogs, linking to onecatalog.in. Good for discovery and leads. It is visible on every client's site, so it is your call.
9. **Privacy and terms** stay noindex until your legal review.

## Maintenance

10. After each new client, check their catalog in Search Console → URL Inspection once.
11. Re-run this audit when there are more than 10 live clients, or after any template change.
12. When PageSpeed quota allows, check https://pagespeed.web.dev/ for onecatalog.in and one catalog product page for field data.
