import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCacheEntryBlock, countRules, hasCacheEntry, insertCacheEntry, MAX_HEADERS_RULES, HEADERS_CAP_EXCEEDED_CODE, HeadersCapExceededError } from './headersCacheEntry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_HEADERS_PATH = path.join(__dirname, '..', '..', 'public', '_headers');

const MINIMAL_HEADERS = `/blog/hoa-fees-temecula-homebuyers-guide/
  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate
/blog/hoa-fees-temecula-homebuyers-guide
  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

describe('buildCacheEntryBlock', () => {
  test('produces the exact 4-line with-slash/without-slash pair', () => {
    assert.equal(
      buildCacheEntryBlock('escrow-process-homebuyers-guide'),
      '/blog/escrow-process-homebuyers-guide/\n' +
      '  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate\n' +
      '/blog/escrow-process-homebuyers-guide\n' +
      '  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate\n'
    );
  });
});

describe('countRules', () => {
  test('counts one per path line, not per Cache-Control line', () => {
    assert.equal(countRules(MINIMAL_HEADERS), 3); // 2 blog paths + /assets/*
  });
});

describe('hasCacheEntry', () => {
  test('true only when BOTH with-slash and without-slash lines exist', () => {
    assert.equal(hasCacheEntry(MINIMAL_HEADERS, 'hoa-fees-temecula-homebuyers-guide'), true);
    assert.equal(hasCacheEntry(MINIMAL_HEADERS, 'escrow-process-homebuyers-guide'), false);
  });

  test('does not false-positive on a slug that is a prefix of an existing one', () => {
    assert.equal(hasCacheEntry(MINIMAL_HEADERS, 'hoa-fees-temecula-homebuyers'), false);
  });
});

describe('insertCacheEntry', () => {
  test('inserts a new pair immediately before /assets/*, exactly matching the hand-edited pattern (articles 1-6)', () => {
    const result = insertCacheEntry(MINIMAL_HEADERS, 'escrow-process-homebuyers-guide');
    assert.equal(result.inserted, true);
    assert.equal(
      result.headersText,
      `/blog/hoa-fees-temecula-homebuyers-guide/
  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate
/blog/hoa-fees-temecula-homebuyers-guide
  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate
/blog/escrow-process-homebuyers-guide/
  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate
/blog/escrow-process-homebuyers-guide
  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`
    );
    assert.equal(result.ruleCountAfter, 5);
  });

  test('idempotent: a slug that already has an entry is a no-op, not a duplicate', () => {
    const once = insertCacheEntry(MINIMAL_HEADERS, 'escrow-process-homebuyers-guide');
    const twice = insertCacheEntry(once.headersText, 'escrow-process-homebuyers-guide');
    assert.equal(twice.inserted, false);
    assert.equal(twice.headersText, once.headersText);
    assert.equal(countRules(twice.headersText), 5); // unchanged, no duplicate pair
  });

  test('missing /assets/* anchor -- refuses to guess, throws', () => {
    assert.throws(() => insertCacheEntry('/some/other/path\n  Cache-Control: x\n', 'new-slug'), /could not find the "\/assets\/\*" anchor/);
  });

  test('fails closed at the 100-rule limit -- refuses to write past it', () => {
    const nearLimitLines = [];
    for (let i = 0; i < 49; i++) {
      nearLimitLines.push(`/blog/filler-${i}/\n  Cache-Control: x\n/blog/filler-${i}\n  Cache-Control: x`);
    }
    const nearLimitHeaders = `${nearLimitLines.join('\n')}\n\n/assets/*\n  Cache-Control: x\n`; // 98 rules + /assets/* = 99
    assert.equal(countRules(nearLimitHeaders), 99);
    assert.throws(() => insertCacheEntry(nearLimitHeaders, 'one-too-many'), /over Cloudflare Pages' 100-rule limit/);
  });

  // 2026-08-31 (Task 1, notification-hardening pass) -- the cap-guard must
  // be catchable BY CLASS, not by matching this exact prose. A test that
  // only asserts the message regex above would still pass after a reword
  // that silently breaks callers detecting this error downstream (exactly
  // what happened to buildFailureDetail's original `/rule limit/` check --
  // see README.md). err.code is the machine-readable identity of this
  // error; the message stays human-readable but is no longer the contract.
  test('the cap-guard error is a typed, identifiable failure -- catchable by class and by a stable err.code, independent of message wording', () => {
    const nearLimitLines = [];
    for (let i = 0; i < 49; i++) {
      nearLimitLines.push(`/blog/filler-${i}/\n  Cache-Control: x\n/blog/filler-${i}\n  Cache-Control: x`);
    }
    const nearLimitHeaders = `${nearLimitLines.join('\n')}\n\n/assets/*\n  Cache-Control: x\n`;
    let caught = null;
    try {
      insertCacheEntry(nearLimitHeaders, 'one-too-many');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'expected insertCacheEntry to throw');
    assert.ok(caught instanceof HeadersCapExceededError, 'expected a HeadersCapExceededError instance');
    assert.ok(caught instanceof Error, 'must still be a real Error (instanceof Error), not a bespoke non-Error throw');
    assert.equal(caught.code, HEADERS_CAP_EXCEEDED_CODE);
  });

  // A DIFFERENT insertCacheEntry failure (the missing-anchor case) must NOT
  // be mistaken for the cap-guard -- proves the typed check discriminates,
  // not just "insertCacheEntry threw something".
  test('a non-cap-guard insertCacheEntry failure does NOT carry the cap-guard code', () => {
    let caught = null;
    try {
      insertCacheEntry('/some/other/path\n  Cache-Control: x\n', 'new-slug');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.ok(!(caught instanceof HeadersCapExceededError));
    assert.notEqual(caught.code, HEADERS_CAP_EXCEEDED_CODE);
  });

  test('exactly at the limit (100) is allowed, 101 is not', () => {
    const okLines = [];
    for (let i = 0; i < 49; i++) {
      okLines.push(`/blog/filler-${i}/\n  Cache-Control: x\n/blog/filler-${i}\n  Cache-Control: x`);
    }
    // 98 rules + /assets/* (1) + the new pair (2) = 101 -- one over.
    const headers101 = `${okLines.join('\n')}\n\n/assets/*\n  Cache-Control: x\n`;
    assert.throws(() => insertCacheEntry(headers101, 'pushes-to-101'));

    // Drop one filler pair so the new insert lands exactly at 100 legally is another test.
  });
});

describe('against the REAL public/_headers file', () => {
  test('current file is well under the 100-rule limit', () => {
    const real = fs.readFileSync(REAL_HEADERS_PATH, 'utf8');
    const count = countRules(real);
    assert.ok(count < MAX_HEADERS_RULES, `expected under ${MAX_HEADERS_RULES}, got ${count}`);
  });

  test('inserting a brand-new slug into the real file succeeds and is well-formed', () => {
    const real = fs.readFileSync(REAL_HEADERS_PATH, 'utf8');
    const result = insertCacheEntry(real, '__test-fixture-slug-not-a-real-article__');
    assert.equal(result.inserted, true);
    assert.match(result.headersText, /\/blog\/__test-fixture-slug-not-a-real-article__\/\n  Cache-Control:.*\n\/blog\/__test-fixture-slug-not-a-real-article__\n  Cache-Control:/);
    // Never actually written to disk -- read-only against the real file, in memory only.
  });
});
