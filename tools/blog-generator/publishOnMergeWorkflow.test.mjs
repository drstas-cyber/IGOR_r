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
    const checkoutBlock = yaml.match(/- uses: actions\/checkout@v4[\s\S]*?(?=\n\s*- name:|\n\s*- uses:|$)/);
    assert.ok(checkoutBlock, 'expected an actions/checkout@v4 step in publish-on-merge.yml');
    assert.match(
      checkoutBlock[0],
      /fetch-depth:\s*(0|[2-9]|\d{2,})\b/,
      'checkout step must declare fetch-depth: 0 or >= 2 -- the default (depth 1) cannot resolve the merge commit\'s first parent, which publishOnMerge.mjs\'s `git diff <sha>~1 <sha>` requires'
    );
  });
});
