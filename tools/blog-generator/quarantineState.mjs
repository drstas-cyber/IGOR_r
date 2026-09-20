import { isValidIsoUtc } from './articleLifecycle.mjs';
import { computeNextEligibleRetryAt } from './retryBackoff.mjs';

const RECORD_KEYS = [
  'topic',
  'status',
  'rejection_reason',
  'rejection_count',
  'last_rejected_at',
  'next_eligible_retry_at',
];

function topicStrings(topics) {
  if (!Array.isArray(topics)) throw new Error('quarantine state: topics must be an array');
  return topics.map((entry, index) => {
    const topic = typeof entry === 'string' ? entry : entry?.topic;
    if (typeof topic !== 'string' || topic.length === 0) {
      throw new Error(`quarantine state: topics[${index}] has no non-empty topic string`);
    }
    return topic;
  });
}

function validateRecordShape(record, index) {
  const label = `quarantine record ${index}`;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${label}: must be an object`);
  }
  const keys = Object.keys(record);
  const missing = RECORD_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(record, key));
  const extra = keys.filter((key) => !RECORD_KEYS.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`${label}: must contain exactly ${RECORD_KEYS.join(', ')}; missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'}`);
  }
  if (typeof record.topic !== 'string' || record.topic.length === 0 || record.topic !== record.topic.trim()) {
    throw new Error(`${label}: topic must be a non-empty exact string without surrounding whitespace`);
  }
  if (record.status !== 'quarantined') {
    throw new Error(`${label}: status must be "quarantined"`);
  }
  if (typeof record.rejection_reason !== 'string' || record.rejection_reason.trim().length === 0) {
    throw new Error(`${label}: rejection_reason must be a non-empty string`);
  }
  if (!Number.isInteger(record.rejection_count) || record.rejection_count <= 0) {
    throw new Error(`${label}: rejection_count must be a positive integer`);
  }
  if (!isValidIsoUtc(record.last_rejected_at)) {
    throw new Error(`${label}: last_rejected_at must be a canonical ISO-8601 UTC timestamp ending in Z`);
  }
  if (!isValidIsoUtc(record.next_eligible_retry_at)) {
    throw new Error(`${label}: next_eligible_retry_at must be a canonical ISO-8601 UTC timestamp ending in Z`);
  }
  if (Date.parse(record.next_eligible_retry_at) < Date.parse(record.last_rejected_at)) {
    throw new Error(`${label}: next_eligible_retry_at cannot precede last_rejected_at`);
  }
}

export function validateQuarantineRecords(records, topics) {
  if (!Array.isArray(records)) throw new Error('quarantine state: top-level value must be an array');
  const knownTopics = topics === undefined ? null : topicStrings(topics);
  const exactKnown = knownTopics ? new Set(knownTopics) : null;
  const exactSeen = new Set();
  const foldedSeen = new Map();

  records.forEach((record, index) => {
    validateRecordShape(record, index);
    if (exactSeen.has(record.topic)) {
      throw new Error(`quarantine state: duplicate exact topic ${JSON.stringify(record.topic)}`);
    }
    exactSeen.add(record.topic);

    const folded = record.topic.toLocaleLowerCase('en-US');
    if (foldedSeen.has(folded)) {
      throw new Error(`quarantine state: case-only topic ambiguity between ${JSON.stringify(foldedSeen.get(folded))} and ${JSON.stringify(record.topic)}`);
    }
    foldedSeen.set(folded, record.topic);

    if (exactKnown && !exactKnown.has(record.topic)) {
      throw new Error(`quarantine state: unknown topic ${JSON.stringify(record.topic)}; exact topics.json identity is required`);
    }
  });

  return records;
}

export function parseQuarantineState(jsonText) {
  if (typeof jsonText !== 'string') throw new Error('quarantine state: JSON input must be a string');
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`quarantine state: malformed JSON: ${error.message}`);
  }
  validateQuarantineRecords(parsed);
  return parsed;
}

export function isRetryEligible(record, now) {
  validateQuarantineRecords([record]);
  if (!isValidIsoUtc(now)) {
    throw new Error(`quarantine state: now must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(now)}`);
  }
  return Date.parse(now) >= Date.parse(record.next_eligible_retry_at);
}

export function classifyQuarantine(record, now) {
  const retryEligible = isRetryEligible(record, now);
  return {
    topic: record.topic,
    status: retryEligible ? 'retry-eligible' : 'active',
    retryEligible,
    nextEligibleRetryAt: record.next_eligible_retry_at,
  };
}

export function recordTopicRejection(records, event, policy, topics) {
  validateQuarantineRecords(records, topics);
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('recordTopicRejection: event must be an object');
  }
  const { topic, rejectionReason, rejectedAt } = event;
  if (typeof topic !== 'string' || topic.length === 0) {
    throw new Error('recordTopicRejection: event.topic must be a non-empty exact string');
  }
  if (!topicStrings(topics).includes(topic)) {
    throw new Error(`recordTopicRejection: unknown topic ${JSON.stringify(topic)}; exact topics.json identity is required`);
  }
  if (typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
    throw new Error('recordTopicRejection: event.rejectionReason must be a non-empty string');
  }
  if (!isValidIsoUtc(rejectedAt)) {
    throw new Error('recordTopicRejection: event.rejectedAt must be a canonical ISO-8601 UTC timestamp ending in Z');
  }
  if (!policy || typeof policy.intervalForCount !== 'function') {
    throw new Error('recordTopicRejection: policy.intervalForCount is required');
  }

  const existingIndex = records.findIndex((record) => record.topic === topic);
  const rejectionCount = existingIndex === -1 ? 1 : records[existingIndex].rejection_count + 1;
  const canonicalRejectedAt = new Date(Date.parse(rejectedAt)).toISOString();
  if (existingIndex !== -1 && Date.parse(canonicalRejectedAt) < Date.parse(records[existingIndex].last_rejected_at)) {
    throw new Error('recordTopicRejection: rejectedAt cannot precede the existing last_rejected_at');
  }
  const nextEligibleRetryAt = computeNextEligibleRetryAt({
    rejectedAt: canonicalRejectedAt,
    rejectionCount,
    intervalForCount: policy.intervalForCount,
  });
  const nextRecord = {
    topic,
    status: 'quarantined',
    rejection_reason: rejectionReason,
    rejection_count: rejectionCount,
    last_rejected_at: canonicalRejectedAt,
    next_eligible_retry_at: nextEligibleRetryAt,
  };

  const output = records.map((record) => ({ ...record }));
  if (existingIndex === -1) output.push(nextRecord);
  else output[existingIndex] = nextRecord;
  validateQuarantineRecords(output, topics);
  return output;
}
