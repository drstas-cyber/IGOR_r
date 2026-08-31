#!/usr/bin/env node
/* eslint-disable no-console */
// Renders tools/blog-generator/.last-run-report.json (written by generate.mjs)
// as Markdown for the PR body. Pure core (renderReportMarkdown, exported
// for tests -- see render-report-md.test.mjs), thin CLI shell at the
// bottom that reads the file and prints the result -- this repo's own
// established "pure core, thin I/O shell" convention, which this file
// hadn't followed until this refactor (2026-08-31, tactical item 3d of the
// manual-publish formalization).
//
// Branches on the report's own `outcome` field, REQUIRED, rather than the
// caller pre-filtering by sniffing for a "topic" key in the raw JSON text
// (generate-article.yml's "Render gate report" step used to do exactly
// that, working around three minimal early-exit reports -- missing_
// api_key / missing_repository / uncaught_exception -- this function would
// otherwise crash on by unconditionally dereferencing report.topic.topic).
// Writer side (generate.mjs) already always sets `outcome` on every report
// it writes, minimal or full; this function now requires it explicitly and
// fails loud, with a clear message, on a report that doesn't have it (or
// claims a "full" outcome but is missing `topic`) -- never a raw
// TypeError, never a silent guess at what the report shape means.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.join(__dirname, '.last-run-report.json');

// MINIMAL_EARLY_EXIT_OUTCOMES (2026-08-31) -- generate.mjs's three
// early-exit reports (missing ANTHROPIC_API_KEY, missing
// GITHUB_REPOSITORY, an uncaught exception during topic selection) carry
// only {generatedAt, outcome, errorMessage?} -- no topic, no layer1/2/3,
// no self-review. None of these three ever opens a PR in the current
// workflow wiring (has_new_article and has_rejected_marker are both false
// for all of them), so this branch exists purely so this function never
// crashes if it's ever invoked against one anyway (a human running it by
// hand while debugging, for instance), not because a PR body currently
// needs it.
const MINIMAL_EARLY_EXIT_OUTCOMES = new Set(['missing_api_key', 'missing_repository', 'uncaught_exception']);

export function renderReportMarkdown(report) {
  if (!report?.outcome) {
    throw new Error('render-report-md.mjs: report has no "outcome" field -- refusing to render an unrecognized report shape.');
  }

  if (MINIMAL_EARLY_EXIT_OUTCOMES.has(report.outcome)) {
    const lines = [
      '## Self-hosted blog generator — run report',
      '',
      `**Outcome:** \`${report.outcome}\``,
      '',
      'The pipeline exited before selecting a topic or generating anything — no gate findings to report.',
    ];
    if (report.errorMessage) {
      lines.push('', `**Captured error:** ${report.errorMessage}`);
    }
    return lines.join('\n');
  }

  if (!report.topic) {
    throw new Error(`render-report-md.mjs: report has outcome "${report.outcome}" but no "topic" field, and this outcome is not a recognized minimal early-exit shape -- refusing to render, this looks like an unrecognized or malformed report.`);
  }

  const lines = [];
  lines.push(`## Self-hosted blog generator — run report`);
  lines.push('');
  lines.push(`**Topic:** ${report.topic.topic}`);
  lines.push(`**Target keyword:** ${report.topic.target_keyword}`);
  lines.push(`**Outcome:** \`${report.outcome}\``);
  lines.push('');
  // The discarded draft's title/slug is deliberately withheld on a tripped
  // run (report.outcome !== 'generated') — this report becomes the PR body,
  // and a rejected-attempt PR must carry only gate findings, never the
  // article's identity (see generate.mjs's handleTrippedGate).
  if (report.outcome === 'generated') {
    lines.push(`**Article:** ${report.article.title} (\`${report.article.slug}\`)`);
    lines.push('');
    // Informational only (owner ruling, 2026-08-31, superseding the
    // 2026-08-03 auto-publish decision) -- this line must NEVER claim an
    // auto-merge/auto-publish action happened or will happen. Publication
    // is always a human Merge; "perfectly silent" is a quality signal that
    // tells the reviewer this one needs less scrutiny than usual, nothing
    // more.
    lines.push(
      report.allSilent
        ? '**Perfectly silent.** Zero findings anywhere (including log-only), all Layer 2 checks false, every citation RESOLVED, self-review found nothing to fix — this run would have qualified for the retired auto-publish path. Publication is always a human Merge; this line is a quality signal, not an action taken.'
        : '**Not perfectly silent — holds for a supervised human read**, same standing rule this pipeline has always had. See the findings below.'
    );
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('### Layer 1 — regex scanner (frozen pattern set 30d8154)');
  lines.push(`Tripped: **${report.layer1.tripped}**`);
  if (report.layer1.findings?.length) {
    for (const f of report.layer1.findings) {
      const tag = f.logOnly ? ' **[LOG-ONLY — demoted for generator articles, does not affect this gate\'s outcome]**' : '';
      lines.push(`- \`[${f.category}${f.subcategory ? ':' + f.subcategory : ''}]\`${tag} matched "${f.matchedText}" — ${f.sentence}`);
    }
  } else {
    lines.push('_No findings._');
  }
  if (report.layer1.uncitedClaimCandidates?.length) {
    lines.push('');
    lines.push(`**LOG-ONLY, does not affect this gate's outcome** — ${report.layer1.uncitedClaimCandidates.length} uncited-claim candidate(s) (measurement only, not yet trip-worthy — see \`findUncitedClaims()\` in \`tools/blog-compliance/scan.js\`):`);
    for (const f of report.layer1.uncitedClaimCandidates) {
      lines.push(`- \`[${f.subcategory}]\` "${f.matchedText}" — ${f.sentence}`);
    }
  }
  lines.push('');
  if (report.selfReview) {
    lines.push('### Self-review (writer model, second pass)');
    // valid === false (2026-08-07 fix): draft_was_clean and violations_found
    // disagreed -- e.g. draft_was_clean=true alongside a non-empty array
    // whose text is narration, not a real correction (the exact PR #27
    // case). Rendered as its own distinct, flagged state so a human reading
    // this PR sees immediately that the list below may not describe real
    // changes -- never silently folded into the ordinary "N correction(s)"
    // rendering, which would look identical to a genuine finding.
    if (report.selfReview.valid === false) {
      lines.push('**SELF-REVIEW SCHEMA MISMATCH** — `draft_was_clean` and `violations_found` disagree with each other. Treat the entries below as unverified, possibly-narration text, not confirmed corrections — read the actual `content_html` directly rather than trusting this field:');
      for (const e of report.selfReview.errors || []) lines.push(`- ${e}`);
      if (report.selfReview.violationsFound?.length) {
        lines.push('');
        lines.push('Reported entries (unverified):');
        for (const v of report.selfReview.violationsFound) lines.push(`- ${v}`);
      }
    } else if (report.selfReview.violationsFound?.length) {
      lines.push(`${report.selfReview.violationsFound.length} correction(s) found and fixed:`);
      for (const v of report.selfReview.violationsFound) lines.push(`- ${v}`);
    } else {
      lines.push('_None — the draft was already clean per the model (`draft_was_clean: true`, zero violations)._');
    }
    lines.push('');
  }
  lines.push('### Layer 2 — independent LLM claim review (claude-haiku-4-5-20251001)');
  lines.push(`Tripped: **${report.layer2.tripped}**`);
  const c = report.layer2.checklist;
  const checklistRows = [
    ['tenure_claim', 'tenure_evidence'],
    ['uniqueness_claim', 'uniqueness_evidence'],
    ['review_rating_claim', 'review_evidence'],
    ['uncited_statistic', 'statistic_evidence'],
    ['competitor_mention', 'competitor_evidence'],
    ['contact_mismatch', 'contact_evidence'],
  ];
  lines.push('');
  lines.push('| Check | Flagged | Evidence |');
  lines.push('|---|---|---|');
  for (const [flagKey, evidenceKey] of checklistRows) {
    lines.push(`| ${flagKey} | ${c[flagKey]} | ${c[evidenceKey] ? c[evidenceKey].replace(/\|/g, '\\|') : '—'} |`);
  }
  if (typeof c.legal_duty_overstated !== 'undefined') {
    lines.push(`| legal_duty_overstated | ${c.legal_duty_overstated} | ${c.legal_duty_evidence ? c.legal_duty_evidence.replace(/\|/g, '\\|') : '—'} |`);
  }
  lines.push('');
  lines.push('### Layer 3 — citation URL resolution');
  lines.push(`Tripped: **${report.layer3?.tripped ?? false}**`);
  lines.push('');
  lines.push('**What this proves, and what it does not:** a RESOLVED (200) response means the URL exists and returned content — it does NOT mean the page supports the claim it is cited for. That gap is covered only by the supervised human read, never by this gate. A green Layer 3 is not verified sourcing.');
  lines.push('');
  if (report.layer3?.results?.length) {
    lines.push('| Outcome | id | Source | Host | Status | URL |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of report.layer3.results) {
      lines.push(`| ${r.outcome} | ${r.id} | ${(r.sourceName || '').replace(/\|/g, '\\|')} | ${r.host || '(unparseable)'} | ${r.status ?? '—'} | ${r.url} |`);
    }
    if (report.layer3.unsupported?.length) {
      lines.push('');
      lines.push(`_${report.layer3.unsupported.length} citation(s) RESOLVED_UNSUPPORTED — the URL resolves, but the expected content was not found in the response body. This DOES trip the gate (fail-closed), same as FAILED, reported separately for diagnosis: a resolving URL that doesn't back its claim is a real problem, not a lesser one._`);
    }
    if (report.layer3.inconclusive?.length) {
      lines.push('');
      lines.push(`_${report.layer3.inconclusive.length} citation(s) UNREACHABLE_LIKELY_BOT — inconclusive, not a trip on their own. Click through above; these are commonly bot-blocked government/legal hosts, not necessarily bad citations. Logged to \`tools/blog-generator/citation-host-log.json\` for accumulating per-host rates across articles._`);
    }
  } else {
    lines.push('_No citations in this article._');
  }
  lines.push('');
  if (report.outcome === 'schema_invalid' && report.schemaErrors?.length) {
    lines.push('---');
    lines.push('');
    lines.push('### Schema validation — FAILED (after both compliance gates passed)');
    lines.push('Both Layer 1 and Layer 2 passed on this draft; it was discarded because schema validation failed:');
    for (const e of report.schemaErrors) {
      lines.push(`- ${e}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push(
    report.outcome === 'generated' && report.allSilent
      ? '**Reminder:** this run would have qualified as perfectly silent, but publication always requires a human Merge (owner ruling, 2026-08-31) — review it the same as any other PR. It is still covered by the weekly retrospective audit — a full six-category read of everything published that week, report-only, same verdict scale.'
      : '**Reminder for the reviewer:** gate-clean is not the same as compliant. This is a review-and-EDIT step, not a rubber stamp — read the article, don\'t just check that both gates say pass. Layer 3 proves citation URLs resolve, not that they support their claims — verifying that is part of the manual read too. If this is one of the first three articles this pipeline has produced under the current prompt, it requires a full manual read regardless of gate results (see `tools/blog-generator/README.md`).'
  );

  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const reportPath = process.argv[2] || DEFAULT_PATH;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  console.log(renderReportMarkdown(report));
}
