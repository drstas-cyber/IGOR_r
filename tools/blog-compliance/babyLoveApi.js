// Shared BabyLoveGrowth API client — extracted from tools/fetch-blog-data.js
// so both the real build script and tools/blog-compliance/write-fixture.mjs
// (which needs full detail for unpublished articles too, unlike the normal
// build) can use the same fetch logic without duplicating it. Pure on
// import — no self-executing main, safe to import from anywhere including
// tests.

const API_BASE = 'https://api.babylovegrowth.ai/api/integrations';
const REQUEST_TIMEOUT_MS = 15000;
// Confirmed live: the API rejects limit > 50 ("limit must be an integer
// between 1 and 50") despite the integration brief's limit=100 example and
// its "max 500 per call" claim — both wrong. Pagination loop below still
// works unchanged for any limit value.
export const PAGE_LIMIT = 50;
// Confirmed live: article-detail fetches are rate-limited to "max 2 requests
// per second per API key". 600ms between request starts (plus each request's
// own round-trip time) stays safely under that.
export const DETAIL_FETCH_SPACING_MS = 600;
export const RATE_LIMIT_RETRY_DELAY_MS = 2000;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiGet(pathAndQuery, apiKey) {
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

export async function fetchAllSummaries(apiKey) {
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

export async function fetchFullArticle(id, apiKey) {
  return apiGet(`/v1/articles/${id}`, apiKey);
}

// Fetches full detail for a list of summaries, with the same spacing/retry
// behavior fetch-blog-data.js used inline. skippedLogger (optional) is
// called with (summary, error) for any article that fails even after retry,
// so callers can log however fits their context instead of this module
// assuming console.warn's exact wording.
export async function fetchFullDetailForAll(summaries, apiKey, { onSkipped } = {}) {
  const articles = [];
  for (const summary of summaries) {
    await sleep(DETAIL_FETCH_SPACING_MS);
    try {
      const full = await fetchFullArticle(summary.id, apiKey);
      articles.push({ ...summary, ...full });
      continue;
    } catch (err) {
      if (err.status !== 429) {
        onSkipped?.(summary, err, false);
        continue;
      }
    }
    // Rate-limited despite the spacing above — one retry after a longer backoff.
    await sleep(RATE_LIMIT_RETRY_DELAY_MS);
    try {
      const full = await fetchFullArticle(summary.id, apiKey);
      articles.push({ ...summary, ...full });
    } catch (err) {
      onSkipped?.(summary, err, true);
    }
  }
  return articles;
}
