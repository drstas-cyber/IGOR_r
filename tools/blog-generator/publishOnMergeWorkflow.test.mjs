// Textual regression guard on publish-on-merge.yml itself -- same pattern
// as gate.test.mjs's guard on the Layer 2 prompt text (assert on the raw
// file contents, no YAML parser dependency needed). This workflow's job
// only ever runs post-merge (on: pull_request: closed), so ordinary CI on
// a branch/PR never exercises it -- exactly why the shallow-checkout bug
// (2026-08-30, PR #38, run 33363712388: default depth-1 checkout left the
// merge commit's parent unresolvable, so publishOnMerge.mjs's
// `git diff <sha>~1 <sha>` failed with "bad revision" before any write)
// went undetected through this workflow's entire existence until its
// first real firing. See tools/blog-generator/README.md's "Publish-on-
// merge" decision record for the full incident writeup.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = path.resolve(__dirname, '..', '..', '.github', 'workflows', 'publish-on-merge.yml');

describe('publish-on-merge.yml — checkout must not be a shallow (depth-1) clone', () => {
  test('the checkout step declares an explicit fetch-depth of 0 or >= 2', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    // VERSION-AGNOSTIC (2026-09-03). This regex used to hardcode
    // `actions/checkout@v4`. Bumping the action to @v5 under the "no
    // unfired paths" order broke it -- loudly, which is the correct
    // failure, but it exposes the real hazard: a slightly looser regex
    // would have made this guard silently match nothing and pass while
    // guarding nothing at all. A pinned major version inside a REGRESSION
    // GUARD's own matcher is a liability; the thing being guarded is
    // fetch-depth, not the action's version.
    const checkoutBlock = yaml.match(/- uses: actions\/checkout@v\d+[\s\S]*?(?=\n\s*- name:|\n\s*- uses:|$)/);
    assert.ok(checkoutBlock, 'expected an actions/checkout step in publish-on-merge.yml');
    assert.match(
      checkoutBlock[0],
      /fetch-depth:\s*(0|[2-9]|\d{2,})\b/,
      'checkout step must declare fetch-depth: 0 or >= 2 -- the default (depth 1) cannot resolve the merge commit\'s first parent, which publishOnMerge.mjs\'s `git diff <sha>~1 <sha>` requires'
    );
  });
  // The guard on the guard. A textual regression check that matches
  // nothing passes vacuously, which is the same as not existing -- and a
  // stale hardcoded version pin is exactly how that happens. This asserts
  // the matcher finds a real checkout step at all.
  test('the matcher actually finds a checkout step -- it cannot pass vacuously', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const steps = yaml.match(/- uses: actions\/checkout@v\d+/g) || [];
    assert.ok(steps.length >= 1, 'no actions/checkout step found at all — the fetch-depth guard above would be passing vacuously');
  });
});
