/**
 * Google Ads & GA4 conversion tracking helpers.
 *
 * Usage: call trackFormSubmission() after a successful form POST.
 * Replace AW-XXXXXXXXX/CONVERSION_LABEL with real values from Google Ads.
 */

export function trackFormSubmission(formName, formData = {}) {
  if (typeof window.gtag !== 'function') return;

  // GA4 event — can be imported as a Google Ads conversion in the UI
  window.gtag('event', 'generate_lead', {
    event_category: 'form',
    event_label: formName,
    value: formName === 'home_value' ? 50 : formName === 'mls_search' ? 30 : 20,
    currency: 'USD',
    ...formData,
  });

  // Google Ads conversion — replace with real conversion action ID + label
  // You'll get these from Google Ads > Tools > Conversions > New conversion action
  window.gtag('event', 'conversion', {
    send_to: 'AW-XXXXXXXXX/CONVERSION_LABEL',
    value: formName === 'home_value' ? 50 : formName === 'mls_search' ? 30 : 20,
    currency: 'USD',
  });
}

export function trackPhoneClick() {
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'conversion', {
    send_to: 'AW-XXXXXXXXX/PHONE_CLICK_LABEL',
  });

  window.gtag('event', 'phone_click', {
    event_category: 'engagement',
    event_label: 'click_to_call',
  });
}
