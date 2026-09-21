import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePublishStatus } from './publishStatusReport.mjs';
import { BLOG_ARTICLE_CACHE_CONTROL } from './headersCacheEntry.mjs';

const CC = `  Cache-Control: ${BLOG_ARTICLE_CACHE_CONTROL}`;

// BATCH F / OPTION D: the header fixture is now the SHARED contract, not a
// per-slug pair. Before Batch F this file's fixture was
// "/blog/<slug>/ + /blog/<slug>" and one test asserted that a DIFFERENT
// slug's pair did not count as coverage. That per-slug question no longer
// exists: two placeholder routes cover every article, present and future,
// so the tests below assert the opposite property on purpose — an
// arbitrary slug nobody has published yet is covered identically.
const VALID_OPTION_D_HEADERS = `/blog/
${CC}
/blog
${CC}
/blog/:slug/
${CC}
/blog/:slug
${CC}

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

function baseArgs(overrides = {}) {
  return {
    slug: 'wolf-creek-temecula-neighborhood-guide',
    article: { slug: 'wolf-creek-temecula-neighborhood-guide', published: true },
    headersText: VALID_OPTION_D_HEADERS,
    blogArticlesSlugs: ['wolf-creek-temecula-neighborhood-guide'],
    ...overrides,
  };
}

const headersCheck = (result) => result.checks.find((c) => c.key === 'headers_entry');

describe('evaluatePublishStatus — merge != publish, one command to check all steps landed', () => {
  // A: the canonical success shape.
  test('published:true + canonical Option D coverage + slug in blog-articles.json -> complete: true', () => {
    const result = evaluatePublishStatus(baseArgs());
    assert.equal(result.complete, true);
    assert.equal(result.checks.every((c) => c.ok), true);
  });

  // B: no concrete pair anywhere, and it still passes.
  test('NO concrete per-slug rule is required for completeness', () => {
    const args = baseArgs();
    assert.ok(!args.headersText.includes('/blog/wolf-creek-temecula-neighborhood-guide'));
    const result = evaluatePublishStatus(args);
    assert.equal(headersCheck(result).ok, true);
    assert.match(headersCheck(result).detail, /shared placeholder routes/);
  });

  // C: the property that replaced "only checks the pair for the slug asked about".
  test('an ARBITRARY future slug is covered identically by the same shared rules', () => {
    const result = evaluatePublishStatus(baseArgs({
      slug: 'an-article-nobody-has-published-yet',
      article: { slug: 'an-article-nobody-has-published-yet', published: true },
      blogArticlesSlugs: ['an-article-nobody-has-published-yet'],
    }));
    assert.equal(headersCheck(result).ok, true);
    assert.equal(result.complete, true);
  });

  test('article JSON missing entirely -> published_flag check fails, not a throw', () => {
    const result = evaluatePublishStatus(baseArgs({ article: null }));
    const check = result.checks.find((c) => c.key === 'published_flag');
    assert.equal(check.ok, false);
    assert.match(check.detail, /not found/);
    assert.equal(result.complete, false);
  });

  // I
  test('article exists but published: false -> published_flag check fails', () => {
    const result = evaluatePublishStatus(baseArgs({ article: { slug: 'x', published: false } }));
    const check = result.checks.find((c) => c.key === 'published_flag');
    assert.equal(check.ok, false);
    assert.equal(result.complete, false);
  });

  // J
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
});

describe('evaluatePublishStatus — malformed Option D coverage fails closed', () => {
  const incomplete = (headersText) => {
    const result = evaluatePublishStatus(baseArgs({ headersText }));
    assert.equal(headersCheck(result).ok, false, 'headers_entry should have failed');
    assert.equal(result.complete, false);
    // The other two checks must be unaffected -- a broken header contract
    // must not be reported as, say, a missing article.
    assert.equal(result.checks.find((c) => c.key === 'published_flag').ok, true);
    assert.equal(result.checks.find((c) => c.key === 'blog_articles_json').ok, true);
    return headersCheck(result);
  };

  // D
  test('a missing placeholder route -> incomplete', () => {
    const check = incomplete(VALID_OPTION_D_HEADERS.replace(`/blog/:slug\n${CC}\n`, ''));
    assert.match(check.detail, /missing the required placeholder route/);
  });

  // E
  test('a wrong Cache-Control value -> incomplete', () => {
    const check = incomplete(VALID_OPTION_D_HEADERS.replace(`/blog/:slug\n${CC}`, '/blog/:slug\n  Cache-Control: public, max-age=99999'));
    assert.match(check.detail, /expected/);
  });

  // F
  test('a duplicate placeholder route -> incomplete', () => {
    const check = incomplete(`${VALID_OPTION_D_HEADERS}\n/blog/:slug\n${CC}\n`);
    assert.match(check.detail, /declared 2 times/);
  });

  // G
  test('a /blog/* Cache-Control wildcard -> incomplete', () => {
    const check = incomplete(`${VALID_OPTION_D_HEADERS}\n/blog/*\n${CC}\n`);
    assert.match(check.detail, /wildcard is prohibited/);
  });

  // H
  test('a concrete per-slug rule overlapping the placeholders -> incomplete', () => {
    const check = incomplete(`${VALID_OPTION_D_HEADERS}\n/blog/wolf-creek-temecula-neighborhood-guide\n${CC}\n`);
    assert.match(check.detail, /concatenate/);
  });

  test('an entirely empty _headers -> incomplete', () => {
    incomplete('');
  });
});
