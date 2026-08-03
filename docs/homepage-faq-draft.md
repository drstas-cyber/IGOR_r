# Homepage FAQ — draft for approval (2026-08-05)

Status: **DRAFT — not implemented.** Nothing in this file is live. Implementation
starts only after George/Stan approve the Q&A text below.

## Why this exists

The site currently ships a sitewide `FAQPage` JSON-LD block (hardcoded in `index.html`,
served on every route — homepage, blog posts, everywhere) with **no corresponding
visible FAQ content anywhere on the page**. That's a live match-the-visible-content
violation: structured data is supposed to describe what's actually on the page, not
stand in for content that was never written. This task replaces that block with a real,
visible FAQ section on the homepage, with the schema generated from the exact same text
a visitor sees — one source of truth for both.

Two compliance issues already in the current sitewide block, not carried forward:
- **"five-star reviewed"** — an unverifiable/invented review claim.
- **"~80% of his practice is buyer-side"** — an uncited statistic.

Neither appears anywhere below. (Both also still appear in *other* schema blocks
sitewide — Person/RealEstateAgent descriptions, the `<noscript>` fallback — which is a
related but separate cleanup, out of scope for this task since it wasn't asked and
touches more than the FAQ block.)

## Draft Q&A text (11 questions)

**1. Is Temecula a good place to live?**
Temecula is a Southern California wine country community known for its master-planned
neighborhoods, local schools, and proximity to Los Angeles, San Diego, and Orange
County. Many buyers are drawn to the area for its family-friendly communities, newer
housing stock, and easy access to Temecula Valley's wineries and outdoor recreation.
Whether it's a good fit depends on your own priorities — commute, school district,
budget, and lifestyle are all worth weighing for your specific situation.

**2. What are the best neighborhoods in Temecula for families?**
The right neighborhood depends on what a family is looking for. Wolf Creek and Paloma
Del Sol are both master-planned communities with parks, pools, and sports courts that
many families consider family-friendly. Redhawk is built around a golf course with
walking trails, and Morgan Hill offers larger lots with mountain views. Each
neighborhood has its own character, and George Khazanovskiy can help you tour a few to
see which fits your family best.

**3. How do I get a free home valuation in Temecula?**
George Khazanovskiy offers a free, no-obligation home valuation for properties in
Temecula, Murrieta, Menifee, and the surrounding area. Rather than an automated online
estimate, it's a comparative market analysis (CMA) based on recent comparable sales in
your specific neighborhood. Request one by calling 619-277-2766, emailing
askgeorgek@gmail.com, or visiting temeculavalleyhomes.us.

**4. What should first-time buyers know about working with an agent?**
First-time buyers often have the most questions about the process — financing,
inspections, contingencies, and closing costs can all be unfamiliar. George Khazanovskiy
works with first-time buyers throughout Temecula, Murrieta, and Menifee and can walk
through each step of a purchase, answer questions as they come up, and help you
understand what to expect before you're under contract.

**5. What languages does George Khazanovskiy speak?**
George is fluent in English, Russian, and Ukrainian. Contracts, negotiations, and
consultations are available in whichever language you're most comfortable with.

**6. How far is Temecula from Los Angeles, San Diego, and Orange County?**
Temecula is located in Southern California's Inland Empire, within driving distance of
Los Angeles, San Diego, and Orange County. Many residents commute to or regularly visit
those areas; exact drive times vary with traffic and your specific destination, so it's
worth checking a map for your particular commute before deciding how the location fits
your routine.

**7. How do I start the process of buying a home in Temecula?**
A good starting point is a conversation about what you're looking for — budget,
timeline, and the neighborhoods or features that matter most to you. George Khazanovskiy
offers a free, no-obligation buyer consultation and can help you understand financing
options, connect you with lenders, and begin touring homes that match your criteria.
Reach out at 619-277-2766 or askgeorgek@gmail.com to get started.

**8. How do I start the process of selling my home in Temecula?**
Selling typically starts with understanding what your home is likely worth in the
current market — George Khazanovskiy provides a free comparative market analysis to help
with that. From there, next steps usually include preparing the home for listing,
professional photography, and setting a pricing and marketing strategy. Call
619-277-2766 or email askgeorgek@gmail.com to discuss your specific property.

**9. What areas does George Khazanovskiy serve?**
George Khazanovskiy serves Temecula (92590, 92591, 92592), Murrieta (92562, 92563),
Menifee (92584, 92585, 92586), Winchester (92596), Lake Elsinore (92530, 92532), Wildomar
(92595), and Fallbrook (92028).

**10. Who is George Khazanovskiy?**
George Khazanovskiy is a licensed California Realtor® (DRE #02034120) with Allison James
Estates & Homes, serving buyers and sellers throughout Temecula, Murrieta, and Menifee.
He is fluent in English, Russian, and Ukrainian.

**11. How can I verify George Khazanovskiy's real estate license?**
Every real estate agent in California must hold a license issued by the California
Department of Real Estate (DRE). You can verify George Khazanovskiy's license status
directly through the DRE's public license lookup tool using DRE #02034120.

### Compliance check against every rule this project has applied all session

| Check | Result |
|---|---|
| Tenure/years-of-experience claims | None |
| Exclusivity ("only") / superlatives ("best," "top," "leading") about George | None — Q2 uses "best neighborhoods" only in the *user's own question wording* (a natural search phrase), never asserts one neighborhood is objectively best |
| Invented reviews/ratings/client counts | None |
| Invented market stats/figures | None — no price ranges, no commute-time minutes, no percentages, no timelines (the original block's "reports delivered within 24 hours" was deliberately dropped — unverifiable operational claim, not something I can confirm is still accurate policy) |
| Fluency line | Exact ceiling in Q5 and Q10: "George is fluent in English, Russian, and Ukrainian" |
| Identity block (where used) | DRE #02034120 / Allison James Estates & Homes / 619-277-2766 / askgeorgek@gmail.com — exact |
| Service area list | Matches the site's own existing, already-established areaServed schema exactly (same cities/zips) |
| Commission/cost-to-buyer claims | Deliberately omitted (Q4) — post-2024 NAR-settlement buyer-agent compensation practices vary by transaction and I can't verify a blanket "no cost to you" claim is currently accurate |

## Implementation plan (not started — for review alongside the Q&A text)

1. **New data source**, single source of truth: `src/data/homepage-faq.js` exporting
   the 11 `{question, answer}` pairs above as a plain array, plus a small
   `buildHomepageFaqJsonLd()` helper mirroring `tools/blog-generator/generate.mjs`'s
   existing `buildFaqJsonLd()` pattern.
2. **New component**, `src/components/HomepageFAQSection.jsx` — renders the visible
   Q&A list/accordion, imports the same array from `homepage-faq.js`. Placed in
   `HomePage.jsx` near the bottom, after `ListingAlertsSection` and before `Footer`
   (matches "placement near homepage bottom").
3. **Schema**: `HomepageFAQSection.jsx` (or `HomePage.jsx`) emits the FAQPage
   `<script type="application/ld+json">` via `<Helmet>`, built from the *same*
   `homepage-faq.js` array via `buildHomepageFaqJsonLd()` — visible text and schema
   generated from one source, can't drift apart.
4. **Critical detail found while planning, not obvious from the component code alone**:
   `tools/seo-prerender.js`'s `extractHelmet()` only captures a fixed whitelist of tags
   (title, meta description, canonical, robots, OG, Twitter) via regex — it does **not**
   currently read `<script type="application/ld+json">` blocks out of a component's
   `<Helmet>` at all. The blog-post path gets its JSON-LD into the static prerendered
   HTML a different way: `buildBlogPostHead()` reads `article.jsonLd`/`article.faqJsonLd`
   directly from `blog-articles.json` (data, not Helmet-parsing) and injects it before
   `</head>`. **If the homepage FAQ schema were added only inside `HomePage.jsx`'s
   `<Helmet>` and nothing else changed, it would render correctly for live browsers
   (client-side Helmet DOM update) but would be silently absent from the static
   `dist/index.html` that `seo-prerender.js` ships** — meaning non-JS crawlers, including
   whichever AI bots aren't currently blocked (see AI-bot section below) and any that get
   unblocked later, would see the visible FAQ text (if server/static-rendered) but no
   matching schema, or worse, neither. This is the same class of bug this task exists to
   fix, just relocated. **The plan therefore also requires a small `tools/seo-prerender.js`
   change**: special-case the `/` route (same pattern `prerenderBlog()` already uses for
   blog posts) to import `homepage-faq.js` directly and inject the built JSON-LD into the
   static homepage HTML at build time, independent of the Helmet-regex path.
5. **Removal**: delete the existing hardcoded `FAQPage` block (Schema.org Structured Data
   Block 5) from `index.html` entirely — it becomes the homepage-scoped, content-matched
   version instead of a sitewide phantom block on every route.
6. **Recommended, not blocking**: also add the visible FAQ text to `index.html`'s
   `<noscript>` fallback block, which currently has no FAQ content either (Services,
   Neighborhoods, About George, Service Areas, Contact — no Q&A). Doing so gives the
   most thorough no-JS/crawler alignment, but the core fix (schema scoped to the
   homepage, generated from real visible text, present in the static build) stands
   without it.
7. **Tests**: given this repo's testing discipline for anything touching structured
   data/build output, a small test asserting `homepage-faq.js`'s array and its generated
   JSON-LD stay in sync (same question count, same text) would match house convention —
   proposed, not yet written.

Nothing above has been implemented. Awaiting approval of the Q&A text (edits welcome)
before touching any component, `index.html`, or `seo-prerender.js`.
