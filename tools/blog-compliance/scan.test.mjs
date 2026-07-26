// Unit tests for the blog compliance scanner. Node's built-in test runner —
// no new dependency for a module this scoped. Run with:
//   node --test tools/blog-compliance/scan.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanArticle, htmlToText } from './scan.js';

function article({ title = 'Test Article', html = '' } = {}) {
  return { slug: 'test-article', title, content_html: html };
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
