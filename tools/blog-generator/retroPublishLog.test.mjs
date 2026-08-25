import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getRecentlyPublishedSlugs } from './retroPublishLog.mjs';

function fakeExec(lines) {
  return () => lines.join('\n');
}

describe('getRecentlyPublishedSlugs — ground truth for the weekly retro\'s scope', () => {
  test('extracts a slug from a human "blog: publish" commit subject', () => {
    const exec = fakeExec([
      'abc123\x1f2026-08-25T07:04:00-07:00\x1fblog: publish "old-town-temecula-neighborhood-guide" (PR #34, supervised read)',
    ]);
    const results = getRecentlyPublishedSlugs({ exec });
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, 'old-town-temecula-neighborhood-guide');
    assert.equal(results[0].commitSha, 'abc123');
  });

  test('extracts a slug from an "blog: auto-publish" commit subject (the perfectly-silent cron path)', () => {
    const exec = fakeExec([
      'def456\x1f2026-08-24T07:00:00-07:00\x1fblog: auto-publish "escrow-process-homebuyers-guide" (perfectly silent run)',
    ]);
    const results = getRecentlyPublishedSlugs({ exec });
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, 'escrow-process-homebuyers-guide');
  });

  test('ignores unrelated commits (cache-pair/rebuild, nav fixes, merges)', () => {
    const exec = fakeExec([
      'a1\x1f2026-08-25T00:00:00-07:00\x1fblog: cache pair + rebuild for "old-town-temecula-neighborhood-guide"',
      'a2\x1f2026-08-25T00:00:00-07:00\x1fMerge pull request #34 from drstas-cyber/blog-generator/auto-32492179840',
      'a3\x1f2026-08-25T00:00:00-07:00\x1fnav: fix regression from prior commit',
    ]);
    const results = getRecentlyPublishedSlugs({ exec });
    assert.deepEqual(results, []);
  });

  test('multiple publish commits, newest-first order preserved from git log', () => {
    const exec = fakeExec([
      'a1\x1f2026-08-25T00:00:00-07:00\x1fblog: publish "vail-ranch-temecula-neighborhood-guide" (PR #35, supervised read)',
      'a2\x1f2026-08-25T00:00:00-07:00\x1fblog: publish "old-town-temecula-neighborhood-guide" (PR #34, supervised read)',
    ]);
    const results = getRecentlyPublishedSlugs({ exec });
    assert.deepEqual(results.map((r) => r.slug), ['vail-ranch-temecula-neighborhood-guide', 'old-town-temecula-neighborhood-guide']);
  });

  test('blank output (nothing published in window) returns an empty array, not an error', () => {
    const results = getRecentlyPublishedSlugs({ exec: fakeExec(['']) });
    assert.deepEqual(results, []);
  });

  test('sinceDays is passed through into the git log --since argument', () => {
    let capturedCmd = null;
    const exec = (cmd) => { capturedCmd = cmd; return ''; };
    getRecentlyPublishedSlugs({ sinceDays: 14, exec });
    assert.match(capturedCmd, /--since="14 days ago"/);
  });

  test('fail-closed: a git log failure throws rather than silently reporting nothing published', () => {
    const exec = () => { throw new Error('git not found'); };
    assert.throws(() => getRecentlyPublishedSlugs({ exec }), /git log failed/);
  });
});
