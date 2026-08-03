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
