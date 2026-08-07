// Fail-closed gate (Batch B, Part 3, 2026-08-08): every internal href in a
// generated article's content_html must match a known live route or known
// live article slug — never an invented one. Pure, no I/O — exported for
// tests, called from generate.mjs after the schema check with the same
// discard-path treatment as a schema-invalid draft (see generate.mjs's
// handleTrippedGate()).
//
// "Internal" here means root-relative ("/blog/...") or full-origin
// ("https://temeculavalleyhomes.us/..."). tel:/mailto:/external citation
// domains (leginfo.legislature.ca.gov, rivcoacr.org, etc.) are out of
// scope for this gate by design — those are governed by schema.js's
// CITATION_HOST_POLICY and the existing citation-URL forbidden-substring
// check, a different concern from in-body contextual links.
//
// The competitor lookalike domain (temeculavalleyhomes.com) needs no
// separate check here: it can never appear in knownRoutes (built entirely
// from the real .us site, see knownRoutes.mjs), so any link to it fails
// this gate automatically as "not a known route" — the same fail-closed
// mechanism that catches a genuinely invented slug.

const SITE = 'https://temeculavalleyhomes.us';

// extractInternalHrefs (exported for tests) — pulls every <a href="...">
// value out of content_html that looks internal (starts with '/' or the
// site's own origin). Normalizes root-relative hrefs to full URLs so
// callers only ever compare one shape.
export function extractInternalHrefs(contentHtml) {
  if (!contentHtml) return [];
  const hrefs = [];
  const re = /<a\s+[^>]*href="([^"]*)"[^>]*>/gi;
  let m;
  while ((m = re.exec(contentHtml))) {
    const href = m[1];
    if (href.startsWith('/')) {
      hrefs.push(`${SITE}${href}`);
    } else if (href.startsWith(SITE)) {
      hrefs.push(href);
    }
    // tel:, mailto:, other https:// domains — not this gate's concern.
  }
  return hrefs;
}

function normalize(url) {
  // Strip any hash fragment/query string, then ensure exactly one
  // trailing slash — matches every knownRoutes URL's own shape
  // (SITE + route.path, and route.path always ends in '/').
  const bare = url.split('#')[0].split('?')[0];
  return bare.endsWith('/') ? bare : `${bare}/`;
}

// validateInternalLinks (exported) — { valid, invalidLinks, checkedCount }.
// Fails closed: an article with zero internal links is valid (nothing to
// check, not the same as "everything checked and passed" but not a
// failure either — internal links are encouraged, not required, per
// prompt.md's "SHOULD include" wording, not "MUST").
export function validateInternalLinks(contentHtml, knownRoutes) {
  const knownUrls = new Set((knownRoutes || []).map((r) => normalize(r.url)));
  const hrefs = extractInternalHrefs(contentHtml);
  const invalidLinks = hrefs.filter((href) => !knownUrls.has(normalize(href)));
  return {
    valid: invalidLinks.length === 0,
    invalidLinks: [...new Set(invalidLinks)],
    checkedCount: hrefs.length,
  };
}
