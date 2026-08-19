import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_SECTION_IDS,
  LEGACY_HOME_HASH_IDS,
  isKnownHomeSectionHash,
  isLegacyHomeHash,
  homeHashHref,
  resolveHashRedirect,
} from './homeSectionScroll.js';

describe('HOME_SECTION_IDS / LEGACY_HOME_HASH_IDS -- the canonical lists', () => {
  test('HOME_SECTION_IDS has real, currently-rendered homepage section ids', () => {
    assert.deepEqual(HOME_SECTION_IDS, ['home-value', 'about-george', 'contact', 'listing-alerts']);
  });

  test('LEGACY_HOME_HASH_IDS has the stale nav ids with no DOM target (2026-08-19 audit)', () => {
    assert.deepEqual(LEGACY_HOME_HASH_IDS, ['search', 'mls-search']);
  });

  test('the two lists never overlap', () => {
    const overlap = HOME_SECTION_IDS.filter((id) => LEGACY_HOME_HASH_IDS.includes(id));
    assert.deepEqual(overlap, []);
  });
});

describe('isKnownHomeSectionHash', () => {
  test('true for every real section id, hash-prefixed', () => {
    for (const id of HOME_SECTION_IDS) {
      assert.equal(isKnownHomeSectionHash(`#${id}`), true, `#${id} should be known`);
    }
  });

  test('false for a legacy id -- this function is only for real, scrollable sections', () => {
    assert.equal(isKnownHomeSectionHash('#search'), false);
    assert.equal(isKnownHomeSectionHash('#mls-search'), false);
  });

  test('false for an unrelated/unknown hash (e.g. a future in-article anchor)', () => {
    assert.equal(isKnownHomeSectionHash('#footnote-3'), false);
  });

  test('false for empty string, null, undefined, or a bare id missing the # prefix', () => {
    assert.equal(isKnownHomeSectionHash(''), false);
    assert.equal(isKnownHomeSectionHash(null), false);
    assert.equal(isKnownHomeSectionHash(undefined), false);
    assert.equal(isKnownHomeSectionHash('home-value'), false);
  });
});

describe('isLegacyHomeHash', () => {
  test('true for #search and #mls-search', () => {
    assert.equal(isLegacyHomeHash('#search'), true);
    assert.equal(isLegacyHomeHash('#mls-search'), true);
  });

  test('false for a real known section -- these two lists are mutually exclusive by contract', () => {
    assert.equal(isLegacyHomeHash('#home-value'), false);
  });

  test('false for empty/null/undefined', () => {
    assert.equal(isLegacyHomeHash(''), false);
    assert.equal(isLegacyHomeHash(null), false);
    assert.equal(isLegacyHomeHash(undefined), false);
  });
});

describe('homeHashHref -- route-aware href construction, single source shared by every nav component', () => {
  test('on the homepage ("/"), returns the bare in-page hash -- native browser anchor scroll, unchanged behavior', () => {
    assert.equal(homeHashHref('home-value', '/'), '#home-value');
    assert.equal(homeHashHref('contact', '/'), '#contact');
  });

  test('on any other route, returns "/#id" -- SPA nav home via <Link>, then HomePage scrolls', () => {
    assert.equal(homeHashHref('home-value', '/blog/paloma-del-sol-temecula-neighborhood-guide/'), '/#home-value');
    assert.equal(homeHashHref('about-george', '/contact/'), '/#about-george');
    assert.equal(homeHashHref('listing-alerts', '/blog/'), '/#listing-alerts');
  });

  test('works for every real section id', () => {
    for (const id of HOME_SECTION_IDS) {
      assert.equal(homeHashHref(id, '/'), `#${id}`);
      assert.equal(homeHashHref(id, '/sell-my-house/'), `/#${id}`);
    }
  });
});

describe('resolveHashRedirect -- the cold-load dead-end fix (HashSectionRedirect\'s decision logic)', () => {
  test('on the homepage itself, never redirects -- HomePage owns its own hash-scroll', () => {
    assert.deepEqual(resolveHashRedirect({ pathname: '/', hash: '#contact' }), { redirect: false });
    assert.deepEqual(resolveHashRedirect({ pathname: '/', hash: '#search' }), { redirect: false });
  });

  test('no hash at all -- never redirects', () => {
    assert.deepEqual(resolveHashRedirect({ pathname: '/blog/some-article/', hash: '' }), { redirect: false });
  });

  test('the concrete repro: a known section hash cold-loaded on an article route redirects to "/"+hash', () => {
    assert.deepEqual(
      resolveHashRedirect({ pathname: '/blog/paloma-del-sol-temecula-neighborhood-guide/', hash: '#contact' }),
      { redirect: true, to: '/#contact' }
    );
  });

  test('every known section id redirects correctly from an arbitrary non-home route', () => {
    for (const id of HOME_SECTION_IDS) {
      assert.deepEqual(
        resolveHashRedirect({ pathname: '/about-george/', hash: `#${id}` }),
        { redirect: true, to: `/#${id}` }
      );
    }
  });

  test('the exact user-reported repro: cold-loading .../paloma-del-sol.../#search redirects to "/" with the hash stripped -- there is no Search section to scroll to, but the visitor must not dead-end on the article', () => {
    assert.deepEqual(
      resolveHashRedirect({ pathname: '/blog/paloma-del-sol-temecula-neighborhood-guide/', hash: '#search' }),
      { redirect: true, to: '/' }
    );
  });

  test('#mls-search, the other legacy id, behaves the same as #search', () => {
    assert.deepEqual(
      resolveHashRedirect({ pathname: '/sell-my-house/', hash: '#mls-search' }),
      { redirect: true, to: '/' }
    );
  });

  test('an unrecognized hash (e.g. a future in-article footnote anchor) is left alone -- never guessed at, never redirected', () => {
    assert.deepEqual(
      resolveHashRedirect({ pathname: '/blog/some-article/', hash: '#footnote-3' }),
      { redirect: false }
    );
  });
});
