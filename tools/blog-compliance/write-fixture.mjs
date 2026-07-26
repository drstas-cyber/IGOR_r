#!/usr/bin/env node
/* eslint-disable no-console */
// Writes tools/blog-compliance/.articles-cache.json — a raw, full-content
// snapshot of EVERY article the API returns, published or not (unlike the
// normal tools/fetch-blog-data.js build path, which only fetches full detail
// for published articles). Requires BABYLOVE_API_KEY. Run this once per
// "key window," then use BLOG_COMPLIANCE_FIXTURE=true for every subsequent
// scan/report this round — no key needed, and the content snapshot is
// pinned even if the generator is still running upstream.
//
// Gitignored — verified with `git check-ignore` before this tooling existed.
// Never commit its output.

import { fetchAllSummaries, fetchFullDetailForAll } from './babyLoveApi.js';
import { writeFixture, maxUpdatedAt } from './fixture.js';

async function main() {
  const apiKey = process.env.BABYLOVE_API_KEY;
  if (!apiKey) {
    console.error('[write-fixture] BABYLOVE_API_KEY not set — cannot write a fixture without it.');
    process.exitCode = 1;
    return;
  }

  console.log('[write-fixture] fetching article list...');
  const summaries = await fetchAllSummaries(apiKey);
  const publishedCount = summaries.filter((s) => s.published !== false).length;
  console.log(`[write-fixture] list: ${summaries.length} total, ${publishedCount} published, ${summaries.length - publishedCount} unpublished`);
  console.log('[write-fixture] fetching full detail for ALL of them (including unpublished — this script differs from the normal build path specifically for that reason)...');

  const articles = await fetchFullDetailForAll(summaries, apiKey, {
    onSkipped: (summary, err, afterRetry) => {
      console.warn(`[write-fixture] failed to fetch article ${summary.id} (${summary.slug || 'no-slug'})${afterRetry ? ' after retry' : ''}: ${err.message} — skipping.`);
    },
  });

  if (articles.length < summaries.length) {
    console.warn(`[write-fixture] WARNING: fetched ${articles.length} of ${summaries.length} — some articles failed to fetch full detail (see warnings above). Fixture is incomplete.`);
  }

  const fetchedAt = new Date().toISOString();
  const result = writeFixture(articles, fetchedAt);

  console.log('');
  console.log('[write-fixture] DONE.');
  console.log(`  path:          ${result.path}`);
  console.log(`  articles:      ${articles.length} (${articles.filter((a) => a.published !== false).length} published, ${articles.filter((a) => a.published === false).length} unpublished)`);
  console.log(`  fetchedAt:     ${result.fetchedAt}`);
  console.log(`  sha256:        ${result.sha256}`);
  console.log(`  max updated_at across batch: ${maxUpdatedAt(articles)}`);
}

main().catch((err) => {
  console.error('[write-fixture] FATAL:', err.message);
  process.exitCode = 1;
});
