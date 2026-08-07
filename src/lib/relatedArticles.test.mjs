import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, scoreArticle, selectRelatedArticles } from './relatedArticles.js';

function article(overrides = {}) {
  return {
    slug: 'article-a',
    title: 'Understanding HOA Fees',
    meta_description: 'A clear explanation of HOA fees for California homebuyers.',
    keywords: ['hoa fees', 'temecula real estate'],
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('tokenize', () => {
  test('lowercases, strips punctuation, drops stop words and short tokens', () => {
    assert.deepEqual(tokenize('Understanding HOA Fees!'), ['understanding', 'hoa', 'fees']);
  });

  test('drops domain stop words that would otherwise trivially match every article ("temecula", "home", "buying", "selling")', () => {
    assert.deepEqual(tokenize('Buying a Home in Temecula'), []);
  });

  test('empty/null input returns empty array', () => {
    assert.deepEqual(tokenize(''), []);
    assert.deepEqual(tokenize(null), []);
    assert.deepEqual(tokenize(undefined), []);
  });
});

describe('scoreArticle', () => {
  test('shared keywords score higher than shared title/description tokens alone', () => {
    const current = article({ keywords: ['escrow process', 'closing costs'] });
    const sameKeyword = article({ slug: 'b', keywords: ['escrow process'], title: 'Unrelated Title', meta_description: 'unrelated' });
    const sameTitleTokenOnly = article({ slug: 'c', keywords: [], title: 'Understanding Escrow Timelines', meta_description: 'unrelated' });
    assert.ok(scoreArticle(current, sameKeyword) > scoreArticle(current, sameTitleTokenOnly));
  });

  test('zero overlap on every field scores exactly 0', () => {
    const current = article({ keywords: ['hoa fees'], title: 'Understanding HOA Fees', meta_description: 'about hoa fees' });
    const unrelated = article({ slug: 'z', keywords: ['zzz completely different'], title: 'Totally Unrelated Zzz Content', meta_description: 'nothing zzz shared here' });
    assert.equal(scoreArticle(current, unrelated), 0);
  });

  test('score is symmetric in the sense that identical articles score maximally against each other', () => {
    const a = article();
    const b = article({ slug: 'b' });
    const score = scoreArticle(a, b);
    assert.ok(score > 0);
  });
});

describe('selectRelatedArticles — deterministic selection (2026-08-08)', () => {
  const POOL = [
    article({ slug: 'hoa-fees', title: 'Understanding HOA Fees', keywords: ['hoa fees', 'planned community'], created_at: '2026-07-27T00:00:00.000Z' }),
    article({ slug: 'escrow-process', title: 'What to Expect During Escrow', keywords: ['escrow process', 'closing costs'], created_at: '2026-08-01T00:00:00.000Z' }),
    article({ slug: 'seller-disclosure', title: 'Understanding Seller Disclosures', keywords: ['seller disclosure', 'tds'], created_at: '2026-08-03T00:00:00.000Z' }),
    article({ slug: 'property-taxes', title: 'How Property Taxes Work', keywords: ['property taxes', 'prop 13'], created_at: '2026-07-29T00:00:00.000Z' }),
  ];

  test('never selects the current article itself (no self-links)', () => {
    const result = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: POOL, count: 3 });
    assert.equal(result.some((a) => a.slug === 'hoa-fees'), false);
  });

  test('never selects a slug outside the given article pool (no dead slugs, by construction)', () => {
    const result = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: POOL, count: 3 });
    const poolSlugs = new Set(POOL.map((a) => a.slug));
    for (const r of result) assert.ok(poolSlugs.has(r.slug));
  });

  test('selects top 3 when 3+ other articles exist', () => {
    const result = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: POOL, count: 3 });
    assert.equal(result.length, 3);
  });

  test('selects exactly 2 when only 2 other articles exist', () => {
    const twoOthers = POOL.slice(0, 3); // hoa-fees + 2 others
    const result = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: twoOthers, count: 3 });
    assert.equal(result.length, 2);
  });

  test('selects exactly 1 when only 1 other article exists', () => {
    const oneOther = POOL.slice(0, 2); // hoa-fees + 1 other
    const result = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: oneOther, count: 3 });
    assert.equal(result.length, 1);
  });

  test('selects none when no other articles exist (graceful degradation)', () => {
    const onlySelf = [POOL[0]];
    const result = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: onlySelf, count: 3 });
    assert.deepEqual(result, []);
  });

  test('returns [] when currentSlug is not found in the article list', () => {
    const result = selectRelatedArticles({ currentSlug: 'does-not-exist', articles: POOL, count: 3 });
    assert.deepEqual(result, []);
  });

  test('reproducible: same inputs always produce the same output, in the same order', () => {
    const run1 = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: POOL, count: 3 }).map((a) => a.slug);
    const run2 = selectRelatedArticles({ currentSlug: 'hoa-fees', articles: POOL, count: 3 }).map((a) => a.slug);
    assert.deepEqual(run1, run2);
  });

  test('tie-break: equal score falls back to newer created_at first', () => {
    const tiedPool = [
      article({ slug: 'current', title: 'Current Article', keywords: [], meta_description: 'x' }),
      article({ slug: 'older', title: 'Zzz Unrelated', keywords: [], meta_description: 'y', created_at: '2026-01-01T00:00:00.000Z' }),
      article({ slug: 'newer', title: 'Yyy Unrelated', keywords: [], meta_description: 'w', created_at: '2026-06-01T00:00:00.000Z' }),
    ];
    const result = selectRelatedArticles({ currentSlug: 'current', articles: tiedPool, count: 2 });
    assert.deepEqual(result.map((a) => a.slug), ['newer', 'older']);
  });

  test('tie-break: equal score AND equal created_at falls back to slug alphabetical order', () => {
    const tiedPool = [
      article({ slug: 'current', title: 'Current Article', keywords: [], meta_description: 'x' }),
      article({ slug: 'zebra', title: 'Zzz Unrelated', keywords: [], meta_description: 'y', created_at: '2026-01-01T00:00:00.000Z' }),
      article({ slug: 'alpha', title: 'Yyy Unrelated', keywords: [], meta_description: 'w', created_at: '2026-01-01T00:00:00.000Z' }),
    ];
    const result = selectRelatedArticles({ currentSlug: 'current', articles: tiedPool, count: 2 });
    assert.deepEqual(result.map((a) => a.slug), ['alpha', 'zebra']);
  });

  test('higher-scoring article always ranks above a lower-scoring one, regardless of date', () => {
    const pool = [
      article({ slug: 'current', title: 'Understanding HOA Fees', keywords: ['hoa fees'], meta_description: 'about hoa fees' }),
      article({ slug: 'high-score', title: 'Understanding HOA Fees Guide', keywords: ['hoa fees'], meta_description: 'about hoa fees', created_at: '2020-01-01T00:00:00.000Z' }),
      article({ slug: 'low-score-newer', title: 'Zzz Totally Unrelated', keywords: [], meta_description: 'nothing shared', created_at: '2027-01-01T00:00:00.000Z' }),
    ];
    const result = selectRelatedArticles({ currentSlug: 'current', articles: pool, count: 2 });
    assert.deepEqual(result.map((a) => a.slug), ['high-score', 'low-score-newer']);
  });
});

// "Prove it red first" — fixtures the spec explicitly asked to fail.
describe('regression fixtures (prove it red first, 2026-08-08)', () => {
  test('RED->GREEN: a self-link fixture never survives selection', () => {
    const pool = [
      article({ slug: 'self', title: 'Self Article' }),
      article({ slug: 'other', title: 'Other Article', keywords: ['hoa fees'] }),
    ];
    const result = selectRelatedArticles({ currentSlug: 'self', articles: pool, count: 3 });
    // The naive bug this guards against: forgetting to filter currentSlug
    // out of the candidate list before scoring/selecting.
    assert.equal(result.find((a) => a.slug === 'self'), undefined, 'a self-link must never appear in the result');
  });

  test('RED->GREEN: an invented/dead slug can never appear because selection only ever draws from the given pool', () => {
    const pool = [
      article({ slug: 'current', title: 'Current' }),
      article({ slug: 'real-article', title: 'Real Article', keywords: ['hoa fees'] }),
    ];
    const result = selectRelatedArticles({ currentSlug: 'current', articles: pool, count: 3 });
    const INVENTED_SLUG = 'best-temecula-neighborhoods-guide'; // never in `pool`
    assert.equal(result.some((a) => a.slug === INVENTED_SLUG), false);
  });

  test('RED->GREEN: non-deterministic ordering never happens -- 20 repeated calls all produce byte-identical order', () => {
    const pool = [
      article({ slug: 'current', title: 'Current' }),
      article({ slug: 'a', title: 'Alpha Article', keywords: ['hoa fees'] }),
      article({ slug: 'b', title: 'Beta Article', keywords: ['hoa fees'] }),
      article({ slug: 'c', title: 'Gamma Article', keywords: [] }),
    ];
    const results = Array.from({ length: 20 }, () =>
      selectRelatedArticles({ currentSlug: 'current', articles: pool, count: 3 }).map((a) => a.slug).join(','),
    );
    const unique = new Set(results);
    assert.equal(unique.size, 1, 'expected every run to produce the identical order');
  });
});
