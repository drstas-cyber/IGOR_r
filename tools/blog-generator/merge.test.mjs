import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

describe('loadGeneratedArticles — filesystem, isolated to a temp fixture', () => {
  const testFiles = ['test-fixture-published.json', 'test-fixture-unpublished.json', 'test-fixture-malformed.json'];

  beforeEach(() => {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  });

  afterEach(() => {
    for (const f of testFiles) {
      const p = path.join(GENERATED_DIR, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  test('loads only published:true (or absent=default-excluded per generate.mjs\'s published:false default) articles', () => {
    fs.writeFileSync(path.join(GENERATED_DIR, testFiles[0]), JSON.stringify(generatedArticle('pub', { published: true })));
    fs.writeFileSync(path.join(GENERATED_DIR, testFiles[1]), JSON.stringify(generatedArticle('unpub', { published: false })));
    const loaded = loadGeneratedArticles();
    const slugs = loaded.map((a) => a.slug);
    assert.ok(slugs.includes('pub'));
    assert.ok(!slugs.includes('unpub'), 'published:false must never be merged — flipping to true is a separate, deliberate edit');
  });

  test('a malformed JSON file is skipped with a warning, not a crash', () => {
    fs.writeFileSync(path.join(GENERATED_DIR, testFiles[2]), '{ this is not valid json');
    assert.doesNotThrow(() => loadGeneratedArticles());
  });
});
