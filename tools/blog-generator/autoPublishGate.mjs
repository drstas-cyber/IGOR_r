// Computes whether a successfully-generated article run was "perfectly
// silent" -- eligible for the auto-merge/auto-publish path (owner
// decision, 2026-08-03; see README.md "Automated publishing"). Pure, no
// I/O, exported for tests -- same reasoning as assembleArticle() in
// generate.mjs: a deterministic decision the pipeline can just compute,
// not something worth asking a model to self-assess.
//
// "Perfectly silent" means every one of these holds:
// - Layer 1: zero findings of ANY kind, including log-only demoted ones
//   (exclusivity:only / exclusivity:superlative). A demoted finding still
//   means the scanner saw something, even though it doesn't trip the
//   gate for generator articles -- see GENERATOR_LOG_ONLY_FINDING_KEYS in
//   tools/blog-compliance/scan.js.
// - Layer 1's separate uncited-claim-candidate signal (findUncitedClaims)
//   is also zero. This is a distinct log-only mechanism from the demoted
//   findings above -- a different function, a different check -- but
//   it's still a signal, not silence, and "ANY finding anywhere -- even
//   log-only -- holds the PR" is the standing rule.
// - Layer 2: every boolean in the independent LLM checklist came back
//   false. layer2.tripped is already exactly that OR'd together (see
//   llmClaimGate.mjs) -- reused directly rather than re-deriving the same
//   seven checks a second, possibly-inconsistent way.
// - Layer 3: every citation RESOLVED. failed/unsupported already make
//   layer3.tripped true; inconclusive (UNREACHABLE_LIKELY_BOT) does NOT
//   trip the gate on its own (a bot-block is inconclusive, not proof of a
//   bad citation -- see citationResolver.mjs) but it IS a signal worth a
//   human's attention, so it disqualifies auto-silent even though it
//   doesn't disqualify generation itself.
// - Self-review: draft_was_clean === true AND zero violations found, BOTH
//   (owner decision, 2026-08-07 -- "Self-review reporting fix", see
//   README.md). Previously this checked violations_found.length === 0
//   alone, on the theory that the model's own "empty array if the draft
//   was already clean" instruction (generate.mjs's REVIEW_TOOL schema)
//   would hold. It didn't always: PR #27 (2026-08-07) shows a genuinely
//   clean draft reported back as a 1-item violations_found array whose
//   text was narration ("draft was already clean, returned unchanged"),
//   not a real correction -- indistinguishable from a real 1-item
//   correction by length alone. Structural fix, not another prompt
//   instruction to hope the model follows: draft_was_clean is a second,
//   independent field the model must also set, and
//   tools/blog-generator/selfReviewSchema.mjs's validateSelfReview()
//   flags any draft_was_clean=true + non-empty violations_found pairing
//   as an explicit inconsistency in report.selfReview.valid before this
//   function ever runs. Reading both fields here (not just trusting
//   report.selfReview.valid alone) is deliberate belt-and-suspenders --
//   this function must independently agree that draft_was_clean is
//   exactly true and the array is exactly empty, never inferring silence
//   from validity alone.
//
// Fails closed: any of the expected arrays/booleans being missing or the
// wrong shape defaults to "not silent," never to "silent." A malformed
// report must never accidentally auto-publish.
export function computeAllSilent(report) {
  if (!report || report.outcome !== 'generated') return false;

  const layer1 = report.layer1;
  const layer1FindingsSilent = Array.isArray(layer1?.findings) && layer1.findings.length === 0;
  const layer1UncitedSilent = Array.isArray(layer1?.uncitedClaimCandidates) && layer1.uncitedClaimCandidates.length === 0;

  const layer2Silent = report.layer2?.tripped === false;

  const layer3 = report.layer3;
  const layer3Silent =
    Array.isArray(layer3?.failed) && layer3.failed.length === 0 &&
    Array.isArray(layer3?.unsupported) && layer3.unsupported.length === 0 &&
    Array.isArray(layer3?.inconclusive) && layer3.inconclusive.length === 0;

  const selfReview = report.selfReview;
  const violationsFound = selfReview?.violationsFound;
  const selfReviewSilent =
    selfReview?.draftWasClean === true &&
    Array.isArray(violationsFound) &&
    violationsFound.length === 0;

  return layer1FindingsSilent && layer1UncitedSilent && layer2Silent && layer3Silent && selfReviewSilent;
}
