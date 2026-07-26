// Build-time footnote rendering (2026-07-26). The citations array is the
// source of truth (written at generation time, reviewed in the PR); the
// rendered footnote HTML is DERIVED from it here, at build time, never
// hand-authored and never stored back onto the committed article file --
// re-generated fresh on every build from whatever's actually on main.
//
// Re-validates marker<->array consistency independently of the
// generation-time check in schema.js (same shared logic, see
// getCitationConsistencyErrors() there) -- a human hand-editing
// content_html during PR review, after generation-time validation already
// passed, is a real gap: this is the second checkpoint that catches it.
// FAILS THE BUILD on any inconsistency, does not warn and continue --
// same standard as everything else in this pipeline (resolveEnforceMode,
// getKnownSlugs, getOpenPrAttemptedTopics, schema.js itself). A silently
// broken footnote (a marker with no citation, or a citation nobody's
// article text points to) is the same bug class this session hit twice
// tonight already (the CI if: condition, the missing sourceTopic
// backfill) -- caught here before it ships, not discovered by a reader
// clicking a dead footnote number.
//
// External links match the site's own established convention (verified
// against Footer.jsx/StickyNavigation.jsx/GoogleReviews.jsx/
// NeighborhoodsGrid.jsx before writing this, not assumed):
// target="_blank" rel="noopener noreferrer".

import { getCitationConsistencyErrors } from './schema.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Pure -- builds the <ol> footnote block HTML from a citations array.
// Order follows the array's own order (which, per prompt.md rule 5, is
// meant to be sequential by id already) -- not re-sorted, so a citations
// array authored out of numeric order renders in that same order rather
// than silently reordering behind the author's back.
export function buildFootnotesHtml(citations) {
  if (!citations || citations.length === 0) return '';
  const items = citations.map((c) => (
    `<li id="footnote-${escapeHtml(c.id)}"><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.sourceName)}</a></li>`
  )).join('');
  return `<hr class="citations-divider" /><ol class="citations-footnotes">${items}</ol>`;
}

// Returns a NEW article object (never mutates the input) with footnotes
// appended to content_html. Throws on any marker<->array inconsistency --
// this is the build-failing checkpoint, not a warning path.
//
// The "nothing to do" fast path is deliberately narrower than just
// "citations is empty" -- an article with an EMPTY citations array but a
// stray data-cite marker in content_html (a marker left behind after its
// citations[] entry was deleted during PR review, say) is exactly the
// inconsistency this checkpoint exists to catch, and skipping validation
// whenever citations.length === 0 would let that slip through silently.
// Only truly skip when there is neither a citations array with entries NOR
// any marker at all -- which is the entire BabyLoveGrowth corpus (no
// citations field, no markers, untouched either way).
export function renderArticleFootnotes(article) {
  const citations = article.citations || [];
  const hasMarkers = /data-cite="/.test(article.content_html || '');
  if (citations.length === 0 && !hasMarkers) return article;

  const errors = getCitationConsistencyErrors(article);
  if (errors.length > 0) {
    throw new Error(
      `[renderCitations] "${article.slug || article.title || '(unknown)'}" has inconsistent citations at build time ` +
      `(passed generation-time validation, but no longer matches -- likely a hand-edit to content_html during PR ` +
      `review that broke a data-cite marker): ${errors.join('; ')}`
    );
  }

  if (citations.length === 0) return article; // consistent AND nothing to render (validated above, no markers either)

  return {
    ...article,
    content_html: `${article.content_html}${buildFootnotesHtml(citations)}`,
  };
}

// Applies renderArticleFootnotes to every article in an array. Fails the
// whole build on the first inconsistency found (does not skip/exclude the
// bad article and continue) -- a citations bug is a pipeline defect to
// fix, not a per-article compliance trip to filter out silently.
export function renderAllFootnotes(articles) {
  return articles.map(renderArticleFootnotes);
}
