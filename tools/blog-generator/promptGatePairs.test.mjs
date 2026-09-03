// Enforcement for the prompt↔gate consistency audit.
//
// The audit in promptGatePairs.mjs is only worth something if it is
// checked against the real prompt.md on every run. Otherwise it is a
// snapshot of one afternoon's reading, and prompt.md drifts out from under
// it exactly the way rule 10 drifted out from under
// identityCompletenessGate.mjs between 2026-08-25 and 2026-09-03.
//
// Two directions are enforced, and both matter:
//   - every `promptAnchor` must be PRESENT (the rule is still stated)
//   - every `forbidden` string must be ABSENT (a retired formulation
//     cannot come back)
//
// The forbidden direction is the one that catches a regression rather
// than a deletion, and it is mutation-checked: the strings in PGP-01 were
// verified to match the pre-fix rule-10 text, so this test genuinely fails
// against the code as it stood this morning.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPT_GATE_PAIRS, AUDIT_DATE, inconsistentPairs, unpairedGates } from './promptGatePairs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// NORMALISED to LF before matching (2026-09-03). Several anchors below
// deliberately span a line break -- they pin the wrapped form of a rule so
// a reflow that changes its meaning is caught, not just a deletion. Git
// checks prompt.md out with CRLF on Windows and LF on the Linux CI runner,
// so an un-normalised read makes those anchors pass in CI and fail on a
// developer machine. Same environment-dependence class as the
// GITHUB_OUTPUT bug this session's CI job caught on its first run: a test
// whose result depends on where it runs is not a test.
const PROMPT = fs.readFileSync(path.join(HERE, 'prompt.md'), 'utf8').replace(/\r\n/g, '\n');

describe('prompt↔gate pairs — structure', () => {
  test('every pair has a unique id, a gate, and an explicit consistent verdict', () => {
    const ids = PROMPT_GATE_PAIRS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate pair id');
    for (const p of PROMPT_GATE_PAIRS) {
      assert.ok(p.gate, `${p.id}: gate is required`);
      assert.equal(typeof p.consistent, 'boolean', `${p.id}: consistent must be an explicit true/false, never left undefined`);
    }
  });

  test('the audit date is recorded', () => {
    assert.match(AUDIT_DATE, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('a pair with no promptAnchor must justify why it is deliberately unpaired', () => {
    for (const p of unpairedGates()) {
      assert.ok(
        p.note && /DELIBERATELY UNPAIRED/.test(p.note),
        `${p.id}: a gate with no corresponding prompt rule must say why that is safe, not just leave the field null`,
      );
    }
  });
});

describe('prompt↔gate pairs — every anchor is present in the real prompt.md', () => {
  test('no pair claims a prompt rule that prompt.md does not actually state', () => {
    const missing = [];
    for (const p of PROMPT_GATE_PAIRS) {
      if (p.promptAnchor === null) continue;
      if (!PROMPT.includes(p.promptAnchor)) {
        missing.push(`${p.id} (${p.promptRule}): anchor not found -> ${JSON.stringify(p.promptAnchor)}`);
      }
    }
    assert.deepEqual(
      missing,
      [],
      `prompt.md no longer states rule(s) that a fail-closed gate enforces. This is the rule-10 defect recurring:\n${missing.join('\n')}`,
    );
  });
});

describe('prompt↔gate pairs — retired formulations cannot come back', () => {
  test('no forbidden string appears anywhere in prompt.md', () => {
    const found = [];
    for (const p of PROMPT_GATE_PAIRS) {
      for (const f of p.forbidden || []) {
        if (PROMPT.includes(f)) found.push(`${p.id}: forbidden text present -> ${JSON.stringify(f)}`);
      }
    }
    assert.deepEqual(found, [], `a retired prompt formulation was reintroduced:\n${found.join('\n')}`);
  });

  test('PGP-01 specifically freezes both sentences that caused the 2026-09-03 incident', () => {
    const pgp01 = PROMPT_GATE_PAIRS.find((p) => p.id === 'PGP-01');
    assert.ok(pgp01, 'PGP-01 must exist — it is the pair the whole audit came from');
    assert.equal(pgp01.forbidden.length, 2, 'both retired sentences must be frozen, not just one');
  });
});

describe('prompt↔gate pairs — the audit verdict', () => {
  test('no pair is currently marked inconsistent', () => {
    const bad = inconsistentPairs().map((p) => `${p.id}: ${p.gate}`);
    assert.deepEqual(
      bad,
      [],
      `prompt/gate inconsistency is recorded but unfixed. Every entry here is a topic-burning rejection waiting to happen:\n${bad.join('\n')}`,
    );
  });

  test('every fail-closed gate module in this directory is represented by at least one pair', () => {
    // Guards against the audit going stale by omission: a new gate module
    // that nobody adds a pair for is exactly how the rule-10 gap opened
    // (identityCompletenessGate.mjs landed 2026-08-25 with no prompt-side
    // review of whether prompt.md agreed with it).
    const gateModules = ['identityCompletenessGate.mjs', 'internalLinkGate.mjs', 'schema.js', 'llmClaimGate.mjs', 'citationResolver.mjs'];
    const allGateText = PROMPT_GATE_PAIRS.map((p) => p.gate).join(' | ');
    for (const mod of gateModules) {
      assert.ok(allGateText.includes(mod), `no prompt↔gate pair references ${mod} — an unaudited fail-closed gate`);
    }
  });
});
