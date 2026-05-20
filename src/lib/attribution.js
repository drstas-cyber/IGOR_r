/**
 * First-touch attribution capture for TVH leads.
 *
 * Captures gclid/fbclid/utm_* on the FIRST page-load of the session into
 * sessionStorage. Subsequent internal navigation (which strips URL params)
 * preserves the original attribution because we read from storage, not the
 * current URL.
 *
 * Cross-session first-touch (localStorage / cookie) is deliberately NOT
 * implemented in this PR — that's a follow-up. Same-session capture is the
 * minimum required so the navigate-then-submit path (ad → LP → /contact → submit)
 * carries the gclid all the way to the EmailJS payload.
 */

const STORAGE_KEY = 'tvh_attribution';

const URL_FIELDS = [
  'gclid', 'fbclid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
];

/**
 * Capture-once: write current page's attribution to sessionStorage if not
 * already present. Called from App.jsx on mount.
 *
 * Best-effort: any storage / URL access failure is silently swallowed —
 * attribution is auxiliary, never block page render.
 */
export function captureFirstTouch() {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const attr = {};
    for (const f of URL_FIELDS) attr[f] = params.get(f) || '';
    attr.referrer = (typeof document !== 'undefined' && document.referrer) || '';
    attr.landing_page = window.location.pathname;
    attr.captured_at = new Date().toISOString();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attr));
  } catch {
    // sessionStorage can throw in private mode or with cookies disabled —
    // ignore. readAttribution will fall back to live URL.
  }
}

/**
 * Read attribution at submit time. Prefers stored first-touch values; falls
 * back to current URL params if storage is empty (e.g., user landed directly
 * on /contact/ with attribution params still in URL).
 */
export function readAttribution() {
  let stored = {};
  try {
    const raw = (typeof window !== 'undefined') ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (raw) stored = JSON.parse(raw) || {};
  } catch {
    stored = {};
  }
  const live = (typeof window !== 'undefined')
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams('');

  const pick = (k) => stored[k] || live.get(k) || '';
  return {
    gclid:        pick('gclid'),
    fbclid:       pick('fbclid'),
    utm_source:   pick('utm_source'),
    utm_medium:   pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content:  pick('utm_content'),
    utm_term:     pick('utm_term'),
    referrer:     stored.referrer    || (typeof document !== 'undefined' ? document.referrer : ''),
    landing_page: stored.landing_page || (typeof window !== 'undefined' ? window.location.pathname : ''),
  };
}
