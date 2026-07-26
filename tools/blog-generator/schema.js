// Validates a generated article object against the exact shape the existing
// pipeline consumes (src/data/blog-articles.json, as read by
// BlogIndexPage.jsx, BlogPostPage.jsx, and tools/seo-prerender.js). Pure, no
// I/O — unit-testable in isolation.

export const META_DESCRIPTION_MIN = 70;
export const META_DESCRIPTION_MAX = 160;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_PREFIX = 'local-';

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

  return { valid: errors.length === 0, errors };
}
