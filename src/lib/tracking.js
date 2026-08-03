/**
 * Google Ads & GA4 conversion tracking helpers.
 * AW ID: AW-18044804522
 * Form Submission Label: J5XxCNy15ZEcEKq7t5xD  (action 7553506012, PRIMARY $100)
 *
 * Phone-click tracking is NOT handled here — see the delegated tel: click
 * listener in index.html (label LL2DCN-15ZEcEKq7t5xD, $50), the live path.
 * See docs/tracking-notes.md for the removal history of the dead
 * trackPhoneClick() helper that used to live in this file.
 */

export function trackFormSubmission(formName, formData = {}) {
  if (typeof window.gtag !== 'function') return;

  // GA4 event — differentiates lead intent for behavioral analysis (value here is the
  // GA4 event value, not the Ads conversion value below).
  window.gtag('event', 'generate_lead', {
    event_category: 'form',
    event_label: formName,
    value: formName === 'home_value' || formName === 'home_value_russian' ? 50 : formName === 'mls_search' ? 30 : 20,
    currency: 'USD',
    ...formData,
  });

  // Google Ads conversion — PRIMARY Form Submission ($100). Must match the
  // primary-for-goal conversion action so Smart Bidding can optimize. Previously
  // pointed at Xuj2CIyqyJAcEKq7t5xD (non-PRIMARY $50), which was invisible to bidding.
  window.gtag('event', 'conversion', {
    send_to: 'AW-18044804522/J5XxCNy15ZEcEKq7t5xD',
    value: 100.0,
    currency: 'USD',
  });
}

// Outbound MLS-search click (nav/footer "Search Homes" → ApexIDX). GA4 engagement
// event only — no Ads conversion, since the destination is a third-party domain.
export function trackSearchHomesClick(location) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'click_search_homes', {
    event_category: 'engagement',
    event_label: location,
    location,
  });
}

// Outbound neighborhood-card click (NeighborhoodsGrid → ApexIDX, city-scoped).
// GA4 engagement event only — same reasoning as trackSearchHomesClick above.
export function trackNeighborhoodSearchClick(slug) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'click_neighborhood_search', {
    event_category: 'engagement',
    event_label: slug,
    neighborhood: slug,
  });
}
