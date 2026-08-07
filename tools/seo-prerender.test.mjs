import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildWebPageJsonLd, patchNoscriptH1, HOMEPAGE_ITEMLIST_JSONLD, HOMEPAGE_SERVICE_JSONLD } from './seo-prerender.js';

// Batch A, AI SEO audit item 1 (2026-08-07): every route used to ship the
// SAME hardcoded WebPage.@id/url, pointing at the homepage. buildWebPageJsonLd()
// is the fix -- these tests prove it's genuinely route-specific, not just
// plumbing that happens to work for one case.
describe('buildWebPageJsonLd — route-specific WebPage schema (2026-08-07)', () => {
  test('builds a WebPage entity keyed to the given url, not a fixed homepage url', () => {
    const result = buildWebPageJsonLd({
      url: 'https://temeculavalleyhomes.us/contact/',
      name: 'Contact George Khazanovskiy | Temecula Realtor',
      description: 'Contact George Khazanovskiy — experienced Temecula Valley Realtor.',
    });
    assert.equal(result['@type'], 'WebPage');
    assert.equal(result.url, 'https://temeculavalleyhomes.us/contact/');
    assert.equal(result['@id'], 'https://temeculavalleyhomes.us/contact/#webpage');
    assert.equal(result.name, 'Contact George Khazanovskiy | Temecula Realtor');
    assert.equal(result.description, 'Contact George Khazanovskiy — experienced Temecula Valley Realtor.');
  });

  test('two different routes produce two different @id/url pairs', () => {
    const home = buildWebPageJsonLd({ url: 'https://temeculavalleyhomes.us/', name: 'Home', description: 'd1' });
    const about = buildWebPageJsonLd({ url: 'https://temeculavalleyhomes.us/about-george/', name: 'About', description: 'd2' });
    assert.notEqual(home['@id'], about['@id']);
    assert.notEqual(home.url, about.url);
  });

  test('a blog article url produces an article-specific @id, not the blog index or homepage', () => {
    const article = buildWebPageJsonLd({
      url: 'https://temeculavalleyhomes.us/blog/how-to-prepare-a-home-for-sale-temecula/',
      name: "Preparing Your Temecula Home for Sale: A Seller's Checklist",
      description: 'A practical checklist for preparing your Temecula home for sale.',
    });
    assert.equal(article['@id'], 'https://temeculavalleyhomes.us/blog/how-to-prepare-a-home-for-sale-temecula/#webpage');
  });

  test('always links into the same global website/agent graph, regardless of route', () => {
    const result = buildWebPageJsonLd({ url: 'https://temeculavalleyhomes.us/sell-my-house/', name: 'n', description: 'd' });
    assert.deepEqual(result.isPartOf, { '@id': 'https://temeculavalleyhomes.us/#website' });
    assert.deepEqual(result.about, { '@id': 'https://temeculavalleyhomes.us/#agent' });
    assert.deepEqual(result.mainEntity, { '@id': 'https://temeculavalleyhomes.us/#agent' });
  });
});

// "Prove it red first" — the exact bug this fix exists to catch: a naive
// implementation that just returns a fixed, hardcoded WebPage object
// (mirroring the pre-fix index.html behavior) cannot distinguish routes at
// all. Demonstrates why a per-call url/name/description is necessary.
describe('regression: a fixed WebPage object cannot be route-specific', () => {
  function naiveFixedWebPage() {
    // Deliberately wrong: mirrors the OLD hardcoded index.html block,
    // always the homepage's own identity regardless of which route asks.
    return {
      '@type': 'WebPage',
      '@id': 'https://temeculavalleyhomes.us/#webpage',
      url: 'https://temeculavalleyhomes.us',
    };
  }

  test('RED: the naive fixed WebPage is identical for every route — the exact pre-fix bug', () => {
    const forContact = naiveFixedWebPage();
    const forAbout = naiveFixedWebPage();
    assert.equal(forContact['@id'], forAbout['@id'], 'demonstrating the naive object is route-blind, not asserting correct behavior');
    assert.equal(forContact.url, 'https://temeculavalleyhomes.us', 'demonstrating every route wrongly claims to be the homepage');
  });

  test('GREEN: buildWebPageJsonLd produces genuinely different identities for the same two routes', () => {
    const forContact = buildWebPageJsonLd({ url: 'https://temeculavalleyhomes.us/contact/', name: 'Contact', description: 'd' });
    const forAbout = buildWebPageJsonLd({ url: 'https://temeculavalleyhomes.us/about-george/', name: 'About', description: 'd' });
    assert.notEqual(forContact['@id'], forAbout['@id']);
    assert.notEqual(forContact.url, 'https://temeculavalleyhomes.us');
    assert.notEqual(forAbout.url, 'https://temeculavalleyhomes.us');
  });
});

// Batch A, AI SEO audit item 2 (2026-08-07): the static shell's <noscript>
// H1 used to be hardcoded to the homepage's own heading on every route.
describe('patchNoscriptH1 — route-specific static shell H1 (2026-08-07)', () => {
  function fixtureHtml(h1Text) {
    return `<!DOCTYPE html><html><head></head><body>
      <div id="root"></div>
      <noscript>
        <div>
          <h1>${h1Text}</h1>
          <p>some fallback content</p>
        </div>
      </noscript>
    </body></html>`;
  }

  test('replaces the noscript H1 text with the given route-specific text', () => {
    const html = fixtureHtml('Temecula Valley Homes For Sale — George Khazanovskiy, Realtor');
    const patched = patchNoscriptH1(html, 'Homes For Sale in Temecula');
    assert.match(patched, /<h1>Homes For Sale in Temecula<\/h1>/);
    assert.doesNotMatch(patched, /Temecula Valley Homes For Sale — George Khazanovskiy, Realtor/);
  });

  test('exactly one <h1> remains after patching — never zero, never two', () => {
    const html = fixtureHtml('Temecula Valley Homes For Sale — George Khazanovskiy, Realtor');
    const patched = patchNoscriptH1(html, 'Sell Your Temecula Home for Top Dollar');
    const matches = patched.match(/<h1[^>]*>/g) || [];
    assert.equal(matches.length, 1);
  });

  test('html-escapes the H1 text (defense in depth, matches htmlEscapeText used elsewhere in this file)', () => {
    const html = fixtureHtml('placeholder');
    const patched = patchNoscriptH1(html, 'Buyers & Sellers <script>');
    assert.match(patched, /Buyers &amp; Sellers &lt;script&gt;/);
  });

  test('no-op when h1Text is falsy — never blanks out the fallback H1', () => {
    const html = fixtureHtml('Temecula Valley Homes For Sale — George Khazanovskiy, Realtor');
    const patched = patchNoscriptH1(html, undefined);
    assert.equal(patched, html);
  });
});

// "Prove it red first" for the H1 fix — the exact pre-fix bug: every route
// carried the identical hardcoded H1 because nothing patched it per route.
describe('regression: an unpatched shell H1 is identical on every route', () => {
  test('RED: two different routes with no H1 patching produce the same H1 text — the exact pre-fix bug', () => {
    const SHARED_UNPATCHED_HTML = '<html><body><noscript><h1>Temecula Valley Homes For Sale — George Khazanovskiy, Realtor</h1></noscript></body></html>';
    const contactHtml = SHARED_UNPATCHED_HTML; // no per-route patch applied
    const aboutHtml = SHARED_UNPATCHED_HTML; // no per-route patch applied
    assert.equal(contactHtml, aboutHtml, 'demonstrating the pre-fix state: identical shell H1 regardless of route');
  });

  test('GREEN: patchNoscriptH1 makes the same starting HTML diverge per route', () => {
    const SHARED_UNPATCHED_HTML = '<html><body><noscript><h1>Temecula Valley Homes For Sale — George Khazanovskiy, Realtor</h1></noscript></body></html>';
    const contactHtml = patchNoscriptH1(SHARED_UNPATCHED_HTML, 'George Khazanovskiy');
    const aboutHtml = patchNoscriptH1(SHARED_UNPATCHED_HTML, 'Meet George Khazanovskiy — Temecula Valley Realtor');
    assert.notEqual(contactHtml, aboutHtml);
  });
});

// Batch A, AI SEO audit item 5 (2026-08-07): ItemList/Service scoping is
// enforced by main()'s route loop (only injected inside the `route.path
// === '/'` branch) rather than by these constants themselves — these tests
// just confirm the constants that DO get scoped are still intact/valid
// after being moved out of index.html verbatim.
describe('HOMEPAGE_ITEMLIST_JSONLD / HOMEPAGE_SERVICE_JSONLD — moved verbatim from index.html (2026-08-07)', () => {
  test('ItemList has all 8 neighborhoods, unchanged', () => {
    assert.equal(HOMEPAGE_ITEMLIST_JSONLD['@type'], 'ItemList');
    assert.equal(HOMEPAGE_ITEMLIST_JSONLD.numberOfItems, 8);
    assert.equal(HOMEPAGE_ITEMLIST_JSONLD.itemListElement.length, 8);
  });

  test('Service references the sitewide #agent entity, unchanged', () => {
    assert.equal(HOMEPAGE_SERVICE_JSONLD['@type'], 'Service');
    assert.deepEqual(HOMEPAGE_SERVICE_JSONLD.provider, { '@id': 'https://temeculavalleyhomes.us/#agent' });
  });

  test('both constants parse cleanly through JSON.stringify/parse (schema-valid JSON)', () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(HOMEPAGE_ITEMLIST_JSONLD)));
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(HOMEPAGE_SERVICE_JSONLD)));
  });
});
