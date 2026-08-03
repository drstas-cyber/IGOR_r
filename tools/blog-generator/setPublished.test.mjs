import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { setPublishedInJson, articlePath } from './setPublished.mjs';

function articleJson(overrides = {}) {
  return JSON.stringify({
    id: 'local-abc',
    title: 'Test Article',
    slug: 'test-article',
    content_html: '<p>x</p>',
    published: false,
    ...overrides,
  });
}

describe('setPublishedInJson — publish (false -> true) and the unpublish rollback (true -> false)', () => {
  test('publish: false -> true', () => {
    const result = setPublishedInJson(articleJson({ published: false }), true);
    assert.equal(result.before, false);
    assert.equal(result.after, true);
    assert.equal(result.changed, true);
    assert.equal(JSON.parse(result.text).published, true);
  });

  test('rollback: true -> false, the exact operation the retrospective-audit unpublish line documents', () => {
    const result = setPublishedInJson(articleJson({ published: true }), false);
    assert.equal(result.before, true);
    assert.equal(result.after, false);
    assert.equal(result.changed, true);
    assert.equal(JSON.parse(result.text).published, false);
  });

  test('setting to the same value is a no-op, changed: false, still succeeds', () => {
    const result = setPublishedInJson(articleJson({ published: true }), true);
    assert.equal(result.changed, false);
  });

  test('preserves every other field untouched', () => {
    const result = setPublishedInJson(articleJson({ published: false, keywords: ['a', 'b'], citations: [{ id: '1' }] }), true);
    const parsed = JSON.parse(result.text);
    assert.deepEqual(parsed.keywords, ['a', 'b']);
    assert.deepEqual(parsed.citations, [{ id: '1' }]);
    assert.equal(parsed.title, 'Test Article');
  });

  test('slug is carried through in the result for logging', () => {
    const result = setPublishedInJson(articleJson({ slug: 'my-slug' }), true);
    assert.equal(result.slug, 'my-slug');
  });

  test('throws if the article has no boolean published field -- fails closed rather than silently adding one', () => {
    assert.throws(
      () => setPublishedInJson(JSON.stringify({ slug: 'x', title: 'x' }), true),
      /no boolean "published" field/
    );
  });

  test('output is valid, re-parseable JSON with a trailing newline (matches every other generated-articles/*.json file)', () => {
    const result = setPublishedInJson(articleJson(), true);
    assert.equal(result.text.endsWith('\n'), true);
    assert.doesNotThrow(() => JSON.parse(result.text));
  });
});

describe('articlePath', () => {
  test('builds the standard generated-articles path for a slug', () => {
    const p = articlePath('escrow-process-homebuyers-guide', 'C:/repo/src/data/generated-articles');
    assert.equal(p, path.join('C:/repo/src/data/generated-articles', 'escrow-process-homebuyers-guide.json'));
  });
});
