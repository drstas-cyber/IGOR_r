# Blog compliance filter — LAST LINE OF DEFENSE, not the fix

This scans each fetched article's title + `content_html` for the compliance
red flags that got the AI-authored blog unpublished in the first place —
exclusivity claims, unsourced tenure/review/urgency stats, named-competitor
disparagement, and wrong DRE/brokerage/phone/email. A tripped article is
**excluded** from the build, never silently rewritten.

**The real fix is upstream, in BabyLoveGrowth's Special Instructions field —
the owner is handling that separately.** This filter exists because content
generation will occasionally drift even with a correct upstream prompt, and
because a human should see what tripped and why before anything ships, not
because pattern-matching English prose is a substitute for controlling what
gets generated in the first place.

**If this filter is tripping constantly once real articles run through it,
that is a signal the upstream prompt is wrong, not a signal to loosen the
patterns.** Loosening the filter to stop it from tripping defeats the point
of having it. Fix the prompt; let the filter go quiet on its own.

## Status: REPORT-ONLY (`BLOG_COMPLIANCE_ENFORCE` unset)

Nothing is currently excluded from any real build — `tools/fetch-blog-data.js`
runs the scan, logs every finding loudly (category + the actual matched
sentence, not just a pass/fail), and writes the full result to
`tools/blog-compliance/last-report.json`, but ships every article regardless.

**Do not set `BLOG_COMPLIANCE_ENFORCE=true`** until the report-only run
against the real 24 (or however many exist by then) articles has been
reviewed for false-positive rate. See "Running it," below — this requires
`BABYLOVE_API_KEY`, which is not available in this development environment
or in GitHub Actions; it only exists as a Cloudflare Pages build variable.

## What's checked, and where each is genuinely uncertain

- **(a) Exclusivity** ("the only agent...") — window-based, not a single
  regex: looks for "only" co-occurring with an agent/professional word
  within 8 words, explicitly excluding "not only" and "the only way to
  [verb]" (both named as expected false positives during design, both
  covered by unit tests). Reasonably precise for the two named idioms;
  untested against real content for other idioms that might exist.
- **(b) Tenure/years-of-experience** — `since <year>` is included and is
  **known to be noisy**: "Since 2020, mortgage rates have moved through
  several cycles" trips it despite having nothing to do with George's
  tenure. Kept in on purpose (real tenure claims often do take this exact
  form) but flagged here so the report-only false-positive count isn't a
  surprise. If the real-data run shows this pattern dominating the trip
  count, that's the first one to reconsider — not by loosening it silently,
  by discussing whether the tradeoff is worth it.
- **(c) Reviews/ratings/stars**, **(d) urgency stats** — straightforward
  regex categories, lower expected false-positive risk, not exercised
  against real content yet either.
- **(e) Named-competitor disparagement** — the least precise category by
  construction. Disparagement is a sentiment judgment; this catches a
  domain-like token near a hand-picked list of negative-sentiment words
  within a 12-word window. It will miss subtle disparagement entirely and
  can flag neutral competitor mentions that happen to share a sentence with
  an unrelated negative word. Treat this category's results as "needs a
  human read," more than the others, not as a reliable automatic verdict.
- **(f) Wrong DRE/brokerage/phone/email** — highest-confidence category:
  checks against exact known-correct values (DRE 02034120, Allison James
  Estates & Homes, 619-277-2766, askgeorgek@gmail.com), so a trip here is
  almost certainly real, not a phrasing artifact.

## Running it

Report-only, against real articles (requires `BABYLOVE_API_KEY` — not
available in this dev environment or CI, only as a Cloudflare Pages build
variable):

```
BABYLOVE_API_KEY=... node tools/fetch-blog-data.js
```

Then read `tools/blog-compliance/last-report.json` (or just the console
output — every finding is logged with its matched sentence) to see the
per-article trip results and false-positive rate before ever considering
`BLOG_COMPLIANCE_ENFORCE=true`.

Unit tests (synthetic articles, no API key needed):

```
node --test tools/blog-compliance/scan.test.mjs
```

## When every article trips

If `BLOG_COMPLIANCE_ENFORCE=true` and 100% of fetched articles trip, the
build fails loudly (a deliberate, narrow exception to
`fetch-blog-data.js`'s otherwise "never fail the build" policy — see that
file's header comment). The blog silently shipping zero articles because a
filter mis-fired would be a worse outcome than a visible build failure. It
does not mean "ship without a blog" — it means stop and look at
`tools/blog-compliance/last-report.json`.
