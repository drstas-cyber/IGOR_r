import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeArticleVerdict, auditArticle, runWeeklyRetro, readArticleFile } from './retroAudit.mjs';
import { RETRO_CHECKLIST_TOOL } from './retroClaimGate.mjs';
import { BLOG_ARTICLE_CACHE_CONTROL } from './headersCacheEntry.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

// BATCH F / OPTION D: retro used to build a per-slug cache pair for its
// header fixture. Article cache coverage is now a single shared contract in
// public/_headers, so every article -- including one published after this
// file was written -- is covered by the same two placeholder routes.
const CC = `  Cache-Control: ${BLOG_ARTICLE_CACHE_CONTROL}`;
const VALID_OPTION_D_HEADERS = `/blog/\n${CC}\n/blog\n${CC}\n/blog/:slug/\n${CC}\n/blog/:slug\n${CC}\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`;

function isolatedDir(prefix = 'retro-audit-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('computeArticleVerdict — pure severity mapping', () => {
  test('nothing found -> CLEAR, zero reasons', () => {
    const { verdict, reasons } = computeArticleVerdict({});
    assert.equal(verdict, 'CLEAR');
    assert.deepEqual(reasons, []);
  });

  test('a missing identity element -> REJECT', () => {
    const { verdict } = computeArticleVerdict({ identityErrors: ['identity block: DRE number (02034120) not found anywhere in content_html'] });
    assert.equal(verdict, 'REJECT');
  });

  test('a wrong identity detail (already live) -> REJECT', () => {
    const { verdict } = computeArticleVerdict({ wrongIdentityFindings: [{ category: 'wrong-phone', matchedText: '555-123-4567' }] });
    assert.equal(verdict, 'REJECT');
  });

  test('a non-log-only prohibited claim -> REJECT', () => {
    const { verdict } = computeArticleVerdict({ prohibitedClaimFindings: [{ category: 'tenure', matchedText: 'over a decade', logOnly: false }] });
    assert.equal(verdict, 'REJECT');
  });

  test('only a log-only (demoted) prohibited claim -> NEEDS-FIX, not REJECT', () => {
    const { verdict, reasons } = computeArticleVerdict({ prohibitedClaimFindings: [{ category: 'exclusivity', subcategory: 'only', matchedText: 'only a minute', logOnly: true }] });
    assert.equal(verdict, 'NEEDS-FIX');
    assert.ok(reasons.some((r) => r.severity === 'NEEDS-FIX'));
  });

  test('a citation that no longer resolves (FAILED) -> REJECT', () => {
    const { verdict } = computeArticleVerdict({ citationEval: { failed: [{ url: 'https://leginfo.legislature.ca.gov/dead' }], unsupported: [], inconclusive: [] } });
    assert.equal(verdict, 'REJECT');
  });

  test('a citation that resolves but no longer supports the claim (RESOLVED_UNSUPPORTED) -> REJECT', () => {
    const { verdict } = computeArticleVerdict({ citationEval: { failed: [], unsupported: [{ url: 'https://rivcoacr.org/x' }], inconclusive: [] } });
    assert.equal(verdict, 'REJECT');
  });

  test('an inconclusive (bot-blocked) citation alone -> NEEDS-FIX, not REJECT', () => {
    const { verdict } = computeArticleVerdict({ citationEval: { failed: [], unsupported: [], inconclusive: [{ url: 'https://law.justia.com/x' }] } });
    assert.equal(verdict, 'NEEDS-FIX');
  });

  test('an uncited-claim candidate alone -> NEEDS-FIX, not REJECT', () => {
    const { verdict } = computeArticleVerdict({ uncitedClaimCandidates: [{ matchedText: '12%' }] });
    assert.equal(verdict, 'NEEDS-FIX');
  });

  test('fabricated_speech tripped -> REJECT', () => {
    const { verdict, reasons } = computeArticleVerdict({
      retroClaimResult: { tripped: true, checklist: { fabricated_speech: true, fabricated_speech_evidence: '"I always say," George says' } },
    });
    assert.equal(verdict, 'REJECT');
    assert.match(reasons.map((r) => r.text).join(), /fabricated speech/);
  });

  test('misattributed_quote tripped -> REJECT', () => {
    const { verdict, reasons } = computeArticleVerdict({
      retroClaimResult: { tripped: true, checklist: { misattributed_quote: true, misattributed_quote_evidence: 'statute does not say this' } },
    });
    assert.equal(verdict, 'REJECT');
    assert.match(reasons.map((r) => r.text).join(), /misattributed quote/);
  });

  test('an incomplete publish sequence -> REJECT', () => {
    const { verdict } = computeArticleVerdict({
      publishStatus: { complete: false, checks: [{ ok: false, label: 'shared blog article cache coverage valid' }] },
    });
    assert.equal(verdict, 'REJECT');
  });

  test('live check FAIL -> REJECT; live check UNVERIFIED-TOOLING -> NEEDS-FIX only', () => {
    const failing = computeArticleVerdict({ liveStatus: { status: 'FAIL', detail: 'HTTP 500' } });
    assert.equal(failing.verdict, 'REJECT');
    const unverified = computeArticleVerdict({ liveStatus: { status: 'UNVERIFIED-TOOLING', detail: 'no network' } });
    assert.equal(unverified.verdict, 'NEEDS-FIX');
  });

  test('REJECT wins over NEEDS-FIX when both kinds of findings are present', () => {
    const { verdict } = computeArticleVerdict({
      identityErrors: ['missing DRE'],
      uncitedClaimCandidates: [{ matchedText: '12%' }],
    });
    assert.equal(verdict, 'REJECT');
  });
});

function toolUseResponse(toolName, input) {
  return { content: [{ type: 'tool_use', name: toolName, input }], stop_reason: 'tool_use' };
}
const CLEAN_RETRO_CHECKLIST = {
  fabricated_speech: false, fabricated_speech_evidence: null,
  misattributed_quote: false, misattributed_quote_evidence: null,
};

describe('auditArticle — integration, mocked network', () => {
  const CLEAN_ARTICLE = {
    slug: 'clean-article',
    title: 'Clean Article',
    content_html: '<p>Home prices vary by neighborhood and condition.</p><h2>About George Khazanovskiy</h2><p>George Khazanovskiy is a Temecula Valley real estate agent (DRE #02034120) with Allison James Estates &amp; Homes. Reach George at 619-277-2766 or askgeorgek@gmail.com.</p>',
    citations: [],
    published: true,
  };

  test('a clean article with no API key -> NEEDS-FIX (key missing is disclosed, not silently skipped as clean)', async () => {
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('/blog/clean-article/')) return { ok: true, status: 200, text: async () => '<title>Clean Article</title>' };
      throw new Error(`unexpected fetch: ${s}`);
    };
    const result = await auditArticle({
      slug: 'clean-article', article: CLEAN_ARTICLE, apiKey: undefined,
      headersText: VALID_OPTION_D_HEADERS,
      blogArticlesSlugs: ['clean-article'],
    });
    assert.equal(result.verdict, 'NEEDS-FIX');
    assert.match(result.reasons.map((r) => r.text).join(), /no ANTHROPIC_API_KEY/);
  });

  test('a clean article, API key present, clean retro checklist, complete publish, live OK -> CLEAR', async () => {
    globalThis.fetch = async (url, init) => {
      const s = String(url);
      if (s.includes('api.anthropic.com')) return { ok: true, status: 200, json: async () => toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN_RETRO_CHECKLIST), text: async () => '' };
      if (s.includes('/blog/clean-article/')) return { ok: true, status: 200, text: async () => '<title>Clean Article</title>' };
      throw new Error(`unexpected fetch: ${s}`);
    };
    const result = await auditArticle({
      slug: 'clean-article', article: CLEAN_ARTICLE, apiKey: 'test-key',
      headersText: VALID_OPTION_D_HEADERS,
      blogArticlesSlugs: ['clean-article'],
    });
    assert.equal(result.verdict, 'CLEAR', JSON.stringify(result.reasons));
  });

  test('article JSON missing entirely (published commit exists, file gone) -> REJECT', async () => {
    const result = await auditArticle({ slug: 'ghost-article', article: null, apiKey: 'test-key' });
    assert.equal(result.verdict, 'REJECT');
    assert.match(result.reasons[0].text, /not found/);
  });

  // BATCH F REGRESSION. Before Option D, retro asked evaluatePublishStatus
  // for a per-slug _headers pair. Had Batch F shipped _headers-only, that
  // lookup would have failed for EVERY article and pinned the Monday retro
  // at REJECT with "publish sequence incomplete" forever. These two tests
  // are what prove the shared contract is actually wired through, and that
  // the reject path it replaced still works.
  test('an Option-D-only published article (no concrete per-slug rule) is NOT falsely REJECTed for an incomplete publish', async () => {
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('api.anthropic.com')) return { ok: true, status: 200, json: async () => toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN_RETRO_CHECKLIST), text: async () => '' };
      if (s.includes('/blog/clean-article/')) return { ok: true, status: 200, text: async () => '<title>Clean Article</title>' };
      throw new Error(`unexpected fetch: ${s}`);
    };
    assert.ok(!VALID_OPTION_D_HEADERS.includes('/blog/clean-article'), 'fixture must carry NO concrete rule for this slug');
    const result = await auditArticle({
      slug: 'clean-article', article: CLEAN_ARTICLE, apiKey: 'test-key',
      headersText: VALID_OPTION_D_HEADERS,
      blogArticlesSlugs: ['clean-article'],
    });
    assert.equal(result.verdict, 'CLEAR', JSON.stringify(result.reasons));
    assert.equal(
      result.reasons.some((r) => /publish sequence incomplete/.test(r.text)), false,
      'placeholder coverage must not read as an incomplete publish sequence'
    );
  });

  test('malformed Option D coverage STILL produces the publish-sequence REJECT -- the reject path is intact, not weakened', async () => {
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('api.anthropic.com')) return { ok: true, status: 200, json: async () => toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN_RETRO_CHECKLIST), text: async () => '' };
      if (s.includes('/blog/clean-article/')) return { ok: true, status: 200, text: async () => '<title>Clean Article</title>' };
      throw new Error(`unexpected fetch: ${s}`);
    };
    const broken = VALID_OPTION_D_HEADERS.replace(`/blog/:slug\n${CC}\n`, '');
    const result = await auditArticle({
      slug: 'clean-article', article: CLEAN_ARTICLE, apiKey: 'test-key',
      headersText: broken,
      blogArticlesSlugs: ['clean-article'],
    });
    assert.equal(result.verdict, 'REJECT');
    const text = result.reasons.map((r) => r.text).join('; ');
    assert.match(text, /publish sequence incomplete/);
    assert.match(text, /shared blog article cache coverage valid/);
    assert.equal(result.reasons.find((r) => /publish sequence incomplete/.test(r.text)).severity, 'REJECT');
  });

  test('a wrong DRE number live on the page -> REJECT via wrongIdentityFindings', async () => {
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('api.anthropic.com')) return { ok: true, status: 200, json: async () => toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN_RETRO_CHECKLIST), text: async () => '' };
      if (s.includes('/blog/bad-dre/')) return { ok: true, status: 200, text: async () => '<title>x</title>' };
      throw new Error(`unexpected fetch: ${s}`);
    };
    const article = {
      slug: 'bad-dre', title: 'Bad DRE',
      content_html: '<p>George is licensed under DRE #01234567, Allison James Estates &amp; Homes, 619-277-2766, askgeorgek@gmail.com.</p>',
      citations: [], published: true,
    };
    const result = await auditArticle({
      slug: 'bad-dre', article, apiKey: 'test-key',
      headersText: VALID_OPTION_D_HEADERS,
      blogArticlesSlugs: ['bad-dre'],
    });
    assert.equal(result.verdict, 'REJECT');
    assert.match(result.reasons.map((r) => r.text).join(), /wrong identity/);
  });
});

describe('readArticleFile', () => {
  test('returns null for a slug with no article file', () => {
    const dir = isolatedDir();
    assert.equal(readArticleFile('nope', dir), null);
  });

  test('reads and parses a real article file', () => {
    const dir = isolatedDir();
    fs.writeFileSync(path.join(dir, 'x.json'), JSON.stringify({ slug: 'x', title: 'X' }), 'utf8');
    const result = readArticleFile('x', dir);
    assert.equal(result.title, 'X');
  });
});

describe('runWeeklyRetro — orchestration, explicit slug list (backfill-style)', () => {
  test('an explicit slugs list bypasses git-log scoping entirely and audits exactly those', async () => {
    const dir = isolatedDir();
    const article = {
      slug: 'a', title: 'A',
      content_html: '<p>x</p><h2>About George Khazanovskiy</h2><p>George Khazanovskiy is a Temecula Valley real estate agent (DRE #02034120) with Allison James Estates &amp; Homes. Reach George at 619-277-2766 or askgeorgek@gmail.com.</p>',
      citations: [], published: true,
    };
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(article), 'utf8');
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('api.anthropic.com')) return { ok: true, status: 200, json: async () => toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN_RETRO_CHECKLIST), text: async () => '' };
      return { ok: true, status: 200, text: async () => '<title>A</title>' };
    };
    const report = await runWeeklyRetro({ slugs: ['a'], apiKey: 'test-key', generatedDir: dir });
    assert.equal(report.scopeCount, 1);
    assert.equal(report.windowDays, null, 'an explicit slug list has no rolling window');
    assert.equal(report.articles[0].slug, 'a');
  });

  test('overall verdict is the worst of any single article (REJECT beats NEEDS-FIX beats CLEAR)', async () => {
    const dir = isolatedDir();
    fs.writeFileSync(path.join(dir, 'good.json'), JSON.stringify({
      slug: 'good', title: 'Good',
      content_html: '<h2>About George Khazanovskiy</h2><p>George Khazanovskiy is a Temecula Valley real estate agent (DRE #02034120) with Allison James Estates &amp; Homes. Reach George at 619-277-2766 or askgeorgek@gmail.com.</p>',
      citations: [], published: true,
    }), 'utf8');
    // 'bad' has no article file at all -> auditArticle's REJECT-on-missing path.
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('api.anthropic.com')) return { ok: true, status: 200, json: async () => toolUseResponse(RETRO_CHECKLIST_TOOL.name, CLEAN_RETRO_CHECKLIST), text: async () => '' };
      return { ok: true, status: 200, text: async () => '<title>x</title>' };
    };
    const report = await runWeeklyRetro({ slugs: ['good', 'bad'], apiKey: 'test-key', generatedDir: dir });
    assert.equal(report.overall, 'REJECT');
    assert.equal(report.hasAnyFindings, true);
  });
});
