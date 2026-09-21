import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as headersModule from './headersCacheEntry.mjs';
import {
  countRules,
  validateBlogArticleCacheCoverage,
  hasValidBlogArticleCacheCoverage,
  BLOG_ARTICLE_CACHE_CONTROL,
  BLOG_PLACEHOLDER_ROUTES,
  MAX_HEADERS_RULES,
  HEADERS_CAP_EXCEEDED_CODE,
} from './headersCacheEntry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_HEADERS_PATH = path.join(__dirname, '..', '..', 'public', '_headers');

const CC = `  Cache-Control: ${BLOG_ARTICLE_CACHE_CONTROL}`;

// The canonical Option D shape, in miniature: literal index rules, the two
// placeholder routes, and an unrelated /assets/* rule to prove the
// validator ignores non-blog routes.
const VALID_HEADERS = `/blog/
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

describe('countRules', () => {
  test('counts one per path line, not per Cache-Control line', () => {
    assert.equal(countRules(VALID_HEADERS), 5); // /blog/, /blog, 2 placeholders, /assets/*
  });
});

describe('validateBlogArticleCacheCoverage — the canonical Option D contract', () => {
  test('the canonical two-placeholder state is valid', () => {
    const result = validateBlogArticleCacheCoverage(VALID_HEADERS);
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.deepEqual(result.errors, []);
    assert.deepEqual([...result.placeholders].sort(), [...BLOG_PLACEHOLDER_ROUTES].sort());
    assert.deepEqual(result.concreteArticleRoutes, []);
    assert.deepEqual(result.wildcardRoutes, []);
  });

  test('both placeholder routes carry the exact expected Cache-Control value', () => {
    assert.equal(BLOG_ARTICLE_CACHE_CONTROL, 'public, max-age=0, s-maxage=300, must-revalidate');
    for (const route of BLOG_PLACEHOLDER_ROUTES) {
      assert.ok(VALID_HEADERS.includes(`${route}\n${CC}\n`), `${route} must be followed by the exact Cache-Control line`);
    }
  });

  test('an EXISTING published slug needs no concrete rule of its own', () => {
    // The whole point of Option D: coverage is a property of the file, so
    // there is no per-slug lookup to do and no per-slug rule to find.
    const result = validateBlogArticleCacheCoverage(VALID_HEADERS);
    assert.equal(result.valid, true);
    assert.ok(!VALID_HEADERS.includes('/blog/title-insurance-california-homebuyers'));
  });

  test('an ARBITRARY FUTURE slug is covered identically, with no file change', () => {
    const result = validateBlogArticleCacheCoverage(VALID_HEADERS);
    assert.equal(result.valid, true);
    assert.ok(!VALID_HEADERS.includes('/blog/some-article-that-does-not-exist-yet'));
    // hasValidBlogArticleCacheCoverage deliberately takes no slug at all --
    // offering one would reintroduce the per-article question Batch F removed.
    assert.equal(hasValidBlogArticleCacheCoverage.length, 1);
  });

  test('empty or non-string input fails closed rather than passing vacuously', () => {
    for (const input of ['', '   ', null, undefined, 42]) {
      const result = validateBlogArticleCacheCoverage(input);
      assert.equal(result.valid, false, `expected ${JSON.stringify(input)} to be invalid`);
    }
  });
});

describe('validateBlogArticleCacheCoverage — fail-closed cases', () => {
  test('missing the BARE placeholder is invalid', () => {
    const text = VALID_HEADERS.replace(`/blog/:slug\n${CC}\n`, '');
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /missing the required placeholder route "\/blog\/:slug"/);
  });

  test('missing the TRAILING-SLASH placeholder is invalid', () => {
    const text = VALID_HEADERS.replace(`/blog/:slug/\n${CC}\n`, '');
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /missing the required placeholder route "\/blog\/:slug\/"/);
  });

  test('a wrong Cache-Control value on a placeholder is invalid', () => {
    const text = VALID_HEADERS.replace(`/blog/:slug\n${CC}`, '/blog/:slug\n  Cache-Control: public, max-age=60');
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /has Cache-Control "public, max-age=60", expected/);
  });

  test('a DUPLICATE placeholder route is invalid (CF would concatenate it with itself)', () => {
    const text = `${VALID_HEADERS}\n/blog/:slug\n${CC}\n`;
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /declared 2 times/);
  });

  test('a malformed block — placeholder present but declaring no Cache-Control — is invalid', () => {
    const text = VALID_HEADERS.replace(`/blog/:slug\n${CC}`, '/blog/:slug\n  X-Robots-Tag: noindex');
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /declares no Cache-Control header/);
  });

  test('a placeholder declaring Cache-Control TWICE is invalid', () => {
    const text = VALID_HEADERS.replace(`/blog/:slug\n${CC}`, `/blog/:slug\n${CC}\n${CC}`);
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /declares Cache-Control 2 times/);
  });

  test('a /blog/* wildcard carrying Cache-Control is invalid — never permitted here', () => {
    const text = `${VALID_HEADERS}\n/blog/*\n${CC}\n`;
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /wildcard is prohibited/);
    assert.deepEqual(result.wildcardRoutes, ['/blog/*']);
  });

  test('a CONCRETE article rule coexisting with the placeholders is invalid', () => {
    const text = `${VALID_HEADERS}\n/blog/title-insurance-california-homebuyers/\n${CC}\n/blog/title-insurance-california-homebuyers\n${CC}\n`;
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /Cloudflare would concatenate the two values/);
    assert.equal(result.concreteArticleRoutes.length, 2);
  });

  test('the literal /blog and /blog/ index rules are NOT mistaken for concrete article rules', () => {
    const result = validateBlogArticleCacheCoverage(VALID_HEADERS);
    assert.equal(result.valid, true);
    assert.deepEqual(result.concreteArticleRoutes, []);
  });

  test('a non-Cache-Control rule under /blog/ (e.g. X-Robots-Tag) does not trip the overlap check', () => {
    // Only Cache-Control concatenation is the hazard Option D guards against;
    // the historical dead-slug noindex pattern must stay expressible.
    const text = `${VALID_HEADERS}\n/blog/some-dead-slug\n  X-Robots-Tag: noindex\n`;
    const result = validateBlogArticleCacheCoverage(text);
    assert.equal(result.valid, true, result.errors.join('; '));
  });
});

describe('no active API can re-add a concrete per-article rule', () => {
  // The Batch F regression that matters most. These three exports were the
  // only way concrete /blog/<slug> rules ever entered the file. If a future
  // change restores any of them, this fails before it can reach production.
  test('buildCacheEntryBlock, insertCacheEntry and hasCacheEntry are GONE, not deprecated', () => {
    const exported = Object.keys(headersModule);
    for (const removed of ['buildCacheEntryBlock', 'insertCacheEntry', 'hasCacheEntry']) {
      assert.ok(
        !exported.includes(removed),
        `${removed} must not be exported — it could recreate a concrete rule that overlaps the placeholders`
      );
    }
  });

  test('no exported function produces text containing a concrete /blog/<slug> Cache-Control rule', () => {
    const concrete = /^\/blog\/(?!:slug)[a-z0-9-]+\/?$/m;
    for (const [name, value] of Object.entries(headersModule)) {
      if (typeof value !== 'function') continue;
      let output;
      try {
        output = value(VALID_HEADERS, 'some-new-slug');
      } catch {
        continue; // throwing on unexpected input is fine — it emits nothing
      }
      const text = typeof output === 'string' ? output : JSON.stringify(output ?? '');
      assert.ok(!concrete.test(text), `${name}() emitted a concrete article route`);
    }
  });

  test('the cap-guard code constant survives for notificationEmail, but nothing in the publish path can throw it', () => {
    assert.equal(HEADERS_CAP_EXCEEDED_CODE, 'HEADERS_CAP_EXCEEDED');
    assert.equal(MAX_HEADERS_RULES, 100);
  });
});

describe('against the REAL public/_headers file', () => {
  const real = () => fs.readFileSync(REAL_HEADERS_PATH, 'utf8');

  test('the real file is exactly 12 rules — a fixed count publication cannot grow', () => {
    assert.equal(countRules(real()), 12);
    assert.ok(countRules(real()) < MAX_HEADERS_RULES);
  });

  test('the real file satisfies the canonical Option D coverage contract', () => {
    const result = validateBlogArticleCacheCoverage(real());
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.deepEqual([...result.placeholders].sort(), ['/blog/:slug', '/blog/:slug/']);
  });

  test('the real file contains ZERO concrete article Cache-Control routes', () => {
    const result = validateBlogArticleCacheCoverage(real());
    assert.deepEqual(result.concreteArticleRoutes, []);
    assert.deepEqual(result.wildcardRoutes, []);
  });

  test('an existing published article and an arbitrary future slug are both covered by the same two rules', () => {
    const text = real();
    assert.equal(hasValidBlogArticleCacheCoverage(text), true);
    for (const slug of ['title-insurance-california-homebuyers', 'a-future-article-nobody-has-written-yet']) {
      assert.ok(!new RegExp(`^/blog/${slug}/?$`, 'm').test(text), `${slug} must NOT have a concrete rule`);
    }
  });

  test('the real file never declares a /blog/* Cache-Control wildcard', () => {
    assert.ok(!/^\/blog\/\*/m.test(real()));
  });
});
