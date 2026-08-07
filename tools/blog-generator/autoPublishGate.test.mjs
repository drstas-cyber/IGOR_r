import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeAllSilent } from './autoPublishGate.mjs';

// Fully clean report -- every layer and self-review at zero. The baseline
// every other test mutates one field away from.
function silentReport(overrides = {}) {
  return {
    outcome: 'generated',
    layer1: { tripped: false, findings: [], uncitedClaimCandidates: [] },
    layer2: { tripped: false, checklist: {} },
    layer3: { tripped: false, failed: [], unsupported: [], inconclusive: [], resolved: [] },
    selfReview: { draftWasClean: true, violationsFound: [] },
    ...overrides,
  };
}

describe('computeAllSilent — the perfectly-silent auto-publish gate (2026-08-03)', () => {
  test('a fully clean report is silent', () => {
    assert.equal(computeAllSilent(silentReport()), true);
  });

  test('outcome other than "generated" is never silent, regardless of layer contents', () => {
    assert.equal(computeAllSilent(silentReport({ outcome: 'skipped' })), false);
    assert.equal(computeAllSilent(silentReport({ outcome: 'schema_invalid' })), false);
    assert.equal(computeAllSilent(silentReport({ outcome: null })), false);
  });

  test('null/undefined report is not silent', () => {
    assert.equal(computeAllSilent(null), false);
    assert.equal(computeAllSilent(undefined), false);
  });

  // The case this whole gate exists to get right: a single LOG-ONLY layer 1
  // finding (demoted exclusivity subcategory, does not trip the gate) must
  // still hold the PR for a human read -- "ANY finding anywhere, even
  // log-only." This is the exact case a naive implementation checking
  // layer1.tripped instead of layer1.findings.length would get wrong --
  // see the "prove it red" block below for a concrete demonstration.
  test('HOLD: one log-only layer 1 finding (gate not tripped) disqualifies silence', () => {
    const report = silentReport({
      layer1: {
        tripped: false, // the finding is demoted, so the gate itself did NOT trip
        findings: [{ category: 'exclusivity', subcategory: 'only', matchedText: 'only agent', sentence: '...', logOnly: true }],
        uncitedClaimCandidates: [],
      },
    });
    assert.equal(computeAllSilent(report), false);
  });

  test('HOLD: a non-log-only (tripped) layer 1 finding also disqualifies silence', () => {
    const report = silentReport({
      layer1: {
        tripped: true,
        findings: [{ category: 'tenure', subcategory: null, matchedText: 'a decade', sentence: '...', logOnly: false }],
        uncitedClaimCandidates: [],
      },
    });
    assert.equal(computeAllSilent(report), false);
  });

  test('HOLD: an uncited-claim candidate (separate log-only mechanism) disqualifies silence', () => {
    const report = silentReport({
      layer1: {
        tripped: false,
        findings: [],
        uncitedClaimCandidates: [{ subcategory: 'uncited-number', matchedText: '17 days', sentence: '...' }],
      },
    });
    assert.equal(computeAllSilent(report), false);
  });

  test('HOLD: layer 2 tripped (any checklist flag true) disqualifies silence', () => {
    const report = silentReport({ layer2: { tripped: true, checklist: { tenure_claim: true } } });
    assert.equal(computeAllSilent(report), false);
  });

  test('HOLD: a FAILED citation disqualifies silence', () => {
    const report = silentReport({ layer3: { tripped: true, failed: [{ id: '1' }], unsupported: [], inconclusive: [], resolved: [] } });
    assert.equal(computeAllSilent(report), false);
  });

  test('HOLD: a RESOLVED_UNSUPPORTED citation disqualifies silence', () => {
    const report = silentReport({ layer3: { tripped: true, failed: [], unsupported: [{ id: '1' }], inconclusive: [], resolved: [] } });
    assert.equal(computeAllSilent(report), false);
  });

  // inconclusive (bot-block) does NOT trip layer3's own gate -- but it
  // still disqualifies auto-silent, because "inconclusive" is not the same
  // thing as "verified."
  test('HOLD: an UNREACHABLE_LIKELY_BOT (inconclusive) citation disqualifies silence even though it never trips layer 3 itself', () => {
    const report = silentReport({ layer3: { tripped: false, failed: [], unsupported: [], inconclusive: [{ id: '1' }], resolved: [] } });
    assert.equal(computeAllSilent(report), false);
  });

  test('zero citations (empty layer3 arrays) is silent -- nothing to verify is not the same as something unverified', () => {
    const report = silentReport({ layer3: { tripped: false, failed: [], unsupported: [], inconclusive: [], resolved: [] } });
    assert.equal(computeAllSilent(report), true);
  });

  test('HOLD: any self-review violation, however described, disqualifies silence', () => {
    const report = silentReport({ selfReview: { draftWasClean: false, violationsFound: ['fixed a minor formatting issue in the closing paragraph'] } });
    assert.equal(computeAllSilent(report), false);
  });

  test('fails closed: a malformed report (missing arrays) is not silent, never silent-by-default', () => {
    assert.equal(computeAllSilent({ outcome: 'generated', layer1: {}, layer2: {}, layer3: {}, selfReview: {} }), false);
    assert.equal(computeAllSilent({ outcome: 'generated' }), false);
  });

  // Self-review reporting fix (owner decision, 2026-08-07) -- the three
  // cases from the pipeline-stall diagnosis that motivated it. See
  // tools/blog-generator/selfReviewSchema.mjs for the underlying
  // draft_was_clean/violations_found consistency check; this suite tests
  // that computeAllSilent reads BOTH fields correctly, not just that the
  // validator itself is correct in isolation.
  describe('self-review: draftWasClean + violationsFound, both required for silence (2026-08-07)', () => {
    test('clean draft: draftWasClean=true, empty array -- silent-eligible', () => {
      const report = silentReport({ selfReview: { draftWasClean: true, violationsFound: [] } });
      assert.equal(computeAllSilent(report), true);
    });

    // The exact PR #27 case: the model said draft_was_clean=true but also
    // listed 1 item (narration, not a real correction). computeAllSilent
    // must NOT be fooled by the boolean alone -- the non-empty array still
    // holds the PR, same as it always would have for a real correction.
    test('HOLD: narrated-clean (draftWasClean=true, 1 item) -- schema mismatch, still holds', () => {
      const report = silentReport({
        selfReview: { draftWasClean: true, violationsFound: ['draft was already clean, returned unchanged'] },
      });
      assert.equal(computeAllSilent(report), false);
    });

    // The exact PR #26 case: a real correction, self-consistently reported.
    test('HOLD: real correction (draftWasClean=false, 1 item) -- holds, same as before this fix', () => {
      const report = silentReport({
        selfReview: { draftWasClean: false, violationsFound: ['removed a fabricated ratio'] },
      });
      assert.equal(computeAllSilent(report), false);
    });

    test('HOLD: draftWasClean=false with an empty array -- also not silent (draftWasClean must be exactly true)', () => {
      const report = silentReport({ selfReview: { draftWasClean: false, violationsFound: [] } });
      assert.equal(computeAllSilent(report), false);
    });

    test('HOLD: draftWasClean missing entirely -- fails closed, not silent', () => {
      const report = silentReport({ selfReview: { violationsFound: [] } });
      assert.equal(computeAllSilent(report), false);
    });
  });
});

// "Prove the hold path red first" — concrete demonstration that the
// log-only test above actually has teeth: a NAIVE gate that checks
// layer1.tripped (the gate's own pass/fail) instead of
// layer1.findings.length (every finding, demoted or not) gets the
// log-only case WRONG -- it would incorrectly call a demoted-finding run
// "silent." Run this block first against that naive stand-in to see it
// fail red, then against the real computeAllSilent to see it pass green.
// Kept in the suite permanently as documentation of exactly which bug
// class this design decision (findings.length, not tripped) exists to
// prevent from silently reappearing.
describe('regression: findings.length, not layer1.tripped, is the correct signal', () => {
  const NAIVE_LOG_ONLY_FINDING_REPORT = silentReport({
    layer1: {
      tripped: false, // demoted -- the naive check would treat this as "clean"
      findings: [{ category: 'exclusivity', subcategory: 'only', matchedText: 'only agent', sentence: '...', logOnly: true }],
      uncitedClaimCandidates: [],
    },
  });

  function naiveComputeAllSilent(report) {
    // Deliberately wrong: mirrors computeAllSilent's structure but checks
    // layer1.tripped instead of layer1.findings.length.
    if (!report || report.outcome !== 'generated') return false;
    const layer1Silent = report.layer1?.tripped === false;
    const layer2Silent = report.layer2?.tripped === false;
    const layer3Silent =
      (report.layer3?.failed?.length ?? 1) === 0 &&
      (report.layer3?.unsupported?.length ?? 1) === 0 &&
      (report.layer3?.inconclusive?.length ?? 1) === 0;
    const selfReviewSilent = (report.selfReview?.violationsFound?.length ?? 1) === 0;
    return layer1Silent && layer2Silent && layer3Silent && selfReviewSilent;
  }

  test('RED: the naive (tripped-based) check wrongly calls the log-only case silent', () => {
    assert.equal(naiveComputeAllSilent(NAIVE_LOG_ONLY_FINDING_REPORT), true, 'demonstrating the naive check is wrong here, not asserting correct behavior');
  });

  test('GREEN: the real computeAllSilent correctly holds the same report', () => {
    assert.equal(computeAllSilent(NAIVE_LOG_ONLY_FINDING_REPORT), false);
  });
});
