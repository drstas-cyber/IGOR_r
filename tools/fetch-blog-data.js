/* eslint-disable no-console */
// Pre-build step: fetches all BabyLoveGrowth articles (list + full content) and
// writes them to src/data/blog-articles.json, which Vite bundles as a plain JS
// import — the client ships pre-fetched article data, never the API key.
//
// Must never fail the build: any error (missing key, network, bad response)
// logs a warning and leaves an empty (or last-known-good) articles file rather
// than throwing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function writeArticles(articles) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
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
      throw new Error(`HTTP ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText}` : ''}`);
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
    try {
      const full = await fetchFullArticle(summary.id, apiKey);
      articles.push({ ...summary, ...full });
    } catch (err) {
      console.warn(`[fetch-blog-data] failed to fetch article ${summary.id} (${summary.slug || 'no-slug'}): ${err.message} — skipping.`);
    }
  }

  writeArticles(articles);
  console.log(`[fetch-blog-data] wrote ${articles.length} of ${publishedSummaries.length} published articles (${summaries.length} total fetched) to src/data/blog-articles.json`);
}

main().catch((err) => {
  console.warn(`[fetch-blog-data] unexpected error: ${err.message} — building with an empty blog.`);
  try {
    writeArticles([]);
  } catch {
    // Even the fallback write failed — leave whatever's already on disk
    // (committed [] placeholder or last successful fetch) rather than crash.
  }
});
