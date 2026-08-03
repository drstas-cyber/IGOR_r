import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { shouldScrollToTop } from './scrollToTop.js';

// Proves the PUSH-vs-POP branch logic per the audit's exact spec, since
// live browser verification (real scrollY numbers, actual Back-button
// behavior) is unavailable this session -- see the batch report for the
// UNVERIFIED-TOOLING flag and the owed follow-up.
describe('shouldScrollToTop -- audit item 4 branch logic', () => {
  test('PUSH, no hash -> true (fresh navigation scrolls to top)', () => {
    assert.equal(shouldScrollToTop({ navigationType: 'PUSH', hash: '' }), true);
  });

  test('REPLACE, no hash -> true (treated the same as PUSH -- still a forward navigation, not history traversal)', () => {
    assert.equal(shouldScrollToTop({ navigationType: 'REPLACE', hash: '' }), true);
  });

  test('PUSH, with hash -> false (hash target owns scroll behavior, must not race it)', () => {
    assert.equal(shouldScrollToTop({ navigationType: 'PUSH', hash: '#home-value' }), false);
  });

  test('REPLACE, with hash -> false, same reasoning as PUSH+hash', () => {
    assert.equal(shouldScrollToTop({ navigationType: 'REPLACE', hash: '#faq' }), false);
  });

  test('POP, no hash -> false (Back/Forward must never be reset -- this is the naive-fix trap the audit named)', () => {
    assert.equal(shouldScrollToTop({ navigationType: 'POP', hash: '' }), false);
  });

  test('POP, with hash -> false (POP wins regardless of hash -- browser scroll restoration is never overridden)', () => {
    assert.equal(shouldScrollToTop({ navigationType: 'POP', hash: '#home-value' }), false);
  });
});
