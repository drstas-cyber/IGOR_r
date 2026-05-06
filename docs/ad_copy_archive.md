# Ad Copy Archive — Russian-Realtor-Flavored (intended-for-future-russian-ad-group)

**Status:** Three Temecula Buyers ad-group RSAs paused 2026-05-04, kept paused 2026-05-06 to avoid Frankenstein-ing onto `/homes-for-sale-temecula/` (different intent than copy). Total accumulated cost across the three: ~$398.35 over 90 days, **0 conversions** when serving against `/contact/`.

**Intent:** Preserve the creative work for a future dedicated **Russian-Speaking Realtor ad group** (the planned 4-ad-group restructure — see project memory). Same copy, paired with Russian-search keywords and `/russian-speaking-realtor-temecula/` as the destination, may convert. The copy is "Russian-speaking realtor" positioning regardless of search intent — it landed on the wrong combination of (English buyer keywords) × (`/contact/` LP) and produced 0 conversions, but that does not mean the copy is dead.

The fifth ad in the same family (807456288145) — **byte-identical copy** but pointing at `/` (homepage) — produced **2 conversions in 90d at $45.52 CPA**. Strong evidence that this copy converts when the destination has full agent context, not when it lands on a form-only contact page.

---

## Ad 805651137818 (paused, was → /contact/, $47.92 / 27 clicks / 0 conv)
**Display path:** `/Russian-Realtor/Temecula`

### Headlines
1. Top Rated Temecula Realtor *(pinned to position 2)*
2. 14+ Years Temecula Expert
3. George Khazanovskiy, Realtor
4. Temecula Murrieta Menifee
5. 100.1% Sale-to-List Ratio
6. Homes Sell in 25 Days Average
7. Speak With George Directly
8. Free Buyer/Seller Consultation
9. Allison James Estates & Homes
10. Licensed DRE #02034120
11. Five-Star Reviewed Realtor
12. Available 7 Days a Week
13. No Pressure Free Consultation
14. English, Russian, Ukrainian
15. Only Russian-Speaking Realtor

### Descriptions
1. Only Russian & Ukrainian-speaking realtor in Temecula Valley. 14+ yrs. 5-star rated.
2. Serving English, Russian & Ukrainian families across Temecula, Murrieta, Menifee.
3. Trilingual service sets George apart. Allison James Estates & Homes. Call today.
4. Get a 5-star realtor who speaks your language. Free search & valuations. No obligation.

---

## Ad 805972345804 (paused, was → /contact/, $15.97 / 9 clicks / 0 conv)
**Display path:** `/Russian-Realtor/Temecula`

**Headlines + descriptions: byte-identical to ad 805651137818 above.** Was a duplicate.

---

## Ad 806107473080 (paused, was → /contact/, $334.46 / 131 clicks / 0 conv) — highest-spend in family
**Display path:** `/Russian-Realtor/Temecula`

**Headlines + descriptions: byte-identical to ad 805651137818 above.** Was the highest-spend duplicate.

---

## When to use this copy

The natural home for these RSAs is a future **Russian-Speaking Realtor ad group** with:
- **Keywords:** `русскоязычный риэлтор`, `russian speaking realtor temecula`, `ukrainian speaking realtor`, etc. (English transliteration + Cyrillic; pull search-volume estimates first via `_tvh_russian_search_volume.js`)
- **Geo:** Temecula DMA (Temecula, Murrieta, Menifee, Winchester, Lake Elsinore, Wildomar, Fallbrook)
- **Final URL:** `https://temeculavalleyhomes.us/russian-speaking-realtor-temecula/`
- **Display path:** `/Russian-Realtor/Temecula` (the existing path, which then matches both copy intent and destination)

When recreating, only **one** RSA needs this copy verbatim — the other two slots in the new ad group should be variant copy testing different angles (e.g., emphasis on Ukrainian vs Russian, family-relocation vs first-time-buyer, etc.).

## Reference IDs (for resurrection)

| Original Ad ID | Final URL when paused | 90d cost | 90d clicks | 90d conv |
|---|---|---|---|---|
| 805651137818 | /contact/ | $47.92 | 27 | 0 |
| 805972345804 | /contact/ | $15.97 | 9 | 0 |
| 806107473080 | /contact/ | $334.46 | 131 | 0 |

These ads remain in the account in PAUSED state. Re-enabling them in Temecula Buyers without changing the URL would put them right back in the same broken combination. Either:
1. Delete them and recreate fresh in the future Russian-Speaking Realtor ad group, OR
2. (Not recommended) Re-enable in a new ad group with destination + keywords properly aligned. Issues: ad ID is bound to its current ad group, can't be moved.

Recommendation: archive only — recreate fresh when the Russian ad group is built.

---

# Site Substantiation — what the buyer LP can and cannot claim

**Load-bearing context for any future ad copy session, terminal-Claude or otherwise.** Recorded 2026-05-06 after a substantiation walkthrough during the buyer-LP RSA drafting that revealed the site doesn't deliver what buyer-intent ad copy implies.

## What the site actually is right now

The TVH site is a **brochure-with-a-form**, not the IDX-powered home-search experience the historical ad copy implied. The user-facing components break down as:

- **`FeaturedListings.jsx`** — three **hardcoded fake listings** with stock Unsplash photos. The "View Details" button just dials `tel:6192772766`. There is no IDX feed, no MLS API call, no live data anywhere.
- **`MLSSearchSection.jsx`** — a **gated lead-capture modal**. Click → name + email form → submit → "redirecting to CRMLS" message. It is the opposite of "free MLS access, no login."
- **`GoogleReviews.jsx`** — three **hardcoded reviews** matching the names in the schema.org review block. No Google Business Profile API integration.
- `index.html` schema — `aggregateRating` is hardcoded `"5.0"` / `"23 reviews"`. Birdeye independently shows 5.0 / 12 reviews. The 23-count is unverified against any source. **Until the live GBP rating is confirmed and the schema/component are wired to real data, every "5-Star Google Rating" claim across the site rests on an unverified hardcoded number.**

## Claims that are FALSE on the current site (do not use in copy)

These cannot ship until either the site builds the feature or the copy is rewritten to be honest about what's offered:

- "Live MLS"
- "Daily MLS Updates"
- "MLS-Listed Homes" (when used in a way that implies real-time IDX)
- "Free MLS Access"
- "No Login"
- "All Active Listings"
- "Recently Sold Comparables" (no buyer-facing sold feature; sold copy only exists in `HomeValueForm` / `SellMyHousePage` for sellers)
- "Open House This Weekend" / any open-house framing (zero open-house feature on the site)
- "Get Pre-Approved Help" / "Lender Partnership" / "Mortgage Help" (no lender relationship integrated)

## Claims that are PARTIAL — true as market context, false as site-feature claim

These are defensible as **market statements** about Temecula but become misleading the moment they imply the site lets a buyer act on them:

- "Homes Under $600K" / "Homes from $480K" — true that several Temecula neighborhoods have median <$600K (Old Town $480K, Vail Ranch $510K, Redhawk $545K, Paloma Del Sol $575K per schema). False that the site filters or surfaces such listings. Frame as market context only ("Temecula median: $740K", "Temecula homes from $480K — market data") not as filterable inventory.
- "Murrieta + Menifee Homes" — site lists these in `areaServed` schema. Site does NOT display Murrieta/Menifee listings. Frame as service-area, not destination ("Serving Murrieta + Menifee").
- "5-Star Google Rating" — schema says 5.0/23, Birdeye says 5.0/12. Use **"Top Rated"** or **"Five-Star Reviewed"** as platform-agnostic phrasing instead, which Birdeye 5.0/12 substantiates. Drop "Google" until the actual GBP rating is verified by the user.
- "Tour Homes With George" — generic realtor service. Defensible.
- "7 days a week, 2-hr response" — substantiated in 4 places on the site (`AgentBioSection`, `Footer`, `ContactForm`, `HomeValueForm`) and in `openingHoursSpecification` schema. Defensible **if George literally honors it.** Aspirational use is a substantiation problem on multiple surfaces.

## Claims that are TRUE and safe to use

Every assertion in this list is grounded in identity, public records, or content that is consistent across the site without depending on a feature the site doesn't have:

- **Identity:** George Khazanovskiy, Realtor® / George K.
- **License:** DRE #02034120 (verifiable via CalDRE public lookup)
- **Brokerage:** Allison James Estates & Homes (full registered name)
- **Experience:** "14+ years Temecula expertise" (verify the founding year — DRE public record will show original license issue date)
- **Languages:** Trilingual: English, Russian, Ukrainian (claimed throughout site + `knowsLanguage` schema)
- **Free consultation / free buyer consultation / free home valuation** — standard real-estate offer, supported by site offer schema
- **No-obligation / no-pressure** framing — service positioning, defensible
- **Service area** (Temecula, Murrieta, Menifee, Winchester, Lake Elsinore, Wildomar, Fallbrook) — schema `areaServed`
- **Real Temecula neighborhoods** (Wolf Creek, Wine Country, Redhawk, Paloma Del Sol, Old Town, Vail Ranch, Morgan Hill, Crown Hill) — schema `ItemList` with median prices
- **Market stats** ($740K median, "100.1% sale-to-list ratio", "homes sell in 25 days average") — schema FAQ block. **Market stats are aggregated and need updating periodically**, but as long as they reflect current Temecula market data they're defensible.
- **Office address** (30777 Rancho California Rd, Temecula, CA 92592)
- **Phone** ((619) 277-2766) — public contact

## California DRE compliance — required on every Google Search text ad

Per B&P Code §10140.6(b), all "first point of contact" advertising materials must include the licensee's **name + license number + responsible broker**. The exemptions are only for radio, TV, streaming video/audio openings, and "for sale" signs. **Google Search text ads are not exempt** — they're electronic-media first-point-of-contact materials, equivalent to print advertising for compliance purposes.

Every TVH Google Ads RSA must therefore include in the headline pool:
- Agent name (e.g., "George Khazanovskiy, Realtor®")
- DRE number (e.g., "DRE #02034120")
- Responsible broker (e.g., "Allison James Estates & Homes")

For a regulated industry, the conservative practice is to **pin all three to fixed positions** (P1, P2, P3 of the 3 visible headline slots) so they always display regardless of which subset of 15 headlines the optimizer selects. This locks the visible creative but maximizes regulatory safety.

## The "build IDX or change the language" decision

The substantiation gap will keep biting any future ad copy session unless one of two things happens:
1. **Build real IDX integration** — replace `FeaturedListings.jsx` static array with live IDX feed, replace `MLSSearchSection.jsx` gated form with a real free-search experience, replace `GoogleReviews.jsx` hardcoded array with the official Google Business Profile widget. Estimated effort: 1-2 weeks engineering + $40-100/mo IDX feed cost.
2. **Change the language** — adjust on-site copy to stop implying features that aren't there. "MLS Search" → "Get Listings Sent to You". "Free MLS Access" → "Free Buyer Consultation". Static "Featured Listings" → labeled "Recent Examples" or "Sample Properties". Lower-effort but constrains how the site presents itself.

Until this is resolved, any ad copy session must filter draft headlines through the FALSE/PARTIAL/TRUE buckets above. The site is the substantiation surface.

## Pointer for future sessions

If you are an AI agent (terminal Claude, Cowork, etc.) about to draft TVH ad copy, **read this section before drafting**. Pulling claims from positioning copy or competitor analysis without filtering through this list will produce non-shippable drafts. The May 2026 RSA-drafting session that surfaced this gap took multiple iterations to converge on substantiated copy — that round-trip is now permanent context, not session-specific knowledge.

