import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractBranchPreviewUrl } from './previewUrlExtract.mjs';

// Real HTML shape, captured 2026-08-25 from a real Cloudflare Pages check-run
// (commit a9f2e5b, PR #35) via the GitHub check-runs API -- not guessed.
const REAL_SUMMARY = `<table><tr><td><strong>Latest commit:</strong> </td><td>\n<code>a9f2e5b</code>\n</td></tr>\n<tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr>\n<tr><td><strong>Preview URL:</strong></td><td>\n<a href='https://d78390a5.igor-r.pages.dev'>https://d78390a5.igor-r.pages.dev</a>\n</td></tr>\n<tr><td><strong>Branch Preview URL:</strong></td><td>\n<a href='https://blog-generator-auto-32644899.igor-r.pages.dev'>https://blog-generator-auto-32644899.igor-r.pages.dev</a>\n</td></tr>\n</table>\n\n[View logs](https://dash.cloudflare.com/?to=/76bcb051d9c04b73411520959fc2e956/pages/view/igor-r/d78390a5-0107-47a3-ae05-a09bfe6d923d)\n`;

describe('extractBranchPreviewUrl', () => {
  test('extracts the Branch Preview URL (stable across pushes to the same branch, not the per-commit hash URL) from a real check-run summary', () => {
    assert.equal(extractBranchPreviewUrl(REAL_SUMMARY), 'https://blog-generator-auto-32644899.igor-r.pages.dev');
  });

  test('an in-progress build (no Branch Preview URL yet) returns null, not a crash', () => {
    const inProgress = '<table><tr><td><strong>Latest commit:</strong> </td><td>\n<code>c758ce4</code>\n</td></tr>\n<tr><td><strong>Status:</strong></td><td>⚡️&nbsp; Build in progress...</td></tr>\n</table>\n';
    assert.equal(extractBranchPreviewUrl(inProgress), null);
  });

  test('missing/empty/null input returns null, never throws', () => {
    assert.equal(extractBranchPreviewUrl(''), null);
    assert.equal(extractBranchPreviewUrl(null), null);
    assert.equal(extractBranchPreviewUrl(undefined), null);
  });

  test('a completely unrelated HTML blob returns null rather than matching something wrong', () => {
    assert.equal(extractBranchPreviewUrl('<p>Some other check output entirely.</p>'), null);
  });
});
