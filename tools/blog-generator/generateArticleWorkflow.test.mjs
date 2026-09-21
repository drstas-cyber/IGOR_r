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
