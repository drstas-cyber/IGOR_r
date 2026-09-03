#!/usr/bin/env node
/* eslint-disable no-console */
// Renders the README's path table and prompt↔gate pairs table from
// pipelinePaths.mjs and promptGatePairs.mjs.
//
// The point is that the README's tables are GENERATED, never hand-typed
// alongside the data. A hand-typed copy is a second source of truth, and
// the whole "no unfired paths" order exists because second sources of
// truth drift silently -- that is precisely what prompt.md rule 10 was
// relative to identityCompletenessGate.mjs.
//
// Usage:
//   node tools/blog-generator/renderPathTable.mjs           # both tables
//   node tools/blog-generator/renderPathTable.mjs --paths   # path table only
//   node tools/blog-generator/renderPathTable.mjs --pairs   # pairs table only
import { PIPELINE_PATHS, unforcedPaths, weakestProofPaths } from './pipelinePaths.mjs';
import { PROMPT_GATE_PAIRS, AUDIT_DATE, inconsistentPairs } from './promptGatePairs.mjs';

const CATEGORY_TITLES = {
  generation: 'Generation outcomes',
  'topic-selection': 'Topic selection',
  'pr-opening': 'PR opening',
  'human-action': 'Human actions',
  'publish-on-merge': 'Publish-on-merge',
  email: 'Emails',
  cron: 'Cron',
  retro: 'Weekly retro',
};

// Markdown table cells cannot contain a raw pipe, and a long note wrecks
// column alignment for a human reading the raw file -- so notes are
// rendered as footnotes below each section rather than inline.
function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function forcingCell(p) {
  if (!p.forcing) return `⚠️ **none — watchdog only**`;
  return `\`${p.forcing.kind}\` — ${cell(p.forcing.test)}`;
}

function renderPaths() {
  const out = [];
  out.push('| # | Path | Forced by | Kind | Last observed |');
  out.push('|---|---|---|---|---|');
  const byCategory = new Map();
  for (const p of PIPELINE_PATHS) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  }
  const footnotes = [];
  for (const [category, rows] of byCategory) {
    out.push(`| | **${CATEGORY_TITLES[category] || category}** | | | |`);
    for (const p of rows) {
      const marker = p.note ? ` [^${p.id}]` : '';
      out.push(
        `| ${p.id} | ${cell(p.name)}${marker} | ${p.forcing ? cell(p.forcing.test) : `watchdog: \`${p.watchdog.workflow}\``} | ${p.forcing ? `\`${p.forcing.kind}\`` : '⚠️ **unforceable**'} | ${cell(p.lastObserved)} |`,
      );
      if (p.note) footnotes.push(`[^${p.id}]: ${p.note}`);
    }
  }
  out.push('');
  out.push(...footnotes);
  return out.join('\n');
}

function renderPairs() {
  const out = [];
  out.push('| # | Fail-closed gate | prompt.md rule | Consistent? |');
  out.push('|---|---|---|---|');
  const footnotes = [];
  for (const p of PROMPT_GATE_PAIRS) {
    const marker = p.note ? ` [^${p.id}]` : '';
    const verdict = p.consistent ? '✅ yes' : '❌ **NO**';
    const anchor = p.promptAnchor === null ? '_(none — see note)_' : `\`${cell(p.promptAnchor.slice(0, 48))}…\``;
    out.push(`| ${p.id} | ${cell(p.gate)}${marker} | ${cell(p.promptRule)}<br>${anchor} | ${verdict} |`);
    if (p.note) footnotes.push(`[^${p.id}]: ${p.note}`);
  }
  out.push('');
  out.push(...footnotes);
  return out.join('\n');
}

function summary() {
  const forced = PIPELINE_PATHS.length - unforcedPaths().length;
  return [
    `**${PIPELINE_PATHS.length} paths enumerated. ${forced} have something that executes them. ${unforcedPaths().length} cannot be forced and have watchdogs instead.**`,
    '',
    `Weakest-proof rows (\`static\` — asserts text, does not execute): ${weakestProofPaths().map((p) => p.id).join(', ') || 'none'}.`,
    `Unforceable rows: ${unforcedPaths().map((p) => p.id).join(', ')}.`,
    `Prompt↔gate pairs audited ${AUDIT_DATE}: ${PROMPT_GATE_PAIRS.length}, inconsistent: ${inconsistentPairs().length}.`,
  ].join('\n');
}

const args = process.argv.slice(2);
if (args.includes('--paths')) {
  console.log(renderPaths());
} else if (args.includes('--pairs')) {
  console.log(renderPairs());
} else if (args.includes('--summary')) {
  console.log(summary());
} else {
  console.log(summary());
  console.log('\n### Path table\n');
  console.log(renderPaths());
  console.log('\n### Prompt↔gate consistency pairs\n');
  console.log(renderPairs());
}
