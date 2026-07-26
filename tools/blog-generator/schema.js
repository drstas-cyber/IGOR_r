// Validates a generated article object against the exact shape the existing
// pipeline consumes (src/data/blog-articles.json, as read by
// BlogIndexPage.jsx, BlogPostPage.jsx, and tools/seo-prerender.js). Pure, no
// I/O — unit-testable in isolation.

export const META_DESCRIPTION_MIN = 70;
export const META_DESCRIPTION_MAX = 160;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_PREFIX = 'local-';

// prompt.md rule 6: primary sources only.
export const CITATION_SOURCE_TYPES = ['statute', 'constitution', 'government-code', 'county-assessor', 'county-tax-collector', 'court-opinion', 'other-primary'];
// prompt.md rule 7: never cite the competitor, defense in depth alongside
// the Layer 1 scanner (which also gets the citations array as of the
// scanner-widening change -- this check exists independently so schema
// validation itself never lets a competitor URL through even if that
// widening is ever reverted).
const CITATION_URL_FORBIDDEN_SUBSTRING = 'temeculavalleyhomes.com';
const CITATION_MARKER_PATTERN = /data-cite="([^"]+)"/g;

// Extracted so BOTH checkpoints -- generation-time (validateArticleSchema
// below) and build-time (renderCitations.mjs, re-validating whatever's
// actually on main before rendering footnotes) -- share the exact same
// consistency logic, not two implementations that could quietly drift
// apart from each other. Self-contained: recomputes citation ids from
// article.citations directly rather than depending on a Set built
// elsewhere, so it can be called independently of the rest of schema
// validation. Returns an array of error strings, empty if consistent.
export function getCitationConsistencyErrors(article) {
  const errors = [];
  if (!Array.isArray(article.citations)) return ['citations must be an array (empty if the article makes no citable claims)'];
  const ids = new Set(article.citations.map((c) => c?.id).filter((id) => typeof id === 'string'));
  const markerIds = new Set([...(String(article.content_html || '')).matchAll(CITATION_MARKER_PATTERN)].map((m) => m[1]));
  for (const id of markerIds) {
    if (!ids.has(id)) errors.push(`content_html references data-cite="${id}" with no matching citations[] entry`);
  }
  for (const id of ids) {
    if (!markerIds.has(id)) errors.push(`citations[] has id ${JSON.stringify(id)} that no data-cite marker in content_html references (orphaned citation)`);
  }
  return errors;
}

export function validateArticleSchema(article) {
  const errors = [];

  if (!article || typeof article !== 'object') {
    return { valid: false, errors: ['article is not an object'] };
  }

  if (typeof article.id !== 'string' || !article.id.startsWith(ID_PREFIX)) {
    errors.push(`id must be a string starting with "${ID_PREFIX}" (namespaced so it can never collide with BabyLoveGrowth's numeric ids), got: ${JSON.stringify(article.id)}`);
  }
  if (typeof article.title !== 'string' || article.title.trim().length === 0) {
    errors.push('title must be a non-empty string');
  }
  if (typeof article.slug !== 'string' || !SLUG_PATTERN.test(article.slug)) {
    errors.push(`slug must be lowercase kebab-case, got: ${JSON.stringify(article.slug)}`);
  }
  if (typeof article.content_html !== 'string' || article.content_html.trim().length === 0) {
    errors.push('content_html must be a non-empty string');
  }
  if (typeof article.meta_description !== 'string') {
    errors.push('meta_description must be a string');
  } else if (
    article.meta_description.length < META_DESCRIPTION_MIN ||
    article.meta_description.length > META_DESCRIPTION_MAX
  ) {
    errors.push(`meta_description must be ${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX} chars, got ${article.meta_description.length}`);
  }
  if (article.hero_image_url !== null && typeof article.hero_image_url !== 'string') {
    errors.push('hero_image_url must be null or a string');
  }
  if (!article.jsonLd || typeof article.jsonLd !== 'object') {
    errors.push('jsonLd must be a non-null object');
  }
  if (article.faqJsonLd !== null && typeof article.faqJsonLd !== 'object') {
    errors.push('faqJsonLd must be null or an object (null when the article has no Q&A section)');
  }
  if (typeof article.created_at !== 'string' || Number.isNaN(new Date(article.created_at).getTime())) {
    errors.push(`created_at must be a valid ISO date string, got: ${JSON.stringify(article.created_at)}`);
  }
  if (!Array.isArray(article.keywords) || article.keywords.length === 0 || !article.keywords.every((k) => typeof k === 'string')) {
    errors.push('keywords must be a non-empty array of strings');
  }
  if (typeof article.published !== 'boolean') {
    errors.push('published must be a boolean');
  }
  if (typeof article.sourceTopic !== 'string' || article.sourceTopic.trim().length === 0) {
    errors.push('sourceTopic must be a non-empty string — the exact topics.json "topic" text this article was generated from, used by topicAvailability.mjs to avoid regenerating the same topic. Added 2026-07-26.');
  }

  // citations array (added 2026-07-26, prompt.md rules 4-8): source of
  // truth for every specific claim in content_html. Validated at two
  // levels -- per-entry shape, then a cross-check that the array and the
  // inline data-cite markers in content_html agree with each other exactly.
  // Fail-closed: any mismatch is an error, never a warning, matching the
  // rest of this pipeline's standard (resolveEnforceMode, getKnownSlugs,
  // getOpenPrAttemptedTopics).
  if (!Array.isArray(article.citations)) {
    errors.push('citations must be an array (empty if the article makes no citable claims)');
  } else {
    const ids = new Set();
    for (const c of article.citations) {
      if (typeof c?.id !== 'string' || c.id.trim().length === 0) {
        errors.push(`citations[]: missing/invalid id in ${JSON.stringify(c)}`);
      } else if (ids.has(c.id)) {
        errors.push(`citations[]: duplicate id "${c.id}"`);
      } else {
        ids.add(c.id);
      }
      if (typeof c?.sourceName !== 'string' || c.sourceName.trim().length === 0) {
        errors.push(`citations[]: missing sourceName (id ${JSON.stringify(c?.id)})`);
      }
      if (typeof c?.url !== 'string' || c.url.trim().length === 0) {
        errors.push(`citations[]: missing url (id ${JSON.stringify(c?.id)})`);
      } else if (c.url.toLowerCase().includes(CITATION_URL_FORBIDDEN_SUBSTRING)) {
        errors.push(`citations[]: url cites the competitor domain (id ${JSON.stringify(c?.id)}, url ${JSON.stringify(c.url)})`);
      }
      if (!CITATION_SOURCE_TYPES.includes(c?.sourceType)) {
        errors.push(`citations[]: sourceType ${JSON.stringify(c?.sourceType)} is not a primary-source category (id ${JSON.stringify(c?.id)}) — must be one of ${JSON.stringify(CITATION_SOURCE_TYPES)}`);
      }
    }

    // Cross-check: source of truth (citations) and its use in prose
    // (data-cite markers) must never silently drift apart -- a marker with
    // no entry renders a dead footnote link; an entry with no marker is an
    // orphaned citation nothing in the article actually points to.
    errors.push(...getCitationConsistencyErrors(article));
  }

  return { valid: errors.length === 0, errors };
}
