import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSelfReview } from './selfReviewSchema.mjs';

describe('validateSelfReview — self-review tool output consistency (2026-08-07)', () => {
  test('clean draft: draft_was_clean=true, empty array -- valid', () => {
    const result = validateSelfReview({ draft_was_clean: true, violations_found: [] });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  test('real correction: draft_was_clean=false, 1 item -- valid (a real correction is not a schema failure)', () => {
    const result = validateSelfReview({ draft_was_clean: false, violations_found: ['softened an overstated legal-duty claim'] });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  // The exact bug this file exists to catch: PR #27 (2026-08-07) reported
  // draft_was_clean=true alongside a 1-item violations_found array whose
  // text was narration ("draft was already clean"), not a real correction.
  test('narrated-clean: draft_was_clean=true, 1 item -- INVALID, mismatch flagged', () => {
    const result = validateSelfReview({
      draft_was_clean: true,
      violations_found: ['No hard-rule violations found -- draft was already clean, returned unchanged'],
    });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /draft_was_clean is true but violations_found has 1 entry/);
  });

  test('missing draft_was_clean -- invalid, fails closed rather than assuming a default', () => {
    const result = validateSelfReview({ violations_found: [] });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /draft_was_clean must be a boolean/);
  });

  test('draft_was_clean wrong type (string) -- invalid', () => {
    const result = validateSelfReview({ draft_was_clean: 'true', violations_found: [] });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /draft_was_clean must be a boolean/);
  });

  test('violations_found missing/wrong type -- invalid', () => {
    const result = validateSelfReview({ draft_was_clean: true, violations_found: null });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /violations_found must be an array/);
  });

  test('null/undefined input -- invalid, fails closed', () => {
    assert.equal(validateSelfReview(null).valid, false);
    assert.equal(validateSelfReview(undefined).valid, false);
  });
});

// "Prove it red first" -- a naive check that only looks at
// violations_found.length (the pre-fix behavior) cannot distinguish a real
// correction from a narrated-clean mismatch; both just look like "1 item."
// Demonstrates why draft_was_clean is a necessary second field, not
// redundant with violations_found.
describe('regression: violations_found.length alone cannot detect the narrated-clean mismatch', () => {
  function naiveIsClean(reviewed) {
    return (reviewed.violations_found?.length ?? 1) === 0;
  }

  const NARRATED_CLEAN = { draft_was_clean: true, violations_found: ['draft was already clean, returned unchanged'] };
  const REAL_CORRECTION = { draft_was_clean: false, violations_found: ['fixed a fabricated statistic'] };

  test('RED: the naive length-only check treats both as identically "not clean" -- cannot tell them apart', () => {
    assert.equal(naiveIsClean(NARRATED_CLEAN), false);
    assert.equal(naiveIsClean(REAL_CORRECTION), false);
    // Both false -- a human reading only this signal has no way to know
    // one of these is a reporting artifact and the other is real content.
  });

  test('GREEN: validateSelfReview distinguishes them -- one is a flagged mismatch, the other is a normal held PR', () => {
    const narrated = validateSelfReview(NARRATED_CLEAN);
    const real = validateSelfReview(REAL_CORRECTION);
    assert.equal(narrated.valid, false, 'narrated-clean must be flagged as an inconsistency');
    assert.equal(real.valid, true, 'a real, self-consistent correction must NOT be flagged as a schema failure');
  });
});
