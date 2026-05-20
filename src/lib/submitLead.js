import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG, GEORGE_PHONE_DISPLAY, GEORGE_PHONE_TEL } from './emailjs-config';
import { validateSubmission } from './antispam';
import { trackFormSubmission } from './tracking';
import { readAttribution } from './attribution';

/**
 * Centralized lead submission for ALL 8 TVH forms.
 *
 * Replaces the prior per-form FormSubmit.co fetch. Single helper means a
 * future bug in this path lives in ONE place, not 8.
 *
 * Critical ordering (the conv-silence fix):
 *   1. Validate (honeypot / 2s bot timer / spam patterns) — same gates as before
 *   2. If validated, FIRE THE CONVERSION PIXEL FIRST, BEFORE any network call.
 *      trackFormSubmission() fires both:
 *        - gtag('event', 'generate_lead', ...)
 *        - gtag('event', 'conversion', {send_to: 'AW-18044804522/J5XxCNy15ZEcEKq7t5xD', value: 100})
 *      Decoupling intent: a validated user submitted a lead — true regardless of
 *      whether the email reaches George. Pre-2026-05-19 the conversion was gated
 *      behind FormSubmit.co's response.ok, so a 522 origin-timeout (which is what
 *      we hit for 17 days) killed conversions AND leads in lockstep. Never again.
 *   3. THEN call emailjs.send(). On success, return ok:true. On failure, return
 *      a DISTINCT error state with George's phone as a recovery path — the
 *      caller MUST surface this visibly. Silent error-swallow (bare catch{}) is
 *      what masked the 17-day outage on ContactPage/SellMyHousePage.
 *
 * Return shape:
 *   { ok: true,  lead_id }
 *   { ok: false, reason: 'blocked',     detail }                  — anti-spam stopped it
 *   { ok: false, reason: 'send_failed', error, recoveryMessage,
 *                recoveryPhoneDisplay, recoveryPhoneTel }         — EmailJS failed
 *                                                                   (conversion ALREADY fired)
 */
export async function submitLead({ form_name, raw, extra = {} }) {
  const fields = normalize(raw);

  // 1. Validate
  const check = validateSubmission({
    email:        fields.email,
    name:         fields.name,
    message:      fields.message,
    website_url:  fields.website_url,
  });
  if (check.blocked) {
    return { ok: false, reason: 'blocked', detail: check.reason };
  }

  // 2. FIRE CONVERSION FIRST — must precede any network call so a third-party
  //    outage cannot break attribution again.
  //    trackFormSubmission internally fires both generate_lead AND the Ads
  //    conversion (action 7553506012, label J5XxCNy15ZEcEKq7t5xD, $100).
  try {
    trackFormSubmission(form_name, { form_name, ...extra });
  } catch (e) {
    // tracking must never block the lead. log + continue.
    if (typeof console !== 'undefined') console.warn('[submitLead] trackFormSubmission threw', e);
  }

  // 3. Build EmailJS payload — covers every variable the universal template references
  const attribution = readAttribution();
  const payload = {
    form_name,
    inquiry_type:     extra.inquiry_type || fields.intent || fields.subject || form_name,
    name:             fields.name             || '',
    phone:            fields.phone            || '',
    email:            fields.email            || '',
    message:          fields.message          || extra.message || '',
    property_address: fields.property_address || fields.address || '',
    neighborhood:     fields.neighborhood     || '',
    budget:           fields.budget           || '',
    timeline:         fields.timeline         || fields.selling_timeline || '',
    submitted_at:     new Date().toISOString(),
    lead_id:          makeLeadId(form_name),
    page_url:         (typeof window !== 'undefined') ? window.location.href : '',
    gclid:            attribution.gclid,
    fbclid:           attribution.fbclid,
    utm_source:       attribution.utm_source,
    utm_medium:       attribution.utm_medium,
    utm_campaign:     attribution.utm_campaign,
    utm_content:      attribution.utm_content,
    utm_term:         attribution.utm_term,
    referrer:         attribution.referrer,
    landing_page:     attribution.landing_page,
  };

  // 4. Send via EmailJS
  try {
    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      payload,
      EMAILJS_CONFIG.publicKey,
    );
    return { ok: true, lead_id: payload.lead_id };
  } catch (e) {
    if (typeof console !== 'undefined') console.error('[submitLead] EmailJS send failed', e);
    return {
      ok: false,
      reason: 'send_failed',
      error: (e && (e.text || e.message)) || 'unknown',
      recoveryMessage:      `We couldn't deliver your message right now. Please call George directly at ${GEORGE_PHONE_DISPLAY}.`,
      recoveryPhoneDisplay: GEORGE_PHONE_DISPLAY,
      recoveryPhoneTel:     GEORGE_PHONE_TEL,
    };
  }
}

function normalize(raw) {
  if (!raw) return {};
  if (typeof FormData !== 'undefined' && raw instanceof FormData) {
    const obj = {};
    for (const [k, v] of raw.entries()) obj[k] = typeof v === 'string' ? v : '';
    return obj;
  }
  return { ...raw };
}

function makeLeadId(form_name) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `tvh_${form_name}_${ts}_${rand}`;
}
