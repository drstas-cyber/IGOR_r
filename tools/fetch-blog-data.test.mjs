import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeneratedArticles } from './blog-generator/loadGenerated.js';

// Regression test for the eac8380 incident. The incident itself was NOT
// caused by the no-key path -- BABYLOVE_API_KEY was present and the BLG
// fetch succeeded ("list: 30 total, 27 published, 3 skipped"). The real
// cause was package.json's "|| true" swallowing a correct FATAL refusal
// from the compliance gate (see build-chain.test.mjs for that half of the
// fix). This file tests the OTHER half of the three-part fix: BLG is now
// retired by default in fetch-blog-data.js itself, so it can't matter
// whether a key happens to be present -- only BLOG_INCLUDE_BLG='true' can
// re-enter that path at all.
//
// These tests spawn the real tools/fetch-blog-data.js against the real
// src/data/generated-articles/ directory (never mocked -- that's the point:
// prove the actual default path in this actual repo), and back up/restore
// the two files it writes so the test suite leaves no side effects.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const REPORT_PATH = path.join(PROJECT_ROOT, 'tools', 'blog-compliance', 'last-report.json');

function snapshot(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
function restore(p, contents) {
  if (contents === null) {
    if (fs.existsSync(p)) fs.rmSync(p);
  } else {
    fs.writeFileSync(p, contents, 'utf8');
  }
}

function runFetchBlogData(envOverrides) {
  const env = { ...process.env, ...envOverrides };
  return spawnSync('node', ['tools/fetch-blog-data.js'], {
    cwd: PROJECT_ROOT,
    env,
    encoding: 'utf8',
  });
}

describe('fetch-blog-data.js -- BLG retired by default (regression for eac8380)', () => {
  let outBefore;
  let reportBefore;

  before(() => {
    outBefore = snapshot(OUT_PATH);
    reportBefore = snapshot(REPORT_PATH);
  });

  after(() => {
    restore(OUT_PATH, outBefore);
    restore(REPORT_PATH, reportBefore);
  });

  test('no BLOG_INCLUDE_BLG, no BABYLOVE_API_KEY: writes all published generated articles', () => {
    const result = runFetchBlogData({
      BABYLOVE_API_KEY: undefined,
      BLOG_INCLUDE_BLG: undefined,
      BLOG_COMPLIANCE_FIXTURE: undefined,
    });

    assert.equal(result.status, 0, `expected exit 0 on the default generated-only path; stderr: ${result.stderr}`);
    assert.match(result.stdout, /BLG retired/i);

    const expected = loadGeneratedArticles(); // real published generated-articles/, same call fetch-blog-data.js makes
    assert.ok(expected.length > 0, 'test fixture assumption: repo must have at least one published generated article');

    const written = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    assert.equal(written.length, expected.length, 'must not silently drop or duplicate published generated articles');
    assert.deepEqual(
      written.map((a) => a.slug).sort(),
      expected.map((a) => a.slug).sort()
    );
  });

  test('BABYLOVE_API_KEY present but BLOG_INCLUDE_BLG unset: BLG path is still not entered', () => {
    // This is the exact scenario the incident review flagged: retirement
    // must not be "one leftover env var away from re-entering production."
    // A key alone -- with no explicit BLOG_INCLUDE_BLG=true -- must not
    // wake the BLG fetch path back up.
    const result = runFetchBlogData({
      BABYLOVE_API_KEY: 'leftover-test-key-should-be-ignored',
      BLOG_INCLUDE_BLG: undefined,
      BLOG_COMPLIANCE_FIXTURE: undefined,
    });

    assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
    assert.match(result.stdout, /BLG retired/i);
    // "[fetch-blog-data] list:" only ever gets logged by the real BLG-API
    // path (runFromApi -> fetchAllSummaries) -- its absence is direct proof
    // that path was never entered, not just that it happened to return
    // nothing.
    assert.doesNotMatch(result.stdout, /\[fetch-blog-data\] list:/);
  });
});

