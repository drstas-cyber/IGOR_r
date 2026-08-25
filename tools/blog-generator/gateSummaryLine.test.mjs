import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGateSummaryLine } from './gateSummaryLine.mjs';

function report(overrides = {}) {
  return {
    outcome: 'generated',
    allSilent: false,
    layer1: { tripped: false },
    layer2: { tripped: false },
    layer3: { tripped: false },
    selfReview: { violationsFound: [] },
    ...overrides,
  };
}

describe('buildGateSummaryLine', () => {
  test('a perfectly silent report gets the silent-specific line', () => {
    const line = buildGateSummaryLine(report({ allSilent: true }));
    assert.match(line, /Perfectly silent/);
  });

  test('an all-clean-but-self-review-had-corrections report shows the correction count', () => {
    const line = buildGateSummaryLine(report({ selfReview: { violationsFound: ['fixed a citation'] } }));
    assert.match(line, /Layer 1: clean/);
    assert.match(line, /Layer 2: clean/);
    assert.match(line, /Layer 3: clean/);
    assert.match(line, /Self-review: 1 correction/);
    assert.doesNotMatch(line, /Perfectly silent/);
  });

  test('a tripped layer shows TRIPPED for that layer specifically', () => {
    const line = buildGateSummaryLine(report({ layer2: { tripped: true } }));
    assert.match(line, /Layer 2: TRIPPED/);
    assert.match(line, /Layer 1: clean/);
  });

  test('a rejected-attempt report (outcome !== "generated") returns null -- no summary line for a discarded draft', () => {
    assert.equal(buildGateSummaryLine(report({ outcome: 'skipped' })), null);
    assert.equal(buildGateSummaryLine(report({ outcome: 'schema_invalid' })), null);
    assert.equal(buildGateSummaryLine(report({ outcome: 'identity_incomplete' })), null);
  });

  test('zero self-review corrections shows "clean", not "0 correction(s)"', () => {
    const line = buildGateSummaryLine(report({ selfReview: { violationsFound: [] } }));
    assert.match(line, /Self-review: clean/);
  });
});
