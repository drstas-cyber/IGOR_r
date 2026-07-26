import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, uniqueSlug, getKnownSlugs, KNOWN_UNPUBLISHED_BABYLOVE_SLUGS } from './slugs.js';

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    assert.equal(slugify('Understanding Escrow'), 'understanding-escrow');
  });

  test('strips punctuation', () => {
    assert.equal(slugify('What Is a "Contingency"?'), 'what-is-a-contingency');
  });

  test('collapses repeated separators and trims edges', () => {
    assert.equal(slugify('  Multiple   Spaces -- Here  '), 'multiple-spaces-here');
  });

  test('strips diacritics', () => {
    assert.equal(slugify('Café résumé'), 'cafe-resume');
  });
});

describe('getKnownSlugs — coverage of BabyLoveGrowth\'s full 28', () => {
  test('includes all 3 confirmed-live unpublished slugs not in the committed baseline', () => {
    const known = getKnownSlugs();
    for (const slug of KNOWN_UNPUBLISHED_BABYLOVE_SLUGS) {
      assert.ok(known.has(slug), `expected known slugs to include ${slug}`);
    }
  });

  test('includes at least the 25 published slugs from the committed redacted baseline', () => {
    const known = getKnownSlugs();
    assert.ok(known.size >= 25, `expected at least 25 known slugs, got ${known.size}`);
  });
});

describe('uniqueSlug — collision resolution', () => {
  test('returns the slugified candidate unchanged when not colliding', () => {
    const known = new Set(['some-other-article']);
    assert.equal(uniqueSlug('Brand New Topic', known), 'brand-new-topic');
  });

  test('appends -2 on a single collision', () => {
    const known = new Set(['understanding-escrow']);
    assert.equal(uniqueSlug('Understanding Escrow', known), 'understanding-escrow-2');
  });

  test('walks past multiple existing numbered collisions', () => {
    const known = new Set(['understanding-escrow', 'understanding-escrow-2', 'understanding-escrow-3']);
    assert.equal(uniqueSlug('Understanding Escrow', known), 'understanding-escrow-4');
  });

  test('resolves uniquely against a real known-28 slug (why-home-values-fluctuate)', () => {
    const known = getKnownSlugs();
    assert.ok(known.has('why-home-values-fluctuate'));
    const resolved = uniqueSlug('Why Home Values Fluctuate', known);
    assert.notEqual(resolved, 'why-home-values-fluctuate');
    assert.equal(resolved, 'why-home-values-fluctuate-2');
  });
});
