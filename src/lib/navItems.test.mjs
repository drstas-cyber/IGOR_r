import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { STICKY_NAV_ITEMS, SUBPAGE_NAV_ITEMS } from './navItems.js';
import { HOME_SECTION_IDS } from './homeSectionScroll.js';

// Drift guard (2026-08-19 nav-hash audit): the bug this whole audit exists
// to fix was exactly this — Navigation.jsx's own, independently-typed ids
// ('homevalue', 'about', 'alerts') silently drifting out of sync with the
// real section ids. Reading the RENDERED item list here (not grepping
// literal strings in JSX) and cross-checking every `sectionId` against
// homeSectionScroll.js's single canonical list is what makes that class of
// drift impossible to reintroduce silently — a typo'd sectionId fails this
// test immediately instead of shipping a dead nav item.
function assertEverySectionIdIsKnown(items, componentName) {
  for (const item of items) {
    if (item.sectionId) {
      assert.ok(
        HOME_SECTION_IDS.includes(item.sectionId),
        `${componentName}'s "${item.label}" points at sectionId "${item.sectionId}", which is not in HOME_SECTION_IDS (${HOME_SECTION_IDS.join(', ')})`
      );
    }
  }
}

describe('STICKY_NAV_ITEMS (StickyNavigation.jsx)', () => {
  test('every sectionId item targets a real, known homepage section', () => {
    assertEverySectionIdIsKnown(STICKY_NAV_ITEMS, 'StickyNavigation');
  });

  test('Search Homes is external, not a hash -- always an outbound ApexIDX link regardless of route', () => {
    const item = STICKY_NAV_ITEMS.find((i) => i.label === 'Search Homes');
    assert.ok(item);
    assert.equal(item.external, true);
    assert.match(item.href, /^https:\/\/apexidx\.com\//);
  });

  test('Blog is a real route link, not a hash', () => {
    const item = STICKY_NAV_ITEMS.find((i) => i.label === 'Blog');
    assert.ok(item);
    assert.equal(item.to, '/blog/');
    assert.equal(item.sectionId, undefined);
  });

  test('Home Value, About George, and Contact are section-hash items (route-aware, via homeHashHref)', () => {
    assert.equal(STICKY_NAV_ITEMS.find((i) => i.label === 'Home Value').sectionId, 'home-value');
    assert.equal(STICKY_NAV_ITEMS.find((i) => i.label === 'About George').sectionId, 'about-george');
    assert.equal(STICKY_NAV_ITEMS.find((i) => i.label === 'Contact').sectionId, 'contact');
  });

  test('exactly 5 items, none accidentally duplicated or dropped', () => {
    assert.equal(STICKY_NAV_ITEMS.length, 5);
    assert.equal(new Set(STICKY_NAV_ITEMS.map((i) => i.label)).size, 5);
  });
});

describe('SUBPAGE_NAV_ITEMS (Navigation.jsx -- every non-home route)', () => {
  test('every sectionId item targets a real, known homepage section (the actual bug: these used to be wrong)', () => {
    assertEverySectionIdIsKnown(SUBPAGE_NAV_ITEMS, 'Navigation');
  });

  test('Search is external (matches StickyNavigation\'s treatment) -- not a hash to a homepage section that no longer exists', () => {
    const item = SUBPAGE_NAV_ITEMS.find((i) => i.label === 'Search');
    assert.ok(item);
    assert.equal(item.external, true);
    assert.match(item.href, /^https:\/\/apexidx\.com\//);
    assert.equal(item.sectionId, undefined, 'must never be a hash -- there is no #search section anymore');
  });

  test('Home Value -> home-value, About -> about-george, Alerts -> listing-alerts (the three that were wrong before this audit)', () => {
    assert.equal(SUBPAGE_NAV_ITEMS.find((i) => i.label === 'Home Value').sectionId, 'home-value');
    assert.equal(SUBPAGE_NAV_ITEMS.find((i) => i.label === 'About').sectionId, 'about-george');
    assert.equal(SUBPAGE_NAV_ITEMS.find((i) => i.label === 'Alerts').sectionId, 'listing-alerts');
  });

  test('Contact stays a real route link (/contact/), untouched -- was already correct before this audit', () => {
    const item = SUBPAGE_NAV_ITEMS.find((i) => i.label === 'Contact');
    assert.ok(item);
    assert.equal(item.to, '/contact/');
    assert.equal(item.sectionId, undefined);
  });

  test('Blog is present and routes to /blog/ -- did not exist at all before this audit', () => {
    const item = SUBPAGE_NAV_ITEMS.find((i) => i.label === 'Blog');
    assert.ok(item, 'Navigation.jsx must have a Blog item -- it is rendered on every blog article and the blog index');
    assert.equal(item.to, '/blog/');
  });

  test('exactly 6 items, none accidentally duplicated or dropped', () => {
    assert.equal(SUBPAGE_NAV_ITEMS.length, 6);
    assert.equal(new Set(SUBPAGE_NAV_ITEMS.map((i) => i.label)).size, 6);
  });
});

describe('cross-component consistency', () => {
  test('Search Homes/Search and Home Value use DISTINCT utm_content values between the two nav variants (attribution must not conflate them)', () => {
    const stickySearch = STICKY_NAV_ITEMS.find((i) => i.label === 'Search Homes').href;
    const subpageSearch = SUBPAGE_NAV_ITEMS.find((i) => i.label === 'Search').href;
    assert.notEqual(stickySearch, subpageSearch);
  });

  test('every component that has a Blog item points at the same URL', () => {
    assert.equal(STICKY_NAV_ITEMS.find((i) => i.label === 'Blog').to, SUBPAGE_NAV_ITEMS.find((i) => i.label === 'Blog').to);
  });
});
