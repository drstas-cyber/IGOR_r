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
// A rejected marker that gets MERGED to main (e.g. by mistake) blocks its
// topic PERMANENTLY, same as a real article would -- there is no special
// case for main vs. PR-branch content here on purpose. Recovery from an
// accidental merge is a manual, reviewed deletion of that file, not an
// automatic un-block.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

// Local ground truth: real articles + rejected markers, both directly under
// the given generated-articles directory (main's checked-out copy, in
// generate.mjs's normal flow).
export function getLocallyAttemptedTopics(generatedDir) {
  const topics = readSourceTopicsFromDir(generatedDir);
  for (const t of readSourceTopicsFromDir(path.join(generatedDir, '.rejected'))) {
    topics.add(t);
  }
  return topics;
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
export function pickNextAvailableTopic(topics, attemptedTopics) {
  return topics.find((t) => !attemptedTopics.has(t.topic)) || null;
}
