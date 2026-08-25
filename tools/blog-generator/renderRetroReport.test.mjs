import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderRetroReportMd } from './renderRetroReport.mjs';

function report(overrides = {}) {
  return {
    generatedAt: '2026-08-25T15:00:00.000Z',
    windowDays: 7,
    scopeCount: 2,
    overall: 'CLEAR',
    hasAnyFindings: false,
    articles: [
      { slug: 'a', title: 'Article A', verdict: 'CLEAR', reasons: [] },
      { slug: 'b', title: 'Article B', verdict: 'CLEAR', reasons: [] },
    ],
    ...overrides,
  };
}

describe('renderRetroReportMd', () => {
  test('an all-CLEAR report renders the CLEAR badge for each article and overall', () => {
    const md = renderRetroReportMd(report());
    assert.match(md, /Overall:\*\* ✅ CLEAR/);
    assert.match(md, /## ✅ CLEAR — Article A/);
    assert.match(md, /## ✅ CLEAR — Article B/);
    assert.match(md, /Nothing to action this cycle/);
  });

  test('a REJECT article renders its reasons and the action-needed footer', () => {
    const md = renderRetroReportMd(report({
      overall: 'REJECT',
      articles: [
        { slug: 'a', title: 'Article A', verdict: 'REJECT', reasons: [{ severity: 'REJECT', text: 'identity block incomplete: missing DRE' }] },
      ],
      scopeCount: 1,
    }));
    assert.match(md, /## 🛑 REJECT — Article A/);
    assert.match(md, /\*\*\[REJECT\]\*\* identity block incomplete: missing DRE/);
    assert.match(md, /Action needed/);
    assert.match(md, /setPublished\.mjs --slug=<slug> --value=false/);
  });

  test('an explicit-list report (windowDays: null) renders the backfill-style window line', () => {
    const md = renderRetroReportMd(report({ windowDays: null }));
    assert.match(md, /explicit article list/);
  });

  test('zero articles in scope renders "nothing to audit" and returns early', () => {
    const md = renderRetroReportMd(report({ scopeCount: 0, articles: [] }));
    assert.match(md, /Nothing published in this window/);
  });

  test('an optional note is rendered verbatim near the top', () => {
    const md = renderRetroReportMd(report(), { note: 'This is the Aug 3 -> Aug 25 catch-up backfill.' });
    assert.match(md, /This is the Aug 3 -> Aug 25 catch-up backfill\./);
  });

  test('a custom title overrides the default heading', () => {
    const md = renderRetroReportMd(report(), { title: 'Backfill retrospective audit' });
    assert.match(md, /^# Backfill retrospective audit/);
  });
});
