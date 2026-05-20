/**
 * EmailJS configuration for TVH lead delivery.
 *
 * These 3 IDs are placeholders. Stan must fill them from the EmailJS dashboard
 * BEFORE the preview deploy can be tested end-to-end. See PR description for
 * the dashboard setup spec (one template, all 8 forms reuse it).
 *
 * The Gmail service backing this MUST be a TVH-dedicated account
 * (askgeorgek@gmail.com or a new tvh-system@gmail.com).
 * DO NOT reuse WFL's EmailJS Gmail service — TVH lead emails must not
 * originate from a WFL-branded address.
 */

export const EMAILJS_CONFIG = {
  serviceId:  'service_PLACEHOLDER',
  templateId: 'template_PLACEHOLDER',
  publicKey:  'PLACEHOLDER_PUBLIC_KEY',
};

/**
 * Public phone for fallback messaging when EmailJS send fails.
 * Used by submitLead's send-failed recovery copy.
 */
export const GEORGE_PHONE_DISPLAY = '(619) 277-2766';
export const GEORGE_PHONE_TEL     = '+16192772766';
