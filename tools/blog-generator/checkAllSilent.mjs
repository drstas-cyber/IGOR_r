#!/usr/bin/env node
/* eslint-disable no-console */
// Determines whether generate.mjs's run was "perfectly silent" (see
// autoPublishGate.mjs), for the GitHub Actions step that decides whether
// to auto-merge and auto-publish the PR this run opened. Extracted into
// its own script matching checkRejectedMarker.mjs's exact pattern (2026-
// 07-27) — reads the STRUCTURED report file generate.mjs already writes,
// never the raw job log. "Don't parse logs" (owner instruction, 2026-08-
// 03) applies here exactly the same way it applies to has_new_article and
// has_rejected_marker already reading ground-truth files instead of
// grepping generate.mjs's console output.
//
// Fails closed like its siblings: a missing or unparseable report, or an
// outcome other than 'generated', all resolve to allSilent: 'false' —
// never 'true' by default. The workflow only auto-merges on an explicit
// 'true'.
import fs from 'node:fs';

export function checkAllSilent({
  reportPath = 'tools/blog-generator/.last-run-report.json',
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
} = {}) {
  if (!existsSync(reportPath)) {
    return { allSilent: 'false', slug: '', reason: `${reportPath} does not exist -- cannot determine outcome, defaulting to hold.` };
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (err) {
    return { allSilent: 'false', slug: '', reason: `${reportPath} exists but failed to parse (${err.message}) -- defaulting to hold.` };
  }

  if (report.outcome !== 'generated') {
    return { allSilent: 'false', slug: '', reason: `outcome is "${report.outcome}", not "generated" -- nothing to auto-publish, holding.` };
  }

  if (report.allSilent === true) {
    return { allSilent: 'true', slug: report.article?.slug || '', reason: 'report.allSilent is true -- eligible for auto-merge/auto-publish.' };
  }

  return { allSilent: 'false', slug: report.article?.slug || '', reason: 'report.allSilent is false -- holding for a supervised human read.' };
}

const isMain = process.argv[1] && process.argv[1].endsWith('checkAllSilent.mjs');
if (isMain) {
  const result = checkAllSilent();
  // Only these two lines go to stdout -- the workflow step redirects
  // stdout straight into $GITHUB_OUTPUT, which expects nothing but
  // key=value lines (same discipline as checkRejectedMarker.mjs).
  console.log(`all_silent=${result.allSilent}`);
  console.log(`article_slug=${result.slug}`);
  console.error(`[checkAllSilent] ${result.reason}`);
}
