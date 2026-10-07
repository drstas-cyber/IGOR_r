// Unit tests for checkAllSilent.mjs -- the workflow's auto-merge decision
// reader (owner decision, 2026-10-06). Real tests, not plumbing: this
// module is pure apart from one file read and one file append, both
// injectable, so every branch below is exercised for real.
//
// What these DON'T prove, stated plainly in keeping with this directory's
// convention: that the workflow step wiring is correct. That is asserted
// separately, as workflow TEXT, in generateArticleWorkflow.test.mjs -- and
// the end-to-end behaviour (a silent run actually merging itself and
// publish-on-merge actually firing off that merge) is only ever proven by
// a real run against a live model. See README.md's decision entry for the
// explicit first-run acceptance check that covers that gap.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateAllSilent, readReport, main } from './checkAllSilent.mjs';

// Same baseline fixture as autoPublishGate.test.mjs, plus the stored flag
// generate.mjs writes alongside it.
function silentReport(overrides = {}) {
  return {
    outcome: 'generated',
    allSilent: true,
    layer1: { tripped: false, findings: [], uncitedClaimCandidates: [] },
    layer2: { tripped: false, checklist: {} },
    layer3: { tripped: false, failed: [], unsupported: [], inconclusive: [], resolved: [] },
    selfReview: { draftWasClean: true, violationsFound: [] },
    ...overrides,
  };
}

describe('evaluateAllSilent — the auto-merge decision', () => {
  test('a perfectly silent report auto-merges', () => {
    const result = evaluateAllSilent(silentReport());
    assert.equal(result.allSilent, true);
    assert.match(result.reason, /perfectly silent/);
  });

  test('a report with one self-review correction does NOT auto-merge', () => {
    // The single most common real case by a wide margin: six of the last
    // eight article PRs (#65, #62, #61, #60, #53, #52) were exactly this
    // shape -- all three compliance layers clean, held only by self-review
    // corrections. Those keep waiting for a human, by design.
    const report = silentReport({
      allSilent: false,
      selfReview: { draftWasClean: false, violationsFound: ['softened an unsourced duty claim'] },
    });
    assert.equal(evaluateAllSilent(report).allSilent, false);
  });

  test('a gate trip (outcome "skipped") never auto-merges', () => {
    const result = evaluateAllSilent(silentReport({ outcome: 'skipped', allSilent: false }));
    assert.equal(result.allSilent, false);
    assert.match(result.reason, /not "generated"/);
  });

  test('FAIL CLOSED: a null, undefined, or non-object report never auto-merges', () => {
    for (const bad of [null, undefined, 'a string', 42, []]) {
      const result = evaluateAllSilent(bad);
      assert.equal(result.allSilent, false, `expected ${JSON.stringify(bad)} to fail closed`);
    }
  });

  test('FAIL CLOSED: a missing allSilent flag on an otherwise clean report still auto-merges only if recomputation agrees', () => {
    // allSilent absent but every underlying layer genuinely clean:
    // computeAllSilent recomputes true, stored is undefined. That is a
    // disagreement, and disagreement always loses.
    const report = silentReport();
    delete report.allSilent;
    const result = evaluateAllSilent(report);
    assert.equal(result.allSilent, false);
    assert.match(result.reason, /DISAGREEMENT/);
  });

  test('FAIL CLOSED: a report claiming allSilent:true over dirty layers is rejected as a disagreement', () => {
    // The attack/corruption shape that matters most: the stored flag says
    // publish me, the actual findings say otherwise. The recomputation is
    // the whole reason this module does not simply read the flag.
    const report = silentReport({
      allSilent: true,
      layer2: { tripped: true, checklist: { uncited_statistic: true } },
    });
    const result = evaluateAllSilent(report);
    assert.equal(result.allSilent, false);
    assert.match(result.reason, /DISAGREEMENT/);
    assert.match(result.reason, /worth investigating/);
  });

  test('FAIL CLOSED: one log-only layer 1 finding holds the PR, same as the underlying gate', () => {
    const report = silentReport({
      allSilent: false,
      layer1: {
        tripped: false,
        findings: [{ category: 'exclusivity', subcategory: 'only', logOnly: true }],
        uncitedClaimCandidates: [],
      },
    });
    assert.equal(evaluateAllSilent(report).allSilent, false);
  });
});

describe('readReport + main — the impure edges', () => {
  function tmpdir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'check-all-silent-'));
  }

  test('readReport returns null (never throws) on a missing file', () => {
    assert.equal(readReport(path.join(tmpdir(), 'nope.json')), null);
  });

  test('readReport returns null (never throws) on malformed JSON', () => {
    const dir = tmpdir();
    const p = path.join(dir, 'bad.json');
    fs.writeFileSync(p, '{ not json');
    assert.equal(readReport(p), null);
  });

  test('main writes all_silent=true to GITHUB_OUTPUT for a silent report', () => {
    const dir = tmpdir();
    const reportPath = path.join(dir, 'report.json');
    const outPath = path.join(dir, 'gh-output');
    fs.writeFileSync(reportPath, JSON.stringify(silentReport()));
    fs.writeFileSync(outPath, '');

    const returned = main({ argv: [`--report=${reportPath}`], env: { GITHUB_OUTPUT: outPath }, log: () => {} });

    assert.equal(returned, true);
    assert.match(fs.readFileSync(outPath, 'utf8'), /^all_silent=true$/m);
  });

  test('main writes all_silent=false when the report file does not exist at all', () => {
    const dir = tmpdir();
    const outPath = path.join(dir, 'gh-output');
    fs.writeFileSync(outPath, '');

    const returned = main({
      argv: [`--report=${path.join(dir, 'absent.json')}`],
      env: { GITHUB_OUTPUT: outPath },
      log: () => {},
    });

    assert.equal(returned, false);
    assert.match(fs.readFileSync(outPath, 'utf8'), /^all_silent=false$/m);
  });

  test('main does not throw when GITHUB_OUTPUT is unset (local invocation)', () => {
    const dir = tmpdir();
    const reportPath = path.join(dir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(silentReport()));
    assert.doesNotThrow(() => main({ argv: [`--report=${reportPath}`], env: {}, log: () => {} }));
  });
});
