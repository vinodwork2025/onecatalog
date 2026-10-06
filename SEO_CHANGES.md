# SEO changes, phase 1

Brief: `onecatalog-seo-build-prompt (2).md`, worked 6 October 2026 on branch `seo-phase1`. Plan and decisions: `SEO_PLAN.md`.

## Pages created or changed (onecatalog.in)

Words and grade are for the article body only (no navigation, author box, sources or buttons). Grade is Flesch-Kincaid, measured with `text-readability`, the Node port of textstat (same formulas). Every page is 6 or below.

| URL | Change | Target phrase | Title | Words | Grade | Schema |
|---|---|---|---|---|---|---|
| `https://onecatalog.in/guides/whatsapp-catalog-not-showing` | Rewritten (Task 1) | whatsapp catalogue not showing | WhatsApp Catalogue Not Showing or Not Working? 7 Fixes 2026 | 1692 | 4.8 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-approval-time` | Rewritten (Task 2) | whatsapp catalog approval time | WhatsApp Catalog Approval Time and How to Speed It Up | 985 | 4.9 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-item-wasnt-saved-error` | New (Task 3) | item wasn't saved whatsapp business | "Item Wasn't Saved" in WhatsApp Business: Causes and Fixes | 1036 | 5.3 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-rejected` | New (Task 4) | whatsapp catalog rejected | WhatsApp Catalog Item Rejected? Why and How to Appeal | 968 | 4.8 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-product-limit` | New (Task 4) | whatsapp catalog product limit | WhatsApp Catalog Product Limit: How Many Items Can You Add? | 787 | 4.9 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-link-not-working` | New (Task 4) | whatsapp catalog link not working | WhatsApp Catalog Link Not Working? 6 Fixes That Help | 931 | 5.6 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/how-to-share-whatsapp-catalog-link` | New (Task 4) | share whatsapp catalog link | How to Share Your WhatsApp Catalog Link (Android and iPhone) | 794 | 5.4 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-vs-website-catalog` | New (Task 4) | whatsapp catalog vs website catalog | WhatsApp Catalog vs Website Catalog: An Honest Comparison | 746 | 4.6 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-bulk-upload` | Rewritten (Task 4) | whatsapp business catalog bulk upload | WhatsApp Business Catalog Bulk Upload: How It Works (2026) | 877 | 5.1 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/add-catalog-to-whatsapp-business` | Rewritten (Task 4) | add catalog to whatsapp business | How to Add a Catalog to WhatsApp Business (2026 Steps) | 874 | 4.8 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-categories` | Rewritten (Task 4) | whatsapp catalogue categories | WhatsApp Catalogue Categories and Your Business Category | 865 | 5.5 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/whatsapp-catalog-price-not-showing` | Re-checked, Last checked line (Task 9) | whatsapp business catalog price not showing | WhatsApp Business Catalog Price Not Showing? (2026 Fix) | 612 | 4.9 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides/how-to-make-a-product-catalogue` | Last checked line (Task 9) | how to make product catalogue | How to Make a Product Catalogue in 7 Steps (2026 Guide) | 726 | 4.7 | Article, FAQPage, BreadcrumbList |
| `https://onecatalog.in/guides` | Regrouped (Task 9) | (hub page) | WhatsApp Catalogue Guides and How-Tos \| OneCatalog | 352 | 5.3 | WebPage, BreadcrumbList |
| `https://onecatalog.in/catalogue-maker/furniture` | New (Task 5) | furniture catalogue maker | Online Furniture Catalogue Maker for Shops in India | 999 | 4.7 | WebPage, FAQPage, BreadcrumbList |
| `https://onecatalog.in/catalogue-maker/tiles-sanitaryware` | New (Task 5) | tiles sanitaryware catalogue maker | Online Tiles and Sanitaryware Catalogue Maker for India | 1016 | 4.1 | WebPage, FAQPage, BreadcrumbList |
| `https://onecatalog.in/catalogue-maker/handicrafts` | New (Task 5) | handicrafts catalogue maker | Online Handicrafts Catalogue Maker for Shops in India | 872 | 4.8 | WebPage, FAQPage, BreadcrumbList |
| `https://onecatalog.in/whatsapp-catalogue` | Links to new trade pages (Task 9) | whatsapp catalogue | WhatsApp Catalogue Maker for Your Business \| OneCatalog | 1157 | 5.4 | WebPage, FAQPage, BreadcrumbList |

Every page above: one H1, a unique title (60 characters or less) and description, a self-referencing canonical, Open Graph tags with its own share image, alt text on every image, and server-rendered HTML (checked by fetching the raw HTML with no JavaScript). Zero banned words, em-dashes, semicolons or extra exclamation marks. All internal links resolve. All JSON-LD parses and has its required fields.

## Client catalogue template (every subdomain)

| What | Where it shows |
|---|---|
| Home title `[Shop] \| [Main category] in [Area, City]`, shortened to 60 characters | Clients with `mainCategory` set: sofasquare, alphafurniture, rsfurniture, rasofa, venkateshwaratenthouse, a2zofficefurniture, hosurtiles |
| Category titles `[Category] in [Area] \| [Shop]` | Every client |
| LocalBusiness subtype from `businessType` (FurnitureStore, HomeGoodsStore), plus `areaServed` | Every client with the field |
| Footer: "Catalogue made with OneCatalog", linked to onecatalog.in | Every client without a demo footer note |
| Optional `h1` and `mapEmbed` (lazy Google Maps embed) | sofasquare (h1), hosurtiles (h1, map) |
| Product schema (name, images, INR price, availability) and BreadcrumbList | Unchanged and checked. Offer appears only when a product has a numeric price. |
| Canonical, sitemap and robots per subdomain | Checked on every indexable client |

Current home titles: `Sofa Square Furniture | Sofa Makers in Koramangala`, `Alpha Furniture | Furniture Showroom in J. P. Nagar`, `R.S Furniture (Factory Outlet) | Furniture in Koramangala`, `Ra Sofa and Furniture | Furniture Makers in Hafeezpet`, `Venkateshwara Tent House | Event Rentals in Chikkalasandra`. luxuryhomesfurniture keeps its current title, as asked.

## Site-wide

- `robots.txt` allows Googlebot, Bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Google-Extended, Applebot and Applebot-Extended.
- `llms.txt` and `sitemap.xml` list every new page. Sitemap `lastmod` comes from each page's `updated` date.
- Article schema on every guide: author Vinod Kumar with job title and bio (16 years in operations and supply chain), publisher, published and modified dates.
- Organization schema on the home page now has a contactPoint. No social profiles were added because the site has none listed.
- Every guide shows the author box and "Last checked: [date], against the WhatsApp Help Center and WhatsApp Business app version 2.26.39.72".
- Shared closing CTA on every guide, industry and main page, with a real client catalogue link. Clicks send `cta_position` and `page_path` to GA4.
- `/guides` index grouped: Fix a problem, Set up your catalogue, Share and sell.
- New page checks in `site/render.js`: the brief's banned words, en-dashes used as dashes, more than one exclamation mark, and Introduction or Conclusion headings. A page that fails is published `noindex`.

## What you need to do by hand

1. **Screenshots:** 21 slots, listed in `SCREENSHOTS_NEEDED.md` with what to capture. Save each as a PNG in `site/img/guides/` with the exact filename and rebuild. A slot stays hidden until its file exists.
2. **GA4:** put your measurement ID in `site/config.json` as `ga4Id`. Click tracking is already in the pages.
3. **hosurtiles real data:** the real shop name, WhatsApp and phone, full address with pincode, opening hours, Google Maps link, real product photos, product names, sizes and rates, and the brands you really stock. Then remove `"noindex": true`. With a name under about 20 characters, the title becomes `[Name] | Sanitaryware & Bathware Showroom in Hosur`. Add it to `/catalogue-maker/tiles-sanitaryware` as the live example.
4. **best-wood-handicrafts:** its about text still says it is a demo with enquiries going to OneCatalog. If it is a real client, send its city, WhatsApp number and real about text.
5. **Search Console:** resubmit `https://onecatalog.in/sitemap.xml`, then request indexing for these 5 pages first:
   - `/guides/whatsapp-catalog-not-showing`
   - `/guides/whatsapp-item-wasnt-saved-error`
   - `/guides/whatsapp-catalog-approval-time`
   - `/catalogue-maker/furniture`
   - `/guides/how-to-share-whatsapp-catalog-link`
6. **Client sitemaps:** in Search Console, also submit `https://sofasquare.onecatalog.in/sitemap.xml` and the other indexable client sitemaps if those subdomains are verified.
