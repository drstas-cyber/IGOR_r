import { isValidIsoUtc } from './articleLifecycle.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_DAYS_BY_REJECTION_COUNT = [7, 14, 30, 60];

export function intervalForRejectionCount(rejectionCount) {
  if (typeof rejectionCount !== 'number' || !Number.isInteger(rejectionCount) || rejectionCount <= 0) {
    throw new Error(`intervalForRejectionCount: rejectionCount must be a positive integer, got: ${JSON.stringify(rejectionCount)}`);
  }
  const cappedIndex = Math.min(rejectionCount, RETRY_DAYS_BY_REJECTION_COUNT.length) - 1;
  return RETRY_DAYS_BY_REJECTION_COUNT[cappedIndex] * DAY_MS;
}

export function computeNextEligibleRetryAt({ rejectedAt, rejectionCount, intervalForCount } = {}) {
  if (!isValidIsoUtc(rejectedAt)) {
    throw new Error(`computeNextEligibleRetryAt: rejectedAt must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(rejectedAt)}`);
  }
  if (!Number.isInteger(rejectionCount) || rejectionCount <= 0) {
    throw new Error(`computeNextEligibleRetryAt: rejectionCount must be a positive integer, got: ${JSON.stringify(rejectionCount)}`);
  }
  if (typeof intervalForCount !== 'function') {
    throw new Error('computeNextEligibleRetryAt: intervalForCount policy function is required');
  }

  const intervalMs = intervalForCount(rejectionCount);
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`computeNextEligibleRetryAt: policy must return a positive safe-integer millisecond interval, got: ${JSON.stringify(intervalMs)}`);
  }

  const nextMs = Date.parse(rejectedAt) + intervalMs;
  if (!Number.isSafeInteger(nextMs) || !Number.isFinite(nextMs)) {
    throw new Error('computeNextEligibleRetryAt: computed retry timestamp is outside the supported date range');
  }
  const next = new Date(nextMs);
  if (Number.isNaN(next.getTime())) {
    throw new Error('computeNextEligibleRetryAt: computed retry timestamp is invalid');
  }
  return next.toISOString();
}
