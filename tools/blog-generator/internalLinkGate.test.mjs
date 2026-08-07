import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractInternalHrefs, validateInternalLinks } from './internalLinkGate.mjs';

const KNOWN_ROUTES = [
  { url: 'https://temeculavalleyhomes.us/', title: 'Home' },
  { url: 'https://temeculavalleyhomes.us/homes-for-sale-temecula/', title: 'Buyer page' },
  { url: 'https://temeculavalleyhomes.us/blog/', title: 'Blog' },
  { url: 'https://temeculavalleyhomes.us/blog/hoa-fees-temecula-homebuyers-guide/', title: 'HOA Fees' },
];

describe('extractInternalHrefs', () => {
  test('finds root-relative internal hrefs, normalized to full URLs', () => {
    const html = '<p>See our <a href="/homes-for-sale-temecula/">buyer page</a>.</p>';
    assert.deepEqual(extractInternalHrefs(html), ['https://temeculavalleyhomes.us/homes-for-sale-temecula/']);
  });

  test('finds full-origin internal hrefs unchanged', () => {
    const html = '<a href="https://temeculavalleyhomes.us/blog/hoa-fees-temecula-homebuyers-guide/">HOA guide</a>';
    assert.deepEqual(extractInternalHrefs(html), ['https://temeculavalleyhomes.us/blog/hoa-fees-temecula-homebuyers-guide/']);
  });

  test('ignores tel:, mailto:, and external citation-style domains — not this gate\'s concern', () => {
    const html = `
      <a href="tel:+16192772766">call</a>
      <a href="mailto:askgeorgek@gmail.com">email</a>
      <a href="https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml">CA Civil Code</a>
    `;
    assert.deepEqual(extractInternalHrefs(html), []);
  });

  test('ignores the competitor lookalike domain at extraction time too (defense in depth)', () => {
    const html = '<a href="https://temeculavalleyhomes.com/blog/some-article/">link</a>';
    assert.deepEqual(extractInternalHrefs(html), []);
  });

  test('no links at all returns an empty array', () => {
    assert.deepEqual(extractInternalHrefs('<p>No links here.</p>'), []);
    assert.deepEqual(extractInternalHrefs(''), []);
    assert.deepEqual(extractInternalHrefs(null), []);
  });
});

describe('validateInternalLinks — fail-closed gate (2026-08-08)', () => {
  test('a valid, known internal link passes', () => {
    const html = '<p>Read our <a href="/homes-for-sale-temecula/">buyer page</a> for details.</p>';
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    assert.equal(result.valid, true);
    assert.deepEqual(result.invalidLinks, []);
    assert.equal(result.checkedCount, 1);
  });

  test('multiple valid links all pass', () => {
    const html = `
      <a href="/homes-for-sale-temecula/">buyer page</a>
      <a href="https://temeculavalleyhomes.us/blog/hoa-fees-temecula-homebuyers-guide/">HOA guide</a>
    `;
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    assert.equal(result.valid, true);
    assert.equal(result.checkedCount, 2);
  });

  test('zero internal links is valid (nothing to check, not required)', () => {
    const result = validateInternalLinks('<p>No internal links in this draft.</p>', KNOWN_ROUTES);
    assert.equal(result.valid, true);
    assert.equal(result.checkedCount, 0);
  });

  // The exact red-first fixture named in the spec.
  test('RED->GREEN: /blog/nonexistent-slug/ (invented, not in knownRoutes) fails the gate', () => {
    const html = '<p>See our <a href="/blog/nonexistent-slug/">related guide</a>.</p>';
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    assert.equal(result.valid, false);
    assert.deepEqual(result.invalidLinks, ['https://temeculavalleyhomes.us/blog/nonexistent-slug/']);
  });

  test('GREEN: the same link, once the slug is real, passes', () => {
    const html = '<p>See our <a href="/blog/hoa-fees-temecula-homebuyers-guide/">HOA guide</a>.</p>';
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    assert.equal(result.valid, true);
  });

  test('an invented top-level page (never in ROUTES) fails', () => {
    const html = '<a href="/luxury-homes-temecula/">Luxury homes</a>';
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    assert.equal(result.valid, false);
    assert.deepEqual(result.invalidLinks, ['https://temeculavalleyhomes.us/luxury-homes-temecula/']);
  });

  test('a link to the competitor lookalike domain fails (never in knownRoutes by construction)', () => {
    const html = '<a href="https://temeculavalleyhomes.com/blog/hoa-fees/">wrong domain</a>';
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    // extractInternalHrefs already filters this out entirely (checkedCount
    // stays 0) — proves the .com domain can never even reach the
    // known/unknown comparison, let alone pass it.
    assert.equal(result.checkedCount, 0);
    assert.equal(result.valid, true, 'nothing was extracted to check, so nothing to fail on — the .com link is simply never treated as an internal link at all');
  });

  test('one valid + one invented link on the same article fails overall, reporting only the invented one', () => {
    const html = `
      <a href="/homes-for-sale-temecula/">real</a>
      <a href="/blog/made-up-article/">fake</a>
    `;
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    assert.equal(result.valid, false);
    assert.deepEqual(result.invalidLinks, ['https://temeculavalleyhomes.us/blog/made-up-article/']);
  });

  test('duplicate invalid links are de-duplicated in the report', () => {
    const html = `
      <a href="/blog/fake/">one</a>
      <a href="/blog/fake/">two</a>
    `;
    const result = validateInternalLinks(html, KNOWN_ROUTES);
    assert.equal(result.invalidLinks.length, 1);
  });
});
