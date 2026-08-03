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
// - Self-review: zero violations found. The pipeline has no structured
//   way to tell "formatting-only" fixes apart from substantive ones --
//   violations_found is a free-text description array (see generate.mjs's
//   REVIEW_TOOL schema), and guessing at that distinction with a keyword
//   match would be exactly the kind of fragile text-parsing this design
//   is supposed to avoid ("don't parse logs" applies just as much to
//   parsing a model's own free-text self-description). Until the
//   self-review tool schema grows an actual structured formatting-vs-
//   substantive classification, ANY self-review correction holds the PR
//   for a human read -- stricter than "no real corrections beyond
//   formatting" reads on its face, but the safe, honest interpretation
//   given what the pipeline can actually verify today. Documented as a
//   deliberate decision in README.md, not silently narrower than asked.
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

  const violationsFound = report.selfReview?.violationsFound;
  const selfReviewSilent = Array.isArray(violationsFound) && violationsFound.length === 0;

  return layer1FindingsSilent && layer1UncitedSilent && layer2Silent && layer3Silent && selfReviewSilent;
}
