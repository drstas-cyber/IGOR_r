/**
 * Google Ads & GA4 conversion tracking helpers.
 * AW ID: AW-18044804522
 * Form Submission Label: J5XxCNy15ZEcEKq7t5xD  (action 7553506012, PRIMARY $100)
 * Phone Click Label: 6MWcCKutt5AcEK6Cu5xD
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

export function trackPhoneClick() {
  if (typeof window.gtag !== 'function') return;

  // Google Ads conversion — Phone Click ($25)
  window.gtag('event', 'conversion', {
    send_to: 'AW-18044804522/6MWcCKutt5AcEK6Cu5xD',
    value: 25.0,
    currency: 'USD',
  });

  window.gtag('event', 'phone_click', {
    event_category: 'engagement',
    event_label: 'click_to_call',
  });
}
