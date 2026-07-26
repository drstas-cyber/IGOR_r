import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { slugify, uniqueSlug, getKnownSlugs, KNOWN_UNPUBLISHED_BABYLOVE_SLUGS } from './slugs.js';

// Isolated temp paths for the fail-closed tests below -- deliberately NEVER
// point at the real (gitignored) local fixture or the real generated-
// articles dir, so these tests measure getKnownSlugs()'s behavior against
// the REAL committed baseline in a genuinely clean environment, the same as
// a fresh CI checkout would see. If a test here could see real repo state
// on this machine, it would be worthless for exactly the reason this whole
// suite exists: local gitignored state masked the original bug for hours.
function isolatedTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'slugs-test-'));
}

function writeTempJson(dir, name, data) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(data), 'utf8');
  return p;
}

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

// THE TEST THAT WOULD HAVE CAUGHT IT — 2026-07-26. getKnownSlugs() silently
// returned 3 slugs instead of 28 in a clean worktree (no gitignored local
// fixture present) because it read the wrong key from the committed
// baseline file. It reported nothing was wrong; a caller had no way to know
// the "structural guarantee" it depended on was broken. Every test above
// this comment was passing on the machine that introduced the bug, the
// entire time, because that machine happened to still have the local
// fixture on disk — its fallback path used the correct key and papered
// over the baseline bug completely. These tests use isolated temp paths
// specifically so they cannot make that mistake again.
describe('getKnownSlugs — fail-closed against a degraded slug set (2026-07-26)', () => {
  test('CLEAN ENVIRONMENT, no local fixture, no generated articles: returns exactly the frozen 28 from the REAL committed baseline', () => {
    const emptyDir = isolatedTempDir();
    const known = getKnownSlugs({
      generatedDir: path.join(emptyDir, 'generated-articles-does-not-exist'),
      blogArticlesPath: path.join(emptyDir, 'blog-articles-does-not-exist.json'),
      localFixturePath: path.join(emptyDir, 'articles-cache-does-not-exist.json'),
      // baselinePath intentionally left at its real default — this is
      // exactly what a fresh CI checkout has: the committed baseline and
      // nothing else.
    });
    assert.equal(known.size, 28, `expected exactly 28 in a clean environment, got ${known.size} — this is the exact failure mode: silently returning fewer slugs than the real corpus`);
  });

  test('baseline file missing entirely: THROWS, does not return a partial/empty set', () => {
    const dir = isolatedTempDir();
    assert.throws(() => {
      getKnownSlugs({ baselinePath: path.join(dir, 'does-not-exist.json') });
    }, /could not read or parse/i);
  });

  test('baseline file present but with the wrong schema key: THROWS, does not silently degrade to the 3 hardcoded slugs', () => {
    const dir = isolatedTempDir();
    const badBaseline = writeTempJson(dir, 'wrong-key-baseline.json', {
      // A real historical mistake: the code looked for "articles" while
      // the file actually used "results". Reproduce exactly that shape.
      articles: [{ slug: 'this-key-is-wrong-and-should-never-be-read' }],
    });
    assert.throws(() => {
      getKnownSlugs({ baselinePath: badBaseline });
    }, /"results" array|schema mismatch/i);
  });

  test('baseline file present with the correct key but a truncated slug count: THROWS on the count mismatch, independent of the key bug', () => {
    const dir = isolatedTempDir();
    const truncatedBaseline = writeTempJson(dir, 'truncated-baseline.json', {
      results: [{ slug: 'only-one-slug-here' }], // real file has 25
    });
    assert.throws(() => {
      getKnownSlugs({ baselinePath: truncatedBaseline });
    }, /expected exactly 28/i);
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
