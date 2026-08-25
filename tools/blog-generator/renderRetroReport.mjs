#!/usr/bin/env node
/* eslint-disable no-console */
// Renders a runWeeklyRetro() report (retroAudit.mjs) as Markdown — the
// artifact committed to docs/retros/. Mirrors render-report-md.mjs's shape
// and discipline exactly (one function, pure, no I/O, exported for tests;
// the CLI block at the bottom is the only place that touches fs/argv).

import fs from 'node:fs';

function verdictBadge(verdict) {
  return verdict === 'CLEAR' ? '✅ CLEAR' : verdict === 'NEEDS-FIX' ? '⚠️ NEEDS-FIX' : '🛑 REJECT';
}

// renderRetroReportMd (exported, pure) — report is runWeeklyRetro()'s
// return shape. `title`/`note` are optional overrides so the same renderer
// serves both the ongoing weekly job (default) and the one-time backfill
// (a distinct title + an explanatory note about what was and wasn't
// re-run — see docs/retros/2026-08-03-to-2026-08-25-backfill.md).
export function renderRetroReportMd(report, { title = 'Weekly retrospective audit', note } = {}) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(
    report.windowDays != null
      ? `**Window:** last ${report.windowDays} days`
      : '**Window:** explicit article list (not a rolling window — see note below)'
  );
  lines.push(`**Articles in scope:** ${report.scopeCount}`);
  lines.push(`**Overall:** ${verdictBadge(report.overall)}`);
  lines.push('');
  if (note) {
    lines.push(note.trim());
    lines.push('');
  }
  lines.push(
    'Six categories, same scale as every prior article read this project has done: fabricated speech, ' +
    'misattributed quotes, prohibited claims, stats-vs-citations, identity block, quality/rendering. ' +
    '`REJECT` = a real defect on a live page; `NEEDS-FIX` = real signal, lower severity, not proof the page ' +
    'is actively wrong; `CLEAR` = nothing found across any category.'
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  if (report.scopeCount === 0) {
    lines.push('_Nothing published in this window — nothing to audit._');
    lines.push('');
    return lines.join('\n');
  }

  for (const a of report.articles) {
    lines.push(`## ${verdictBadge(a.verdict)} — ${a.title || a.slug} (\`${a.slug}\`)`);
    if (a.reasons.length === 0) {
      lines.push('');
      lines.push('No findings across any category.');
      lines.push('');
      continue;
    }
    lines.push('');
    for (const r of a.reasons) {
      lines.push(`- **[${r.severity}]** ${r.text}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    report.overall === 'CLEAR'
      ? '**Nothing to action this cycle.**'
      : '**Action needed** — see the REJECT/NEEDS-FIX findings above. A REJECT finding on a live article is the ' +
        'exact gap this audit exists to catch (the compensating control for the auto-publish path\'s missing ' +
        'pre-merge human read) — do not let this sit; either fix the article or unpublish it ' +
        '(`node tools/blog-generator/setPublished.mjs --slug=<slug> --value=false`, per README.md\'s rollback line).'
  );

  return lines.join('\n');
}

const isMain = process.argv[1] && process.argv[1].endsWith('renderRetroReport.mjs');
if (isMain) {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error('[renderRetroReport] usage: node renderRetroReport.mjs <report.json path>');
    process.exitCode = 1;
  } else {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    console.log(renderRetroReportMd(report));
  }
}
