// ApexIDX (MLS/IDX vendor) outbound search URLs. Single source of truth so all
// call sites share one UTM taxonomy and one place to update if ApexIDX changes
// its URL scheme.
const UTM_BASE = 'utm_source=tvh&utm_medium=referral&utm_campaign=search_homes';

// Empty ApexIDX search form — visitor searches manually from here. Current
// destination for footer / nav / buyer-LP "Search Homes" links.
const APEX_ADVANCED_SEARCH_BASE = 'https://apexidx.com/idx_lite/advancedsearch/EN_LA';
export function apexAdvancedSearchUrl(utmContent) {
  return `${APEX_ADVANCED_SEARCH_BASE}?${UTM_BASE}&utm_content=${utmContent}`;
}

// Temecula-city-scoped results. "508" is ApexIDX's internal numeric city ID
// for Temecula, with no stability guarantee from ApexIDX — it is NOT a
// documented public parameter.
//   - Captured: 2026-07-24, by submitting the advancedsearch form above with
//     City = "Temecula" (typeahead — type "Temecula", click the suggestion
//     chip, not just plain text entry) and reading the resulting URL.
//   - Shortened from the form's raw output where segments were confirmed
//     no-ops: dropped `active,short-sales,foreclosures_homeStatus` (461
//     results with or without it — already ApexIDX's default) and
//     `home,Townhouse_homeType` (confirmed to silently exclude condo/
//     multi-family/land — 455 vs 461 results with it removed).
//   - `lastModified_orderBy/desc_order` (newest-first) was KEPT, not
//     dropped — confirmed NOT a no-op: without it, the bare URL's default
//     order is Price (Highest to Lowest), a completely different ordering
//     (first result jumps from a $600K "New" listing to an $8.995M listing).
//     With the segment, the page's own sort dropdown shows "New or Modified
//     (Newest to Oldest)" selected and every visible result is flagged "New".
//   - Re-verify this ID any time ApexIDX changes vendors/platforms, or if a
//     link audit reports zero/anomalous results on it — see Phase 1.5 crawl
//     scope, which includes these 9 URLs explicitly.
const APEX_CITY_RESULTS_BASE =
  'https://apexidx.com/idx_lite/results/EN_LA/lastModified_orderBy/desc_order/508_city';
export function apexSearchUrl(utmContent) {
  return `${APEX_CITY_RESULTS_BASE}?${UTM_BASE}&utm_content=${utmContent}`;
}
