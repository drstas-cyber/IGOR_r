// Deterministic "Related articles" selection (Batch B, AI SEO audit RISK
// #3, 2026-08-08) — pure, no I/O, no LLM call, shared by BlogPostPage.jsx
// (client render) and tools/seo-prerender.js (Node build step, for the
// crawler-visible noscript block), same reason src/lib/blog.js is plain
// ESM: both environments import the exact same function, so selection can
// never drift between what a hydrated visitor sees and what a raw-HTML
// reader sees.
//
// Available metadata note: the requested algorithm's "shared category/
// topic" scoring component is dropped — no category/topic field exists
// anywhere in the article data model (verified: id, title, slug,
// content_html, meta_description, hero_image_url, jsonLd, faqJsonLd,
// created_at, keywords, citations, published, sourceTopic — no category).
// Implemented with the fields that actually exist: keywords array overlap,
// title token overlap, and meta_description token overlap. Weights are
// arbitrary but fixed and documented, not tuned against real data (10
// articles is too small a sample to tune against without overfitting).

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'how', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'should',
  'that', 'the', 'their', 'this', 'to', 'up', 'was', 'what', 'when',
  'where', 'who', 'will', 'with', 'you', 'your', 'about', 'before', 'buying',
  'selling', 'home', 'homes', 'temecula',
]);

// tokenize (exported for tests): lowercase, strip punctuation, split on
// whitespace, drop stop words and tokens under 3 chars. "temecula"/"home"/
// "homes"/"buying"/"selling" are in STOP_WORDS deliberately — every single
// one of the 10 articles' titles contains at least one of them, so leaving
// them in would make title-token overlap trivially high across every pair
// and defeat the point of the signal.
export function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function overlapCount(a, b) {
  const setB = new Set(b);
  let count = 0;
  for (const item of new Set(a)) {
    if (setB.has(item)) count++;
  }
  return count;
}

// scoreArticle (exported for tests): current + candidate -> integer score.
// Weights: keyword overlap x3 (most reliable signal — keywords are
// deliberately curated per article, not free prose), title-token overlap
// x2, meta_description-token overlap x1.
export function scoreArticle(current, candidate) {
  const currentKeywords = (current.keywords || []).map((k) => k.toLowerCase());
  const candidateKeywords = (candidate.keywords || []).map((k) => k.toLowerCase());
  const keywordScore = overlapCount(currentKeywords, candidateKeywords) * 3;

  const titleScore = overlapCount(tokenize(current.title), tokenize(candidate.title)) * 2;

  const descScore = overlapCount(tokenize(current.meta_description), tokenize(candidate.meta_description)) * 1;

  return keywordScore + titleScore + descScore;
}

// selectRelatedArticles (exported for tests) — the full deterministic
// pipeline: score every other article, sort by
// (score desc, created_at desc, slug asc), take top `count`.
//
// No self-links: candidate list excludes currentSlug before scoring.
// No dead slugs, by construction: only ever selects from the `articles`
// array it's given — cannot produce a slug that isn't already in that
// list, so a caller passing the live published article set can never get
// a dead slug back.
// Graceful degradation: 0 other articles -> [], 1 -> [that one], 2 -> both,
// 3+ -> top `count` (default 3).
export function selectRelatedArticles({ currentSlug, articles, count = 3 }) {
  const current = articles.find((a) => a.slug === currentSlug);
  if (!current) return [];

  const candidates = articles.filter((a) => a.slug !== currentSlug);
  if (candidates.length === 0) return [];

  const scored = candidates.map((candidate) => ({
    article: candidate,
    score: scoreArticle(current, candidate),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dateA = new Date(a.article.created_at).getTime();
    const dateB = new Date(b.article.created_at).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return a.article.slug.localeCompare(b.article.slug);
  });

  const limit = Math.min(count, candidates.length);
  return scored.slice(0, limit).map((s) => s.article);
}
