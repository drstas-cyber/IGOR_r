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

// Closed host allowlist for citations (added 2026-07-26). Found via a real
// example: this file's own sample fixture cited law.justia.com -- a
// REPUBLISHER, an aggregator by prompt.md rule 6's own definition -- with
// sourceType "statute". Nothing checked that pairing; the enum was
// self-reported and unverified, so any URL could be labeled any
// sourceType and pass. That's exactly how a mislabeled mirror ships
// unnoticed: green gate, nobody the wiser.
//
// TIER 1 -- source of record, preferred. TIER 2 -- permitted faithful
// republishers (Justia and Cornell LII reproduce statutory text
// accurately), but labeled as such in the rendered report so a supervised
// read knows it's looking at a mirror, not the source of record.
// EVERYTHING ELSE fails validation -- not a warning, no exceptions.
//
// allowedSourceTypes makes this a genuinely PAIRED check, not two
// independent ones: a host being on the list is not enough on its own --
// the citation's declared sourceType must also be one this specific host
// is actually a plausible source for. A county-assessor sourceType on a
// justia.com URL fails even though justia.com itself is allowlisted,
// because justia.com doesn't publish county assessor records.
//
// Deliberately excluded, not merely omitted: ca-riverside-ttc.publicaccessnow.com
// is Riverside County's TAX PAYMENT portal, not an informational citation
// source -- citations point at informational pages, never a payment
// system, so this stays off the list even though it's a real, legitimate
// county-run domain.
export const CITATION_HOST_POLICY = {
  // --- Tier 1: source of record ---
  'leginfo.legislature.ca.gov': { tier: 1, allowedSourceTypes: ['statute', 'constitution', 'government-code'] },
  'courts.ca.gov': { tier: 1, allowedSourceTypes: ['court-opinion'] },
  'rivcoacr.org': { tier: 1, allowedSourceTypes: ['county-assessor'] }, // Riverside County Assessor-County Clerk-Recorder
  'countytreasurer.org': { tier: 1, allowedSourceTypes: ['county-tax-collector'] }, // Riverside County Treasurer-Tax Collector -- a bare .org with no county name in it; the entire argument for pinning hosts rather than trusting a model to guess correctly
  'rivco.gov': { tier: 1, allowedSourceTypes: ['county-assessor', 'county-tax-collector', 'other-primary'] }, // county umbrella
  // --- Tier 2: permitted faithful republishers ---
  'law.justia.com': { tier: 2, allowedSourceTypes: ['statute', 'constitution', 'government-code', 'court-opinion'] },
  'law.cornell.edu': { tier: 2, allowedSourceTypes: ['statute', 'constitution', 'government-code', 'court-opinion'] },
};

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// www-normalization (2026-07-27, draw 5 of the article-3 bait run): the
// writer produced "www.rivcoacr.org" and "www.countytreasurer.org" -- both
// real, correct hosts, rejected outright because CITATION_HOST_POLICY has
// no www. variants, crashing the run on a real content gap rather than a
// policy violation. Strips EXACTLY one leading "www." label before the
// allowlist lookup below -- not a general subdomain-stripping scheme:
// "www.rivcoacr.org.evil.com" strips to "rivcoacr.org.evil.com" (still not
// on the list, still rejected) and "wwwrivcoacr.org" (no dot after "www",
// not actually the www subdomain) is left untouched and still rejected.
// Applied ONLY to the allowlist lookup -- error messages still show the
// real host as cited, and isBareHostRoot()'s pathname check below is
// entirely unaffected (bare-root rejection stays exactly as strict; draw
// 5's bare-root catch on www.rivcoacr.org was itself a correct catch,
// unrelated to and unchanged by this fix).
export function normalizeHostForPolicy(host) {
  if (typeof host !== 'string') return host;
  return host.startsWith('www.') ? host.slice(4) : host;
}

// Bare-root rejection (added 2026-07-27). Found live, on article 1's own
// first citation set: "https://rivcoacr.org/" resolved 200 unconditionally
// and supported no specific claim -- the one URL shape that passes every
// other check (real host, real sourceType pairing, real 200) while
// carrying zero evidentiary weight. Narrow on purpose: rejects ONLY a
// truly empty path (no path, or just "/") -- a real, shallow-but-genuine
// page ("/property-tax-information/") passes. Deliberately not requiring
// a "deep" link: over-tightening toward "must deep-link" would push the
// model toward fabricating a plausible deep path that 404s, which Layer 3
// would then have to catch instead -- and a 404 is a worse failure than a
// shallow-but-real page. This check is purely structural (does the URL
// even attempt to point at content); Layer 3's body-content verification
// (citationResolver.mjs) is what confirms a shallow-but-real page
// actually carries the cited fact.
function isBareHostRoot(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false; // unparseable is the host-policy check's job, not this one's
  }
  return parsed.pathname.replace(/^\/+|\/+$/g, '').length === 0;
}

// Paired host<->sourceType check, self-contained like
// getCitationConsistencyErrors() above so it can be called independently
// (schema.js at generation time; anywhere else that needs to re-verify
// what's already on main). Returns an array of error strings, empty if
// every citation passes.
export function getCitationHostPolicyErrors(article) {
  const errors = [];
  for (const c of article.citations || []) {
    if (typeof c?.url !== 'string' || c.url.trim().length === 0) continue; // reported separately by the per-entry shape check
    const host = hostnameOf(c.url);
    const policy = host ? CITATION_HOST_POLICY[normalizeHostForPolicy(host)] : undefined;
    if (!policy) {
      errors.push(`citations[]: host "${host || c.url}" is not an approved citation host (id ${JSON.stringify(c?.id)}) — must be one of ${JSON.stringify(Object.keys(CITATION_HOST_POLICY))}`);
      continue;
    }
    if (!policy.allowedSourceTypes.includes(c.sourceType)) {
      errors.push(`citations[]: sourceType ${JSON.stringify(c.sourceType)} is not valid for host "${host}" (id ${JSON.stringify(c?.id)}) — "${host}" only permits ${JSON.stringify(policy.allowedSourceTypes)}`);
    }
  }
  return errors;
}

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
      } else if (isBareHostRoot(c.url)) {
        errors.push(`citations[]: url "${c.url}" is a bare host root — carries no specific claim (id ${JSON.stringify(c?.id)}). Cite the specific page, not the site homepage.`);
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

    // Closed host allowlist, paired with sourceType -- see
    // CITATION_HOST_POLICY above for why this exists. Independent of the
    // CITATION_SOURCE_TYPES check earlier in this loop: that check only
    // confirms sourceType is SOME valid category; this confirms it's the
    // RIGHT category for the actual host the citation points at.
    errors.push(...getCitationHostPolicyErrors(article));
  }

  return { valid: errors.length === 0, errors };
}
