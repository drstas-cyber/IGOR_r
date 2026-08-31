// Validates the self-review tool call's own internal consistency --
// structural, not prompt-hopeful (owner decision, 2026-08-07, see
// tools/blog-generator/README.md "Self-review reporting fix"). Extracted
// into its own file matching checkRejectedMarker.mjs's pattern:
// single-purpose, unit-tested in isolation, not inline logic a
// future reader has to untangle from generate.mjs's main().
//
// Root cause this exists to fix: the self-review tool schema used to have
// one field, violations_found, with a free-text instruction ("empty array
// if the draft was already clean") the model was expected to just follow.
// It didn't always: PR #27 (2026-08-07) shows a genuinely clean draft
// reported back as violations_found: ["No hard-rule violations found ...
// Draft was already clean ... returned unchanged"] -- a narration
// masquerading as a 1-item correction list. autoPublishGate.mjs's
// selfReviewSilent check (violationsFound.length === 0) correctly held
// that PR for a human read, for the wrong reason: it looked like a real
// correction, not a reporting quirk, and a human had to read the actual
// content_html to discover the two were the same "nothing changed" case
// dressed up two different ways in adjacent runs' reports (PR #26 legitimately
// found and fixed 3 real issues; PR #27's "correction" was nothing at all).
//
// Fix: two fields now, draft_was_clean (boolean) and violations_found
// (array), with an explicit code-enforced consistency rule instead of a
// hoped-for prompt instruction -- "structural not prompt-hopeful" per the
// owner's own framing of this fix. draft_was_clean=true paired with a
// non-empty violations_found is flagged HERE, deterministically, as a
// schema-validation failure -- never silently trusted, never guessed at.
// This does not discard the run (see generate.mjs -- the article still
// gets a real PR); it only ever affects report.selfReview.valid, which
// autoPublishGate.mjs reads to keep the run from being misclassified as
// silent.
export function validateSelfReview(reviewed) {
  const errors = [];

  if (!reviewed || typeof reviewed !== 'object') {
    return { valid: false, errors: ['self-review output is not an object'] };
  }

  if (typeof reviewed.draft_was_clean !== 'boolean') {
    errors.push(`draft_was_clean must be a boolean, got: ${JSON.stringify(reviewed.draft_was_clean)}`);
  }

  if (!Array.isArray(reviewed.violations_found)) {
    errors.push(`violations_found must be an array, got: ${JSON.stringify(reviewed.violations_found)}`);
  }

  // The one rule this whole file exists to enforce: draft_was_clean=true
  // REQUIRES an empty array. Only checked once both fields are confirmed
  // to be the right shape above -- a malformed report already fails for
  // that reason and doesn't need a second, possibly-confusing error about
  // a mismatch that can't even be evaluated yet.
  if (
    reviewed.draft_was_clean === true &&
    Array.isArray(reviewed.violations_found) &&
    reviewed.violations_found.length > 0
  ) {
    errors.push(
      `draft_was_clean is true but violations_found has ${reviewed.violations_found.length} entr${reviewed.violations_found.length === 1 ? 'y' : 'ies'} -- these two fields disagree about whether the draft was clean. Fails closed: never guess which field to believe, hold for a human read. Reported entries: ${JSON.stringify(reviewed.violations_found)}`,
    );
  }

  return { valid: errors.length === 0, errors };
}
