import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQuarantine,
  isRetryEligible,
  parseQuarantineState,
  recordTopicRejection,
  validateQuarantineRecords,
} from './quarantineState.mjs';
import { intervalForRejectionCount } from './retryBackoff.mjs';

const TOPICS = [{ topic: 'Topic One', target_keyword: 'one' }, { topic: 'Topic Two', target_keyword: 'two' }];
const POLICY = { intervalForCount: intervalForRejectionCount };

function record(overrides = {}) {
  return {
    topic: 'Topic One',
    status: 'quarantined',
    rejection_reason: 'Layer 2 finding',
    rejection_count: 1,
    last_rejected_at: '2026-09-20T12:00:00.000Z',
    next_eligible_retry_at: '2026-09-27T12:00:00.000Z',
    ...overrides,
  };
}

describe('parseQuarantineState and validation', () => {
  test('parses an empty future state file and valid records', () => {
    assert.deepEqual(parseQuarantineState('[]'), []);
    assert.deepEqual(parseQuarantineState(JSON.stringify([record()])), [record()]);
    assert.equal(validateQuarantineRecords([record()], TOPICS).length, 1);
  });

  test('fails closed on malformed JSON, non-array state, and malformed records', () => {
    assert.throws(() => parseQuarantineState('{'), /malformed JSON/);
    assert.throws(() => parseQuarantineState('{}'), /top-level value must be an array/);
    assert.throws(() => parseQuarantineState(JSON.stringify([{ topic: 'Topic One' }])), /must contain exactly/);
    assert.throws(() => validateQuarantineRecords([record({ status: 'ready' })], TOPICS), /quarantined/);
    assert.throws(() => validateQuarantineRecords([record({ rejection_count: 0 })], TOPICS), /positive integer/);
  });

  test('rejects invalid and non-monotonic timestamps', () => {
    assert.throws(() => validateQuarantineRecords([record({ last_rejected_at: 'bad' })], TOPICS), /last_rejected_at/);
    assert.throws(() => validateQuarantineRecords([record({ next_eligible_retry_at: '2026-09-19T12:00:00.000Z' })], TOPICS), /cannot precede/);
  });

  test('rejects duplicate exact and case-only topic identities', () => {
    assert.throws(() => validateQuarantineRecords([record(), record()], TOPICS), /duplicate exact/);
    assert.throws(() => validateQuarantineRecords([
      record(),
      record({ topic: 'topic one' }),
    ]), /case-only/);
  });

  test('rejects unknown topics using exact sourceTopic semantics', () => {
    assert.throws(() => validateQuarantineRecords([record({ topic: 'Topic one' })], TOPICS), /unknown topic/);
    assert.throws(() => validateQuarantineRecords([record({ topic: 'Unknown' })], TOPICS), /unknown topic/);
  });
});

describe('retry classification', () => {
  test('is unavailable before the boundary and eligible at the boundary', () => {
    assert.equal(isRetryEligible(record(), '2026-09-27T11:59:59.999Z'), false);
    assert.equal(isRetryEligible(record(), '2026-09-27T12:00:00.000Z'), true);
    assert.deepEqual(classifyQuarantine(record(), '2026-09-27T11:59:59.999Z'), {
      topic: 'Topic One',
      status: 'active',
      retryEligible: false,
      nextEligibleRetryAt: '2026-09-27T12:00:00.000Z',
    });
    assert.equal(classifyQuarantine(record(), '2026-09-27T12:00:00.000Z').status, 'retry-eligible');
  });

  test('rejects malformed now rather than guessing', () => {
    assert.throws(() => isRetryEligible(record(), '2026-09-27T05:00:00-07:00'), /now/);
  });
});

describe('recordTopicRejection', () => {
  test('creates first quarantine state without mutating caller input', () => {
    const input = [];
    const output = recordTopicRejection(input, {
      topic: 'Topic One',
      rejectionReason: 'First rejection',
      rejectedAt: '2026-09-20T12:00:00Z',
    }, POLICY, TOPICS);
    assert.deepEqual(input, []);
    assert.deepEqual(output, [record({ rejection_reason: 'First rejection' })]);
  });

  test('increments repeated rejection and replaces reason/timestamps', () => {
    const output = recordTopicRejection([record()], {
      topic: 'Topic One',
      rejectionReason: 'Second rejection',
      rejectedAt: '2026-09-28T12:00:00.000Z',
    }, POLICY, TOPICS);
    assert.equal(output[0].rejection_count, 2);
    assert.equal(output[0].rejection_reason, 'Second rejection');
    assert.equal(output[0].last_rejected_at, '2026-09-28T12:00:00.000Z');
    assert.equal(output[0].next_eligible_retry_at, '2026-10-12T12:00:00.000Z');
  });

  test('preserves exact topic matching and refuses unknown topics', () => {
    assert.throws(() => recordTopicRejection([], {
      topic: 'topic one', rejectionReason: 'x', rejectedAt: '2026-09-20T12:00:00.000Z',
    }, POLICY, TOPICS), /unknown topic/);
  });

  test('fails closed without policy and on time reversal', () => {
    assert.throws(() => recordTopicRejection([], {
      topic: 'Topic One', rejectionReason: 'x', rejectedAt: '2026-09-20T12:00:00.000Z',
    }, null, TOPICS), /policy/);
    assert.throws(() => recordTopicRejection([record()], {
      topic: 'Topic One', rejectionReason: 'older', rejectedAt: '2026-09-19T12:00:00.000Z',
    }, POLICY, TOPICS), /cannot precede/);
  });

  test('exposes an interface that can be combined with external article and open-PR holds', () => {
    const quarantine = new Set([record().topic]);
    const articleHolds = new Set(['Topic Two']);
    const openPrHolds = new Set(['A third topic']);
    const combined = new Set([...articleHolds, ...openPrHolds, ...quarantine]);
    assert.deepEqual([...combined].sort(), ['A third topic', 'Topic One', 'Topic Two']);
  });
});
