import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkAllSilent } from './checkAllSilent.mjs';

describe('checkAllSilent — auto-merge gate check (2026-08-03)', () => {
  test('report file does not exist -> allSilent "false", never a confident default of "true"', () => {
    const result = checkAllSilent({
      reportPath: 'tools/blog-generator/.last-run-report.json',
      existsSync: () => false,
      readFileSync: () => { throw new Error('readFileSync must never be called when the file does not exist'); },
    });
    assert.equal(result.allSilent, 'false');
    assert.equal(result.slug, '');
    assert.match(result.reason, /does not exist/);
  });

  test('report file exists but fails to parse -> allSilent "false"', () => {
    const result = checkAllSilent({
      existsSync: () => true,
      readFileSync: () => 'not valid json{{{',
    });
    assert.equal(result.allSilent, 'false');
    assert.match(result.reason, /failed to parse/);
  });

  test('outcome "skipped" (gate trip) -> allSilent "false" regardless of report.allSilent', () => {
    const result = checkAllSilent({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ outcome: 'skipped', allSilent: true }),
    });
    assert.equal(result.allSilent, 'false');
    assert.match(result.reason, /not "generated"/);
  });

  test('outcome "schema_invalid" -> allSilent "false"', () => {
    const result = checkAllSilent({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ outcome: 'schema_invalid', allSilent: true }),
    });
    assert.equal(result.allSilent, 'false');
  });

  test('outcome "generated" with allSilent: true -> "true", slug carried through', () => {
    const result = checkAllSilent({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ outcome: 'generated', allSilent: true, article: { slug: 'escrow-process-homebuyers-guide', title: 'x' } }),
    });
    assert.equal(result.allSilent, 'true');
    assert.equal(result.slug, 'escrow-process-homebuyers-guide');
  });

  test('outcome "generated" with allSilent: false (a finding held it) -> "false"', () => {
    const result = checkAllSilent({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ outcome: 'generated', allSilent: false, article: { slug: 'some-slug', title: 'x' } }),
    });
    assert.equal(result.allSilent, 'false');
    assert.equal(result.slug, 'some-slug'); // slug still carried through so a human reviewing the held PR has it, even though auto-merge won't fire
  });

  test('outcome "generated" but allSilent field missing entirely -> "false", fails closed, not silent-by-default', () => {
    const result = checkAllSilent({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ outcome: 'generated', article: { slug: 'x' } }),
    });
    assert.equal(result.allSilent, 'false');
  });

  test('default reportPath matches generate.mjs\'s real REPORT_PATH relative location', () => {
    let seenPath;
    checkAllSilent({
      existsSync: (p) => { seenPath = p; return false; },
    });
    assert.equal(seenPath, 'tools/blog-generator/.last-run-report.json');
  });
});
