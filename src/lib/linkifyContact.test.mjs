import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { linkifyContact, plainTextOf } from './linkifyContact.js';
import { HOMEPAGE_FAQ } from '../data/homepage-faq.js';

describe('linkifyContact', () => {
  test('a phone number becomes a tel: link descriptor', () => {
    const segments = linkifyContact('Call 619-277-2766 today.');
    assert.deepEqual(segments, [
      'Call ',
      { type: 'tel', href: 'tel:+16192772766', text: '619-277-2766' },
      ' today.',
    ]);
  });

  test('an email becomes a mailto: link descriptor', () => {
    const segments = linkifyContact('Email askgeorgek@gmail.com anytime.');
    assert.deepEqual(segments, [
      'Email ',
      { type: 'mailto', href: 'mailto:askgeorgek@gmail.com', text: 'askgeorgek@gmail.com' },
      ' anytime.',
    ]);
  });

  test('both in one string, multiple occurrences, all linkified', () => {
    const segments = linkifyContact('Call 619-277-2766 or email askgeorgek@gmail.com. Or call 619-277-2766 again.');
    const linkCount = segments.filter((s) => typeof s !== 'string').length;
    assert.equal(linkCount, 3);
  });

  test('no contact info -> unchanged single string segment', () => {
    const segments = linkifyContact('No contact info in this sentence.');
    assert.deepEqual(segments, ['No contact info in this sentence.']);
  });

  test('plainTextOf reverses linkifyContact exactly -- the transform is lossless', () => {
    const original = "Reach out at 619-277-2766 or askgeorgek@gmail.com to get started.";
    assert.equal(plainTextOf(linkifyContact(original)), original);
  });

  // The actual proof requested: every real HOMEPAGE_FAQ answer, run through
  // the render-time transform and back, reconstructs byte-for-byte --
  // confirming the schema (which reads the raw string) and the rendered
  // visible text (built from these segments) can never visibly diverge,
  // even though the FAQPage JSON-LD stays plain text and the rendered DOM
  // gains <a> tags.
  test('round-trip: every HOMEPAGE_FAQ answer survives linkify -> plainTextOf unchanged', () => {
    for (const item of HOMEPAGE_FAQ) {
      assert.equal(plainTextOf(linkifyContact(item.answer)), item.answer, `mismatch on: "${item.question}"`);
    }
  });

  test('hrefs use the exact tel:/mailto: prefixes the sitewide delegated click-tracker checks for', () => {
    const segments = linkifyContact('619-277-2766 askgeorgek@gmail.com');
    const tel = segments.find((s) => s.type === 'tel');
    const mailto = segments.find((s) => s.type === 'mailto');
    assert.equal(tel.href.indexOf('tel:'), 0);
    assert.equal(mailto.href.indexOf('mailto:'), 0);
  });
});
