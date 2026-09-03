// The README's generated tables must match the data they claim to be
// generated from.
//
// pipelinePaths.mjs says, in its own header, that "the README table is
// GENERATED from this file's contents, never hand-typed alongside it."
// Without this test that is an intention, not a fact — and an intention
// about keeping two representations in agreement is exactly what failed
// between prompt.md and identityCompletenessGate.mjs for nine days.
//
// The failure mode being prevented is specific and cheap to hit: someone
// adds a path row, runs the suite (green — pipelinePaths.test.mjs only
// checks the DATA against the source), and never re-runs
// renderPathTable.mjs. The README then confidently states a path count
// and a coverage claim that is quietly wrong, which is worse than having
// no table, because a wrong table gets trusted.
//
// Fix when this fails: `node tools/blog-generator/renderPathTable.mjs`
// and paste the output between the markers. Never edit the block by hand.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const README = fs.readFileSync(path.join(HERE, 'README.md'), 'utf8').replace(/\r\n/g, '\n');

function generated(flag) {
  return execFileSync(process.execPath, [path.join(HERE, 'renderPathTable.mjs'), flag], {
    encoding: 'utf8',
  })
    .replace(/\r\n/g, '\n')
    .trim();
}

function extractBlock(name) {
  const begin = README.indexOf(`<!-- BEGIN GENERATED: ${name}`);
  const end = README.indexOf(`<!-- END GENERATED: ${name} -->`);
  assert.ok(begin !== -1, `README is missing the "BEGIN GENERATED: ${name}" marker`);
  assert.ok(end !== -1, `README is missing the "END GENERATED: ${name}" marker`);
  const afterBegin = README.indexOf('-->', begin) + 3;
  return README.slice(afterBegin, end).trim();
}

describe('README generated blocks are in sync with their source data', () => {
  test('the path table block matches renderPathTable.mjs --paths', () => {
    const block = extractBlock('paths');
    const expected = generated('--paths');
    assert.ok(
      block.includes(expected),
      'the README path table has drifted from pipelinePaths.mjs. Re-run: node tools/blog-generator/renderPathTable.mjs',
    );
  });

  test('the summary line matches renderPathTable.mjs --summary (the path COUNT is a claim, and it must be true)', () => {
    const block = extractBlock('paths');
    const expected = generated('--summary');
    assert.ok(
      block.includes(expected),
      `the README summary has drifted. Expected it to contain:\n${expected}`,
    );
  });

  test('the prompt↔gate pairs block matches renderPathTable.mjs --pairs', () => {
    const block = extractBlock('pairs');
    const expected = generated('--pairs');
    assert.ok(
      block.includes(expected),
      'the README pairs table has drifted from promptGatePairs.mjs. Re-run: node tools/blog-generator/renderPathTable.mjs',
    );
  });

  test('every path id in the data appears somewhere in the README block', () => {
    // Belt and braces on top of the exact-match tests above: catches a
    // partial paste, which an includes() on the whole block would also
    // catch but with a far less useful message.
    const block = extractBlock('paths');
    // Imported lazily so this file has no import-order dependency on the
    // data module's own test.
    return import('./pipelinePaths.mjs').then(({ PIPELINE_PATHS }) => {
      const missing = PIPELINE_PATHS.map((p) => p.id).filter((id) => !block.includes(id));
      assert.deepEqual(missing, [], `path id(s) absent from the README table: ${missing.join(', ')}`);
    });
  });
});
