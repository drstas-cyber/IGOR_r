import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractAnchors, restoreStrippedInternalLinks } from './internalLinkRestore.mjs';

const SITE = 'https://temeculavalleyhomes.us';
const KNOWN_ROUTES = [
  { url: `${SITE}/blog/redhawk-temecula-neighborhood-guide/` },
  { url: `${SITE}/blog/wolf-creek-temecula-neighborhood-guide/` },
  { url: `${SITE}/blog/hoa-fees-temecula-homebuyers-guide/` },
  { url: `${SITE}/homes-for-sale-temecula/` },
  { url: `${SITE}/contact/` },
];

describe('extractAnchors', () => {
  test('pulls href, text, and the raw matched tag out of content_html', () => {
    const html = `<p>See our <a href="${SITE}/contact/">contact page</a> for details.</p>`;
    const anchors = extractAnchors(html);
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].href, `${SITE}/contact/`);
    assert.equal(anchors[0].text, 'contact page');
    assert.equal(anchors[0].raw, `<a href="${SITE}/contact/">contact page</a>`);
  });

  test('returns [] for content with no anchors', () => {
    assert.deepEqual(extractAnchors('<p>No links here.</p>'), []);
  });

  test('returns [] for empty/null input', () => {
    assert.deepEqual(extractAnchors(''), []);
    assert.deepEqual(extractAnchors(null), []);
  });
});

describe('restoreStrippedInternalLinks — the real PR #32 bug (2026-08-17)', () => {
  test('reproduces the reported bug: a valid known-route link, present in the draft, wrongly stripped to plain text by self-review, is restored', () => {
    const draft = `<p>If you're weighing this against other established communities, our guide to <a href="${SITE}/blog/redhawk-temecula-neighborhood-guide/">living in Redhawk</a> covers a similarly planned neighborhood.</p>`;
    // Self-review's real, observed failure mode: strips the <a>, keeps the
    // anchor text verbatim as plain text, exactly as its own correction
    // log described ("removed anchor markup, kept plain text").
    const reviewed = `<p>If you're weighing this against other established communities, our guide to living in Redhawk covers a similarly planned neighborhood.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 1);
    assert.equal(result.restored[0].href, `${SITE}/blog/redhawk-temecula-neighborhood-guide/`);
    assert.match(result.html, /<a href="https:\/\/temeculavalleyhomes\.us\/blog\/redhawk-temecula-neighborhood-guide\/">living in Redhawk<\/a>/);
    assert.equal(result.skipped.length, 0);
  });

  test('restores multiple wrongly-stripped links in one pass (the actual Paloma Del Sol shape -- several links stripped in one self-review call)', () => {
    const draft = `<p>See <a href="${SITE}/blog/redhawk-temecula-neighborhood-guide/">Redhawk</a> and <a href="${SITE}/blog/wolf-creek-temecula-neighborhood-guide/">Wolf Creek</a>, or browse <a href="${SITE}/homes-for-sale-temecula/">homes for sale in Temecula</a>.</p>`;
    const reviewed = `<p>See Redhawk and Wolf Creek, or browse homes for sale in Temecula.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 3);
    assert.match(result.html, /<a href="[^"]*redhawk[^"]*">Redhawk<\/a>/);
    assert.match(result.html, /<a href="[^"]*wolf-creek[^"]*">Wolf Creek<\/a>/);
    assert.match(result.html, /<a href="[^"]*homes-for-sale-temecula\/">homes for sale in Temecula<\/a>/);
  });

  test('does NOT restore a link whose URL is not an exact known-route match -- self-review was right to strip it', () => {
    const draft = `<p>Check out <a href="${SITE}/blog/some-invented-slug-that-doesnt-exist/">this guide</a>.</p>`;
    const reviewed = `<p>Check out this guide.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 0);
    assert.equal(result.html, reviewed, 'html must be untouched -- this was a correct strip, not a bug');
  });

  test('a link that survived self-review intact is a no-op -- never double-wrapped', () => {
    const draft = `<p>Visit our <a href="${SITE}/contact/">contact page</a>.</p>`;
    const reviewed = `<p>Visit our <a href="${SITE}/contact/">contact page</a>.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 0);
    assert.equal(result.html, reviewed);
  });

  test('root-relative href in the draft (/contact/) still matches the full-URL known route, and the restored anchor keeps the ORIGINAL root-relative form', () => {
    const draft = `<p>Reach out via the <a href="/contact/">contact page</a>.</p>`;
    const reviewed = `<p>Reach out via the contact page.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 1);
    assert.match(result.html, /<a href="\/contact\/">contact page<\/a>/, 'restored anchor must reuse the draft\'s own href form, not rewrite it to a full URL');
  });

  test('ambiguous case: anchor text appears twice as bare text in the reviewed html -- skipped, not guessed at', () => {
    const draft = `<p>Our <a href="${SITE}/contact/">contact page</a> has the details. See the contact page for hours too.</p>`;
    const reviewed = `<p>Our contact page has the details. See the contact page for hours too.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /ambiguous/i);
    assert.equal(result.html, reviewed, 'must not guess which occurrence to wrap');
  });

  test('anchor text reworded away entirely by self-review -- skipped as "not found", not restored', () => {
    const draft = `<p>See our <a href="${SITE}/blog/hoa-fees-temecula-homebuyers-guide/">HOA fee guide</a>.</p>`;
    const reviewed = `<p>Ask your agent about typical association dues in the area.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /not found/i);
  });

  test('never restores into an occurrence that is already inside a different anchor', () => {
    const draft = `<p>Our <a href="${SITE}/contact/">contact page</a> can help.</p>`;
    // self-review stripped the original link AND separately, coincidentally,
    // linked the same words to something else entirely -- restoring must not
    // clobber that.
    const reviewed = `<p>Our <a href="${SITE}/homes-for-sale-temecula/">contact page</a> can help.</p>`;

    const result = restoreStrippedInternalLinks(draft, reviewed, KNOWN_ROUTES);

    assert.equal(result.restored.length, 0);
    assert.equal(result.html, reviewed);
  });

  test('draft with no anchors at all -- no-op, empty result', () => {
    const result = restoreStrippedInternalLinks('<p>No links.</p>', '<p>No links.</p>', KNOWN_ROUTES);
    assert.deepEqual(result.restored, []);
    assert.deepEqual(result.skipped, []);
  });
});
