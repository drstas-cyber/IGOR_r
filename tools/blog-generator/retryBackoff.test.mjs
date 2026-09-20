import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeNextEligibleRetryAt, intervalForRejectionCount } from './retryBackoff.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('intervalForRejectionCount — canonical frozen policy', () => {
  test('maps rejection counts to 7, 14, 30, then permanently capped 60 days', () => {
    const expectedDays = new Map([
      [1, 7],
      [2, 14],
      [3, 30],
      [4, 60],
      [5, 60],
      [1_000_000, 60],
    ]);
    for (const [count, days] of expectedDays) {
      assert.equal(intervalForRejectionCount(count), days * DAY_MS, `rejection count ${count}`);
    }
  });

  test('rejects zero, negative, fractional, NaN, and non-number counts', () => {
    for (const count of [0, -1, 1.5, Number.NaN, '1', null, undefined]) {
      assert.throws(() => intervalForRejectionCount(count), /positive integer/);
    }
  });
});

describe('computeNextEligibleRetryAt', () => {
  test('computes representative retries with the canonical frozen policy', () => {
    const cases = [
      [1, '2026-09-27T23:59:59.999Z'],
      [2, '2026-10-04T23:59:59.999Z'],
      [3, '2026-10-20T23:59:59.999Z'],
      [4, '2026-11-19T23:59:59.999Z'],
      [5, '2026-11-19T23:59:59.999Z'],
    ];
    for (const [rejectionCount, expected] of cases) {
      assert.equal(computeNextEligibleRetryAt({
        rejectedAt: '2026-09-20T23:59:59.999Z',
        rejectionCount,
        intervalForCount: intervalForRejectionCount,
      }), expected);
    }
  });

  test('handles a millisecond boundary and emits canonical UTC', () => {
    const result = computeNextEligibleRetryAt({
      rejectedAt: '2026-09-20T23:59:59.999Z',
      rejectionCount: 1,
      intervalForCount: () => 1,
    });
    assert.equal(result, '2026-09-21T00:00:00.000Z');
  });

  test('rejects invalid counts', () => {
    for (const rejectionCount of [0, -1, 1.5, '1', null]) {
      assert.throws(() => computeNextEligibleRetryAt({
        rejectedAt: '2026-09-20T00:00:00.000Z',
        rejectionCount,
        intervalForCount: () => DAY_MS,
      }), /positive integer/);
    }
  });

  test('rejects invalid or non-UTC timestamps', () => {
    for (const rejectedAt of ['bad', '2026-09-20T00:00:00', '2026-09-19T17:00:00-07:00']) {
      assert.throws(() => computeNextEligibleRetryAt({
        rejectedAt,
        rejectionCount: 1,
        intervalForCount: () => DAY_MS,
      }), /rejectedAt/);
    }
  });

  test('fails closed when policy is missing or returns an invalid interval', () => {
    assert.throws(() => computeNextEligibleRetryAt({
      rejectedAt: '2026-09-20T00:00:00.000Z', rejectionCount: 1,
    }), /policy function is required/);
    for (const interval of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      assert.throws(() => computeNextEligibleRetryAt({
        rejectedAt: '2026-09-20T00:00:00.000Z',
        rejectionCount: 1,
        intervalForCount: () => interval,
      }), /positive safe-integer/);
    }
  });
});
