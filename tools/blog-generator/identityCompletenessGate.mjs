// Fail-closed gate (hardening batch, 2026-08-25, after PR #35 "Vail Ranch,"
// 2026-08-23): every generated article's content_html must carry the full
// fixed identity block -- DRE #02034120, "Allison James" (brokerage), the
// reference phone number in any formatting, and askgeorgek@gmail.com. Pure,
// no I/O -- exported for tests, called from generate.mjs after the internal-
// link gate with the same discard-path treatment as a schema-invalid draft
// (see generate.mjs's handleTrippedGate()).
//
// Same shape and placement in the pipeline as internalLinkGate.mjs on
// purpose -- both are "the model got the shape of the article wrong"
// problems, both get their own standalone gate module with their own
// failureClass, neither is folded into schema.js's structural/citation
// checks. Two different reasons that separation matters here specifically:
//
// 1. The underlying check (findIdentityCompletenessErrors, in
//    tools/blog-compliance/scan.js, colocated with REFERENCE and
//    findWrongIdentity so there's exactly one source of truth for what
//    "correct identity" means) is explicitly NOT folded into scanArticle()'s
//    own findings/tripped either -- see that file's comment for why a
//    BabyLoveGrowth-shaped article must never be required to carry this
//    exact block. This module is the generator-specific caller that DOES
//    require it, same relationship generate.mjs already has with
//    scanArticle() via GENERATOR_LOG_ONLY_FINDING_KEYS.
// 2. Folding this into validateArticleSchema() directly would have silently
//    broken every existing schema.test.mjs fixture that overrides
//    content_html to test something unrelated (citation shape, host policy,
//    marker consistency) without an identity block -- noise with no
//    connection to what those tests actually verify. A separate gate keeps
//    that blast radius at zero, the same reason internalLinkGate.mjs isn't
//    inside schema.js either.
import { findIdentityCompletenessErrors } from '../blog-compliance/scan.js';

// validateIdentityCompleteness (exported) — { valid, errors }, matching
// validateArticleSchema()'s and validateInternalLinks()'s own return shape
// so generate.mjs's three post-generation checks read the same way.
export function validateIdentityCompleteness(article) {
  const errors = findIdentityCompletenessErrors(article);
  return { valid: errors.length === 0, errors };
}
