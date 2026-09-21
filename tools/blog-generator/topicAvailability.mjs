// Ground-truth topic-availability check, replacing topics.json's own
// `status` field entirely. See the 2026-07-26 postmortem: derived state
// stored as fact (a `status` written on a PR branch that main never sees)
// is the bug class that produced four runs on one topic and a same-slug PR
// collision (#8 / #9). "Already attempted" is now computed fresh, every
// run, from ground truth visible without merging anything -- never stored.
//
// Three sources, unioned:
//   1. sourceTopic values on real generated-article files already on main
//   2. sourceTopic values on real generated-article files AND rejected-
//      attempt marker files (src/data/generated-articles/.rejected/) on
//      any OPEN generator PR branch
// (Slug collisions specifically -- as opposed to topic selection -- are a
// separate, already-solved problem: see getKnownSlugs() in slugs.js, used
// by assembleArticle() when a topic is actually generated. Topic selection
// here never needs to touch the frozen BabyLoveGrowth dead-slug set
// directly.)
//
// THE RULE, stated once so it's a decision, not an emergent behavior: an
// open generator PR (real draft or rejected-attempt marker) means its
// topic is spoken for. Closing that PR without merging releases the topic
// -- deliberate, symmetric in both directions, documented in README.md.
//
// PHASE 3 / MODEL A (this change). A rejected marker that gets MERGED to
// main used to block its topic PERMANENTLY, with recovery only by a
// manual `git rm` of the marker file. That is retired. Under Model A the
// three ACTIVE availability holds are:
//
//   1. a real generated article (topic consumed, permanent)
//   2. an open generator PR (held while pending, released on close)
//   3. an ACTIVE quarantine record in topic-quarantine.json
//
// A merged `.rejected/` marker is AUDIT / HISTORY ONLY -- it records that
// a rejection happened, and it no longer subtracts from availability by
// itself. What holds the topic after a merge is the quarantine record
// that travelled in the same PR, and that record EXPIRES on the canonical
// 7/14/30/60-day policy. The whole point of the change is that a rejected
// topic can actually come back.
//
// The one thing that must never happen is a merged marker silently
// releasing a topic because its quarantine record went missing. A merged
// marker whose sourceTopic has no matching valid quarantine record is an
// AMBIGUOUS MIGRATION STATE and fails closed -- see
// assertMergedMarkersAreQuarantined() below. That is the same fail-closed
// standard getOpenPrAttemptedTopics() already holds for `gh pr list`:
// never guess, never silently degrade.
//
// `now` is INJECTED, never read from a global clock in here. Eligibility
// is a pure function of (topics, holds, quarantine, now), which is what
// keeps the tests deterministic across timezones and machines.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { isValidIsoUtc } from './articleLifecycle.mjs';
import { isRetryEligible } from './quarantineState.mjs';

const GENERATED_DIR_REPO_PATH = 'src/data/generated-articles';

function readSourceTopicsFromDir(dirAbsPath) {
  const topics = new Set();
  if (!fs.existsSync(dirAbsPath)) return topics;
  for (const file of fs.readdirSync(dirAbsPath)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dirAbsPath, file), 'utf8'));
      if (data?.sourceTopic) topics.add(data.sourceTopic);
    } catch {
      // Skip an unparseable file rather than fail the whole scan on one bad
      // file -- this reads already-committed local content, not something
      // crossing a trust boundary the way the open-PR fetch below is.
    }
  }
  return topics;
}

// Local ground truth, MODEL A: topics CONSUMED by a real generated article
// on main. Permanent -- an article that exists was generated, full stop.
//
// Deliberately does NOT include `.rejected/` markers any more. Before
// Phase 3 this function unioned them in, which is what made a merged
// marker a permanent hold. Markers are now audit history and are read
// separately by getMergedMarkerTopics() for the consistency check only.
export function getConsumedTopics(generatedDir) {
  return readSourceTopicsFromDir(generatedDir);
}

// Merged rejected-attempt markers on main. AUDIT ONLY -- this set is never
// unioned into the attempted/blocked set. It exists so the caller can
// prove every merged marker still has a quarantine record backing it.
export function getMergedMarkerTopics(generatedDir) {
  return readSourceTopicsFromDir(path.join(generatedDir, '.rejected'));
}

// FAIL-CLOSED consistency guard. Every merged marker topic must have a
// quarantine record. If one does not, we are either mid-migration or
// someone hand-edited state, and the honest answer is "I cannot tell
// whether this topic is held" -- which must stop the run, not silently
// release the topic into the queue.
export function assertMergedMarkersAreQuarantined(mergedMarkerTopics, quarantineRecords) {
  const quarantined = new Set(
    (quarantineRecords || []).map((r) => (r && typeof r.topic === 'string' ? r.topic : null)).filter(Boolean)
  );
  const orphans = [...mergedMarkerTopics].filter((t) => !quarantined.has(t));
  if (orphans.length > 0) {
    throw new Error(
      `[topicAvailability] ${orphans.length} merged rejected-marker topic(s) have no quarantine record: `
      + `${orphans.map((t) => JSON.stringify(t)).join(', ')}. Under Model A a merged marker is audit history and the `
      + 'quarantine record is the hold, so a marker with no record is an ambiguous state. Refusing to guess whether '
      + 'these topics are available -- seed the missing record(s) in tools/blog-generator/topic-quarantine.json.'
    );
  }
}

// FAIL-CLOSED: throws on any failure anywhere in this function -- the gh
// CLI call, git fetch, git ls-tree, git show, or a JSON parse. Never falls
// back to "couldn't check, assume nothing attempted" or any other silent
// degradation. A caller that received an incomplete picture here would
// have no way to know it was handed a broken guarantee -- exactly the
// failure class getKnownSlugs() and resolveEnforceMode() were already
// fixed for tonight. `exec` is injectable so tests can simulate gh/git
// success and failure without real network or git access.
export function getOpenPrAttemptedTopics({ repo, exec = execSync } = {}) {
  if (!repo) {
    throw new Error('[topicAvailability] getOpenPrAttemptedTopics(): repo is required (expected "owner/name").');
  }

  let prListRaw;
  try {
    prListRaw = exec(`gh pr list --repo ${repo} --state open --json headRefName --limit 100`, { encoding: 'utf8' });
  } catch (err) {
    throw new Error(`[topicAvailability] gh pr list failed: ${err.message}. Refusing to guess which topics are already attempted.`);
  }

  let prs;
  try {
    prs = JSON.parse(prListRaw);
  } catch (err) {
    throw new Error(`[topicAvailability] could not parse gh pr list output: ${err.message}`);
  }
  if (!Array.isArray(prs)) {
    throw new Error('[topicAvailability] gh pr list did not return an array — refusing to guess.');
  }

  const topics = new Set();
  for (const pr of prs) {
    const branch = pr?.headRefName;
    if (!branch || !branch.startsWith('blog-generator/')) continue;

    try {
      exec(`git fetch origin ${branch} --depth=1 -q`, { encoding: 'utf8' });
    } catch (err) {
      throw new Error(`[topicAvailability] git fetch of open PR branch "${branch}" failed: ${err.message}. Refusing to guess.`);
    }

    let fileList;
    try {
      fileList = exec(`git ls-tree -r --name-only FETCH_HEAD -- ${GENERATED_DIR_REPO_PATH}`, { encoding: 'utf8' })
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.endsWith('.json'));
    } catch (err) {
      throw new Error(`[topicAvailability] git ls-tree on branch "${branch}" failed: ${err.message}. Refusing to guess.`);
    }

    for (const file of fileList) {
      let content;
      try {
        content = exec(`git show FETCH_HEAD:${file}`, { encoding: 'utf8' });
      } catch (err) {
        throw new Error(`[topicAvailability] git show of "${file}" on branch "${branch}" failed: ${err.message}. Refusing to guess.`);
      }
      let data;
      try {
        data = JSON.parse(content);
      } catch (err) {
        throw new Error(`[topicAvailability] could not parse "${file}" on branch "${branch}": ${err.message}. Refusing to guess.`);
      }
      if (data?.sourceTopic) topics.add(data.sourceTopic);
    }
  }
  return topics;
}

// Pure, no I/O — picks the first topics.json entry whose exact topic text
// is not in the attempted set. Returns null if every topic has been
// attempted (queue exhausted — not an error). Exact-string match: editing
// a topic's wording in topics.json makes it newly-eligible, deliberately —
// see README.md.
//
// Kept as the low-level primitive. Callers that need Model A's full hold
// composition use pickNextEligibleTopic() below instead.
export function pickNextAvailableTopic(topics, attemptedTopics) {
  return topics.find((t) => !attemptedTopics.has(t.topic)) || null;
}

// Pure. The set of topics an ACTIVE quarantine currently blocks at `now`.
// A record blocks while now < next_eligible_retry_at. At exact equality
// the quarantine has expired and the topic is eligible again -- the
// boundary is inclusive on the eligible side, matching isRetryEligible().
//
// Validation of the records themselves (shape, exact topic identity,
// duplicates, case-only collisions, monotonic timestamps) belongs to
// quarantineState.mjs and must already have run before this is called.
export function quarantineBlockedTopics(quarantineRecords, now) {
  if (!isValidIsoUtc(now)) {
    throw new Error(`[topicAvailability] now must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(now)}`);
  }
  const blocked = new Set();
  for (const record of quarantineRecords || []) {
    if (!isRetryEligible(record, now)) blocked.add(record.topic);
  }
  return blocked;
}

// MODEL A, composed. The single place the full eligibility rule lives:
//
//   eligible(topic, now) =
//         NOT consumed by a real generated article
//     AND NOT held by an open generator PR
//     AND ( no quarantine record OR now >= next_eligible_retry_at )
//
// Merged `.rejected/` markers are deliberately absent from that rule. They
// are passed in only so the fail-closed consistency guard can run: every
// merged marker must still have a quarantine record behind it.
//
// Pure and `now`-injected, so the caller (generate.mjs) owns the clock.
export function pickNextEligibleTopic({
  topics,
  consumedTopics,
  openPrTopics,
  mergedMarkerTopics,
  quarantineRecords,
  now,
} = {}) {
  if (!Array.isArray(topics)) {
    throw new Error('[topicAvailability] pickNextEligibleTopic: topics must be an array');
  }
  assertMergedMarkersAreQuarantined(mergedMarkerTopics || new Set(), quarantineRecords || []);

  const blocked = new Set([
    ...(consumedTopics || new Set()),
    ...(openPrTopics || new Set()),
    ...quarantineBlockedTopics(quarantineRecords || [], now),
  ]);
  return pickNextAvailableTopic(topics, blocked);
}
