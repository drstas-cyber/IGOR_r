// Unit tests for the blog compliance scanner. Node's built-in test runner —
// no new dependency for a module this scoped. Run with:
//   node --test tools/blog-compliance/scan.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanArticle, htmlToText, evaluateBatch, scanAllArticles } from './scan.js';

function article({ slug = 'test-article', title = 'Test Article', html = '' } = {}) {
  return { slug, title, content_html: html };
}

function categories(result) {
  return result.findings.map((f) => f.category);
}

describe('htmlToText', () => {
  test('strips tags but keeps words separated across block boundaries', () => {
    assert.equal(htmlToText('<p>Hello</p><p>World</p>'), 'Hello World');
  });

  test('joins a phrase split across inline tags', () => {
    assert.equal(htmlToText('the <strong>only</strong> agent'), 'the only agent');
  });

  test('decodes common HTML entities', () => {
    assert.equal(htmlToText('Buy &amp; sell &nbsp;homes'), 'Buy & sell homes');
  });
});

describe('(a) exclusivity claims', () => {
  test('POSITIVE: "the only agent" trips', () => {
    const r = scanArticle(article({ html: '<p>George is the only agent in Temecula who speaks Russian.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('exclusivity'));
  });

  test('POSITIVE: "only Realtor" trips', () => {
    const r = scanArticle(article({ html: "<p>He's the only Realtor you'll ever need in this market.</p>" }));
    assert.equal(r.tripped, true);
  });

  test('POSITIVE: split across tags still trips', () => {
    const r = scanArticle(article({ html: '<p>George is the <em>only</em> broker who covers Wine Country full-time.</p>' }));
    assert.equal(r.tripped, true);
  });

  test('NEGATIVE (must NOT trip): "not only... but also"', () => {
    const r = scanArticle(article({ html: '<p>Not only does George know the market, but he also speaks three languages.</p>' }));
    assert.equal(categories(r).includes('exclusivity'), false);
  });

  test('NEGATIVE (must NOT trip): "the only way to know is an appraisal"', () => {
    const r = scanArticle(article({ html: "<p>The only way to know your home's true value is a professional appraisal.</p>" }));
    assert.equal(categories(r).includes('exclusivity'), false);
  });

  test('NEGATIVE (must NOT trip): "only" with no agent-context word nearby', () => {
    const r = scanArticle(article({ html: '<p>This is the only listing currently available in Wolf Creek this month.</p>' }));
    assert.equal(categories(r).includes('exclusivity'), false);
  });

  // Widened 2026-07-26 after the real gap: "only" alone missed
  // superlative-framed competitor-comparison titles entirely.
  test('POSITIVE (real title, verbatim): "Best...Alternatives" trips', () => {
    const r = scanArticle(article({ title: 'Best Meekerrealtygroup.com Alternatives for Temecula Buyers' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('exclusivity'));
  });

  test('POSITIVE (real title, verbatim): "Top 4...Alternatives" trips', () => {
    const r = scanArticle(article({ title: 'Top 4 debonisteam.com Alternatives Providers 2026' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('exclusivity'));
  });

  test('POSITIVE (real title, verbatim): "Top 5...Alternatives" trips', () => {
    const r = scanArticle(article({ title: 'Top 5 yukomiyata.com Alternatives for Real Estate Experts' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('exclusivity'));
  });

  test('NEGATIVE (must NOT trip): "best time to sell" — no agent/alternative context nearby', () => {
    const r = scanArticle(article({ html: '<p>Spring is generally considered the best time to sell a home in this market.</p>' }));
    assert.equal(categories(r).includes('exclusivity'), false);
  });

  test('NEGATIVE (must NOT trip): "top 5 neighborhoods" — no agent/alternative context nearby', () => {
    const r = scanArticle(article({ html: '<p>Here are the top 5 neighborhoods for families in Temecula Valley.</p>' }));
    assert.equal(categories(r).includes('exclusivity'), false);
  });
});

describe('(b) tenure / years-of-experience claims', () => {
  test('POSITIVE: "over N years"', () => {
    const r = scanArticle(article({ html: '<p>With over 10 years of experience, George has closed hundreds of deals.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('tenure'));
  });

  test('POSITIVE: "veteran agent"', () => {
    const r = scanArticle(article({ html: '<p>As a veteran agent, George has seen every market cycle.</p>' }));
    assert.equal(r.tripped, true);
  });

  test('KNOWN NOISY (documented, not a bug): "since <year>" trips even for unrelated market commentary', () => {
    // This is the exact false-positive risk flagged during design. Kept as a
    // documented "expected to trip" case, not asserted as a negative — see
    // patterns.js and the README for the tuning note after the real-data run.
    const r = scanArticle(article({ html: '<p>Since 2020, mortgage rates have moved through several distinct cycles.</p>' }));
    assert.equal(categories(r).includes('tenure'), true);
  });

  test('NEGATIVE (must NOT trip): generic market copy with no tenure language', () => {
    const r = scanArticle(article({ html: '<p>Home prices in Temecula have risen steadily this quarter.</p>' }));
    assert.equal(categories(r).includes('tenure'), false);
  });

  // PERMANENT REGRESSION TEST — this is the real ground-truth sentence from
  // the open-house article, verified against the live BabyLoveGrowth data on
  // 2026-07-26. It previously tripped tenure only by coincidence, via an
  // unrelated sentence elsewhere in the same article — this exact sentence,
  // in isolation, matched NONE of the pre-2026-07-26 patterns. If this test
  // ever goes red again, that is the same gap recurring, not noise.
  test('POSITIVE (ground truth, must never regress): "has spent over a decade guiding" trips tenure', () => {
    const r = scanArticle(article({
      html: '<p>George Khazanovskiy at Temeculavalleyhomes has spent over a decade guiding first-time buyers through exactly this process in the Temecula Valley.</p>',
    }));
    assert.ok(categories(r).includes('tenure'), `expected tenure to trip, got: ${JSON.stringify(r.findings)}`);
  });

  test('POSITIVE: "two decades"', () => {
    const r = scanArticle(article({ html: '<p>With two decades in the Temecula market, George has seen every cycle.</p>' }));
    assert.ok(categories(r).includes('tenure'));
  });

  test('POSITIVE: "over ten years" (word-form, no digit)', () => {
    const r = scanArticle(article({ html: '<p>He has over ten years helping local buyers navigate the process.</p>' }));
    assert.ok(categories(r).includes('tenure'));
  });

  test('POSITIVE: "nearly twenty years"', () => {
    const r = scanArticle(article({ html: '<p>Nearly twenty years in real estate has taught her a lot.</p>' }));
    assert.ok(categories(r).includes('tenure'));
  });

  test('POSITIVE: "spent years"', () => {
    const r = scanArticle(article({ html: '<p>George has spent years building relationships with local lenders.</p>' }));
    assert.ok(categories(r).includes('tenure'));
  });

  test('POSITIVE: "years guiding"', () => {
    const r = scanArticle(article({ html: '<p>Her years guiding first-time buyers gives her a practiced eye for red flags.</p>' }));
    assert.ok(categories(r).includes('tenure'));
  });

  test('NEGATIVE (must NOT trip): "a decade" with no over/more-than framing but still a bare duration mention is intentionally caught — sanity check it does not explode on unrelated "a" usage', () => {
    const r = scanArticle(article({ html: '<p>Choosing a home in this market requires patience.</p>' }));
    assert.equal(categories(r).includes('tenure'), false);
  });
});

describe('(c) review counts / ratings / stars', () => {
  test('POSITIVE: "5 stars"', () => {
    const r = scanArticle(article({ html: '<p>George is rated 5 stars by dozens of happy clients.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('reviews-ratings'));
  });

  test('POSITIVE: "50 five-star reviews"', () => {
    const r = scanArticle(article({ html: '<p>With over 50 five-star reviews, George is a trusted local expert.</p>' }));
    assert.equal(r.tripped, true);
  });

  test('NEGATIVE (must NOT trip): "five-bedroom" does not match "five-star"', () => {
    const r = scanArticle(article({ html: '<p>Consider a home with a five-bedroom layout for a growing family.</p>' }));
    assert.equal(categories(r).includes('reviews-ratings'), false);
  });

  // "rated N" widened 2026-07-26 to require review/star/client/testimonial
  // context nearby — previously a bare regex, which fired on unrelated
  // numeric scoring scales just as readily as real review claims.
  test('POSITIVE: "rated 5 stars by 40 clients" trips (review context present)', () => {
    const r = scanArticle(article({ html: '<p>The agency is rated 5 stars by 40 clients on independent review sites.</p>' }));
    assert.ok(categories(r).includes('reviews-ratings'));
    const finding = r.findings.find((f) => f.subcategory === 'rated-n');
    assert.ok(finding, 'expected a rated-n finding specifically');
  });

  test('NEGATIVE (must NOT trip on rated-n specifically): "neighborhood rated 7 for walkability" — no review context nearby', () => {
    const r = scanArticle(article({ html: '<p>Moving from a neighborhood rated 5 to one rated 7 for walkability adds real value.</p>' }));
    const ratedNFinding = r.findings.find((f) => f.subcategory === 'rated-n');
    assert.equal(ratedNFinding, undefined, `expected no rated-n finding, got: ${JSON.stringify(r.findings)}`);
  });
});

describe('(d) unverifiable urgency stats', () => {
  test('POSITIVE: "N% of homes sell in Y days"', () => {
    const r = scanArticle(article({ html: '<p>73% of homes sell within 10 days in this market.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('urgency-stat'));
  });

  test('NEGATIVE (must NOT trip): general trend language with no specific stat', () => {
    const r = scanArticle(article({ html: '<p>Homes have generally been selling faster than last year.</p>' }));
    assert.equal(categories(r).includes('urgency-stat'), false);
  });
});

describe('(e) named-competitor disparagement', () => {
  test('POSITIVE: domain near a disparagement word', () => {
    const r = scanArticle(article({ html: '<p>Unlike outdated agencies like oldrealty.com, George offers a modern, full-service experience.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('disparagement'));
  });

  test('NEGATIVE (must NOT trip): neutral competitor/reference mention', () => {
    const r = scanArticle(article({ html: '<p>For additional listings, buyers often also check Zillow.com or Realtor.com.</p>' }));
    assert.equal(categories(r).includes('disparagement'), false);
  });

  // Widened 2026-07-26: neutral-tone "domain + Alternatives" content was
  // missed entirely by sentiment-only matching — same real gap as (a) above.
  test('POSITIVE (real title, verbatim): "Best...Alternatives" trips via comparison-framing, no negative sentiment needed', () => {
    const r = scanArticle(article({ title: 'Best Meekerrealtygroup.com Alternatives for Temecula Buyers' }));
    assert.ok(categories(r).includes('disparagement'));
    const finding = r.findings.find((f) => f.category === 'disparagement');
    assert.equal(finding.subcategory, 'comparison-framing');
  });

  test('POSITIVE (real title, verbatim): "Top 4...Alternatives" trips via comparison-framing', () => {
    const r = scanArticle(article({ title: 'Top 4 debonisteam.com Alternatives Providers 2026' }));
    assert.ok(categories(r).includes('disparagement'));
  });

  test('POSITIVE (real title, verbatim): "Top 5...Alternatives" trips via comparison-framing', () => {
    const r = scanArticle(article({ title: 'Top 5 yukomiyata.com Alternatives for Real Estate Experts' }));
    assert.ok(categories(r).includes('disparagement'));
  });
});

describe('(f) wrong DRE / brokerage / phone / email', () => {
  test('POSITIVE: wrong DRE number', () => {
    const r = scanArticle(article({ html: '<p>George is licensed under DRE #01234567.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('wrong-dre'));
  });

  test('POSITIVE: wrong phone number', () => {
    const r = scanArticle(article({ html: '<p>Call George today at 555-123-4567 for a free consultation.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('wrong-phone'));
  });

  test('POSITIVE: wrong email', () => {
    const r = scanArticle(article({ html: '<p>Reach out any time at george@othersite.com.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('wrong-email'));
  });

  test('POSITIVE: wrong brokerage', () => {
    const r = scanArticle(article({ html: '<p>George is affiliated with Century 21 Premier Realty.</p>' }));
    assert.equal(r.tripped, true);
    assert.ok(categories(r).includes('wrong-brokerage'));
  });

  test('NEGATIVE (must NOT trip): correct DRE number', () => {
    const r = scanArticle(article({ html: '<p>George is licensed under DRE #02034120.</p>' }));
    assert.equal(categories(r).includes('wrong-dre'), false);
  });

  test('NEGATIVE (must NOT trip): correct phone number', () => {
    const r = scanArticle(article({ html: '<p>Call George today at 619-277-2766 for a free consultation.</p>' }));
    assert.equal(categories(r).includes('wrong-phone'), false);
  });

  test('NEGATIVE (must NOT trip): correct email', () => {
    const r = scanArticle(article({ html: '<p>Email askgeorgek@gmail.com for details.</p>' }));
    assert.equal(categories(r).includes('wrong-email'), false);
  });

  test('NEGATIVE (must NOT trip): correct brokerage', () => {
    const r = scanArticle(article({ html: '<p>George is affiliated with Allison James Estates & Homes.</p>' }));
    assert.equal(categories(r).includes('wrong-brokerage'), false);
  });

  // POSITIVE CONTROL, added 2026-07-26: the real 25-article batch showed
  // zero wrong-identity hits. Zero is indistinguishable from "the patterns
  // are broken" without a known-bad sample proving they fire. This
  // synthetic "poison pill" article carries all four markers at once and
  // must trip all four categories in a single scan — and via scanAllArticles
  // (batch context), not just a lone scanArticle call, to prove it also
  // works the way runComplianceFilter() actually calls it.
  test('POSITIVE CONTROL: synthetic article with all four wrong-identity markers fires all four categories', () => {
    const poisonPill = article({
      slug: 'positive-control-poison-pill',
      title: 'Positive Control Article — Not Real Content',
      html: `<p>George is licensed under DRE #01234567, affiliated with Century 21 Premier Realty.
             Call him at 555-123-4567 or email george@othersite.com for details.</p>`,
    });
    const r = scanArticle(poisonPill);
    const cats = categories(r);
    assert.ok(cats.includes('wrong-dre'), 'wrong-dre did not fire');
    assert.ok(cats.includes('wrong-brokerage'), 'wrong-brokerage did not fire');
    assert.ok(cats.includes('wrong-phone'), 'wrong-phone did not fire');
    assert.ok(cats.includes('wrong-email'), 'wrong-email did not fire');
  });

  test('POSITIVE CONTROL, batch context: the poison pill fires all four when run through scanAllArticles alongside real-shaped clean articles', () => {
    const clean1 = article({ slug: 'clean-1', title: 'Clean Article One', html: '<p>Home prices vary by neighborhood and condition.</p>' });
    const poisonPill = article({
      slug: 'positive-control-poison-pill',
      title: 'Positive Control Article — Not Real Content',
      html: `<p>George is licensed under DRE #01234567, affiliated with Century 21 Premier Realty.
             Call him at 555-123-4567 or email george@othersite.com for details.</p>`,
    });
    const clean2 = article({ slug: 'clean-2', title: 'Clean Article Two', html: '<p>Buyers should review comparable sales before making an offer.</p>' });
    const results = scanAllArticles([clean1, poisonPill, clean2]);
    const pillResult = results.find((r) => r.slug === 'positive-control-poison-pill');
    assert.ok(pillResult, 'poison pill result missing from batch');
    const cats = pillResult.findings.map((f) => f.category);
    assert.ok(cats.includes('wrong-dre') && cats.includes('wrong-brokerage') && cats.includes('wrong-phone') && cats.includes('wrong-email'),
      `expected all four identity categories, got: ${JSON.stringify(cats)}`);
    assert.equal(results.find((r) => r.slug === 'clean-1').tripped, false);
    assert.equal(results.find((r) => r.slug === 'clean-2').tripped, false);
  });
});

describe('a genuinely clean article', () => {
  test('NEGATIVE (must NOT trip on anything): realistic clean article', () => {
    const r = scanArticle(article({
      title: 'What Determines Your Home’s Market Value',
      html: `
        <p>Several factors shape what a home is worth in today's market: location,
        condition, recent comparable sales, and overall demand. Buyers and sellers
        both benefit from understanding these basics before pricing a home or
        making an offer.</p>
        <p>George Khazanovskiy, a Realtor® with Allison James Estates & Homes
        (DRE #02034120), works with buyers and sellers across Temecula Valley.
        For a free consultation, call 619-277-2766 or email
        askgeorgek@gmail.com.</p>
      `,
    }));
    assert.equal(r.tripped, false, `expected clean, got findings: ${JSON.stringify(r.findings)}`);
  });
});

function fakeResults(trippedCount, total) {
  return Array.from({ length: total }, (_, i) => ({ tripped: i < trippedCount }));
}

describe('evaluateBatch — batch-level fail threshold', () => {
  test('100% tripped (24/24) fails the build', () => {
    const b = evaluateBatch(fakeResults(24, 24), 0.5);
    assert.equal(b.shouldFailBuild, true);
    assert.equal(b.trippedCount, 24);
    assert.equal(b.total, 24);
  });

  test('the exact scenario named during review: 23/24 tripped fails the build', () => {
    // Previously this shipped 1 survivor and reported success — the bug
    // being fixed here.
    const b = evaluateBatch(fakeResults(23, 24), 0.5);
    assert.equal(b.shouldFailBuild, true);
  });

  test('just under the threshold (11/24, ~45.8%) does NOT fail', () => {
    const b = evaluateBatch(fakeResults(11, 24), 0.5);
    assert.ok(b.tripRate < 0.5);
    assert.equal(b.shouldFailBuild, false);
  });

  test('exactly at the threshold (12/24, 50%) does NOT fail — "above", not "at or above"', () => {
    const b = evaluateBatch(fakeResults(12, 24), 0.5);
    assert.equal(b.tripRate, 0.5);
    assert.equal(b.shouldFailBuild, false);
  });

  test('just above the threshold (13/24, ~54.2%) fails', () => {
    const b = evaluateBatch(fakeResults(13, 24), 0.5);
    assert.ok(b.tripRate > 0.5);
    assert.equal(b.shouldFailBuild, true);
  });

  test('low trip rate (2/24) does not fail', () => {
    const b = evaluateBatch(fakeResults(2, 24), 0.5);
    assert.equal(b.shouldFailBuild, false);
  });

  test('0 tripped does not fail', () => {
    const b = evaluateBatch(fakeResults(0, 24), 0.5);
    assert.equal(b.shouldFailBuild, false);
  });

  test('empty batch (0 articles fetched at all) does not fail here — that case is handled earlier in fetch-blog-data.js, before this is ever called', () => {
    const b = evaluateBatch([], 0.5);
    assert.equal(b.shouldFailBuild, false);
    assert.equal(b.total, 0);
  });

  test('uses the imported MAX_TRIP_RATE default when no override is passed', () => {
    const b = evaluateBatch(fakeResults(24, 24));
    assert.equal(b.shouldFailBuild, true);
  });
});
