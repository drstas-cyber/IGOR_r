// One-line gate summary for the TOP of a real-article PR body (hardening
// batch item 3, 2026-08-25 — "PR body carries preview link + gate summary
// at top", specifically so a human merging from the GitHub mobile app
// doesn't have to scroll a long report to know whether this is a
// perfectly-silent PR or one that needs a real read). Pure, no I/O — the
// full report already has everything render-report-md.mjs's own detailed
// rendering needs; this is a compressed, second view of the same report
// object, not a second source of truth computed a different way.
//
// "Perfectly silent" is informational only (owner ruling, 2026-08-31,
// superseding the 2026-08-03 auto-publish decision) -- publication is
// ALWAYS a human Merge, never a trigger this line's wording should imply
// happens automatically. The finding that forced this: zero silent
// publishes in the project's entire history -- every article was
// human-merged, and allSilent was unreachable in practice (phantom
// self-review link-stripping corrections, see internalLinkRestore.mjs's
// header comment and README.md's decision record, meant a "clean" draft
// almost always still carried at least one correction). This line still
// tells a reviewer "this one needs less scrutiny than usual," which is
// genuinely useful -- it just never claims to have acted on that signal
// itself.
export function buildGateSummaryLine(report) {
  if (report.outcome !== 'generated') return null; // a discarded draft carries no article identity, nothing to summarize at the top

  if (report.allSilent) {
    return '**Perfectly silent** — Layer 1/2/3 clean, self-review found nothing. Still requires a human Merge to publish.';
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
