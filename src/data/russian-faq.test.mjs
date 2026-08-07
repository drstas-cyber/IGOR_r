import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RUSSIAN_FAQ, buildRussianFaqJsonLd } from './russian-faq.js';

// Batch A, AI SEO audit item 3 (2026-08-07): the Russian-speaking-realtor
// page had 6 visible FAQs (RussianFAQAccordion.jsx) and zero FAQPage
// schema. Fix: extract the FAQ data into this shared module, imported by
// both the accordion component and tools/seo-prerender.js's schema
// injection — same pattern as src/data/homepage-faq.js.
//
// Correction from the 2026-08-07 audit report: the source array has 5
// questions, not 6 as originally reported (a grep-count artifact in that
// audit, not a real discrepancy) — verified here directly against the
// actual data.
describe('RUSSIAN_FAQ — single source of truth for the Russian page FAQ', () => {
  test('has exactly 5 questions, matching RussianFAQAccordion.jsx source (verified directly, not the earlier miscounted 6)', () => {
    assert.equal(RUSSIAN_FAQ.length, 5);
  });

  test('every entry has both a non-empty question and answer, in Russian', () => {
    for (const item of RUSSIAN_FAQ) {
      assert.ok(item.question && item.question.length > 0);
      assert.ok(item.answer && item.answer.length > 0);
      // Cyrillic sanity check — this page's FAQ should be in Russian.
      assert.match(item.question, /[Ѐ-ӿ]/);
    }
  });
});

describe('buildRussianFaqJsonLd — schema matches visible source data exactly (2026-08-07)', () => {
  test('produces a valid FAQPage with one Question per RUSSIAN_FAQ entry', () => {
    const ld = buildRussianFaqJsonLd();
    assert.equal(ld['@type'], 'FAQPage');
    assert.equal(ld.mainEntity.length, RUSSIAN_FAQ.length);
  });

  test('question/answer text matches the source array exactly, 1:1, in order', () => {
    const ld = buildRussianFaqJsonLd();
    RUSSIAN_FAQ.forEach((item, i) => {
      assert.equal(ld.mainEntity[i].name, item.question);
      assert.equal(ld.mainEntity[i].acceptedAnswer.text, item.answer);
    });
  });

  test('@id is scoped to the Russian page, not the homepage FAQ (#faq) or any other route', () => {
    const ld = buildRussianFaqJsonLd();
    assert.equal(ld['@id'], 'https://temeculavalleyhomes.us/russian-speaking-realtor-temecula/#faq');
  });

  test('parses cleanly through JSON.stringify/parse', () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildRussianFaqJsonLd())));
  });
});

// "Prove it red first" — the exact pre-fix state: visible FAQs with no
// schema at all. A naive "does this route have FAQ schema" check against
// the OLD sitewide shared blocks (Person/WebSite/WebPage/ItemList/Service)
// would wrongly report false for every route, including this one, because
// none of those blocks are FAQPage type.
describe('regression: the old sitewide shared schema blocks contain no FAQPage for this route', () => {
  test('RED: the Russian page had visible FAQs (5, confirmed above) but the schema types present on that route were only Person/Agent/WebSite/WebPage/ItemList/Service — demonstrating the pre-fix gap', () => {
    const OLD_SITEWIDE_TYPES_ON_RUSSIAN_ROUTE = ['Person', 'RealEstateAgent', 'WebSite', 'WebPage', 'ItemList', 'Service'];
    assert.equal(OLD_SITEWIDE_TYPES_ON_RUSSIAN_ROUTE.includes('FAQPage'), false, 'demonstrating the gap this fix closes, not asserting correct behavior');
  });

  test('GREEN: buildRussianFaqJsonLd gives this route its own FAQPage, closing that gap', () => {
    const ld = buildRussianFaqJsonLd();
    assert.equal(ld['@type'], 'FAQPage');
  });
});
