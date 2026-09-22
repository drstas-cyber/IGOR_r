import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getConsumedTopics,
  getMergedMarkerTopics,
  assertMergedMarkersAreQuarantined,
  quarantineBlockedTopics,
  pickNextEligibleTopic,
  getOpenPrAttemptedTopics,
  pickNextAvailableTopic,
} from './topicAvailability.mjs';
import { intervalForRejectionCount, computeNextEligibleRetryAt } from './retryBackoff.mjs';

function isolatedDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'topic-avail-test-'));
}

function writeJson(dir, name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data), 'utf8');
}

describe('getConsumedTopics — local ground truth (main\'s checkout)', () => {
  test('empty/nonexistent dir returns an empty set', () => {
    const dir = isolatedDir();
    const known = getConsumedTopics(path.join(dir, 'does-not-exist'));
    assert.equal(known.size, 0);
  });

  test('a real generated-article file with sourceTopic is included', () => {
    const dir = isolatedDir();
    writeJson(dir, 'some-article.json', { sourceTopic: 'What First-Time Buyers Should Know About Home Inspections', slug: 'x' });
    const known = getConsumedTopics(dir);
    assert.ok(known.has('What First-Time Buyers Should Know About Home Inspections'));
  });

  // MODEL A, the inversion of the retired behavior. This test previously
  // asserted a merged marker WAS included, which is exactly what made it a
  // permanent hold. It must now be excluded from consumed topics while
  // staying discoverable for the fail-closed consistency check.
  test('a merged rejected-attempt marker is NOT a consumed topic', () => {
    const dir = isolatedDir();
    fs.mkdirSync(path.join(dir, '.rejected'));
    writeJson(path.join(dir, '.rejected'), 'rejected-topic.json', { sourceTopic: 'Some Rejected Topic', rejectedAt: '2026-01-01T00:00:00.000Z' });
    assert.equal(getConsumedTopics(dir).has('Some Rejected Topic'), false);
    assert.ok(getMergedMarkerTopics(dir).has('Some Rejected Topic'), 'still discoverable for the consistency check');
  });

  test('a malformed JSON file is skipped, does not throw', () => {
    const dir = isolatedDir();
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ not valid json', 'utf8');
    assert.doesNotThrow(() => getConsumedTopics(dir));
  });

  test('a file with no sourceTopic field contributes nothing', () => {
    const dir = isolatedDir();
    writeJson(dir, 'no-source-topic.json', { slug: 'x', title: 'y' });
    const known = getConsumedTopics(dir);
    assert.equal(known.size, 0);
  });
});

describe('getOpenPrAttemptedTopics — fail-closed (2026-07-26)', () => {
  test('missing repo argument throws', () => {
    assert.throws(() => getOpenPrAttemptedTopics({}), /repo is required/i);
  });

  test('gh pr list failure THROWS, does not silently return empty', () => {
    const exec = () => { throw new Error('simulated gh auth failure'); };
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /gh pr list failed/i);
  });

  test('unparseable gh pr list output THROWS', () => {
    const exec = () => 'not json';
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /could not parse gh pr list/i);
  });

  test('gh pr list returning a non-array THROWS', () => {
    const exec = () => JSON.stringify({ not: 'an array' });
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /did not return an array/i);
  });

  test('a git fetch failure on one branch THROWS the whole call, does not skip that branch silently', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 1, headRefName: 'blog-generator/auto-123' }]);
      if (cmd.startsWith('gh api')) return JSON.stringify([{ status: 'added', filename: 'src/data/generated-articles/x.json' }]);
      if (cmd.startsWith('git fetch')) throw new Error('simulated network failure');
      throw new Error(`unexpected command in test: ${cmd}`);
    };
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /git fetch of open PR branch/i);
  });

  test('non-blog-generator branches are ignored (no fetch attempted)', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 1, headRefName: 'some-unrelated-branch' }]);
      throw new Error(`should not be called for an unrelated branch: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.equal(known.size, 0);
  });

  test('success case: one open PR branch, one article file, sourceTopic extracted', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 1, headRefName: 'blog-generator/auto-999' }]);
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.startsWith('gh api')) return JSON.stringify([{ status: 'added', filename: 'src/data/generated-articles/some-slug.json' }]);
      if (cmd.startsWith('git show')) return JSON.stringify({ sourceTopic: 'Understanding HOA Fees Before You Buy in a Planned Community', slug: 'some-slug' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has('Understanding HOA Fees Before You Buy in a Planned Community'));
  });

  test('success case: rejected-marker file on an open PR branch is also picked up', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 1, headRefName: 'blog-generator/rejected-999' }]);
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.startsWith('gh api')) return JSON.stringify([{ status: 'added', filename: 'src/data/generated-articles/.rejected/some-topic.json' }]);
      if (cmd.startsWith('git show')) return JSON.stringify({ sourceTopic: 'A Rejected Topic On A PR Branch', rejectedAt: '2026-01-01T00:00:00.000Z' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has('A Rejected Topic On A PR Branch'));
  });

  test('success case: a modified rejected-marker file on an open PR is held', () => {
    const topic = 'Understanding Mello-Roos Taxes in Temecula Valley Communities';
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 56, headRefName: 'blog-generator/rejected-56' }]);
      if (cmd.startsWith('gh api')) return JSON.stringify([
        {
          status: 'modified',
          filename: 'src/data/generated-articles/.rejected/understanding-mello-roos-taxes-in-temecula-valley-communities.json',
        },
      ]);
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.startsWith('git show')) return JSON.stringify({ sourceTopic: topic, rejectedAt: '2026-09-22T00:00:00.000Z' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has(topic));
  });

  test('success case: a renamed generator artifact uses the destination path', () => {
    const topic = 'A Renamed Rejected Topic';
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 57, headRefName: 'blog-generator/rejected-57' }]);
      if (cmd.startsWith('gh api')) return JSON.stringify([
        {
          status: 'renamed',
          filename: 'src/data/generated-articles/.rejected/renamed-topic.json',
          previous_filename: 'src/data/generated-articles/.rejected/old-topic.json',
        },
      ]);
      if (cmd.startsWith('git fetch')) return '';
      if (cmd === 'git show FETCH_HEAD:src/data/generated-articles/.rejected/renamed-topic.json') {
        return JSON.stringify({ sourceTopic: topic, rejectedAt: '2026-09-22T00:00:00.000Z' });
      }
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has(topic));
  });

  test('multiple open PR branches: repeat run collision safety — two rejected attempts on the same topic, different run IDs, both readable with no error', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) {
        return JSON.stringify([
          { number: 1, headRefName: 'blog-generator/rejected-111' },
          { number: 1, headRefName: 'blog-generator/rejected-222' },
        ]);
      }
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.startsWith('gh api')) return JSON.stringify([{ status: 'added', filename: 'src/data/generated-articles/.rejected/same-topic.json' }]);
      if (cmd.startsWith('git show')) return JSON.stringify({ sourceTopic: 'A Topic That Keeps Tripping', rejectedAt: '2026-01-01T00:00:00.000Z' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const known = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(known.has('A Topic That Keeps Tripping'));
    assert.equal(known.size, 1, 'same topic from two branches should collapse to one entry, not error');
  });
});

describe('pickNextAvailableTopic — pure', () => {
  test('returns the first topic not in the attempted set', () => {
    const topics = [{ topic: 'A' }, { topic: 'B' }, { topic: 'C' }];
    const attempted = new Set(['A']);
    assert.deepEqual(pickNextAvailableTopic(topics, attempted), { topic: 'B' });
  });

  test('returns null when every topic has been attempted (queue exhausted, not an error)', () => {
    const topics = [{ topic: 'A' }, { topic: 'B' }];
    const attempted = new Set(['A', 'B']);
    assert.equal(pickNextAvailableTopic(topics, attempted), null);
  });

  test('empty topics array returns null', () => {
    assert.equal(pickNextAvailableTopic([], new Set()), null);
  });

  test('exact-string matching: whitespace/casing differences do NOT match — editing a topic\'s text makes it newly-eligible, deliberately', () => {
    const topics = [{ topic: 'What First-Time Buyers Should Know About Home Inspections' }];
    const attempted = new Set(['what first-time buyers should know about home inspections']); // different case
    assert.deepEqual(pickNextAvailableTopic(topics, attempted), topics[0], 'exact-string match only, case-sensitive — this is deliberate, not a bug');
  });
});

// ---------------------------------------------------------------------------
// PHASE 3 / MODEL A — quarantine-aware eligibility.
//
// Every test here injects `now` explicitly. Nothing reads a clock, so these
// are deterministic on any machine in any timezone, which is the whole
// reason `now` is a parameter rather than a global.
// ---------------------------------------------------------------------------

const TOPICS = [
  { topic: 'Alpha Topic', target_keyword: 'a' },
  { topic: 'Beta Topic', target_keyword: 'b' },
  { topic: 'Gamma Topic', target_keyword: 'g' },
];

// Builds a record the same way the runtime writer does: retry date derived
// from the canonical frozen policy, never hand-written.
function quarantineRecord(topic, rejectedAt, rejectionCount = 1) {
  return {
    topic,
    status: 'quarantined',
    rejection_reason: 'gate_trip',
    rejection_count: rejectionCount,
    last_rejected_at: rejectedAt,
    next_eligible_retry_at: computeNextEligibleRetryAt({
      rejectedAt,
      rejectionCount,
      intervalForCount: intervalForRejectionCount,
    }),
  };
}

const REJECTED_AT = '2026-09-01T00:00:00.000Z';
const BOUNDARY = '2026-09-08T00:00:00.000Z'; // REJECTED_AT + 7d, first-rejection interval
const EMPTY = new Set();

function pick(overrides = {}) {
  return pickNextEligibleTopic({
    topics: TOPICS,
    consumedTopics: EMPTY,
    openPrTopics: EMPTY,
    mergedMarkerTopics: EMPTY,
    quarantineRecords: [],
    now: BOUNDARY,
    ...overrides,
  });
}

describe('pickNextEligibleTopic — MODEL A hold composition', () => {
  test('a quarantined topic is unavailable BEFORE its retry date', () => {
    const picked = pick({
      quarantineRecords: [quarantineRecord('Alpha Topic', REJECTED_AT)],
      now: '2026-09-07T23:59:59.999Z',
    });
    assert.equal(picked.topic, 'Beta Topic', 'Alpha is still quarantined, so Beta is next');
  });

  test('at the EXACT retry boundary the topic is eligible again (equality is eligible)', () => {
    const picked = pick({
      quarantineRecords: [quarantineRecord('Alpha Topic', REJECTED_AT)],
      now: BOUNDARY,
    });
    assert.equal(picked.topic, 'Alpha Topic');
  });

  test('after the retry date the topic is eligible', () => {
    const picked = pick({
      quarantineRecords: [quarantineRecord('Alpha Topic', REJECTED_AT)],
      now: '2026-09-08T00:00:00.001Z',
    });
    assert.equal(picked.topic, 'Alpha Topic');
  });

  test('an EXPIRED quarantine plus an open PR is still held — the PR hold is independent', () => {
    const picked = pick({
      quarantineRecords: [quarantineRecord('Alpha Topic', REJECTED_AT)],
      openPrTopics: new Set(['Alpha Topic']),
      now: BOUNDARY,
    });
    assert.equal(picked.topic, 'Beta Topic');
  });

  test('a consumed topic (real article) stays permanently held', () => {
    const picked = pick({ consumedTopics: new Set(['Alpha Topic']) });
    assert.equal(picked.topic, 'Beta Topic');
  });

  test('a merged marker WITH a matching quarantine record is valid Model A state', () => {
    assert.doesNotThrow(() => pick({
      mergedMarkerTopics: new Set(['Alpha Topic']),
      quarantineRecords: [quarantineRecord('Alpha Topic', REJECTED_AT)],
    }));
  });

  test('a merged marker WITHOUT a quarantine record FAILS CLOSED', () => {
    assert.throws(
      () => pick({ mergedMarkerTopics: new Set(['Alpha Topic']), quarantineRecords: [] }),
      /no quarantine record/,
    );
  });

  test('a merged marker does NOT independently block once its quarantine expires', () => {
    // The single most important Model A assertion: pre-Phase-3 this topic
    // was blocked forever by the marker alone.
    const picked = pick({
      mergedMarkerTopics: new Set(['Alpha Topic']),
      quarantineRecords: [quarantineRecord('Alpha Topic', REJECTED_AT)],
      now: BOUNDARY,
    });
    assert.equal(picked.topic, 'Alpha Topic');
  });

  test('PR #47 semantics: a closed-unmerged ordinary article PR leaves no marker and no quarantine, so its topic is eligible', () => {
    // Nothing represents a closed article PR anywhere — no marker file is
    // ever written for one, and it is deliberately unseeded. The topic is
    // therefore simply available, with no synthesized rejection timestamp.
    const picked = pick({ mergedMarkerTopics: EMPTY, quarantineRecords: [] });
    assert.equal(picked.topic, 'Alpha Topic');
  });

  test('an unrelated topic is unaffected by another topic quarantine', () => {
    const picked = pick({
      consumedTopics: new Set(['Alpha Topic']),
      quarantineRecords: [quarantineRecord('Beta Topic', REJECTED_AT)],
      now: '2026-09-02T00:00:00.000Z',
    });
    assert.equal(picked.topic, 'Gamma Topic');
  });

  test('an empty quarantine state with no merged markers preserves pre-Phase-3 behavior exactly', () => {
    const consumed = new Set(['Alpha Topic']);
    const openPr = new Set(['Beta Topic']);
    const modelA = pickNextEligibleTopic({
      topics: TOPICS, consumedTopics: consumed, openPrTopics: openPr,
      mergedMarkerTopics: EMPTY, quarantineRecords: [], now: BOUNDARY,
    });
    const legacy = pickNextAvailableTopic(TOPICS, new Set([...consumed, ...openPr]));
    assert.deepEqual(modelA, legacy);
  });

  test('availability shrinks by exactly the number of ACTIVE quarantines, not by expired ones', () => {
    const records = [
      quarantineRecord('Alpha Topic', REJECTED_AT),          // expired at BOUNDARY
      quarantineRecord('Beta Topic', '2026-09-05T00:00:00.000Z'), // still active at BOUNDARY
    ];
    const blocked = quarantineBlockedTopics(records, BOUNDARY);
    assert.deepEqual([...blocked], ['Beta Topic']);
    assert.equal(blocked.size, 1);
  });

  test('a malformed now fails closed rather than being guessed', () => {
    assert.throws(() => pick({ now: '2026-09-08T00:00:00' }), /canonical ISO-8601 UTC/);
    assert.throws(() => pick({ now: 'not-a-date' }), /canonical ISO-8601 UTC/);
  });
});

describe('assertMergedMarkersAreQuarantined — the migration consistency guard', () => {
  test('names every orphaned marker topic, not just the first', () => {
    assert.throws(
      () => assertMergedMarkersAreQuarantined(new Set(['Alpha Topic', 'Beta Topic']), []),
      (err) => /Alpha Topic/.test(err.message) && /Beta Topic/.test(err.message) && /2 merged/.test(err.message),
    );
  });

  test('passes when every merged marker has a record', () => {
    assert.doesNotThrow(() => assertMergedMarkersAreQuarantined(
      new Set(['Alpha Topic']),
      [quarantineRecord('Alpha Topic', REJECTED_AT)],
    ));
  });

  test('no merged markers is trivially consistent', () => {
    assert.doesNotThrow(() => assertMergedMarkersAreQuarantined(new Set(), []));
  });
});

// ---------------------------------------------------------------------------
// OPEN-PR HOLD SCOPE (fixed 2026-09-21).
//
// The hold used to be derived from `git ls-tree` over the PR BRANCH, which
// lists everything the branch CONTAINS -- and a PR branch contains all of
// main. So every merged article and every merged `.rejected/` marker came
// back as "attempted by this open PR": one open generator PR that had added
// a single file reported 28 held topics against the live repository.
//
// Harmless before Phase 3, when merged markers were permanent holds anyway.
// Under Model A it silently violated the contract -- an expired quarantine
// must release its topic, and this re-held it for as long as ANY generator
// PR happened to be open. Observed live: PR #55's branch inherited main's
// merged Mello-Roos marker, whose quarantine expired 2026-09-01.
//
// The hold is now derived from the PR DIFF: only paths the PR itself
// introduced count.
// ---------------------------------------------------------------------------
describe('getOpenPrAttemptedTopics — holds only what the PR itself introduced', () => {
  const MELLO = 'Understanding Mello-Roos Taxes in Temecula Valley Communities';
  const FEHA = "Understanding California's Fair Employment and Housing Act for Buyers and Sellers";

  // Mirrors the real #55 shape: the PR adds ONE marker, and its branch also
  // carries an inherited merged marker plus inherited articles from main.
  function prLikeFiftyFive(ownTopic) {
    return (cmd) => {
      if (cmd.startsWith('gh pr list')) {
        return JSON.stringify([{ number: 55, headRefName: 'blog-generator/rejected-35455336418' }]);
      }
      if (cmd.startsWith('gh api')) {
        // The PR diff: exactly one added file. Inherited files never appear
        // in a PR's file list, which is the whole point of the fix.
        return JSON.stringify([
          { status: 'added', filename: 'src/data/generated-articles/.rejected/own-topic.json' },
        ]);
      }
      if (cmd.startsWith('git fetch')) return '';
      if (cmd === 'git show FETCH_HEAD:src/data/generated-articles/.rejected/own-topic.json') {
        return JSON.stringify({ sourceTopic: ownTopic, rejectedAt: '2026-09-19T16:34:48.534Z' });
      }
      // Any attempt to read an inherited path is a bug: the fix must never
      // ask for one. Fail loudly rather than quietly returning a topic.
      throw new Error(`must not read an inherited path: ${cmd}`);
    };
  }

  test('holds the topic the PR actually added', () => {
    const held = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec: prLikeFiftyFive(FEHA) });
    assert.ok(held.has(FEHA), 'the PR own attempted topic must still be held');
    assert.equal(held.size, 1);
  });

  test('does NOT hold a merged .rejected marker inherited from main (#55 / Mello-Roos case)', () => {
    const held = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec: prLikeFiftyFive(FEHA) });
    assert.equal(held.has(MELLO), false, 'an inherited merged marker must not create an open-PR hold');
  });

  test('does NOT hold an inherited generated article already present on main', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 60, headRefName: 'blog-generator/auto-60' }]);
      if (cmd.startsWith('gh api')) {
        return JSON.stringify([
          { status: 'added', filename: 'src/data/generated-articles/brand-new.json' },
        ]);
      }
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.includes('brand-new.json')) return JSON.stringify({ sourceTopic: 'A Brand New Topic' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const held = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.ok(held.has('A Brand New Topic'));
    assert.equal(held.has('An Inherited Topic'), false, 'an inherited article absent from the PR diff must not create a hold');
  });

  test('removed rejected-marker files do not create a hold', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 61, headRefName: 'blog-generator/rejected-61' }]);
      if (cmd.startsWith('gh api')) return JSON.stringify([
        { status: 'removed', filename: 'src/data/generated-articles/.rejected/removed-topic.json' },
      ]);
      throw new Error(`must not fetch or read removed files: ${cmd}`);
    };
    assert.equal(getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }).size, 0);
  });

  test('modified non-JSON files under .rejected do not create a hold', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 62, headRefName: 'blog-generator/rejected-62' }]);
      if (cmd.startsWith('gh api')) return JSON.stringify([
        { status: 'modified', filename: 'src/data/generated-articles/.rejected/notes.txt' },
      ]);
      throw new Error(`must not fetch or read non-json files: ${cmd}`);
    };
    assert.equal(getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }).size, 0);
  });

  test('multiple open PRs each hold only their own attempted topic', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) {
        return JSON.stringify([
          { number: 71, headRefName: 'blog-generator/auto-71' },
          { number: 72, headRefName: 'blog-generator/rejected-72' },
        ]);
      }
      if (cmd.startsWith('gh api') && cmd.includes('/pulls/71/')) {
        return JSON.stringify([{ status: 'added', filename: 'src/data/generated-articles/a.json' }]);
      }
      if (cmd.startsWith('gh api') && cmd.includes('/pulls/72/')) {
        return JSON.stringify([{ status: 'added', filename: 'src/data/generated-articles/.rejected/b.json' }]);
      }
      if (cmd.startsWith('git fetch')) return '';
      if (cmd.endsWith('a.json')) return JSON.stringify({ sourceTopic: 'Topic From PR 71' });
      if (cmd.endsWith('b.json')) return JSON.stringify({ sourceTopic: 'Topic From PR 72' });
      throw new Error(`unexpected command: ${cmd}`);
    };
    const held = getOpenPrAttemptedTopics({ repo: 'owner/repo', exec });
    assert.deepEqual([...held].sort(), ['Topic From PR 71', 'Topic From PR 72']);
  });

  test('a PR that introduces no generator artifact holds nothing and never fetches its branch', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 80, headRefName: 'blog-generator/auto-80' }]);
      if (cmd.startsWith('gh api')) return JSON.stringify([{ status: 'modified', filename: 'tools/blog-generator/README.md' }]);
      throw new Error(`must not fetch or read for a PR that added no artifact: ${cmd}`);
    };
    assert.equal(getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }).size, 0);
  });

  test('closing the PR removes the true hold — a closed PR is simply absent from gh pr list', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([]); // e.g. #55 now closed
      throw new Error(`nothing else should run when no PR is open: ${cmd}`);
    };
    assert.equal(getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }).size, 0);
  });

  test('fails closed on an unusable PR file list, never returning a partial hold set', () => {
    const base = (filesResponse) => (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ number: 90, headRefName: 'blog-generator/auto-90' }]);
      if (cmd.startsWith('gh api')) return filesResponse();
      throw new Error(`unexpected: ${cmd}`);
    };
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec: base(() => { throw new Error('gh down'); }) }), /files failed/i);
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec: base(() => 'not json') }), /could not parse the file list/i);
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec: base(() => JSON.stringify({})) }), /was not an array/i);
    // A full page means the list may be truncated — refuse rather than miss one.
    const full = JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ status: 'modified', filename: `f${i}.txt` })));
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec: base(() => full) }), /page limit/i);
  });

  test('an open PR with no number fails closed rather than guessing its diff', () => {
    const exec = (cmd) => {
      if (cmd.startsWith('gh pr list')) return JSON.stringify([{ headRefName: 'blog-generator/auto-1' }]);
      throw new Error(`unexpected: ${cmd}`);
    };
    assert.throws(() => getOpenPrAttemptedTopics({ repo: 'owner/repo', exec }), /no usable number/i);
  });
});

describe('Model A end-to-end: an expired quarantine is released once its PR hold is gone', () => {
  const MELLO = 'Understanding Mello-Roos Taxes in Temecula Valley Communities';
  const TOPICS = [{ topic: MELLO }, { topic: 'Another Topic' }];
  const EXPIRED = {
    topic: MELLO,
    status: 'quarantined',
    rejection_reason: 'gate_trip',
    rejection_count: 1,
    last_rejected_at: '2026-08-25T14:38:39.617Z',
    next_eligible_retry_at: '2026-09-01T14:38:39.617Z',
  };
  const NOW = '2026-09-21T00:00:00.000Z'; // well past the retry date

  test('expired quarantine + merged marker + an UNRELATED open PR => eligible', () => {
    // This is the exact live situation: Mello-Roos has a merged marker on
    // main and an expired quarantine, while PR #55 (an unrelated topic) is
    // open. Before the fix it was held; under Model A it must be eligible.
    const picked = pickNextEligibleTopic({
      topics: TOPICS,
      consumedTopics: new Set(),
      openPrTopics: new Set(['Some Other Topic From An Open PR']),
      mergedMarkerTopics: new Set([MELLO]),
      quarantineRecords: [EXPIRED],
      now: NOW,
    });
    assert.equal(picked.topic, MELLO);
  });

  test('the merged-marker consistency guard is independent and still fails closed', () => {
    // Removing the false PR hold must not weaken the orphan-marker guard.
    assert.throws(
      () => pickNextEligibleTopic({
        topics: TOPICS,
        consumedTopics: new Set(),
        openPrTopics: new Set(),
        mergedMarkerTopics: new Set([MELLO]),
        quarantineRecords: [], // marker on main with NO record
        now: NOW,
      }),
      /no quarantine record/,
    );
  });
});
