#!/usr/bin/env node
/* eslint-disable no-console */
// Renders tools/blog-generator/.last-run-report.json (written by generate.mjs)
// as Markdown for the PR body. Reads from a path passed as argv[2], or the
// default report path. Prints to stdout only — no side effects.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.join(__dirname, '.last-run-report.json');
const reportPath = process.argv[2] || DEFAULT_PATH;

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

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
}
lines.push('---');
lines.push('');
lines.push('### Layer 1 — regex scanner (frozen pattern set 30d8154)');
lines.push(`Tripped: **${report.layer1.tripped}**`);
if (report.layer1.findings?.length) {
  for (const f of report.layer1.findings) {
    lines.push(`- \`[${f.category}${f.subcategory ? ':' + f.subcategory : ''}]\` matched "${f.matchedText}" — ${f.sentence}`);
  }
} else {
  lines.push('_No findings._');
}
lines.push('');
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
lines.push('');
lines.push('---');
lines.push('');
lines.push('**Reminder for the reviewer:** gate-clean is not the same as compliant. This is a review-and-EDIT step, not a rubber stamp — read the article, don\'t just check that both gates say pass. If this is one of the first three articles this pipeline has produced, it requires a full manual read regardless of gate results (see `tools/blog-generator/README.md`).');

console.log(lines.join('\n'));
