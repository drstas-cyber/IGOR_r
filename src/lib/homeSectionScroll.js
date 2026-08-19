// Single source of truth for the homepage's in-page section ids (2026-08-19
// nav-hash audit). Consumed by: HomePage.jsx's cold-load/hash-change
// scroll effect, StickyNavigation.jsx and Navigation.jsx's route-aware
// nav-item hrefs, and HashSectionRedirect.jsx's cold-load safety net.
// Centralizing this list is the actual fix for the root-cause class of bug
// found in this audit -- Navigation.jsx had its own, independently-typed
// id strings ('homevalue', 'about', 'alerts') that silently drifted out of
// sync with the real section ids ('home-value', 'about-george',
// 'listing-alerts') the moment either side changed. One list, everywhere.

// Real <section id="..."> elements that currently exist on the homepage
// (HomeValueForm.jsx, AgentBioSection.jsx, ContactForm.jsx,
// ListingAlertsSection.jsx) — every nav item that should scroll-to-section
// targets one of these.
export const HOME_SECTION_IDS = ['home-value', 'about-george', 'contact', 'listing-alerts'];

// Stale ids that used to appear (or could still appear, via an old
// bookmark/shared link) in a nav href, but correspond to no DOM element
// anywhere anymore. 'search'/'mls-search': the homepage's old in-page MLS
// search section was removed when it was replaced by a real outbound
// ApexIDX link (see docs/ad_copy_archive.md's "What the site actually is"
// history) — Navigation.jsx's "Search" item still pointed at the dead
// '#search'/'id:search' target until this same audit fixed it to be an
// external link, matching StickyNavigation's "Search Homes". These ids
// exist here ONLY so a cold-loaded legacy URL still lands somewhere live
// (the homepage) instead of dead-ending on whatever route it arrived on —
// see resolveHashRedirect() below. Never a retry-scroll target: there is
// nothing to scroll to.
export const LEGACY_HOME_HASH_IDS = ['search', 'mls-search'];

function hashId(hash) {
  return typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : null;
}

// isKnownHomeSectionHash (exported) — true only for a hash whose id has a
// real, currently-rendered homepage section to scroll to.
export function isKnownHomeSectionHash(hash) {
  const id = hashId(hash);
  return id != null && HOME_SECTION_IDS.includes(id);
}

// isLegacyHomeHash (exported) — true only for a hash that used to mean
// something nav-wise but has no live target anymore.
export function isLegacyHomeHash(hash) {
  const id = hashId(hash);
  return id != null && LEGACY_HOME_HASH_IDS.includes(id);
}

// homeHashHref (exported) — the one route-aware href-construction rule
// every nav component shares: on the homepage itself, a bare in-page hash
// (native browser anchor scroll, CSS smooth-scroll already handles the
// animation — unchanged, current behavior); on any other route, "/#id"
// for a <Link> SPA navigation home, where HomePage's own effect (see
// HomePage.jsx) takes over and scrolls once the target section has
// rendered.
export function homeHashHref(id, pathname) {
  return pathname === '/' ? `#${id}` : `/#${id}`;
}

// resolveHashRedirect (exported) — pure decision logic for
// HashSectionRedirect.jsx, the cold-load safety net. Given the current
// location, decides whether a non-home route carrying a home-section (or
// legacy) hash should redirect to the homepage, and with what hash (or
// none, for a legacy id with nothing to scroll to). Never touches the
// homepage itself (HomePage owns its own hash-scroll) and never redirects
// a hash it doesn't recognize -- an in-article anchor (a future
// #footnote-3, say) must never be treated as a homepage section by
// accident.
export function resolveHashRedirect({ pathname, hash }) {
  if (pathname === '/') return { redirect: false };
  if (!hash) return { redirect: false };
  if (isKnownHomeSectionHash(hash)) return { redirect: true, to: `/${hash}` };
  if (isLegacyHomeHash(hash)) return { redirect: true, to: '/' };
  return { redirect: false };
}
