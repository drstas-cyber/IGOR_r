#!/usr/bin/env node
/* eslint-disable no-console */
// "PR body carries preview link + gate summary at top" (hardening batch
// item 3, 2026-08-25) — a real-article generator PR's body is a long,
// detailed gate report (render-report-md.mjs); useful for a desktop read,
// hard to skim from a phone. This script prepends a short, marked block —
// the Cloudflare Pages branch preview link plus a one-line gate summary
// (gateSummaryLine.mjs) — so a human deciding whether to merge from the
// GitHub mobile app sees the essentials without scrolling.
//
// Runs as its own step in generate-article.yml, after PR creation and
// before the auto-merge decision — see that workflow for the exact
// placement and the `continue-on-error: true` on the calling step (this is
// a convenience feature; it must never be the reason a real publish run
// goes red).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { extractBranchPreviewUrl } from './previewUrlExtract.mjs';
import { buildGateSummaryLine } from './gateSummaryLine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORT_PATH = path.join(__dirname, '.last-run-report.json');

const TOP_BLOCK_PATTERN = /<!-- preview-link-block -->[\s\S]*?<!-- \/preview-link-block -->\n*/;

// buildUpdatedPrBody (exported, pure) — idempotent: a body that already
// carries a marked top block (from a prior run of this same script, e.g. a
// re-push to the PR branch) gets that block REPLACED, never stacked. The
// marker comments are HTML comments so they render invisibly on GitHub —
// a human reading the PR sees only the preview link and summary, not the
// bookkeeping around them.
export function buildUpdatedPrBody({ existingBody, previewUrl, gateSummaryLine }) {
  const withoutOldBlock = String(existingBody || '').replace(TOP_BLOCK_PATTERN, '');
  const previewLine = previewUrl
    ? `**Preview:** ${previewUrl}`
    : '_Preview URL unavailable (Cloudflare Pages check did not complete in time)._';
  const summaryLine = gateSummaryLine ? `\n\n${gateSummaryLine}` : '';
  const block = `<!-- preview-link-block -->\n${previewLine}${summaryLine}\n\n---\n<!-- /preview-link-block -->\n\n`;
  return `${block}${withoutOldBlock}`;
}

// pollForCheckRunSummary (exported) — polls `gh api .../check-runs` for the
// named check on the given SHA until it reports `status: completed`,
// returning its `output.summary` HTML (or null on timeout / the check
// never appearing / a completed check with no summary). `exec`/`sleep` are
// injectable, same fail-tolerant-not-fatal spirit as
// topicAvailability.mjs's exec injection, but the OPPOSITE failure
// posture deliberately: that function is fail-CLOSED (throws) because a
// wrong answer there could double-generate an article; this one is
// fail-SOFT (never throws, worst case returns null) because a wrong or
// missing answer here only costs a nicer PR body, never a real defect.
export async function pollForCheckRunSummary({ repo, sha, checkName, exec = execSync, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), maxAttempts = 20, delayMs = 15000 }) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const raw = exec(`gh api repos/${repo}/commits/${sha}/check-runs`, { encoding: 'utf8' });
      const parsed = JSON.parse(raw);
      const run = (parsed.check_runs || []).find((r) => r.name === checkName);
      if (run && run.status === 'completed') {
        return run.output?.summary ?? null;
      }
    } catch {
      // Transient gh/API failure -- treated as "not ready yet," same as an
      // in-progress check. Retried on the next attempt, never thrown --
      // see this function's own header comment for why fail-soft is right
      // here specifically.
    }
    if (attempt < maxAttempts) await sleep(delayMs);
  }
  return null;
}

function getPrBody({ repo, prNumber, exec = execSync }) {
  return exec(`gh pr view ${prNumber} --repo ${repo} --json body -q .body`, { encoding: 'utf8' });
}

function setPrBody({ repo, prNumber, body, exec = execSync }) {
  const tmpFile = path.join(os.tmpdir(), `pr-${prNumber}-body-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, body, 'utf8');
  try {
    exec(`gh pr edit ${prNumber} --repo ${repo} --body-file "${tmpFile}"`, { encoding: 'utf8' });
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

async function main({ repo = process.env.GITHUB_REPOSITORY, prNumber = process.argv.find((a) => a.startsWith('--pr='))?.slice('--pr='.length), sha = process.argv.find((a) => a.startsWith('--sha='))?.slice('--sha='.length), reportPath = DEFAULT_REPORT_PATH } = {}) {
  if (!repo || !prNumber || !sha) {
    console.error('[updatePrPreviewLink] usage: GITHUB_REPOSITORY=owner/repo node updatePrPreviewLink.mjs --pr=<number> --sha=<branch head sha>');
    process.exitCode = 1;
    return;
  }

  console.log(`[updatePrPreviewLink] polling for the Cloudflare Pages check on ${sha}...`);
  const summary = await pollForCheckRunSummary({ repo, sha, checkName: 'Cloudflare Pages' });
  const previewUrl = extractBranchPreviewUrl(summary);
  if (previewUrl) {
    console.log(`[updatePrPreviewLink] preview URL: ${previewUrl}`);
  } else {
    console.log('[updatePrPreviewLink] no preview URL found (check never completed, or the summary shape changed) -- proceeding with the "unavailable" line.');
  }

  let report = null;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (err) {
    console.log(`[updatePrPreviewLink] could not read run report at ${reportPath} (${err.message}) -- gate summary line omitted.`);
  }
  const gateSummaryLine = report ? buildGateSummaryLine(report) : null;

  const existingBody = getPrBody({ repo, prNumber });
  const updatedBody = buildUpdatedPrBody({ existingBody, previewUrl, gateSummaryLine });
  setPrBody({ repo, prNumber, body: updatedBody });
  console.log(`[updatePrPreviewLink] PR #${prNumber} body updated.`);

  // Surfaced as a step output (added alongside the email-notifications
  // batch, 2026-08-25) purely so the "article PR opened" email step can
  // reuse the SAME already-polled preview URL instead of polling the
  // Cloudflare Pages check a second time -- one poll, two consumers.
  // Empty string (never a bare missing key) when unavailable, so the
  // calling YAML's `steps.*.outputs.preview_url` always exists as a
  // defined-but-possibly-empty string, never undefined.
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `preview_url=${previewUrl || ''}\n`);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('updatePrPreviewLink.mjs');
if (isMain) {
  main().catch((err) => {
    // Deliberately non-fatal at the process level too -- see this file's
    // header comment: a convenience feature must never fail the workflow.
    // The calling workflow step also sets continue-on-error: true as a
    // second, independent layer of the same guarantee.
    console.error(`[updatePrPreviewLink] non-fatal error: ${err.message}`);
    process.exitCode = 0;
  });
}
