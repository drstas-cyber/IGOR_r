import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildFootnotesHtml, renderArticleFootnotes, renderAllFootnotes } from './renderCitations.mjs';

const CITATIONS = [
  { id: '1', sourceName: 'California Constitution, Article XIII A', url: 'https://leginfo.legislature.ca.gov/x', sourceType: 'constitution' },
  { id: '2', sourceName: 'Riverside County Tax Collector', url: 'https://rivcotaxcollector.example.gov/y', sourceType: 'county-tax-collector' },
];

function articleWithMarkers({ citations = CITATIONS, extraHtml = '' } = {}) {
  const markers = citations.map((c) => `<sup class="citation" data-cite="${c.id}">[${c.id}]</sup>`).join('');
  return {
    slug: 'test-article',
    title: 'Test Article',
    content_html: `<p>First claim.${citations[0] ? `<sup class="citation" data-cite="${citations[0].id}">[${citations[0].id}]</sup>` : ''} Second claim.${citations[1] ? `<sup class="citation" data-cite="${citations[1].id}">[${citations[1].id}]</sup>` : ''}</p>${extraHtml}`,
    citations,
  };
}

describe('buildFootnotesHtml — pure', () => {
  test('empty citations array produces an empty string', () => {
    assert.equal(buildFootnotesHtml([]), '');
  });

  test('undefined citations produces an empty string', () => {
    assert.equal(buildFootnotesHtml(undefined), '');
  });

  test('one citation produces one <li> with the sourceName as link text', () => {
    const html = buildFootnotesHtml([CITATIONS[0]]);
    assert.match(html, /<ol class="citations-footnotes">/);
    assert.match(html, /<li id="footnote-1">/);
    assert.match(html, /California Constitution, Article XIII A/);
  });

  test('external links use the site\'s actual convention: target="_blank" rel="noopener noreferrer"', () => {
    const html = buildFootnotesHtml([CITATIONS[0]]);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });

  test('the href is the citation URL, verbatim', () => {
    const html = buildFootnotesHtml([CITATIONS[0]]);
    assert.match(html, new RegExp(`href="${CITATIONS[0].url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  });

  test('multiple citations render in array order, not re-sorted', () => {
    const reordered = [CITATIONS[1], CITATIONS[0]]; // id "2" first
    const html = buildFootnotesHtml(reordered);
    const indexOf2 = html.indexOf('footnote-2');
    const indexOf1 = html.indexOf('footnote-1');
    assert.ok(indexOf2 < indexOf1, 'array order must be preserved, not sorted by id');
  });

  test('sourceName and url are HTML-escaped', () => {
    const html = buildFootnotesHtml([{ id: '1', sourceName: 'A & B "quoted"', url: 'https://example.gov/x?a=1&b=2', sourceType: 'other-primary' }]);
    assert.match(html, /A &amp; B &quot;quoted&quot;/);
    assert.match(html, /a=1&amp;b=2/);
    assert.doesNotMatch(html, /"quoted"/, 'a raw unescaped quote would break out of the href attribute');
  });
});

describe('renderArticleFootnotes — per-article, throws on inconsistency', () => {
  test('an article with no citations passes through completely unchanged (BabyLoveGrowth corpus)', () => {
    const article = { slug: 'x', title: 't', content_html: '<p>No citations here.</p>' };
    const result = renderArticleFootnotes(article);
    assert.equal(result, article, 'must be the SAME reference when there is nothing to render -- no needless copy');
  });

  test('an article with an empty citations array passes through unchanged', () => {
    const article = { slug: 'x', title: 't', content_html: '<p>No claims.</p>', citations: [] };
    const result = renderArticleFootnotes(article);
    assert.equal(result.content_html, article.content_html);
  });

  test('a consistent article gets footnotes appended to content_html', () => {
    const article = articleWithMarkers();
    const result = renderArticleFootnotes(article);
    assert.match(result.content_html, /<ol class="citations-footnotes">/);
    assert.ok(result.content_html.startsWith(article.content_html), 'footnotes must be APPENDED, not prepended or interleaved');
  });

  test('does NOT mutate the original article object', () => {
    const article = articleWithMarkers();
    const originalContentHtml = article.content_html;
    renderArticleFootnotes(article);
    assert.equal(article.content_html, originalContentHtml, 'the source-of-truth article object must never be mutated by rendering');
  });

  test('THROWS on a marker with no matching citations[] entry (simulates a broken hand-edit during PR review)', () => {
    const article = {
      slug: 'x', title: 't',
      content_html: '<p>Claim.<sup class="citation" data-cite="1">[1]</sup> Edited claim.<sup class="citation" data-cite="99">[99]</sup></p>',
      citations: [CITATIONS[0]], // only id "1" exists -- "99" was added by a hand-edit with no matching entry
    };
    assert.throws(() => renderArticleFootnotes(article), /data-cite="99" with no matching citations\[\] entry/);
  });

  test('THROWS on an orphaned citations[] entry (simulates a marker deleted during PR review)', () => {
    const article = {
      slug: 'x', title: 't',
      content_html: '<p>Only one claim left.<sup class="citation" data-cite="1">[1]</sup></p>',
      citations: CITATIONS, // id "2"'s marker was deleted by a hand-edit, entry never removed
    };
    assert.throws(() => renderArticleFootnotes(article), /citations\[\] has id "2" that no data-cite marker/);
  });

  test('the thrown error names the article (slug or title) so a build failure is actionable', () => {
    const article = {
      slug: 'the-broken-one', title: 't',
      content_html: '<p>x<sup class="citation" data-cite="99">[99]</sup></p>',
      citations: [],
    };
    assert.throws(() => renderArticleFootnotes(article), /the-broken-one/);
  });
});

describe('renderAllFootnotes — batch', () => {
  test('renders every article in an array', () => {
    const articles = [
      articleWithMarkers(),
      { slug: 'no-citations', title: 't', content_html: '<p>Plain.</p>' },
    ];
    const results = renderAllFootnotes(articles);
    assert.equal(results.length, 2);
    assert.match(results[0].content_html, /citations-footnotes/);
    assert.equal(results[1].content_html, '<p>Plain.</p>');
  });

  test('a single bad article fails the whole batch, does not skip and continue', () => {
    const articles = [
      articleWithMarkers(),
      { slug: 'broken', title: 't', content_html: '<p>x<sup class="citation" data-cite="99">[99]</sup></p>', citations: [] },
    ];
    assert.throws(() => renderAllFootnotes(articles), /broken/);
  });
});
