import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isGeneratedArticle } from './loadGenerated.js';

describe('isGeneratedArticle (2026-08-12)', () => {
  test('true for an article with a non-empty sourceTopic (the generator\'s own shape)', () => {
    assert.equal(isGeneratedArticle({ slug: 'a', sourceTopic: 'A Real Topic' }), true);
  });

  test('false for a BabyLoveGrowth article -- no sourceTopic field at all', () => {
    assert.equal(isGeneratedArticle({ slug: 'a', title: 'A BLG Article' }), false);
  });

  test('false when sourceTopic is an empty string', () => {
    assert.equal(isGeneratedArticle({ slug: 'a', sourceTopic: '' }), false);
  });

  test('false when sourceTopic is not a string (defensive -- a malformed article must never be misread as generated)', () => {
    assert.equal(isGeneratedArticle({ slug: 'a', sourceTopic: null }), false);
    assert.equal(isGeneratedArticle({ slug: 'a', sourceTopic: 123 }), false);
  });

  test('does not throw on null/undefined input', () => {
    assert.equal(isGeneratedArticle(null), false);
    assert.equal(isGeneratedArticle(undefined), false);
  });
});
