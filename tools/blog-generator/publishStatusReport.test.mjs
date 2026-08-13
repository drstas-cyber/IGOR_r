import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePublishStatus } from './publishStatusReport.mjs';

function baseArgs(overrides = {}) {
  return {
    slug: 'wolf-creek-temecula-neighborhood-guide',
    article: { slug: 'wolf-creek-temecula-neighborhood-guide', published: true },
    headersText: '/blog/wolf-creek-temecula-neighborhood-guide/\n  Cache-Control: public\n/blog/wolf-creek-temecula-neighborhood-guide\n  Cache-Control: public\n',
    blogArticlesSlugs: ['wolf-creek-temecula-neighborhood-guide'],
    ...overrides,
  };
}

describe('evaluatePublishStatus — merge != publish, one command to check all steps landed', () => {
  test('all three local checks pass -> complete: true', () => {
    const result = evaluatePublishStatus(baseArgs());
    assert.equal(result.complete, true);
    assert.equal(result.checks.every((c) => c.ok), true);
  });

  test('article JSON missing entirely -> published_flag check fails, not a throw', () => {
    const result = evaluatePublishStatus(baseArgs({ article: null }));
    const check = result.checks.find((c) => c.key === 'published_flag');
    assert.equal(check.ok, false);
    assert.match(check.detail, /not found/);
    assert.equal(result.complete, false);
  });

  test('article exists but published: false -> published_flag check fails', () => {
    const result = evaluatePublishStatus(baseArgs({ article: { slug: 'x', published: false } }));
    const check = result.checks.find((c) => c.key === 'published_flag');
    assert.equal(check.ok, false);
    assert.equal(result.complete, false);
  });

  test('_headers missing the cache pair -> headers_entry check fails, others unaffected', () => {
    const result = evaluatePublishStatus(baseArgs({ headersText: '/blog/some-other-slug/\n  Cache-Control: public\n' }));
    const headers = result.checks.find((c) => c.key === 'headers_entry');
    const published = result.checks.find((c) => c.key === 'published_flag');
    assert.equal(headers.ok, false);
    assert.equal(published.ok, true);
    assert.equal(result.complete, false);
  });

  test('slug absent from blog-articles.json -> blog_articles_json check fails', () => {
    const result = evaluatePublishStatus(baseArgs({ blogArticlesSlugs: ['a-different-slug'] }));
    const check = result.checks.find((c) => c.key === 'blog_articles_json');
    assert.equal(check.ok, false);
    assert.equal(result.complete, false);
  });

  test('every check present even when everything is missing -- never throws on a half-finished sequence', () => {
    const result = evaluatePublishStatus({ slug: 'nope', article: null, headersText: '', blogArticlesSlugs: [] });
    assert.equal(result.checks.length, 3);
    assert.equal(result.complete, false);
  });

  test('only checks the cache pair for the slug asked about, not any slug present in _headers', () => {
    const result = evaluatePublishStatus(baseArgs({
      slug: 'redhawk-temecula-neighborhood-guide',
      article: { slug: 'redhawk-temecula-neighborhood-guide', published: true },
      blogArticlesSlugs: ['redhawk-temecula-neighborhood-guide'],
      // headersText still only has the wolf-creek pair from baseArgs()
    }));
    const headers = result.checks.find((c) => c.key === 'headers_entry');
    assert.equal(headers.ok, false);
  });
});
