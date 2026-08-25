// One-line gate summary for the TOP of a real-article PR body (hardening
// batch item 3, 2026-08-25 — "PR body carries preview link + gate summary
// at top", specifically so a human merging from the GitHub mobile app
// doesn't have to scroll a long report to know whether this is a
// perfectly-silent PR or one that needs a real read). Pure, no I/O — the
// full report already has everything render-report-md.mjs's own detailed
// rendering needs; this is a compressed, second view of the same report
// object, not a second source of truth computed a different way.

export function buildGateSummaryLine(report) {
  if (report.outcome !== 'generated') return null; // a discarded draft carries no article identity, nothing to summarize at the top

  if (report.allSilent) {
    return '**Perfectly silent** — Layer 1/2/3 clean, self-review found nothing. Auto-merges/auto-publishes.';
  }

  const correctionCount = report.selfReview?.violationsFound?.length || 0;
  const parts = [
    `Layer 1: ${report.layer1?.tripped ? 'TRIPPED' : 'clean'}`,
    `Layer 2: ${report.layer2?.tripped ? 'TRIPPED' : 'clean'}`,
    `Layer 3: ${report.layer3?.tripped ? 'TRIPPED' : 'clean'}`,
    `Self-review: ${correctionCount > 0 ? `${correctionCount} correction(s)` : 'clean'}`,
  ];
  return `**Not silent** — ${parts.join(' · ')} — holds for a supervised human read.`;
}
