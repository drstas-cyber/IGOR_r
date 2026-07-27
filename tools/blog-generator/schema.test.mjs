import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateArticleSchema, META_DESCRIPTION_MIN, META_DESCRIPTION_MAX, CITATION_SOURCE_TYPES } from './schema.js';

function validArticle(overrides = {}) {
  return {
    id: 'local-abc123',
    title: 'Understanding Escrow',
    slug: 'understanding-escrow',
    content_html: '<p>Escrow is a neutral third-party process. Closing typically occurs within 30 days.<sup class="citation" data-cite="1">[1]</sup></p>',
    meta_description: 'A clear, practical explanation of how escrow works for California homebuyers from start to close of sale.',
    hero_image_url: null,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
    faqJsonLd: null,
    created_at: '2026-07-25T00:00:00.000Z',
    keywords: ['escrow', 'homebuying'],
    citations: [
      { id: '1', sourceName: 'California Civil Code section 1057', url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1057', sourceType: 'statute' },
    ],
    published: false,
    sourceTopic: 'What to Expect During Escrow When Buying a Home',
    ...overrides,
  };
}

describe('validateArticleSchema — required fields', () => {
  test('a fully valid article passes', () => {
    const result = validateArticleSchema(validArticle());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  test('rejects an id not namespaced with local-', () => {
    const result = validateArticleSchema(validArticle({ id: '632480' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /id must be a string starting with "local-"/);
  });

  test('rejects a missing/empty title', () => {
    const result = validateArticleSchema(validArticle({ title: '' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /title must be a non-empty string/);
  });

  test('rejects a non-kebab-case slug', () => {
    const result = validateArticleSchema(validArticle({ slug: 'Not Kebab Case!' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /slug must be lowercase kebab-case/);
  });

  test('rejects empty content_html', () => {
    const result = validateArticleSchema(validArticle({ content_html: '' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /content_html must be a non-empty string/);
  });

  test('meta_description below the minimum length fails', () => {
    const result = validateArticleSchema(validArticle({ meta_description: 'Too short.' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), new RegExp(`${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX}`));
  });

  test('meta_description above the maximum length fails', () => {
    const result = validateArticleSchema(validArticle({ meta_description: 'x'.repeat(200) }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), new RegExp(`${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX}`));
  });

  test('meta_description at exactly the min/max boundary passes', () => {
    const min = validateArticleSchema(validArticle({ meta_description: 'x'.repeat(META_DESCRIPTION_MIN) }));
    const max = validateArticleSchema(validArticle({ meta_description: 'x'.repeat(META_DESCRIPTION_MAX) }));
    assert.equal(min.valid, true);
    assert.equal(max.valid, true);
  });

  test('hero_image_url: null is explicitly valid', () => {
    const result = validateArticleSchema(validArticle({ hero_image_url: null }));
    assert.equal(result.valid, true);
  });

  test('hero_image_url: a non-string non-null value fails', () => {
    const result = validateArticleSchema(validArticle({ hero_image_url: 123 }));
    assert.equal(result.valid, false);
  });

  test('jsonLd must be a non-null object', () => {
    const result = validateArticleSchema(validArticle({ jsonLd: null }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /jsonLd must be a non-null object/);
  });

  test('faqJsonLd: null is valid (no Q&A section)', () => {
    const result = validateArticleSchema(validArticle({ faqJsonLd: null }));
    assert.equal(result.valid, true);
  });

  test('faqJsonLd: an object is valid (has a Q&A section)', () => {
    const result = validateArticleSchema(validArticle({ faqJsonLd: { '@type': 'FAQPage' } }));
    assert.equal(result.valid, true);
  });

  test('rejects an unparseable created_at', () => {
    const result = validateArticleSchema(validArticle({ created_at: 'not-a-date' }));
    assert.equal(result.valid, false);
  });

  test('rejects empty keywords array', () => {
    const result = validateArticleSchema(validArticle({ keywords: [] }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /keywords must be a non-empty array/);
  });

  test('rejects non-boolean published', () => {
    const result = validateArticleSchema(validArticle({ published: 'false' }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /published must be a boolean/);
  });

  test('rejects a missing sourceTopic — needed by topicAvailability.mjs to avoid regenerating the same topic (2026-07-26)', () => {
    const result = validateArticleSchema(validArticle({ sourceTopic: undefined }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /sourceTopic must be a non-empty string/);
  });

  test('rejects an empty-string sourceTopic', () => {
    const result = validateArticleSchema(validArticle({ sourceTopic: '' }));
    assert.equal(result.valid, false);
  });

  test('accumulates multiple errors at once, not just the first', () => {
    const result = validateArticleSchema(validArticle({ title: '', slug: 'BAD SLUG', keywords: [] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 3);
  });
});

describe('validateArticleSchema — citations (added 2026-07-26)', () => {
  test('an empty citations array is valid when content_html has no data-cite markers', () => {
    const result = validateArticleSchema(validArticle({ citations: [], content_html: '<p>No specific claims here.</p>' }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test('rejects a non-array citations field', () => {
    const result = validateArticleSchema(validArticle({ citations: null }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /citations must be an array/);
  });

  test('rejects a citation entry missing sourceName', () => {
    const result = validateArticleSchema(validArticle({ citations: [{ id: '1', url: 'https://leginfo.legislature.ca.gov/x', sourceType: 'statute' }] }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /missing sourceName/);
  });

  test('rejects a citation entry missing url', () => {
    const result = validateArticleSchema(validArticle({ citations: [{ id: '1', sourceName: 'x', sourceType: 'statute' }] }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /missing url/);
  });

  test('rejects a sourceType outside the primary-source allowlist', () => {
    const result = validateArticleSchema(validArticle({ citations: [{ id: '1', sourceName: 'x', url: 'https://example.com', sourceType: 'blog' }] }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /not a primary-source category/);
  });

  // Each sourceType paired with a REAL approved host that actually permits
  // it (see CITATION_HOST_POLICY, tested independently below) -- a bare
  // placeholder host like example.gov would now fail the host-policy
  // check regardless of sourceType, which would make this test meaningless
  // for what it's actually checking (that every enum VALUE is accepted,
  // not that every host is).
  const SOURCE_TYPE_TO_VALID_HOST = {
    statute: 'https://leginfo.legislature.ca.gov/x',
    constitution: 'https://leginfo.legislature.ca.gov/x',
    'government-code': 'https://leginfo.legislature.ca.gov/x',
    'county-assessor': 'https://rivcoacr.org/x',
    'county-tax-collector': 'https://countytreasurer.org/x',
    'court-opinion': 'https://courts.ca.gov/x',
    'other-primary': 'https://rivco.gov/x',
  };

  test('every real CITATION_SOURCE_TYPES value is accepted, paired with a host that actually permits it', () => {
    assert.deepEqual(Object.keys(SOURCE_TYPE_TO_VALID_HOST).sort(), [...CITATION_SOURCE_TYPES].sort(), 'this test\'s own mapping must cover every real sourceType, or it silently stops testing new ones added later');
    for (const sourceType of CITATION_SOURCE_TYPES) {
      const result = validateArticleSchema(validArticle({ citations: [{ id: '1', sourceName: 'x', url: SOURCE_TYPE_TO_VALID_HOST[sourceType], sourceType }] }));
      assert.equal(result.valid, true, `${sourceType} should be valid: ${JSON.stringify(result.errors)}`);
    }
  });

  test('rejects a citation URL containing the competitor domain (prompt.md rule 7, defense in depth)', () => {
    const result = validateArticleSchema(validArticle({
      citations: [{ id: '1', sourceName: 'x', url: 'https://temeculavalleyhomes.com/blog/property-taxes', sourceType: 'other-primary' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /cites the competitor domain/);
  });

  test('rejects duplicate citation ids', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Claim A.<sup class="citation" data-cite="1">[1]</sup> Claim B.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [
        { id: '1', sourceName: 'Source A', url: 'https://leginfo.legislature.ca.gov/a', sourceType: 'statute' },
        { id: '1', sourceName: 'Source B', url: 'https://leginfo.legislature.ca.gov/b', sourceType: 'statute' },
      ],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /duplicate id "1"/);
  });

  test('rejects a data-cite marker in content_html with no matching citations[] entry', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Closing typically occurs within 30 days.<sup class="citation" data-cite="2">[2]</sup></p>',
      // citations still has id "1" from the base fixture -- "2" is referenced but never defined
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /data-cite="2" with no matching citations\[\] entry/);
  });

  test('rejects a citations[] entry with no matching data-cite marker (orphaned citation)', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>No markers in this body at all.</p>',
      // citations still has id "1" from the base fixture -- nothing references it
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /orphaned citation/);
  });

  test('a fully consistent multi-citation article passes', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Claim A.<sup class="citation" data-cite="1">[1]</sup> Claim B.<sup class="citation" data-cite="2">[2]</sup></p>',
      citations: [
        { id: '1', sourceName: 'Source A', url: 'https://leginfo.legislature.ca.gov/a', sourceType: 'statute' },
        { id: '2', sourceName: 'Source B', url: 'https://rivcoacr.org/b', sourceType: 'county-assessor' },
      ],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });
});

describe('validateArticleSchema — citation host policy, paired with sourceType (2026-07-26)', () => {
  test('POSITIVE CONTROL: a tier-1 host with its correctly paired sourceType passes', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>The rate is capped at 1%.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Cal. Const. Art. XIII A', url: 'https://leginfo.legislature.ca.gov/x', sourceType: 'constitution' }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test('POSITIVE CONTROL: a tier-2 republisher with a permitted sourceType passes', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>The rate is capped at 1%.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Civil Code 1102.6b', url: 'https://law.justia.com/x', sourceType: 'statute' }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test('a plausible-but-disallowed host (a real estate blog) fails, even with an otherwise-valid sourceType', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Fees vary.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'A Realtor Blog', url: 'https://somerealtorblog.com/property-taxes', sourceType: 'statute' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /not an approved citation host/);
  });

  test('a plausible-but-disallowed host (a general explainer site) fails', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Fees vary.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Investopedia', url: 'https://www.investopedia.com/mello-roos', sourceType: 'other-primary' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /not an approved citation host/);
  });

  // THE demonstrated gap this whole check exists to close -- this exact
  // pairing (law.justia.com labeled "statute") is what this file's own
  // Layer 3 sample fixture produced unprompted, with nothing catching it.
  test('MISLABELED PAIRING: a county-assessor sourceType on a justia.com URL fails, even though justia.com itself is allowlisted', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Assessed value varies.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County records (mirrored)', url: 'https://law.justia.com/some-page', sourceType: 'county-assessor' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /sourceType "county-assessor" is not valid for host "law\.justia\.com"/);
  });

  test('a real .org with no county name in it (countytreasurer.org) is correctly approved for county-tax-collector', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Bills are due Nov 1.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County Treasurer-Tax Collector', url: 'https://countytreasurer.org/x', sourceType: 'county-tax-collector' }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test('the excluded payment portal (ca-riverside-ttc.publicaccessnow.com) is NOT approved, deliberately', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Pay online.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Pay Property Taxes', url: 'https://ca-riverside-ttc.publicaccessnow.com/pay', sourceType: 'county-tax-collector' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /not an approved citation host/);
  });

  test('an unparseable citation URL fails as "not an approved citation host", not a crash', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'x', url: 'not-a-url', sourceType: 'statute' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /not an approved citation host/);
  });
});

// Real incident: draw 5 of the article-3 bait run produced
// "https://www.rivcoacr.org/" and "https://www.countytreasurer.org/..." --
// real, correct hosts, rejected outright because the allowlist has no
// www. variants, crashing the run with zero ground truth (the separate
// silent-discard-gap fix). Exactly one leading "www." label is stripped
// before the allowlist lookup -- not a general subdomain-stripping scheme.
describe('validateArticleSchema — www. host normalization (2026-07-27)', () => {
  test('POSITIVE CONTROL: www.rivcoacr.org + county-assessor passes', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Assessed value varies.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County Assessor', url: 'https://www.rivcoacr.org/property-tax-information/', sourceType: 'county-assessor' }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test('POSITIVE CONTROL: www.countytreasurer.org + county-tax-collector passes', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>Bills are due Nov 1.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County Treasurer-Tax Collector', url: 'https://www.countytreasurer.org/property-tax-information/', sourceType: 'county-tax-collector' }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test('NEGATIVE: www.rivcoacr.org.evil.com still fails — strips to "rivcoacr.org.evil.com", no allowlist match', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'x', url: 'https://www.rivcoacr.org.evil.com/property-tax-information/', sourceType: 'county-assessor' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /not an approved citation host/);
  });

  test('NEGATIVE: wwwrivcoacr.org still fails — no dot after "www", not actually a www. prefix', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'x', url: 'https://wwwrivcoacr.org/property-tax-information/', sourceType: 'county-assessor' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /not an approved citation host/);
  });

  test('bare-root rejection is unaffected by www. normalization — a bare www.-prefixed root still fails', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'x', url: 'https://www.rivcoacr.org/', sourceType: 'county-assessor' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /bare host root/);
  });
});

describe('validateArticleSchema — bare-root citation rejection (2026-07-27)', () => {
  // Real incident: article 1's citation 3 was "https://rivcoacr.org/" --
  // real tier-1 host, correct sourceType pairing, real 200 -- and
  // supported no specific claim. rivco.gov used here since it's the same
  // real host class (Riverside County) and permits sourceType
  // "other-primary", keeping these tests grounded in the actual incident.

  test('POSITIVE CONTROL: a bare root with trailing slash fails', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County', url: 'https://rivco.gov/', sourceType: 'other-primary' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /is a bare host root/);
  });

  test('POSITIVE CONTROL: a bare root with NO trailing slash also fails', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County', url: 'https://rivco.gov', sourceType: 'other-primary' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /is a bare host root/);
  });

  test('POSITIVE CONTROL: a real deep path passes', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County', url: 'https://rivco.gov/departments/assessor/property-tax-postponement', sourceType: 'other-primary' }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  // The adopted recommendation: shallow-but-real passes -- only TRUE bare
  // root fails. Rejecting this too would push the model toward fabricating
  // a plausible deep path that 404s, a worse failure than a real shallow
  // page (Layer 3's body-content verification is what confirms a shallow
  // page actually carries the cited fact, not this structural check).
  test('a shallow-but-real path (one segment) passes -- not required to deep-link', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County', url: 'https://rivco.gov/property-tax-information', sourceType: 'other-primary' }],
    }));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  test('a root with only a query string, no path, still fails as bare-root', () => {
    const result = validateArticleSchema(validArticle({
      content_html: '<p>x<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: [{ id: '1', sourceName: 'Riverside County', url: 'https://rivco.gov/?search=assessor', sourceType: 'other-primary' }],
    }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(), /is a bare host root/);
  });
});
