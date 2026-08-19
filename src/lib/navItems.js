// Plain-data nav item lists, extracted out of StickyNavigation.jsx and
// Navigation.jsx (2026-08-19 nav-hash audit) specifically so they're
// importable by `node --test` — Node's module loader refuses to parse a
// file containing JSX at all, regardless of whether the particular export
// needed is itself JSX-free (same reason src/lib/scrollToTop.js exists as
// a plain .js sibling of ScrollToTop.jsx; see that file's header comment).
// The two components import these arrays and render them; this file is
// the single place a "which id does this label point at" drift-guard test
// (navItems.test.mjs) can check against homeSectionScroll.js's canonical
// HOME_SECTION_IDS without ever touching React/JSX.
import { apexAdvancedSearchUrl } from './apexSearch.js';

// Outbound MLS search (ApexIDX). New tab; rel="noopener noreferrer" — the site's
// Referrer-Policy (strict-origin-when-cross-origin) already caps any cross-origin
// referrer to the bare origin, so dropping the path/query via noreferrer loses no
// attribution ApexIDX didn't already lack; utm_content on the URL is the real signal.
const APEX_SEARCH_NAV_URL = apexAdvancedSearchUrl('nav');
const APEX_SEARCH_NAV_SUBPAGE_URL = apexAdvancedSearchUrl('nav_subpage');

// STICKY_NAV_ITEMS — StickyNavigation.jsx (rendered on: HomePage,
// BuyerHomesPage, AboutGeorgePage). Three item shapes:
//   - `external: true` — outbound link (ApexIDX), unaffected by route.
//   - `to` — a real page route, always a <Link>, unaffected by route.
//   - `sectionId` — a homepage <section id="...">; resolved through
//     homeHashHref(), route-aware: bare "#id" (in-page scroll, unchanged)
//     on the homepage itself, "/#id" (SPA <Link> home, then HomePage's own
//     effect scrolls) everywhere else. Before this audit, every
//     `sectionId` item was a bare href="#id" that only ever worked on "/".
export const STICKY_NAV_ITEMS = [
  { label: 'Search Homes', href: APEX_SEARCH_NAV_URL, external: true },
  { label: 'Home Value', sectionId: 'home-value' },
  { label: 'About George', sectionId: 'about-george' },
  { label: 'Blog', to: '/blog/' },
  { label: 'Contact', sectionId: 'contact' },
];

// SUBPAGE_NAV_ITEMS — Navigation.jsx (rendered on every page StickyNavigation
// does NOT cover: every blog article, the blog index, /contact/, /sell-my-
// house/). Never rendered on the homepage — every `sectionId` item here is
// unconditionally the cross-page "/#id" form, no route check needed (unlike
// StickyNavigation, which also renders on "/" itself).
//
// Before this audit: 'Search' pointed at id 'search' (no such element
// exists anywhere — the homepage's old in-page MLS search section was
// removed when it was replaced by this same outbound ApexIDX link, see
// docs/ad_copy_archive.md's "What the site actually is" history);
// 'Home Value'/'About'/'Alerts' pointed at 'homevalue'/'about'/'alerts' —
// none of which match the real ids ('home-value'/'about-george'/
// 'listing-alerts'). Every item on this page was silently dead. 'Contact'
// (→ the real /contact/ route) and the missing 'Blog' item are the two
// exceptions: Contact was already correct (untouched here), Blog didn't
// exist before and is added for parity with StickyNavigation.
export const SUBPAGE_NAV_ITEMS = [
  { label: 'Search', href: APEX_SEARCH_NAV_SUBPAGE_URL, external: true },
  { label: 'Home Value', sectionId: 'home-value' },
  { label: 'About', sectionId: 'about-george' },
  { label: 'Blog', to: '/blog/' },
  { label: 'Contact', to: '/contact/' },
  { label: 'Alerts', sectionId: 'listing-alerts' },
];
