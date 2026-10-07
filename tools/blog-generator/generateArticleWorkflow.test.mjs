// STATIC guards on generate-article.yml, for the Phase 3 quarantine
// cutover. Same shape and same honesty caveat as
// publishOnMergeWorkflow.test.mjs: this asserts workflow TEXT, it does not
// execute the workflow. That is weaker proof than a unit or e2e test and is
// labelled `static` in pipelinePaths.mjs for exactly that reason.
//
// It earns its place anyway, because the three things it pins cannot be
// checked any other way without a real Actions run:
//
//   1. the SINGLE RUNTIME WRITER rule — quarantine state is written only
//      by generate-article, under an unkeyed concurrency group that
//      serializes the whole repo's generator runs;
//   2. the DELIVERY path — topic-quarantine.json must ride in the rejected
//      PR's add-paths, or the transition never leaves the runner and the
//      retry system is silently inert;
//   3. the OPERATOR CONTRACT — the PR title and body must state that MERGE
//      records the quarantine and CLOSE overrides it. The retired "DO NOT
//      MERGE — close to release topic back to queue" contract said the
//      opposite, so its absence is asserted, not just the new text's
//      presence.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(HERE, '..', '..', '.github', 'workflows');
const GENERATE_ARTICLE = path.join(WORKFLOWS_DIR, 'generate-article.yml');

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('generate-article.yml — the single serialized quarantine writer', () => {
  test('declares the unkeyed generate-article concurrency group', () => {
    const yml = read(GENERATE_ARTICLE);
    // Unkeyed on purpose: a ${{ github.ref }}-style key would let two
    // generator runs on different refs write quarantine state at once.
    assert.match(yml, /concurrency:\n\s+group:\s*generate-article\n/);
    assert.doesNotMatch(yml, /group:\s*generate-article-\$\{\{/, 'the group must not be keyed per-ref');
  });

  test('does not cancel in-progress runs — a cancelled writer could drop a transition', () => {
    const yml = read(GENERATE_ARTICLE);
    const block = yml.slice(yml.indexOf('concurrency:'));
    assert.match(block, /cancel-in-progress:\s*false/);
  });

  test('NO other workflow writes topic-quarantine.json — exactly one runtime writer', () => {
    const others = fs.readdirSync(WORKFLOWS_DIR)
      .filter((f) => f.endsWith('.yml') && f !== 'generate-article.yml');
    const offenders = others.filter((f) => read(path.join(WORKFLOWS_DIR, f)).includes('topic-quarantine.json'));
    assert.deepEqual(
      offenders, [],
      `only generate-article.yml may write quarantine state at runtime; found references in: ${offenders.join(', ')}`,
    );
  });
});

describe('generate-article.yml — rejected PR carries the quarantine transition', () => {
  test('rejected-PR add-paths include BOTH the marker directory and topic-quarantine.json', () => {
    const yml = read(GENERATE_ARTICLE);
    const rejectedBlock = yml.slice(yml.indexOf('blog-generator/rejected-'));
    assert.match(rejectedBlock, /add-paths:\s*\|[\s\S]*src\/data\/generated-articles\/\.rejected\//);
    assert.match(rejectedBlock, /add-paths:\s*\|[\s\S]*tools\/blog-generator\/topic-quarantine\.json/);
  });

  test('the pre-existing citation-host-log add-path is preserved, not replaced', () => {
    const yml = read(GENERATE_ARTICLE);
    const rejectedBlock = yml.slice(yml.indexOf('blog-generator/rejected-'));
    assert.match(rejectedBlock, /tools\/blog-generator\/citation-host-log\.json/);
  });

  test('the rejected PR is still opened from the run-unique branch', () => {
    const yml = read(GENERATE_ARTICLE);
    assert.match(yml, /branch:\s*"blog-generator\/rejected-\$\{\{\s*github\.run_id\s*\}\}"/);
  });

  test('the SUCCESSFUL article PR path is not redefined by this change', () => {
    const yml = read(GENERATE_ARTICLE);
    // Still its own branch, its own body output, and deliberately NOT
    // carrying quarantine state — a clean run has no transition to record.
    assert.match(yml, /branch:\s*"blog-generator\/auto-\$\{\{\s*github\.run_id\s*\}\}"/);
    const autoBlock = yml.slice(yml.indexOf('blog-generator/auto-'), yml.indexOf('blog-generator/rejected-'));
    assert.doesNotMatch(autoBlock, /topic-quarantine\.json/, 'a successful run must not touch quarantine state');
  });
});

describe('generate-article.yml — the MERGE/CLOSE operator contract', () => {
  test('the rejected PR title states both actions', () => {
    const yml = read(GENERATE_ARTICLE);
    assert.match(yml, /title:\s*"⛔ REJECTED — merge to record quarantine, close to override"/);
  });

  test('the retired DO-NOT-MERGE contract is gone from the title', () => {
    const yml = read(GENERATE_ARTICLE);
    const titleLines = yml.split('\n').filter((l) => l.trimStart().startsWith('title:'));
    for (const line of titleLines) {
      assert.doesNotMatch(line, /DO NOT MERGE/, `retired contract still present in: ${line.trim()}`);
      assert.doesNotMatch(line, /close to release topic/, `retired contract still present in: ${line.trim()}`);
    }
  });

  test('the rejected PR body explains MERGE records quarantine and CLOSE overrides', () => {
    const yml = read(GENERATE_ARTICLE);
    assert.match(yml, /This run was rejected by the compliance gates\. No article was produced\./);
    assert.match(yml, /MERGE\s+— accept this rejection/);
    assert.match(yml, /CLOSE\s+— override this rejection/);
    assert.match(yml, /the topic returns/);
    assert.match(yml, /Both are valid\. Merging is the normal action\./);
  });

  test('the rejected PR uses its own body output, leaving the article PR body untouched', () => {
    const yml = read(GENERATE_ARTICLE);
    assert.match(yml, /body:\s*\$\{\{\s*steps\.report\.outputs\.rejected_body\s*\}\}/);
    assert.match(yml, /body:\s*\$\{\{\s*steps\.report\.outputs\.body\s*\}\}/);
    assert.match(yml, /rejected_body<<GENERATE_REJECTED_EOF/, 'the output must actually be produced');
  });
});

// ---------------------------------------------------------------------------
// YAML VALIDITY GUARD -- added after the 2026-09-21 production incident.
//
// Commit 7500489 shipped a generate-article.yml that GitHub could not parse:
// a multi-line shell assignment in the rejected_body step had a continuation
// line indented one space LESS than the `run: |` block scalar's base, which
// terminated the block early. GitHub responded the way it always does to an
// unparseable workflow -- a run with ZERO jobs, conclusion `failure`, titled
// by file path instead of the workflow's `name:` -- and article generation
// was down until the follow-up fix.
//
// The whole suite was 810/810 green across that commit. It could not have
// caught it: every assertion in this file greps workflow TEXT, and text
// greps pass happily against a file YAML cannot load. build-check does not
// validate workflow files either.
//
// So this parses the real files. It is SYNTAX validation only -- js-yaml
// knows nothing about the GitHub Actions schema, so a workflow that parses
// can still be semantically wrong (that is what the assertions above are
// for). It closes exactly one gap: "valid YAML", which is the gap that
// actually bit us.
// ---------------------------------------------------------------------------
describe('workflow YAML is parseable (regression guard, 2026-09-21 incident)', () => {
  const trackedWorkflows = () => execFileSync('git', ['ls-files', '.github/workflows'], { encoding: 'utf8' })
    .trim().split('\n').map((f) => f.trim()).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  test('generate-article.yml parses as YAML', () => {
    assert.doesNotThrow(
      () => yaml.load(fs.readFileSync(GENERATE_ARTICLE, 'utf8')),
      'generate-article.yml must be valid YAML -- an unparseable workflow takes article generation down silently',
    );
  });

  test('generate-article.yml still declares its triggers, schedule, concurrency and job after parsing', () => {
    // Parsing alone is not enough: assert the structure survived, so a
    // "fix" that deletes the broken region to make it parse also fails.
    const doc = yaml.load(fs.readFileSync(GENERATE_ARTICLE, 'utf8'));
    const on = doc.on ?? doc[true]; // YAML 1.1 parses a bare `on:` key as boolean true
    assert.ok(on, 'the trigger block must survive parsing');
    assert.ok('workflow_dispatch' in on, 'workflow_dispatch must remain available');
    assert.deepEqual(on.schedule, [{ cron: '23 13 */2 * *' }], 'the generation schedule must be unchanged');
    assert.deepEqual(doc.concurrency, { group: 'generate-article', 'cancel-in-progress': false });
    assert.deepEqual(Object.keys(doc.jobs), ['generate']);
  });

  test('EVERY tracked workflow file parses as YAML', () => {
    const broken = [];
    for (const file of trackedWorkflows()) {
      try {
        yaml.load(fs.readFileSync(path.join(HERE, '..', '..', file), 'utf8'));
      } catch (err) {
        broken.push(`${file}: ${err.message.split('\n')[0]}`);
      }
    }
    assert.deepEqual(broken, [], `unparseable workflow file(s):\n${broken.join('\n')}`);
  });
});

// Auto-merge-on-silence (owner decision, 2026-10-06). STATIC guards, same
// honesty caveat as the rest of this file: this asserts workflow TEXT, it
// does not execute the workflow. It earns its place because the three
// things it pins are each a real, already-made mistake or a real failure
// mode that no unit test can reach:
//
//   1. THE TOKEN — the retired 2026-08-03 auto-merge path merged with the
//      default GITHUB_TOKEN, which GitHub's loop-prevention stops from
//      triggering publish-on-merge.yml. That combination produces a
//      green run, a merged PR, and an article that never goes live, with
//      no email. The PAT is the fix and it must not drift back.
//   2. THE BAR — auto-merge must be gated on the all_silent decision step
//      and on nothing else. A step that merges on has_new_article alone
//      publishes every article unreviewed.
//   3. NO DOUBLE EMAIL — a silent run must not get both "awaits your
//      review" (which would be false) and "published". The held-for-review
//      notification is therefore gated on NOT silent.
describe('generate-article.yml — auto-merge on perfect silence (2026-10-06)', () => {
  test('the auto-merge step merges with the PAT, never the default GITHUB_TOKEN', () => {
    const yml = read(GENERATE_ARTICLE);
    const doc = yaml.load(yml);
    const steps = doc.jobs.generate.steps;
    const merge = steps.find((s) => s.name && s.name.startsWith('Auto-merge'));
    assert.ok(merge, 'expected an "Auto-merge" step in generate-article.yml');
    assert.match(merge.env.GH_TOKEN, /TVH_BOT_PR_PAT/);
    assert.doesNotMatch(
      merge.env.GH_TOKEN,
      /secrets\.GITHUB_TOKEN/,
      'a GITHUB_TOKEN merge cannot trigger publish-on-merge.yml — the article would merge and never publish',
    );
    assert.match(merge.run, /gh pr merge/);
  });

  test('auto-merge is gated on the all_silent decision, not merely on an article existing', () => {
    const doc = yaml.load(read(GENERATE_ARTICLE));
    const steps = doc.jobs.generate.steps;
    const merge = steps.find((s) => s.name && s.name.startsWith('Auto-merge'));
    assert.match(merge.if, /steps\.silent\.outputs\.all_silent == 'true'/);
  });

  test('the all_silent decision step exists, runs checkAllSilent.mjs, and carries the id the merge step reads', () => {
    const doc = yaml.load(read(GENERATE_ARTICLE));
    const steps = doc.jobs.generate.steps;
    const decide = steps.find((s) => s.id === 'silent');
    assert.ok(decide, 'expected a step with id "silent"');
    assert.match(decide.run, /checkAllSilent\.mjs/);
  });

  test('a failed auto-merge never reds the run — it falls back to the PR sitting for a human', () => {
    const doc = yaml.load(read(GENERATE_ARTICLE));
    const steps = doc.jobs.generate.steps;
    const merge = steps.find((s) => s.name && s.name.startsWith('Auto-merge'));
    const decide = steps.find((s) => s.id === 'silent');
    assert.equal(merge['continue-on-error'], true);
    assert.equal(decide['continue-on-error'], true);
  });

  test('a silent run does not also get the "held for review" email', () => {
    const doc = yaml.load(read(GENERATE_ARTICLE));
    const steps = doc.jobs.generate.steps;
    const held = steps.filter((s) => s.name && /held for review/.test(s.name));
    assert.equal(held.length, 2, 'expected both the build-content and notify steps for the held-for-review email');
    for (const s of held) {
      assert.match(s.if, /steps\.silent\.outputs\.all_silent != 'true'/);
    }
  });

  test('the auto-merge step comes after the PR is opened, so it has a PR number to merge', () => {
    const doc = yaml.load(read(GENERATE_ARTICLE));
    const names = doc.jobs.generate.steps.map((s) => s.name || s.id || '');
    const openIdx = names.findIndex((n) => /Open PR with the generated article/.test(n));
    const decideIdx = doc.jobs.generate.steps.findIndex((s) => s.id === 'silent');
    const mergeIdx = names.findIndex((n) => /^Auto-merge/.test(n));
    assert.ok(openIdx !== -1 && decideIdx !== -1 && mergeIdx !== -1);
    assert.ok(openIdx < decideIdx, 'the silence decision must come after the PR is opened');
    assert.ok(decideIdx < mergeIdx, 'the merge must come after the silence decision');
  });

  test('rejected-attempt PRs are never auto-merged — the merge is scoped to the article-PR path only', () => {
    // A rejected PR merging itself would record a quarantine with no human
    // ever seeing the gate's reasoning, removing the override that PR #63
    // (a genuine gate misfire) turned out to need.
    const doc = yaml.load(read(GENERATE_ARTICLE));
    const merge = doc.jobs.generate.steps.find((s) => s.name && s.name.startsWith('Auto-merge'));
    assert.match(merge.if, /steps\.check\.outputs\.has_new_article == 'true'/);
    assert.doesNotMatch(merge.run, /rejected/i);
  });
});
