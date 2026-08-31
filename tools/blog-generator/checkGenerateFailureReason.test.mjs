import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkGenerateFailureReason } from './checkGenerateFailureReason.mjs';
import { QUEUE_EXHAUSTED_MARKER } from './queueExhaustedMarker.mjs';

// checkGenerateFailureReason — the notification-hardening pass's Task 3
// (2026-08-31). Determines what generate-article.yml's red-run email
// should say, in strict precedence order:
//   1. Structured failure class from .last-run-report.json, when it exists
//      and parses -- name the real cause, quote the specific findings.
//   2. Captured job log text, if no structured report exists.
//   3. The neutral "cause could not be determined" message, if there's no
//      log either.
// The trap this whole module exists to avoid: "no report" does NOT mean
// "queue exhausted" -- generate.mjs also exits early with no report on a
// missing ANTHROPIC_API_KEY, a missing GITHUB_REPOSITORY, and any
// fail-closed throw in topicAvailability's gh/git state gathering (before
// this pass; see generate.mjs's early-exit reports, Task 3). Mirrors
// checkRejectedMarker.mjs's fail-closed,
// three-state-aware pure-core shape.

function fixedReport(overrides = {}) {
  return {
    generatedAt: '2026-08-31T00:00:00.000Z',
    topic: { topic: 'Some Topic', target_keyword: 'kw' },
    ...overrides,
  };
}

describe('checkGenerateFailureReason — precedence 1: structured report', () => {
  test('outcome identity_incomplete -- names the real cause and quotes the missing elements', () => {
    const result = checkGenerateFailureReason({
      existsSync: (p) => p === 'report.json',
      readFileSync: () => JSON.stringify(fixedReport({
        outcome: 'identity_incomplete',
        identityErrors: ['missing DRE number', 'missing phone number'],
      })),
      reportPath: 'report.json',
      logPath: 'log.txt',
    });
    assert.equal(result.source, 'structured');
    assert.match(result.reason, /identity_incomplete/);
    assert.match(result.detail, /missing DRE number/);
    assert.match(result.detail, /missing phone number/);
    assert.doesNotMatch(result.detail, /очередь тем/i, 'must never mention the topic queue for a real gate-trip cause');
    assert.equal(result.failureClass, 'no_article');
  });

  test('outcome schema_invalid -- names it, quotes schemaErrors', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(fixedReport({ outcome: 'schema_invalid', schemaErrors: ['meta_description too short'] })),
    });
    assert.equal(result.source, 'structured');
    assert.match(result.reason, /schema_invalid/);
    assert.match(result.detail, /meta_description too short/);
  });

  test('outcome internal_link_invalid -- names it, quotes internalLinkErrors', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(fixedReport({ outcome: 'internal_link_invalid', internalLinkErrors: ['invented URL /fake-page/'] })),
    });
    assert.equal(result.source, 'structured');
    assert.match(result.reason, /internal_link_invalid/);
    assert.match(result.detail, /invented URL/);
  });

  test('outcome skipped (Layer 1/2/3 gate trip) -- named as gate_trip, findings summarized from layer1/2/3', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(fixedReport({
        outcome: 'skipped',
        layer1: { tripped: true, findings: [{ category: 'exclusivity', subcategory: 'only', matchedText: 'only we' }] },
        layer2: { tripped: false, checklist: {} },
        layer3: { tripped: false },
      })),
    });
    assert.equal(result.source, 'structured');
    assert.match(result.reason, /gate_trip/);
    assert.match(result.detail, /only we/);
  });

  test('outcome generated (a real article WAS produced, a LATER step failed) -- failureClass article_stranded, slug carried', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(fixedReport({ outcome: 'generated', article: { title: 'X', slug: 'some-real-slug' } })),
    });
    assert.equal(result.source, 'structured');
    assert.equal(result.failureClass, 'article_stranded');
    assert.equal(result.slug, 'some-real-slug');
    assert.match(result.detail, /some-real-slug/);
  });

  test('outcome missing_api_key -- names it plainly, no invented cause', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ generatedAt: '2026-08-31T00:00:00.000Z', outcome: 'missing_api_key' }),
    });
    assert.equal(result.source, 'structured');
    assert.match(result.reason, /ANTHROPIC_API_KEY/);
    assert.equal(result.failureClass, 'no_article');
    assert.equal(result.slug, null);
  });

  test('outcome missing_repository -- names it plainly', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ generatedAt: '2026-08-31T00:00:00.000Z', outcome: 'missing_repository' }),
    });
    assert.equal(result.source, 'structured');
    assert.match(result.reason, /GITHUB_REPOSITORY/);
  });

  test('outcome uncaught_exception -- quotes the REAL captured error message, not a guess', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({
        generatedAt: '2026-08-31T00:00:00.000Z',
        outcome: 'uncaught_exception',
        errorMessage: '[topicAvailability] gh pr list failed: simulated CI outage.',
      }),
    });
    assert.equal(result.source, 'structured');
    assert.match(result.detail, /\[topicAvailability\] gh pr list failed: simulated CI outage\./);
  });

  test('an UNRECOGNIZED outcome value -- NOT treated as structured, falls through to the log/neutral precedence instead of guessing', () => {
    const result = checkGenerateFailureReason({
      existsSync: (p) => p === 'report.json', // report exists...
      readFileSync: (p) => (p === 'report.json' ? JSON.stringify(fixedReport({ outcome: 'some_future_outcome_this_module_has_never_seen' })) : ''),
      reportPath: 'report.json',
      logPath: 'log.txt', // ...but no log file either -> neutral
    });
    assert.equal(result.source, 'neutral');
  });

  test('a report file that exists but fails to parse -- treated the same as no report, falls through, never crashes', () => {
    const result = checkGenerateFailureReason({
      existsSync: (p) => p === 'report.json',
      readFileSync: (p) => (p === 'report.json' ? 'not valid json{{{' : ''),
      reportPath: 'report.json',
      logPath: 'log.txt',
    });
    assert.equal(result.source, 'neutral');
  });
});

describe('checkGenerateFailureReason — precedence 2: captured log text, no structured report', () => {
  test('the queue-exhausted sentinel in the log -- named specifically, a real deliberate signal, not a guess', () => {
    const result = checkGenerateFailureReason({
      existsSync: (p) => p === 'log.txt', // no report file
      readFileSync: (p) => (p === 'log.txt' ? `some setup noise\n::error::[generate] ${QUEUE_EXHAUSTED_MARKER} — every topic already attempted\nmore noise` : ''),
      reportPath: 'report.json',
      logPath: 'log.txt',
    });
    assert.equal(result.source, 'log');
    assert.match(result.reason, /очередь/i);
    assert.doesNotMatch(result.detail, /ANTHROPIC_API_KEY/);
    assert.equal(result.failureClass, 'no_article');
  });

  test('log text with no recognized sentinel -- says the cause could not be pinned down AND still attaches the captured log, does not guess', () => {
    const result = checkGenerateFailureReason({
      existsSync: (p) => p === 'log.txt',
      readFileSync: (p) => (p === 'log.txt' ? 'Error: ENOSPC: no space left on device' : ''),
      reportPath: 'report.json',
      logPath: 'log.txt',
    });
    assert.equal(result.source, 'log');
    assert.match(result.detail, /ENOSPC/, 'the real captured log must still be attached even when unrecognized');
    assert.doesNotMatch(result.detail, /очередь тем исчерпана/i, 'must not claim queue exhaustion when the sentinel is not present');
    assert.doesNotMatch(result.reason, /очередь/i, 'must not name a specific cause it does not have evidence for');
  });
});

describe('checkGenerateFailureReason — precedence 3: neutral, no report and no log', () => {
  test('neither report nor log exist -- the neutral message, no cause named, this is the genuinely-cannot-distinguish case', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => false,
      readFileSync: () => { throw new Error('must never be called when existsSync is false'); },
    });
    assert.equal(result.source, 'neutral');
    assert.doesNotMatch(result.detail, /очередь|API_KEY|REPOSITORY/i, 'no cause named -- this is the honest "we do not know" case');
  });

  test('report and log files exist but are both empty/whitespace-only -- same neutral outcome, not a crash', () => {
    const result = checkGenerateFailureReason({
      existsSync: () => true,
      readFileSync: (p) => (p.includes('report') ? '' : '   \n'),
    });
    assert.equal(result.source, 'neutral');
  });
});
