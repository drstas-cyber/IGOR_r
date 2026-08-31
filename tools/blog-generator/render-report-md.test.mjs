import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderReportMarkdown } from './render-report-md.mjs';

// render-report-md.mjs (2026-08-31 refactor, tactical item 3d of the
// manual-publish formalization) -- previously a bare top-level script with
// no exported function and no test file at all, branching implicitly on
// whatever fields happened to be present. Split into a pure
// renderReportMarkdown(report) function (this repo's own established
// "pure core, thin I/O shell" convention, same as every other module in
// this directory) specifically so it can require an explicit `outcome`
// field and branch on it rather than the CALLER sniffing for a "topic" key
// in the raw JSON text (generate-article.yml's workaround before this
// pass). Writer side (generate.mjs) already always sets `outcome`; reader
// side (this function) now requires it.

function fullReport(overrides = {}) {
  return {
    generatedAt: '2026-08-31T00:00:00.000Z',
    topic: { topic: 'Understanding HOA Fees', target_keyword: 'hoa fees' },
    outcome: 'generated',
    article: { title: 'Understanding HOA Fees', slug: 'understanding-hoa-fees' },
    allSilent: false,
    layer1: { tripped: false, findings: [] },
    layer2: { tripped: false, checklist: {} },
    layer3: { tripped: false, results: [] },
    selfReview: { draftWasClean: true, violationsFound: [], valid: true, errors: [] },
    ...overrides,
  };
}

describe('renderReportMarkdown — required outcome field', () => {
  test('a report with no outcome field at all -- refuses to render, throws loudly rather than rendering "undefined"', () => {
    assert.throws(() => renderReportMarkdown({ topic: { topic: 'x', target_keyword: 'y' } }), /outcome/i);
  });
});

describe('renderReportMarkdown — minimal early-exit reports (2026-08-31)', () => {
  test('outcome missing_api_key -- renders a short informational body, does not crash on missing topic/layer1', () => {
    const md = renderReportMarkdown({ generatedAt: '2026-08-31T00:00:00.000Z', outcome: 'missing_api_key' });
    assert.match(md, /missing_api_key/);
    assert.doesNotMatch(md, /undefined/);
  });

  test('outcome missing_repository -- same, renders cleanly', () => {
    const md = renderReportMarkdown({ generatedAt: '2026-08-31T00:00:00.000Z', outcome: 'missing_repository' });
    assert.match(md, /missing_repository/);
  });

  test('outcome uncaught_exception -- renders cleanly AND includes the captured errorMessage when present', () => {
    const md = renderReportMarkdown({ generatedAt: '2026-08-31T00:00:00.000Z', outcome: 'uncaught_exception', errorMessage: '[topicAvailability] gh pr list failed: simulated outage.' });
    assert.match(md, /uncaught_exception/);
    assert.match(md, /simulated outage/);
  });

  test('outcome uncaught_exception with no errorMessage -- still renders, no crash, no "undefined"', () => {
    const md = renderReportMarkdown({ generatedAt: '2026-08-31T00:00:00.000Z', outcome: 'uncaught_exception' });
    assert.doesNotMatch(md, /undefined/);
  });
});

describe('renderReportMarkdown — a recognized trip outcome with no topic (malformed) -- fails loud, never silently crashes with a raw TypeError', () => {
  test('outcome "generated" but no topic field and not a recognized minimal shape -- throws a clear, actionable error', () => {
    assert.throws(
      () => renderReportMarkdown({ outcome: 'generated' }),
      /topic/i
    );
  });
});

describe('renderReportMarkdown — full reports, informational-only silent-run language (2026-08-31 manual-publish formalization)', () => {
  test('outcome generated, allSilent true -- describes it as informational, never claims an auto-merge/auto-publish action was taken', () => {
    const md = renderReportMarkdown(fullReport({ allSilent: true }));
    assert.match(md, /Perfectly silent/);
    assert.doesNotMatch(md, /merges and publishes automatically/i);
    assert.doesNotMatch(md, /auto-merge\/auto-publish path/i);
    assert.match(md, /human Merge/i, 'must state publication requires a human Merge');
  });

  test('outcome generated, allSilent false -- the reviewer reminder never claims an auto-publish path was disqualified', () => {
    const md = renderReportMarkdown(fullReport({ allSilent: false }));
    assert.doesNotMatch(md, /disqualified the auto-publish path/i);
  });

  test('the closing reminder for a perfectly-silent run never claims this run auto-merges/auto-publishes', () => {
    const md = renderReportMarkdown(fullReport({ allSilent: true }));
    assert.doesNotMatch(md, /this run auto-merges and auto-publishes/i);
    assert.match(md, /weekly retrospective/i, 'the weekly-retro mention must survive -- it is still the standing audit');
  });

  test('a tripped run (outcome skipped) still renders the full Layer 1/2/3 report, unaffected by the minimal-report branch', () => {
    const md = renderReportMarkdown(fullReport({
      outcome: 'skipped',
      article: undefined,
      layer1: { tripped: true, findings: [{ category: 'exclusivity', subcategory: 'only', matchedText: 'only we', sentence: 'Only we do this.' }] },
    }));
    assert.match(md, /Layer 1/);
    assert.match(md, /only we/);
    assert.doesNotMatch(md, /\*\*Article:\*\*/, 'a tripped run must never carry the discarded draft\'s identity');
  });

  test('identical output to the pre-refactor renderer for an ordinary full report (regression guard on the unrelated Layer 1/2/3 rendering)', () => {
    const md = renderReportMarkdown(fullReport());
    assert.match(md, /## Self-hosted blog generator — run report/);
    assert.match(md, /\*\*Topic:\*\* Understanding HOA Fees/);
    assert.match(md, /\*\*Article:\*\* Understanding HOA Fees \(`understanding-hoa-fees`\)/);
    assert.match(md, /### Layer 1/);
    assert.match(md, /### Layer 2/);
    assert.match(md, /### Layer 3/);
  });
});
