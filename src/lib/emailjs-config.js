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

// IDs confirmed live 2026-05-19.
// The publicKey is designed to be client-visible — it identifies the EmailJS
// account but cannot be used to bypass dashboard-side template/service config
// or rate limits. NOT a leaked secret; do not move to env vars.
export const EMAILJS_CONFIG = {
  serviceId:  'service_m0mb7w6',
  templateId: 'template_rk917on',
  publicKey:  'aLjoOd891WEIaH5we',
};

/**
 * Public phone for fallback messaging when EmailJS send fails.
 * Used by submitLead's send-failed recovery copy.
 */
export const GEORGE_PHONE_DISPLAY = '(619) 277-2766';
export const GEORGE_PHONE_TEL     = '+16192772766';
