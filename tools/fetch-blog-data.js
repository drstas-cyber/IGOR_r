/* eslint-disable no-console */
// Pre-build step: fetches all BabyLoveGrowth articles (list + full content) and
// writes them to src/data/blog-articles.json, which Vite bundles as a plain JS
// import — the client ships pre-fetched article data, never the API key.
//
// Must never fail the build on API/network problems: any error (missing key,
// network, bad response) logs a warning and leaves an empty (or last-known-good)
// articles file rather than throwing. ONE deliberate exception: if the
// compliance filter (see tools/blog-compliance/) is in enforce mode and EVERY
// fetched article trips it, that's treated as fatal — see runComplianceFilter()
// below. A misfiring filter that quietly ships zero articles is worse than a
// loud build failure; "never fail the build" was never meant to cover that.
//
// Compliance filter is REPORT-ONLY by default (BLOG_COMPLIANCE_ENFORCE unset
// or not 'true') — it logs what it would exclude and why, but excludes
// nothing. Do not set BLOG_COMPLIANCE_ENFORCE=true until the report-only
// false-positive rate has been reviewed. See tools/blog-compliance/README.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanArticle } from './blog-compliance/scan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const API_BASE = 'https://api.babylovegrowth.ai/api/integrations';
const REQUEST_TIMEOUT_MS = 15000;
// Confirmed live: the API rejects limit > 50 ("limit must be an integer
// between 1 and 50") despite the integration brief's limit=100 example and
// its "max 500 per call" claim — both wrong. Pagination loop below still
// works unchanged for any limit value.
const PAGE_LIMIT = 50;
// Confirmed live: article-detail fetches are rate-limited to "max 2 requests
// per second per API key". 600ms between request starts (plus each request's
// own round-trip time) stays safely under that.
const DETAIL_FETCH_SPACING_MS = 600;
const RATE_LIMIT_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeArticles(articles) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
}

const COMPLIANCE_REPORT_PATH = path.join(PROJECT_ROOT, 'tools', 'blog-compliance', 'last-report.json');

// Scans every article, logs every finding loudly (matched sentence, not just
// a category name), and writes a machine-readable report file for review.
// REPORT-ONLY unless BLOG_COMPLIANCE_ENFORCE=true — even then, exclusion
// only, never rewriting: a tripped article is dropped from the array
// entirely, its content is never modified.
function runComplianceFilter(articles) {
  const enforce = process.env.BLOG_COMPLIANCE_ENFORCE === 'true';
  // results[i] corresponds to articles[i] — kept index-aligned throughout
  // rather than reconstructed by slug lookup, since slugs aren't guaranteed
  // unique/present and a lookup-based rebuild would be fragile.
  const results = articles.map((a) => scanArticle(a));
  const tripped = results.filter((r) => r.tripped);
  const clean = results.filter((r) => !r.tripped);

  console.log(
    `[blog-compliance] ${enforce ? 'ENFORCE' : 'REPORT-ONLY'} mode: ` +
    `${tripped.length}/${results.length} article(s) tripped the filter.`
  );

  for (const r of tripped) {
    console.log(`[blog-compliance] ${enforce ? 'EXCLUDED' : 'WOULD EXCLUDE'}: "${r.title}" (${r.slug})`);
    for (const f of r.findings) {
      console.log(`    [${f.category}${f.subcategory ? ':' + f.subcategory : ''}] matched "${f.matchedText}"`);
      console.log(`        sentence: ${f.sentence}`);
    }
  }

  fs.mkdirSync(path.dirname(COMPLIANCE_REPORT_PATH), { recursive: true });
  fs.writeFileSync(
    COMPLIANCE_REPORT_PATH,
    JSON.stringify({ mode: enforce ? 'enforce' : 'report-only', generatedAt: new Date().toISOString(), results }, null, 2) + '\n',
    'utf8'
  );
  console.log(`[blog-compliance] full report written to ${path.relative(PROJECT_ROOT, COMPLIANCE_REPORT_PATH)}`);

  if (!enforce) {
    return articles; // report-only: exclude nothing
  }

  if (articles.length > 0 && clean.length === 0) {
    // Deliberate exception to this file's "never fail the build" policy —
    // see the header comment. A filter that trips 100% of articles is
    // broken (or the upstream content generation is), and shipping an
    // empty blog silently would hide that instead of surfacing it.
    const fatal = new Error(
      `[blog-compliance] FATAL: all ${articles.length} article(s) tripped the compliance filter in enforce mode. ` +
      `Refusing to silently ship an empty blog — see ${path.relative(PROJECT_ROOT, COMPLIANCE_REPORT_PATH)} for details. ` +
      `This means either every article genuinely has a real compliance problem (check the upstream BabyLoveGrowth ` +
      `Special Instructions), or the filter itself is misconfigured — it does not mean "build without a blog."`
    );
    fatal.blogComplianceFatal = true; // must actually fail the build — see main().catch() below
    throw fatal;
  }

  return articles.filter((_, i) => !results[i].tripped);
}

async function apiGet(pathAndQuery, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${pathAndQuery}`, {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      let bodyText = '';
      try {
        bodyText = (await res.text()).slice(0, 500);
      } catch {
        // response body unreadable — fall through with just the status
      }
      const err = new Error(`HTTP ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText}` : ''}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Confirmed live: the list endpoint returns a bare array. Also handles a
// {articles:[...]}/{data:[...]} wrapper defensively in case that ever changes.
function unwrapList(page) {
  if (Array.isArray(page)) return page;
  if (Array.isArray(page?.articles)) return page.articles;
  if (Array.isArray(page?.data)) return page.data;
  return [];
}

async function fetchAllSummaries(apiKey) {
  const all = [];
  let offset = 0;
  for (;;) {
    const page = await apiGet(`/v1/articles?limit=${PAGE_LIMIT}&offset=${offset}`, apiKey);
    const items = unwrapList(page);
    all.push(...items);
    if (items.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return all;
}

async function fetchFullArticle(id, apiKey) {
  return apiGet(`/v1/articles/${id}`, apiKey);
}

async function main() {
  const apiKey = process.env.BABYLOVE_API_KEY;

  if (!apiKey) {
    console.warn('[fetch-blog-data] BABYLOVE_API_KEY not set — building with an empty blog.');
    writeArticles([]);
    return;
  }

  let summaries;
  try {
    summaries = await fetchAllSummaries(apiKey);
  } catch (err) {
    console.warn(`[fetch-blog-data] failed to reach BabyLoveGrowth API: ${err.message} — building with an empty blog.`);
    writeArticles([]);
    return;
  }

  if (summaries.length === 0) {
    console.warn('[fetch-blog-data] API returned 0 articles — building with an empty blog.');
    writeArticles([]);
    return;
  }

  // Missing `published` is treated as published (future-proofing if the API
  // drops the flag) — only an explicit `false` excludes an article.
  const includeUnpublished = process.env.BLOG_INCLUDE_UNPUBLISHED === 'true';
  const publishedSummaries = includeUnpublished
    ? summaries
    : summaries.filter((s) => s.published !== false);
  const skippedCount = summaries.length - publishedSummaries.length;

  console.log(
    `[fetch-blog-data] list: ${summaries.length} total, ${publishedSummaries.length} published, ${skippedCount} skipped` +
    (includeUnpublished ? ' (BLOG_INCLUDE_UNPUBLISHED=true — filter bypassed)' : '')
  );

  if (publishedSummaries.length === 0) {
    console.warn('[fetch-blog-data] 0 published articles after filtering — building with an empty blog.');
    writeArticles([]);
    return;
  }

  const articles = [];
  for (const summary of publishedSummaries) {
    await sleep(DETAIL_FETCH_SPACING_MS);
    try {
      const full = await fetchFullArticle(summary.id, apiKey);
      articles.push({ ...summary, ...full });
      continue;
    } catch (err) {
      if (err.status !== 429) {
        console.warn(`[fetch-blog-data] failed to fetch article ${summary.id} (${summary.slug || 'no-slug'}): ${err.message} — skipping.`);
        continue;
      }
    }
    // Rate-limited despite the spacing above — one retry after a longer backoff.
    await sleep(RATE_LIMIT_RETRY_DELAY_MS);
    try {
      const full = await fetchFullArticle(summary.id, apiKey);
      articles.push({ ...summary, ...full });
    } catch (err) {
      console.warn(`[fetch-blog-data] failed to fetch article ${summary.id} (${summary.slug || 'no-slug'}) after retry: ${err.message} — skipping.`);
    }
  }

  const surviving = runComplianceFilter(articles);
  writeArticles(surviving);
  console.log(`[fetch-blog-data] wrote ${surviving.length} of ${publishedSummaries.length} published articles (${summaries.length} total fetched) to src/data/blog-articles.json`);
}

main().catch((err) => {
  if (err.blogComplianceFatal) {
    // The one deliberate exception to "never fail the build" — see the
    // header comment and runComplianceFilter(). Must actually exit non-zero,
    // not fall through to the soft-fail path below.
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
  console.warn(`[fetch-blog-data] unexpected error: ${err.message} — building with an empty blog.`);
  try {
    writeArticles([]);
  } catch {
    // Even the fallback write failed — leave whatever's already on disk
    // (committed [] placeholder or last successful fetch) rather than crash.
  }
});
