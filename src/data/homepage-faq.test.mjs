import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HOMEPAGE_FAQ, buildHomepageFaqJsonLd } from './homepage-faq.js';

describe('homepage-faq — single source of truth for HomepageFAQSection.jsx and the FAQPage schema', () => {
  test('11 questions, approved 2026-08-05 (docs/homepage-faq-draft.md, Stage A)', () => {
    assert.equal(HOMEPAGE_FAQ.length, 11);
  });

  test('every entry has a non-empty question and answer', () => {
    for (const item of HOMEPAGE_FAQ) {
      assert.ok(item.question && item.question.length > 0);
      assert.ok(item.answer && item.answer.length > 0);
    }
  });

  test('buildHomepageFaqJsonLd() produces one Question per HOMEPAGE_FAQ entry, same order, same text -- proves schema cannot drift from the visible array', () => {
    const ld = buildHomepageFaqJsonLd();
    assert.equal(ld['@type'], 'FAQPage');
    assert.equal(ld.mainEntity.length, HOMEPAGE_FAQ.length);
    HOMEPAGE_FAQ.forEach((item, i) => {
      assert.equal(ld.mainEntity[i].name, item.question);
      assert.equal(ld.mainEntity[i].acceptedAnswer.text, item.answer);
    });
  });

  test('fluency line is the exact approved ceiling, no "only", no superlatives', () => {
    const fluencyAnswers = HOMEPAGE_FAQ.filter((i) => /fluent in English, Russian, and Ukrainian/.test(i.answer));
    assert.ok(fluencyAnswers.length >= 2, 'expected the exact fluency phrase in at least Q5 and Q10');
    for (const item of fluencyAnswers) {
      assert.doesNotMatch(item.answer, /\bonly\b/i);
      assert.doesNotMatch(item.answer, /\b(best|top|leading|premier|unmatched)\b/i);
    }
  });

  test('no invented review/rating/stat language anywhere in the set', () => {
    const joined = HOMEPAGE_FAQ.map((i) => i.answer).join(' ');
    assert.doesNotMatch(joined, /five-star|five star/i);
    assert.doesNotMatch(joined, /\d+%/); // no invented percentages
    assert.doesNotMatch(joined, /\bonly\b/i); // no exclusivity claims about George
  });

  test('identity block, where present, matches exactly: DRE #02034120 / Allison James Estates & Homes / 619-277-2766 / askgeorgek@gmail.com', () => {
    const withDre = HOMEPAGE_FAQ.filter((i) => i.answer.includes('DRE'));
    assert.ok(withDre.length > 0);
    for (const item of withDre) {
      assert.match(item.answer, /DRE #02034120/);
    }
    const withPhone = HOMEPAGE_FAQ.filter((i) => i.answer.includes('619-277-2766'));
    assert.ok(withPhone.length > 0);
  });
});
