import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyApprovedBufferRecord,
  classifyBufferDepth,
  scanApprovedBuffer,
  sortApprovedBuffer,
  validateApprovalProvenance,
} from './approvedBuffer.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function article(slug = 'approved-article', overrides = {}) {
  return {
    id: `local-${slug}`,
    title: 'Approved Article',
    slug,
    content_html: '<p>No specific factual claim.</p>',
    meta_description: 'A sufficiently long metadata description for an approved-buffer fixture used by the complete test suite.',
    hero_image_url: null,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
    faqJsonLd: null,
    created_at: '2026-09-01T12:00:00.000Z',
    keywords: ['approved buffer'],
    citations: [],
    published: false,
    sourceTopic: `Topic for ${slug}`,
    approved_at: '2026-09-02T12:00:00.000Z',
    approval_pr: 57,
    approval_merge_sha: SHA,
    published_at: null,
    ...overrides,
  };
}

function record(slug = 'approved-article', overrides = {}) {
  return {
    path: `src/data/generated-articles/${slug}.json`,
    article: article(slug, overrides),
  };
}

describe('validateApprovalProvenance', () => {
  test('recognizes complete valid provenance', () => {
    assert.deepEqual(validateApprovalProvenance(article()), {
      present: true, complete: true, valid: true, errors: [],
    });
  });

  test('distinguishes absent provenance from malformed partial provenance', () => {
    const absent = article();
    delete absent.approved_at;
    delete absent.approval_pr;
    delete absent.approval_merge_sha;
    assert.deepEqual(validateApprovalProvenance(absent), {
      present: false, complete: false, valid: false, errors: [],
    });
    const partial = { ...absent, approved_at: '2026-09-02T12:00:00.000Z' };
    const result = validateApprovalProvenance(partial);
    assert.equal(result.present, true);
    assert.equal(result.complete, false);
    assert.equal(result.valid, false);
  });
});

describe('classifyApprovedBufferRecord', () => {
  test('marks a direct, valid, approved unpublished article eligible', () => {
    const result = classifyApprovedBufferRecord(record());
    assert.equal(result.classification, 'eligible');
  });

  test('surfaces published:false without provenance as unapproved, not fatal', () => {
    const value = article();
    delete value.approved_at;
    delete value.approval_pr;
    delete value.approval_merge_sha;
    delete value.published_at;
    const result = classifyApprovedBufferRecord({ path: `src/data/generated-articles/${value.slug}.json`, article: value });
    assert.equal(result.classification, 'unapproved');
    assert.equal(result.reason, 'approval-provenance-absent');
  });

  test('excludes rejected paths before trying to treat markers as articles', () => {
    const marker = { sourceTopic: 'Rejected topic', rejected: true };
    const result = classifyApprovedBufferRecord({
      path: 'src/data/generated-articles/.rejected/rejected-topic.json',
      article: marker,
    });
    assert.equal(result.classification, 'excluded');
    assert.equal(result.reason, 'rejected-path');
  });

  test('excludes non-generated paths and already-published articles', () => {
    assert.equal(classifyApprovedBufferRecord({ path: 'fixtures/approved-article.json', article: article() }).reason, 'not-normal-generated-article-path');
    assert.equal(classifyApprovedBufferRecord(record('approved-article', {
      published: true,
      published_at: '2026-09-03T12:00:00.000Z',
    })).reason, 'already-published');
  });

  test('fails closed on partial provenance, invalid schema, and conflicting filename identity', () => {
    const partial = article();
    delete partial.approval_pr;
    assert.throws(() => classifyApprovedBufferRecord({ path: `src/data/generated-articles/${partial.slug}.json`, article: partial }), /invalid article/);
    assert.throws(() => classifyApprovedBufferRecord(record('approved-article', { created_at: 'bad' })), /invalid article/);
    assert.throws(() => classifyApprovedBufferRecord({ path: 'src/data/generated-articles/other.json', article: article() }), /conflicting identity/);
  });
});

describe('scanApprovedBuffer', () => {
  test('sorts eligible articles by approved_at then slug and reports other classes', () => {
    const unapproved = article('unapproved');
    delete unapproved.approved_at;
    delete unapproved.approval_pr;
    delete unapproved.approval_merge_sha;
    delete unapproved.published_at;
    const result = scanApprovedBuffer([
      record('z-last', { approved_at: '2026-09-03T12:00:00.000Z' }),
      record('b-tie'),
      record('a-tie'),
      { path: 'src/data/generated-articles/unapproved.json', article: unapproved },
      { path: 'src/data/generated-articles/.rejected/x.json', article: {} },
    ]);
    assert.deepEqual(result.eligible.map((entry) => entry.article.slug), ['a-tie', 'b-tie', 'z-last']);
    assert.equal(result.unapproved.length, 1);
    assert.equal(result.excluded.length, 1);
    assert.equal(result.depth, 3);
    assert.equal(result.health, 'critical');
  });

  test('fails closed on duplicate slug, duplicate path, and case-only path identity', () => {
    assert.throws(() => scanApprovedBuffer([
      record('same'),
      { path: 'src/data/generated-articles/other-name.json', article: article('other-name', { slug: 'same' }) },
    ]), /duplicate slug/);
    assert.throws(() => scanApprovedBuffer([record('same'), record('same')]), /duplicate\/conflicting path/);
    assert.throws(() => scanApprovedBuffer([
      record('same'),
      { path: 'SRC/DATA/GENERATED-ARTICLES/SAME.JSON', article: article('same') },
    ]), /duplicate\/conflicting path|duplicate slug/);
  });

  test('does not mutate caller ordering', () => {
    const records = [record('z', { approved_at: '2026-09-03T12:00:00.000Z' }), record('a')];
    scanApprovedBuffer(records);
    assert.deepEqual(records.map((entry) => entry.article.slug), ['z', 'a']);
  });
});

describe('sortApprovedBuffer and depth thresholds', () => {
  test('sort helper accepts article objects directly', () => {
    const result = sortApprovedBuffer([
      article('b'),
      article('a'),
      article('older', { approved_at: '2026-09-01T13:00:00.000Z' }),
    ]);
    assert.deepEqual(result.map((entry) => entry.slug), ['older', 'a', 'b']);
  });

  test('classifies every frozen buffer-depth boundary', () => {
    assert.equal(classifyBufferDepth(0), 'broken');
    assert.equal(classifyBufferDepth(1), 'critical');
    assert.equal(classifyBufferDepth(3), 'critical');
    assert.equal(classifyBufferDepth(4), 'warning');
    assert.equal(classifyBufferDepth(6), 'warning');
    assert.equal(classifyBufferDepth(7), 'watch');
    assert.equal(classifyBufferDepth(13), 'watch');
    assert.equal(classifyBufferDepth(14), 'healthy');
    assert.equal(classifyBufferDepth(100), 'healthy');
    assert.throws(() => classifyBufferDepth(-1), /non-negative integer/);
  });
});
