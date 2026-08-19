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

  // 2026-08-19 nav-hash audit: StickyNavigation/Navigation's "Contact" item,
  // clicked from a blog article (or any non-home route), is now
  // <Link to="/#contact">, a PUSH navigation carrying a hash. Explicit
  // regression coverage for exactly that flow -- logically the same branch
  // the '#home-value' PUSH case above already proves, but named for this
  // specific real flow per the audit's own test-matrix requirement, so a
  // future reader doesn't have to infer that the general rule covers it.
  test('article -> Link to "/#contact" (PUSH, hash present) -> false -- HomePage\'s hash-scroll effect owns the scroll, ScrollToTop must not race it back to (0,0)', () => {
    assert.equal(shouldScrollToTop({ navigationType: 'PUSH', hash: '#contact' }), false);
  });
});
