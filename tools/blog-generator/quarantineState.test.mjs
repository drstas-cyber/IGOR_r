import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQuarantine,
  isRetryEligible,
  parseQuarantineState,
  recordTopicRejection,
  validateQuarantineRecords,
} from './quarantineState.mjs';
import { intervalForRejectionCount, computeNextEligibleRetryAt } from './retryBackoff.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

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

// ---------------------------------------------------------------------------
// PHASE 3 MIGRATION SEED — the exact 3 records committed at cutover.
//
// These assert the REAL tracked file, not a fixture. Each record's retry
// date must reproduce from the canonical frozen policy applied to the
// `rejectedAt` value in the actual evidence (a `.rejected/` marker), so a
// hand-edit of either the seed or the policy fails here.
// ---------------------------------------------------------------------------
describe('Phase 3 migration seed — topic-quarantine.json on disk', () => {
  const SEED_PATH = path.join(HERE, 'topic-quarantine.json');
  const TOPICS_PATH = path.join(HERE, 'topics.json');
  const seed = () => parseQuarantineState(fs.readFileSync(SEED_PATH, 'utf8'));
  const topics = () => JSON.parse(fs.readFileSync(TOPICS_PATH, 'utf8'));

  const EXPECTED = [
    ['Understanding Mello-Roos Taxes in Temecula Valley Communities', '2026-08-25T14:38:39.617Z', '2026-09-01T14:38:39.617Z'],
    ['How Riverside County Property Tax Assessment Appeals Work', '2026-09-17T17:40:35.007Z', '2026-09-24T17:40:35.007Z'],
    ["Understanding California's Fair Employment and Housing Act for Buyers and Sellers", '2026-09-19T16:34:48.534Z', '2026-09-26T16:34:48.534Z'],
  ];

  test('contains exactly 3 records and validates against topics.json', () => {
    const records = seed();
    assert.equal(records.length, 3);
    assert.doesNotThrow(() => validateQuarantineRecords(records, topics()));
  });

  for (const [topic, lastRejected, nextRetry] of EXPECTED) {
    test(`seed record is exact and policy-derived: ${topic.slice(0, 48)}`, () => {
      const record = seed().find((r) => r.topic === topic);
      assert.ok(record, `missing seed record for ${JSON.stringify(topic)}`);
      assert.equal(record.status, 'quarantined');
      assert.equal(record.rejection_reason, 'gate_trip');
      assert.equal(record.rejection_count, 1);
      assert.equal(record.last_rejected_at, lastRejected);
      assert.equal(record.next_eligible_retry_at, nextRetry);
      // The retry date is not a typed-in constant: it must reproduce from
      // the canonical policy applied to the evidence timestamp.
      assert.equal(
        computeNextEligibleRetryAt({
          rejectedAt: record.last_rejected_at,
          rejectionCount: record.rejection_count,
          intervalForCount: intervalForRejectionCount,
        }),
        record.next_eligible_retry_at,
      );
    });
  }

  test('PR #47 topic is deliberately NOT seeded — no rejection evidence exists for it', () => {
    const pr47Topic = "Understanding Riverside County's Documentary Transfer Tax on Home Sales";
    assert.ok(topics().some((t) => t.topic === pr47Topic), 'the topic itself still exists in the queue');
    assert.equal(seed().some((r) => r.topic === pr47Topic), false);
  });

  test('deterministic order: last_rejected_at ASC, then topic ASC', () => {
    const records = seed();
    const sorted = [...records].sort((a, b) =>
      a.last_rejected_at.localeCompare(b.last_rejected_at) || a.topic.localeCompare(b.topic));
    assert.deepEqual(records.map((r) => r.topic), sorted.map((r) => r.topic));
  });

  test('Mello-Roos retry date is left in the past — deliberately NOT extended at cutover', () => {
    const record = seed().find((r) => r.topic.startsWith('Understanding Mello-Roos'));
    assert.ok(Date.parse(record.next_eligible_retry_at) < Date.parse('2026-09-21T00:00:00.000Z'));
    assert.equal(isRetryEligible(record, '2026-09-21T00:00:00.000Z'), true);
  });
});

describe('canonical frozen policy is pinned at the transition call site', () => {
  const TOPICS = [{ topic: 'Alpha Topic' }];

  test('recordTopicRejection with intervalForRejectionCount yields exactly +7d on a first rejection', () => {
    const [record] = recordTopicRejection(
      [],
      { topic: 'Alpha Topic', rejectionReason: 'gate_trip', rejectedAt: '2026-09-01T00:00:00.000Z' },
      { intervalForCount: intervalForRejectionCount },
      TOPICS,
    );
    assert.equal(record.rejection_count, 1);
    assert.equal(record.next_eligible_retry_at, '2026-09-08T00:00:00.000Z');
  });

  test('a repeat rejection increments to 2 and moves to the 14-day interval, same row', () => {
    const first = recordTopicRejection(
      [], { topic: 'Alpha Topic', rejectionReason: 'gate_trip', rejectedAt: '2026-09-01T00:00:00.000Z' },
      { intervalForCount: intervalForRejectionCount }, TOPICS,
    );
    const second = recordTopicRejection(
      first, { topic: 'Alpha Topic', rejectionReason: 'schema_invalid', rejectedAt: '2026-09-10T00:00:00.000Z' },
      { intervalForCount: intervalForRejectionCount }, TOPICS,
    );
    assert.equal(second.length, 1, 'same row, never a second row');
    assert.equal(second[0].rejection_count, 2);
    assert.equal(second[0].rejection_reason, 'schema_invalid');
    assert.equal(second[0].last_rejected_at, '2026-09-10T00:00:00.000Z');
    assert.equal(second[0].next_eligible_retry_at, '2026-09-24T00:00:00.000Z'); // +14d
  });

  // CLOSE-UNMERGED semantics: the transition is computed into a NEW array
  // and the caller's prior state is untouched. Closing the PR simply means
  // that new array never reaches main, so main keeps exactly what it had.
  test('close-unmerged: the attempted transition never mutates the prior state', () => {
    const before = recordTopicRejection(
      [], { topic: 'Alpha Topic', rejectionReason: 'gate_trip', rejectedAt: '2026-09-01T00:00:00.000Z' },
      { intervalForCount: intervalForRejectionCount }, TOPICS,
    );
    const snapshot = JSON.parse(JSON.stringify(before));
    recordTopicRejection(
      before, { topic: 'Alpha Topic', rejectionReason: 'gate_trip', rejectedAt: '2026-09-15T00:00:00.000Z' },
      { intervalForCount: intervalForRejectionCount }, TOPICS,
    );
    assert.deepEqual(before, snapshot, 'prior main state must be byte-identical after a discarded transition');
  });
});
