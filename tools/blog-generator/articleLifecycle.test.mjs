import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidIsoUtc,
  prepareFirstPublication,
  recordSubstantiveModification,
  stampApproval,
  validateOptionalLifecycleMetadata,
} from './articleLifecycle.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function draft(overrides = {}) {
  return {
    slug: 'sample-article',
    created_at: '2026-09-01T12:00:00.000Z',
    published: false,
    jsonLd: {
      datePublished: '2026-09-01T12:00:00.000Z',
      dateModified: '2026-09-01T12:00:00.000Z',
    },
    ...overrides,
  };
}

function approved(overrides = {}) {
  return {
    ...draft(),
    approved_at: '2026-09-02T12:00:00.000Z',
    approval_pr: 57,
    approval_merge_sha: SHA,
    published_at: null,
    ...overrides,
  };
}

describe('isValidIsoUtc', () => {
  test('accepts canonical UTC timestamps with or without milliseconds', () => {
    assert.equal(isValidIsoUtc('2026-09-01T12:30:00.000Z'), true);
    assert.equal(isValidIsoUtc('2026-09-01T12:30:00Z'), true);
  });

  test('rejects offsets, local timestamps, impossible dates, and excess precision', () => {
    assert.equal(isValidIsoUtc('2026-09-01T05:30:00-07:00'), false);
    assert.equal(isValidIsoUtc('2026-09-01T12:30:00'), false);
    assert.equal(isValidIsoUtc('2026-02-30T12:30:00.000Z'), false);
    assert.equal(isValidIsoUtc('2026-09-01T12:30:00.0000Z'), false);
  });
});

describe('validateOptionalLifecycleMetadata', () => {
  test('allows a legacy article with all lifecycle fields absent', () => {
    assert.deepEqual(validateOptionalLifecycleMetadata(draft()), { valid: true, errors: [] });
    assert.deepEqual(validateOptionalLifecycleMetadata(draft({ published: true })), { valid: true, errors: [] });
  });

  test('accepts complete approval provenance with null published_at', () => {
    assert.deepEqual(validateOptionalLifecycleMetadata(approved()), { valid: true, errors: [] });
  });

  test('rejects every partial approval-provenance shape', () => {
    for (const partial of [
      { approved_at: '2026-09-02T12:00:00.000Z' },
      { approval_pr: 57 },
      { approval_merge_sha: SHA },
      { approved_at: '2026-09-02T12:00:00.000Z', approval_pr: 57 },
    ]) {
      assert.equal(validateOptionalLifecycleMetadata(draft(partial)).valid, false);
    }
  });

  test('rejects malformed provenance values', () => {
    assert.equal(validateOptionalLifecycleMetadata(approved({ approved_at: '2026-09-02T05:00:00-07:00' })).valid, false);
    assert.equal(validateOptionalLifecycleMetadata(approved({ approval_pr: 0 })).valid, false);
    assert.equal(validateOptionalLifecycleMetadata(approved({ approval_merge_sha: 'abc' })).valid, false);
  });

  test('rejects false with a publication timestamp', () => {
    const result = validateOptionalLifecycleMetadata(approved({ published_at: '2026-09-03T12:00:00.000Z' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /published:false/);
  });

  test('requires published_at when a future-metadata article is published', () => {
    const result = validateOptionalLifecycleMetadata(approved({ published: true, published_at: null }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /published:true/);
  });
});

describe('stampApproval', () => {
  test('returns a new approved draft without changing created_at or the caller', () => {
    const input = draft();
    const output = stampApproval(input, {
      approvedAt: '2026-09-02T12:00:00Z',
      approvalPr: 57,
      approvalMergeSha: SHA,
    });
    assert.notEqual(output, input);
    assert.equal(output.created_at, input.created_at);
    assert.equal(output.approved_at, '2026-09-02T12:00:00.000Z');
    assert.equal(output.approval_pr, 57);
    assert.equal(output.approval_merge_sha, SHA);
    assert.equal(output.published_at, null);
    assert.equal(Object.hasOwn(input, 'approved_at'), false);
  });

  test('is idempotent for identical provenance and refuses replacement', () => {
    const input = approved();
    const same = stampApproval(input, {
      approvedAt: input.approved_at,
      approvalPr: input.approval_pr,
      approvalMergeSha: input.approval_merge_sha,
    });
    assert.deepEqual(same, input);
    assert.throws(() => stampApproval(input, {
      approvedAt: '2026-09-02T13:00:00.000Z',
      approvalPr: 57,
      approvalMergeSha: SHA,
    }), /immutable/);
  });

  test('rejects published articles and malformed input', () => {
    assert.throws(() => stampApproval(draft({ published: true }), {
      approvedAt: '2026-09-02T12:00:00.000Z', approvalPr: 57, approvalMergeSha: SHA,
    }), /unpublished/);
    assert.throws(() => stampApproval(draft(), {
      approvedAt: 'bad', approvalPr: 57, approvalMergeSha: SHA,
    }), /approvedAt/);
  });
});

describe('prepareFirstPublication', () => {
  test('sets the first-publication state and preserves generation provenance', () => {
    const input = approved();
    const output = prepareFirstPublication(input, { publishedAt: '2026-09-03T12:00:00Z' });
    assert.equal(output.published, true);
    assert.equal(output.published_at, '2026-09-03T12:00:00.000Z');
    assert.equal(output.created_at, input.created_at);
    assert.equal(output.jsonLd.datePublished, output.published_at);
    assert.equal(output.jsonLd.dateModified, output.published_at);
    assert.equal(input.published, false);
  });

  test('clamps a substantive pre-publication edit to the public date', () => {
    const output = prepareFirstPublication(approved(), {
      publishedAt: '2026-09-03T12:00:00.000Z',
      substantiveModifiedAt: '2026-09-02T18:00:00.000Z',
    });
    assert.equal(output.jsonLd.dateModified, output.published_at);
  });

  test('retains a substantive modification after publication', () => {
    const output = prepareFirstPublication(approved(), {
      publishedAt: '2026-09-03T12:00:00.000Z',
      substantiveModifiedAt: '2026-09-04T12:00:00.000Z',
    });
    assert.equal(output.jsonLd.dateModified, '2026-09-04T12:00:00.000Z');
  });

  test('is idempotent for a repeated consistent publication attempt', () => {
    const once = prepareFirstPublication(approved(), { publishedAt: '2026-09-03T12:00:00.000Z' });
    const twice = prepareFirstPublication(once, { publishedAt: '2026-09-03T12:00:00.000Z' });
    assert.deepEqual(twice, once);

    const prePublicationEdit = prepareFirstPublication(approved(), {
      publishedAt: '2026-09-03T12:00:00.000Z',
      substantiveModifiedAt: '2026-09-02T18:00:00.000Z',
    });
    assert.deepEqual(prepareFirstPublication(prePublicationEdit, {
      publishedAt: '2026-09-03T12:00:00.000Z',
      substantiveModifiedAt: '2026-09-02T18:00:00.000Z',
    }), prePublicationEdit);
  });

  test('rejects attempts to change first publication or publish before creation/approval', () => {
    const once = prepareFirstPublication(approved(), { publishedAt: '2026-09-03T12:00:00.000Z' });
    assert.throws(() => prepareFirstPublication(once, { publishedAt: '2026-09-04T12:00:00.000Z' }), /immutable/);
    assert.throws(() => prepareFirstPublication(approved(), { publishedAt: '2026-08-31T12:00:00.000Z' }), /created_at/);
    assert.throws(() => prepareFirstPublication(approved(), { publishedAt: '2026-09-02T11:00:00.000Z' }), /approved_at/);
  });

  test('rejects a legacy published article as a first-publication candidate', () => {
    assert.throws(() => prepareFirstPublication(draft({ published: true }), {
      publishedAt: '2026-09-03T12:00:00.000Z',
    }), /approval provenance/);
  });

  test('fails explicitly on malformed or regressive existing public dates', () => {
    const published = prepareFirstPublication(approved(), { publishedAt: '2026-09-03T12:00:00.000Z' });
    assert.throws(() => prepareFirstPublication({
      ...published,
      jsonLd: { ...published.jsonLd, dateModified: 'bad' },
    }, { publishedAt: published.published_at }), /datePublished and jsonLd.dateModified/);
    assert.throws(() => prepareFirstPublication({
      ...published,
      jsonLd: { ...published.jsonLd, dateModified: '2026-09-02T12:00:00.000Z' },
    }, { publishedAt: published.published_at }), /cannot precede/);
  });
});

describe('recordSubstantiveModification', () => {
  test('updates dateModified without changing first-publication fields', () => {
    const published = prepareFirstPublication(approved(), { publishedAt: '2026-09-03T12:00:00.000Z' });
    const output = recordSubstantiveModification(published, { modifiedAt: '2026-09-05T12:00:00Z' });
    assert.equal(output.published_at, published.published_at);
    assert.equal(output.jsonLd.datePublished, published.jsonLd.datePublished);
    assert.equal(output.jsonLd.dateModified, '2026-09-05T12:00:00.000Z');
  });

  test('is idempotent and prevents dateModified from moving backwards', () => {
    const published = prepareFirstPublication(approved(), { publishedAt: '2026-09-03T12:00:00.000Z' });
    const changed = recordSubstantiveModification(published, { modifiedAt: '2026-09-05T12:00:00.000Z' });
    assert.deepEqual(recordSubstantiveModification(changed, { modifiedAt: '2026-09-05T12:00:00.000Z' }), changed);
    assert.throws(() => recordSubstantiveModification(changed, { modifiedAt: '2026-09-04T12:00:00.000Z' }), /backwards/);
  });

  test('rejects malformed timestamps and legacy published articles', () => {
    assert.throws(() => recordSubstantiveModification(draft({ published: true }), { modifiedAt: '2026-09-05T12:00:00.000Z' }), /published_at/);
    const published = prepareFirstPublication(approved(), { publishedAt: '2026-09-03T12:00:00.000Z' });
    assert.throws(() => recordSubstantiveModification(published, { modifiedAt: 'bad' }), /modifiedAt/);
  });
});
