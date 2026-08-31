// Deterministic backstop for over-eager self-review link stripping
// (2026-08-19). prompt.md's "Validate internal links against the list"
// paragraph (fixed 2026-08-12, see README.md) gives the self-review model
// the same Known live routes list the draft pass used, with explicit
// keep-if-exact-match instructions -- but it's still an LLM judgment call
// about string equality, and it can get that judgment wrong even with the
// list in hand. Observed live: PR #32 (Paloma Del Sol, 2026-08-17) stripped
// six links whose URLs were verbatim, exact matches to entries on the list
// it was given -- including two to real, live articles (redhawk, wolf-creek)
// -- citing "extra trailing slash / mismatch" that did not actually exist.
// internalLinkGate.mjs's fail-closed gate never malfunctioned here (there
// was nothing invalid left to catch); the loss was entirely on the
// "wrongly removed something good" side, which no gate up to this point
// was checking for.
//
// This function does exactly one thing: for every anchor in the DRAFT
// whose href is an exact match (per internalLinkGate.mjs's own normalize())
// to a known route, if that anchor is missing from self-review's output,
// restore it -- but ONLY when it's unambiguous where to put it back (the
// anchor text survives as a single, not-already-anchored occurrence in the
// reviewed HTML). Anything ambiguous is left alone and reported in
// `skipped`, never guessed at. This is deliberately narrow: it does not
// second-guess a strip of a genuinely invalid link (that's not this
// function's job, and internalLinkGate.mjs remains the fail-closed
// backstop for anything that slips through both self-review and this pass).
//
// PENDING REMOVAL (2026-08-31, owner ruling item 2, manual-publish
// formalization): self-review no longer receives the Known live routes
// list at all and is explicitly instructed not to touch internal links --
// see generate.mjs's selfReview() and prompt.md's "Do not touch internal
// links during self-review" paragraph. That's the actual root fix; this
// module stays wired in as defense-in-depth ONLY until it proves out
// against real runs (success = a run where violations_found contains zero
// phantom link entries -- checked run over run, not assumed from this
// commit alone). Remove this module and its call site in generate.mjs
// once that's confirmed; do not remove it preemptively in the same pass
// that introduces the root fix.
//
// Pure, no I/O -- same pattern as internalLinkGate.mjs and every other
// gate/helper in this directory. Called from generate.mjs right after
// self-review returns, before assembleArticle() builds the final article.
import { normalize } from './internalLinkGate.mjs';

const SITE = 'https://temeculavalleyhomes.us';
const ANCHOR_RE = /<a href="([^"]*)">([^<]*)<\/a>/g;

// Root-relative hrefs ("/contact/") must resolve to the same full-URL shape
// knownRoutes uses before comparison -- same conversion
// internalLinkGate.mjs's extractInternalHrefs() already does. The href
// itself is left untouched in the anchor we restore (see `raw` below) --
// only the comparison is normalized, never the draft's own original form.
function resolveHref(href) {
  return href.startsWith('/') ? `${SITE}${href}` : href;
}

// extractAnchors (exported for tests) — every {href, text, raw} triple in
// content_html, in document order. Matches this pipeline's own generated
// anchor shape exactly (`<a href="...">...</a>`, no extra attributes —
// verified against real generated-article content_html), not general HTML.
export function extractAnchors(html) {
  if (!html) return [];
  const anchors = [];
  const re = new RegExp(ANCHOR_RE);
  let m;
  while ((m = re.exec(html))) {
    anchors.push({ href: m[1], text: m[2], raw: m[0] });
  }
  return anchors;
}

function findAnchorSpans(html) {
  const spans = [];
  const re = new RegExp(ANCHOR_RE);
  let m;
  while ((m = re.exec(html))) {
    spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

// Every index in `html` where `text` occurs as a plain substring that is
// NOT inside an existing anchor span -- i.e. a candidate spot to wrap back
// into a link. Excludes matches inside other anchors' innerText so a
// coincidentally-identical phrase already linked elsewhere is never
// clobbered.
function findBareOccurrences(html, text, anchorSpans) {
  const indices = [];
  let idx = html.indexOf(text);
  while (idx !== -1) {
    const insideAnchor = anchorSpans.some(([start, end]) => idx >= start && idx < end);
    if (!insideAnchor) indices.push(idx);
    idx = html.indexOf(text, idx + 1);
  }
  return indices;
}

// restoreStrippedInternalLinks (exported) — { html, restored, skipped }.
// `restored`: [{href, text}] for every link put back. `skipped`: [{href,
// text, reason}] for every known-route draft link that's missing from
// `reviewedHtml` but couldn't be safely restored (reason: 'text not found
// unwrapped in reviewed html' or 'ambiguous -- text appears N times').
export function restoreStrippedInternalLinks(draftHtml, reviewedHtml, knownRoutes) {
  const knownUrls = new Set((knownRoutes || []).map((r) => normalize(r.url)));
  const draftAnchors = extractAnchors(draftHtml);
  let html = reviewedHtml || '';
  const restored = [];
  const skipped = [];

  for (const { href, text, raw } of draftAnchors) {
    // Only ever restore a link the draft already pointed at a genuine known
    // route -- an invented/invalid URL in the draft is not this function's
    // business, and must never be resurrected just because it went missing.
    if (!href || !knownUrls.has(normalize(resolveHref(href)))) continue;
    if (!text) continue;
    if (html.includes(raw)) continue; // survived self-review intact

    const anchorSpans = findAnchorSpans(html);
    const bareOccurrences = findBareOccurrences(html, text, anchorSpans);

    if (bareOccurrences.length === 1) {
      const idx = bareOccurrences[0];
      html = html.slice(0, idx) + raw + html.slice(idx + text.length);
      restored.push({ href, text });
    } else {
      skipped.push({
        href,
        text,
        reason: bareOccurrences.length === 0
          ? 'text not found unwrapped in reviewed html'
          : `ambiguous -- text appears ${bareOccurrences.length} times unwrapped in reviewed html`,
      });
    }
  }

  return { html, restored, skipped };
}
