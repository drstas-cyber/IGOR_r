import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assertNoGeneratedArticleSilentlyDropped } from './silentDropGuard.mjs';

function generated(overrides = {}) {
  return { slug: 'a-generated-article', title: 'A Generated Article', sourceTopic: 'A Generated Article', published: true, ...overrides };
}
function blg(overrides = {}) {
  return { slug: 'a-blg-article', title: 'A BLG Article', ...overrides }; // no sourceTopic -- true BLG shape
}

// Proven RED first (2026-08-12): before this guard existed, the real
// incident it fixes -- "seller-closing-costs-explained" had published:true
// and a merged PR, but silently never appeared in blog-articles.json --
// produced a clean exit 0 from fetch-blog-data.js, with the drop visible
// only as one console.log line among many. This file's tests exercise the
// guard in isolation; tools/fetch-blog-data.test.mjs's "silent-drop guard,
// full pipeline" describe block proves the same thing end to end against
// the real script.
describe('assertNoGeneratedArticleSilentlyDropped (2026-08-12)', () => {
  test('does not throw when every generated article in `combined` is present in the final array', () => {
    const combined = [blg(), generated()];
    const final = [blg(), generated()];
    assert.doesNotThrow(() => assertNoGeneratedArticleSilentlyDropped(combined, final));
  });

  test('throws, naming the missing article by title and slug, when a generated article in `combined` is absent from the final array', () => {
    const combined = [
      blg(),
      generated({ slug: 'seller-closing-costs-explained', title: 'What Sellers Should Know About Closing Costs' }),
    ];
    const final = [blg()]; // the generated article silently dropped downstream (e.g. the compliance filter)
    assert.throws(() => assertNoGeneratedArticleSilentlyDropped(combined, final), /seller-closing-costs-explained/);
  });

  test('the thrown error is flagged blogComplianceFatal so fetch-blog-data.js\'s main().catch() actually fails the build', () => {
    const combined = [generated({ slug: 'x', title: 'X' })];
    const final = [];
    try {
      assertNoGeneratedArticleSilentlyDropped(combined, final);
      assert.fail('must throw');
    } catch (err) {
      assert.equal(err.blogComplianceFatal, true);
      assert.match(err.message, /did not make it into/);
      assert.match(err.message, /"X" \(x\)/);
    }
  });

  test('reports every missing article when more than one is silently dropped', () => {
    const combined = [
      generated({ slug: 'article-a', title: 'Article A' }),
      generated({ slug: 'article-b', title: 'Article B' }),
    ];
    const final = [];
    try {
      assertNoGeneratedArticleSilentlyDropped(combined, final);
      assert.fail('must throw');
    } catch (err) {
      assert.match(err.message, /article-a/);
      assert.match(err.message, /article-b/);
    }
  });

  test('does NOT throw for a BabyLoveGrowth-only drop -- this guard is scoped to generated articles only', () => {
    const combined = [blg({ slug: 'dropped-blg-article' }), generated()];
    const final = [generated()]; // the BLG article is absent -- an ordinary BLG-side compliance trip, not this guard's concern
    assert.doesNotThrow(() => assertNoGeneratedArticleSilentlyDropped(combined, final));
  });

  test('a legitimate slug-collision drop is not double-reported -- the colliding article is simply absent from `combined` already', () => {
    // mergeArticleSources() drops a colliding generated article (with its own loud console.warn) BEFORE
    // `combined` is ever built, so a collision never appears in `combined` in the first place -- nothing
    // for this guard to catch or re-report.
    const combined = [blg()];
    const final = [blg()];
    assert.doesNotThrow(() => assertNoGeneratedArticleSilentlyDropped(combined, final));
  });

  test('includes the compliance report path in the message when provided, omits it cleanly when not', () => {
    const combined = [generated({ slug: 'x', title: 'X' })];
    const final = [];
    assert.throws(
      () => assertNoGeneratedArticleSilentlyDropped(combined, final, 'tools/blog-compliance/last-report.json'),
      /last-report\.json/
    );
    try {
      assertNoGeneratedArticleSilentlyDropped(combined, final);
      assert.fail('must throw');
    } catch (err) {
      assert.doesNotMatch(err.message, /undefined/, 'omitting the path must not leak the literal string "undefined" into the message');
    }
  });
});
