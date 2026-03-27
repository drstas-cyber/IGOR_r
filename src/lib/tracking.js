/**
 * Google Ads & GA4 conversion tracking helpers.
 * AW ID: AW-18044804522
 * Lead Form Label: Xuj2CIyqyJAcEKq7t5xD
 * Phone Click Label: 6MWcCKutt5AcEK6Cu5xD
 */

export function trackFormSubmission(formName, formData = {}) {
  if (typeof window.gtag !== 'function') return;

  // GA4 event — can be imported as a Google Ads conversion
  window.gtag('event', 'generate_lead', {
    event_category: 'form',
    event_label: formName,
    value: formName === 'home_value' || formName === 'home_value_russian' ? 50 : formName === 'mls_search' ? 30 : 20,
    currency: 'USD',
    ...formData,
  });

  // Google Ads conversion — Lead Form Submission ($50)
  window.gtag('event', 'conversion', {
    send_to: 'AW-18044804522/Xuj2CIyqyJAcEKq7t5xD',
    value: 50.0,
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
