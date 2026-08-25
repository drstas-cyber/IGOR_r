import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildUpdatedPrBody, pollForCheckRunSummary } from './updatePrPreviewLink.mjs';

describe('buildUpdatedPrBody — pure, idempotent top-block insertion', () => {
  const ORIGINAL_BODY = '## Self-hosted blog generator — run report\n\n**Topic:** x\n\n...rest of the real report...';

  test('prepends a marked top block with both the preview link and the gate summary', () => {
    const body = buildUpdatedPrBody({ existingBody: ORIGINAL_BODY, previewUrl: 'https://blog-generator-auto-1.igor-r.pages.dev', gateSummaryLine: '**Not silent** — Layer 1: clean · Layer 2: clean · Layer 3: clean · Self-review: 2 correction(s) — holds for a supervised human read.' });
    assert.match(body, /<!-- preview-link-block -->/);
    assert.match(body, /<!-- \/preview-link-block -->/);
    assert.match(body, /\*\*Preview:\*\* https:\/\/blog-generator-auto-1\.igor-r\.pages\.dev/);
    assert.match(body, /Not silent.*holds for a supervised human read/);
    assert.match(body, /## Self-hosted blog generator — run report/, 'the original report body must survive underneath the new top block');
  });

  test('a missing preview URL (poll timed out) renders an explicit "unavailable" line, never a broken/empty link', () => {
    const body = buildUpdatedPrBody({ existingBody: ORIGINAL_BODY, previewUrl: null, gateSummaryLine: '**Perfectly silent** — auto-merges/auto-publishes.' });
    assert.match(body, /Preview URL unavailable/);
    assert.doesNotMatch(body, /\*\*Preview:\*\* $/m);
  });

  test('a null gateSummaryLine (rejected-attempt outcome) omits the gate-summary line entirely rather than rendering "null"', () => {
    const body = buildUpdatedPrBody({ existingBody: ORIGINAL_BODY, previewUrl: 'https://x.pages.dev', gateSummaryLine: null });
    assert.doesNotMatch(body, /null/);
    assert.match(body, /\*\*Preview:\*\* https:\/\/x\.pages\.dev/);
  });

  test('idempotent: calling it again on an ALREADY-updated body replaces the top block instead of stacking a second one', () => {
    const once = buildUpdatedPrBody({ existingBody: ORIGINAL_BODY, previewUrl: 'https://old.pages.dev', gateSummaryLine: 'old summary' });
    const twice = buildUpdatedPrBody({ existingBody: once, previewUrl: 'https://new.pages.dev', gateSummaryLine: 'new summary' });
    assert.equal((twice.match(/<!-- preview-link-block -->/g) || []).length, 1, 'must never stack a second block');
    assert.match(twice, /https:\/\/new\.pages\.dev/);
    assert.doesNotMatch(twice, /https:\/\/old\.pages\.dev/);
    assert.match(twice, /## Self-hosted blog generator — run report/, 'the original report body must still be intact after two updates');
  });
});

describe('pollForCheckRunSummary — orchestration, injected exec/sleep', () => {
  function fakeCheckRunsResponse(checkRuns) {
    return JSON.stringify({ check_runs: checkRuns });
  }

  test('returns the summary as soon as the named check reports completed', async () => {
    const exec = () => fakeCheckRunsResponse([
      { name: 'Cloudflare Pages', status: 'completed', output: { summary: '<p>done</p>' } },
    ]);
    const result = await pollForCheckRunSummary({ repo: 'o/r', sha: 'abc', checkName: 'Cloudflare Pages', exec, sleep: async () => {}, maxAttempts: 3 });
    assert.equal(result, '<p>done</p>');
  });

  test('polls again (via injected sleep) while the check is still in_progress, then returns once completed', async () => {
    let call = 0;
    const exec = () => {
      call += 1;
      const status = call < 3 ? 'in_progress' : 'completed';
      return fakeCheckRunsResponse([{ name: 'Cloudflare Pages', status, output: { summary: status === 'completed' ? '<p>ready</p>' : null } }]);
    };
    let sleepCalls = 0;
    const result = await pollForCheckRunSummary({ repo: 'o/r', sha: 'abc', checkName: 'Cloudflare Pages', exec, sleep: async () => { sleepCalls += 1; }, maxAttempts: 10 });
    assert.equal(result, '<p>ready</p>');
    assert.equal(sleepCalls, 2);
  });

  test('gives up after maxAttempts and returns null rather than hanging forever', async () => {
    const exec = () => fakeCheckRunsResponse([{ name: 'Cloudflare Pages', status: 'in_progress', output: null }]);
    const result = await pollForCheckRunSummary({ repo: 'o/r', sha: 'abc', checkName: 'Cloudflare Pages', exec, sleep: async () => {}, maxAttempts: 3 });
    assert.equal(result, null);
  });

  test('the named check never appearing at all (not yet scheduled) returns null, not a crash', async () => {
    const exec = () => fakeCheckRunsResponse([{ name: 'Build on push & PR', status: 'completed', output: { summary: 'x' } }]);
    const result = await pollForCheckRunSummary({ repo: 'o/r', sha: 'abc', checkName: 'Cloudflare Pages', exec, sleep: async () => {}, maxAttempts: 2 });
    assert.equal(result, null);
  });

  test('an exec/API failure is treated as a retry, not a fatal crash -- this is a nice-to-have feature, never worth failing the whole workflow over', async () => {
    let call = 0;
    const exec = () => {
      call += 1;
      if (call === 1) throw new Error('gh api transient failure');
      return fakeCheckRunsResponse([{ name: 'Cloudflare Pages', status: 'completed', output: { summary: '<p>ok</p>' } }]);
    };
    const result = await pollForCheckRunSummary({ repo: 'o/r', sha: 'abc', checkName: 'Cloudflare Pages', exec, sleep: async () => {}, maxAttempts: 3 });
    assert.equal(result, '<p>ok</p>');
  });
});
