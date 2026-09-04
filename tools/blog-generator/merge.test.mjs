import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeArticleSources, loadGeneratedArticles, GENERATED_DIR } from './loadGenerated.js';

function babyLoveArticle(slug) {
  return { id: 632480, slug, title: `BabyLoveGrowth: ${slug}`, source: 'babylove' };
}

function generatedArticle(slug, overrides = {}) {
  return { id: `local-${slug}`, slug, title: `Generated: ${slug}`, published: false, ...overrides };
}

describe('mergeArticleSources — pure, no I/O', () => {
  test('concatenates non-colliding sources', () => {
    const baby = [babyLoveArticle('a'), babyLoveArticle('b')];
    const generated = [generatedArticle('c'), generatedArticle('d')];
    const merged = mergeArticleSources(baby, generated);
    assert.deepEqual(merged.map((a) => a.slug).sort(), ['a', 'b', 'c', 'd']);
  });

  test('on a slug collision, BabyLoveGrowth wins and the generated one is dropped, explicitly (not silently)', () => {
    const baby = [babyLoveArticle('shared-slug')];
    const generated = [generatedArticle('shared-slug')];

    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args.join(' '));
    let merged;
    try {
      merged = mergeArticleSources(baby, generated);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, 'BabyLoveGrowth: shared-slug');
    assert.ok(warnings.some((w) => w.includes('SLUG COLLISION') && w.includes('shared-slug')), 'expected a loud collision warning, not a silent drop');
  });

  test('empty generated array is a no-op', () => {
    const baby = [babyLoveArticle('a')];
    assert.deepEqual(mergeArticleSources(baby, []), baby);
  });

  test('empty BabyLoveGrowth array still includes all generated articles', () => {
    const generated = [generatedArticle('a'), generatedArticle('b')];
    const merged = mergeArticleSources([], generated);
    assert.equal(merged.length, 2);
  });
});

// FIXTURES ARE ISOLATED TO A TEMP DIRECTORY (2026-09-04, Phase 6B2a).
//
// This block previously wrote its fixtures into the REAL
// src/data/generated-articles/ and unlinked them in afterEach. The
// describe title already claimed isolation; it was not isolated. One
// fixture carries published: true, and that directory is read by the
// production build (loadGeneratedArticles -> mergeArticleSources ->
// compliance filter -> src/data/blog-articles.json). An interrupted run
// left it behind, and the next build would ship a junk article or fail on
// footnote rendering. Cleanup in afterEach cannot fix that, because the
// failure mode IS the run not reaching afterEach.
//
// Now every write goes to mkdtempSync(os.tmpdir()), matching the
// isolatedDir() pattern already used by topicAvailability.test.mjs and
// generate.test.mjs, and the directory is passed explicitly into
// loadGeneratedArticles(dir). The real directory is never touched, so
// there is nothing for an interrupted run to leave behind.
describe('loadGeneratedArticles — filesystem, isolated to a temp fixture', () => {
  const testFiles = ['test-fixture-published.json', 'test-fixture-unpublished.json', 'test-fixture-malformed.json'];
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-test-'));
  });

  afterEach(() => {
    // Tidiness only. Unlike the old version, nothing about repository
    // safety depends on this running -- the temp dir is outside the repo.
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('loads only published:true (absent defaults to excluded, matching the published:false default in generate.mjs) articles', () => {
    fs.writeFileSync(path.join(dir, testFiles[0]), JSON.stringify(generatedArticle('pub', { published: true })));
    fs.writeFileSync(path.join(dir, testFiles[1]), JSON.stringify(generatedArticle('unpub', { published: false })));
    const loaded = loadGeneratedArticles(dir);
    const slugs = loaded.map((a) => a.slug);
    assert.ok(slugs.includes('pub'));
    assert.ok(!slugs.includes('unpub'), 'published:false must never be merged — flipping to true is a separate, deliberate edit');
  });

  test('a malformed JSON file is skipped with a warning, not a crash', () => {
    fs.writeFileSync(path.join(dir, testFiles[2]), '{ this is not valid json');
    assert.doesNotThrow(() => loadGeneratedArticles(dir));
  });

  test('the default (no argument) still reads the real GENERATED_DIR -- production behavior unchanged', () => {
    // Read-only: proves the parameter is genuinely optional and that
    // fetch-blog-data.js's argument-less call is unaffected by 6B2a.
    assert.doesNotThrow(() => loadGeneratedArticles());
    assert.ok(Array.isArray(loadGeneratedArticles()));
  });

  // THE GUARD. Asserts the thing this batch exists to guarantee: not that
  // fixtures are cleaned up afterwards, but that they were never written
  // to the real directory in the first place.
  test('no fixture is ever written into the real src/data/generated-articles/', () => {
    for (const f of testFiles) {
      const real = path.join(GENERATED_DIR, f);
      assert.equal(
        fs.existsSync(real),
        false,
        `${f} exists under the real GENERATED_DIR. This suite must never write there -- an interrupted run would leave a published:true fixture in the directory the production build reads.`,
      );
    }
  });
});
