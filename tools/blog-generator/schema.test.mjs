import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateArticleSchema, META_DESCRIPTION_MIN, META_DESCRIPTION_MAX } from './schema.js';

function validArticle(overrides = {}) {
  return {
    id: 'local-abc123',
    title: 'Understanding Escrow',
    slug: 'understanding-escrow',
    content_html: '<p>Escrow is a neutral third-party process.</p>',
    meta_description: 'A clear, practical explanation of how escrow works for California homebuyers from start to close of sale.',
    hero_image_url: null,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
    faqJsonLd: null,
    created_at: '2026-07-25T00:00:00.000Z',
    keywords: ['escrow', 'homebuying'],
    published: false,
    ...overrides,
  };
}

describe('validateArticleSchema — required fields', () => {
  test('a fully valid article passes', () => {
    const result = validateArticleSchema(validArticle());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  test('rejects an id not namespaced with local-', () => {
    const result = validateArticleSchema(validArticle({ id: '632480' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /id must be a string starting with "local-"/);
  });

  test('rejects a missing/empty title', () => {
    const result = validateArticleSchema(validArticle({ title: '' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /title must be a non-empty string/);
  });

  test('rejects a non-kebab-case slug', () => {
    const result = validateArticleSchema(validArticle({ slug: 'Not Kebab Case!' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /slug must be lowercase kebab-case/);
  });

  test('rejects empty content_html', () => {
    const result = validateArticleSchema(validArticle({ content_html: '' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /content_html must be a non-empty string/);
  });

  test('meta_description below the minimum length fails', () => {
    const result = validateArticleSchema(validArticle({ meta_description: 'Too short.' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), new RegExp(`${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX}`));
  });

  test('meta_description above the maximum length fails', () => {
    const result = validateArticleSchema(validArticle({ meta_description: 'x'.repeat(200) }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), new RegExp(`${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX}`));
  });

  test('meta_description at exactly the min/max boundary passes', () => {
    const min = validateArticleSchema(validArticle({ meta_description: 'x'.repeat(META_DESCRIPTION_MIN) }));
    const max = validateArticleSchema(validArticle({ meta_description: 'x'.repeat(META_DESCRIPTION_MAX) }));
    assert.equal(min.valid, true);
    assert.equal(max.valid, true);
  });

  test('hero_image_url: null is explicitly valid', () => {
    const result = validateArticleSchema(validArticle({ hero_image_url: null }));
    assert.equal(result.valid, true);
  });

  test('hero_image_url: a non-string non-null value fails', () => {
    const result = validateArticleSchema(validArticle({ hero_image_url: 123 }));
    assert.equal(result.valid, false);
  });

  test('jsonLd must be a non-null object', () => {
    const result = validateArticleSchema(validArticle({ jsonLd: null }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /jsonLd must be a non-null object/);
  });

  test('faqJsonLd: null is valid (no Q&A section)', () => {
    const result = validateArticleSchema(validArticle({ faqJsonLd: null }));
    assert.equal(result.valid, true);
  });

  test('faqJsonLd: an object is valid (has a Q&A section)', () => {
    const result = validateArticleSchema(validArticle({ faqJsonLd: { '@type': 'FAQPage' } }));
    assert.equal(result.valid, true);
  });

  test('rejects an unparseable created_at', () => {
    const result = validateArticleSchema(validArticle({ created_at: 'not-a-date' }));
    assert.equal(result.valid, false);
  });

  test('rejects empty keywords array', () => {
    const result = validateArticleSchema(validArticle({ keywords: [] }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /keywords must be a non-empty array/);
  });

  test('rejects non-boolean published', () => {
    const result = validateArticleSchema(validArticle({ published: 'false' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /published must be a boolean/);
  });

  test('accumulates multiple errors at once, not just the first', () => {
    const result = validateArticleSchema(validArticle({ title: '', slug: 'BAD SLUG', keywords: [] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 3);
  });
});
