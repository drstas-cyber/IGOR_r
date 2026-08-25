#!/usr/bin/env node
/* eslint-disable no-console */
// CLI entrypoint for the weekly retrospective audit — what
// .github/workflows/weekly-retro.yml actually runs. Thin by design: all
// real logic lives in retroAudit.mjs (testable, no argv/fs coupling) and
// renderRetroReport.mjs; this file's only job is argv -> options,
// running the audit, writing the report artifact to docs/retros/, and
// setting the exit code.
//
// "Loud if it finds anything" (the standing instruction this audit exists
// to satisfy): exits non-zero whenever ANY article has ANY reason at all —
// REJECT or NEEDS-FIX — not just on REJECT. A NEEDS-FIX-only week (a
// demoted finding, a bot-blocked citation) is still worth a human's
// attention; the report is always committed either way (see the
// workflow's `if: always()` commit step) so a red run never means the
// evidence disappears, exactly the "gate trip is not silent" discipline
// this whole pipeline already applies everywhere else.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWeeklyRetro } from './retroAudit.mjs';
import { renderRetroReportMd } from './renderRetroReport.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const RETROS_DIR = path.join(PROJECT_ROOT, 'docs', 'retros');

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const sinceDaysArg = process.argv.find((a) => a.startsWith('--since-days='));
  const sinceDays = sinceDaysArg ? Number(sinceDaysArg.slice('--since-days='.length)) : 7;
  const skipLive = process.argv.includes('--skip-live');

  console.log(`[weeklyRetroCli] running weekly retro audit (last ${sinceDays} day(s))...`);
  const report = await runWeeklyRetro({ sinceDays, skipLive });

  console.log(`[weeklyRetroCli] ${report.scopeCount} article(s) in scope, overall: ${report.overall}`);
  for (const a of report.articles) {
    console.log(`  [${a.verdict}] ${a.slug}${a.reasons.length ? ` — ${a.reasons.length} reason(s)` : ''}`);
    for (const r of a.reasons) console.log(`      [${r.severity}] ${r.text}`);
  }

  const md = renderRetroReportMd(report);
  fs.mkdirSync(RETROS_DIR, { recursive: true });
  const outPath = path.join(RETROS_DIR, `${todayIsoDate()}.md`);
  fs.writeFileSync(outPath, `${md}\n`, 'utf8');
  console.log(`[weeklyRetroCli] report written to ${path.relative(PROJECT_ROOT, outPath)}`);

  if (report.hasAnyFindings) {
    console.error(`::error::[weeklyRetroCli] the weekly retro found ${report.articles.filter((a) => a.reasons.length).length} article(s) with at least one finding — see ${path.relative(PROJECT_ROOT, outPath)}`);
    process.exitCode = 1;
  } else {
    console.log('[weeklyRetroCli] clean — nothing found across any category.');
  }
}

main().catch((err) => {
  console.error(`[weeklyRetroCli] FATAL: ${err.message}`);
  process.exitCode = 1;
});
