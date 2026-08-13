# Phone-click tracking notes

## 2026-08-03 — removed dead `trackPhoneClick()` from `src/lib/tracking.js`

`trackPhoneClick()` fired the Google Ads conversion action
`AW-18044804522/6MWcCKutt5AcEK6Cu5xD` ($25) plus a GA4 `phone_click` event.
It had **zero call sites** anywhere in the codebase (confirmed via repo-wide
grep before deletion) — no component ever imported or invoked it. It was
dead code, not a disabled/parallel tracking path.

Phone-click conversions are, and were already, tracked by a different
mechanism: a single delegated click listener in `index.html` that matches
any `<a href="tel:...">` on the page (`href.indexOf('tel:') === 0`, prefix
match, not exact-string) and fires the Google Ads conversion action
`AW-18044804522/LL2DCN-15ZEcEKq7t5xD` ($50). That listener was not touched
by this change and remains the sole live phone-tracking path.

**Manual follow-up owed (account-side, not code):** the unused $25
conversion action `AW-18044804522/6MWcCKutt5AcEK6Cu5xD` still exists in the
Google Ads account and should be retired (paused/removed) in the Google Ads
UI by Stan. Nothing in this repo fires it anymore, so leaving it live in
the Ads account serves no purpose and just adds clutter to the conversions
list.

## 2026-08-13 — live $25 mailto action: account-confirmed

The delegated `mailto:` click listener in `index.html` fires
`AW-18044804522/aBETCNm15ZEcEKq7t5xD` ($25, GA4 `email_click`). This is a
**different** conversion action from the dead `6MWcCKutt5AcEK6Cu5xD` above —
same value, unrelated ID, do not conflate the two when auditing the Ads
account. Confirmed in the Google Ads account as **Email Click, Secondary**
category. Live and correctly wired; no follow-up needed.

## Standing warning — do not add a manual route-change `page_view`

SPA `page_view`s are handled by **GA4 Enhanced Measurement**
(`pageChangesEnabled: true`, verified 2026-08-12). GA4 already listens for
History API navigation (react-router-dom's client-side route changes) and
fires `page_view` on its own. **Never add a manual `gtag('event',
'page_view', ...)` (or equivalent) on route change** — Enhanced Measurement
will fire its own `page_view` for the same navigation, and the two will
double-count every SPA page view in GA4 reporting. If a future session
needs to instrument route changes, use a distinctly-named custom event
(e.g. `spa_route_change`), never `page_view` itself.
