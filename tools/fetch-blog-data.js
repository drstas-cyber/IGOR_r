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
//
// OFFLINE FIXTURE MODE (BLOG_COMPLIANCE_FIXTURE=true): reads
// tools/blog-compliance/.articles-cache.json instead of hitting the live API
// — no BABYLOVE_API_KEY needed. Use this for repeated scans/reports against
// a pinned content snapshot within one "key window" (see
// tools/blog-compliance/write-fixture.mjs to create the snapshot). Every
// downstream step (published filtering, compliance scan, writeArticles) is
// identical between the two modes — only the article *source* differs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanArticle, evaluateBatch } from './blog-compliance/scan.js';
import { MAX_TRIP_RATE } from './blog-compliance/patterns.js';
import { fetchAllSummaries, fetchFullDetailForAll } from './blog-compliance/babyLoveApi.js';
import { readFixture } from './blog-compliance/fixture.js';
import { loadGeneratedArticles, mergeArticleSources } from './blog-generator/loadGenerated.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');

function writeArticles(articles) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
}

const COMPLIANCE_REPORT_PATH = path.join(PROJECT_ROOT, 'tools', 'blog-compliance', 'last-report.json');

// Shared tail end of both runFromFixture/runFromApi (and their early-exit
// branches): merges in locally-generated articles, runs the compliance
// filter over the COMBINED set, and writes the result. Used even when
// babyLoveArticles is [] (missing key, network failure, zero published) so
// generated articles aren't silently dropped just because BabyLoveGrowth had
// nothing to contribute this build.
function buildAndWrite(babyLoveArticles) {
  const generated = loadGeneratedArticles();
  if (generated.length > 0) console.log(`[fetch-blog-data] ${generated.length} locally-generated article(s) eligible (published:true) from src/data/generated-articles/`);
  const combined = mergeArticleSources(babyLoveArticles, generated);
  const surviving = runComplianceFilter(combined);
  writeArticles(surviving);
  console.log(`[fetch-blog-data] wrote ${surviving.length} of ${combined.length} combined articles (${babyLoveArticles.length} BabyLoveGrowth + ${generated.length} generated) to src/data/blog-articles.json`);
}

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

  const batch = evaluateBatch(results);
  if (batch.shouldFailBuild) {
    // Deliberate exception to this file's "never fail the build" policy —
    // see the header comment. Threshold is MAX_TRIP_RATE (tools/blog-
    // compliance/patterns.js), not "100% tripped" — a build that silently
    // ships 1 of 24 articles because the other 23 tripped is barely
    // different from shipping 0, and both mean something is badly wrong
    // (the filter is broken, or the upstream content generation is).
    const fatal = new Error(
      `[blog-compliance] FATAL: ${batch.trippedCount}/${batch.total} article(s) ` +
      `(${Math.round(batch.tripRate * 100)}%) tripped the compliance filter in enforce mode, ` +
      `above the ${Math.round(MAX_TRIP_RATE * 100)}% threshold. ` +
      `Refusing to ship a batch this decimated silently — see ${path.relative(PROJECT_ROOT, COMPLIANCE_REPORT_PATH)} for details. ` +
      `This means either most articles genuinely have a real compliance problem (check the upstream BabyLoveGrowth ` +
      `Special Instructions), or the filter itself is misconfigured — it does not mean "ship the survivors and move on."`
    );
    fatal.blogComplianceFatal = true; // must actually fail the build — see main().catch() below
    throw fatal;
  }

  return articles.filter((_, i) => !results[i].tripped);
}

// Fixture mode: articles already have full content_html (write-fixture.mjs
// fetches full detail for everything, published or not), so there's no
// per-article detail-fetch loop here — just filter and hand off to the same
// compliance+write path the real-API mode uses below.
async function runFromFixture() {
  const fixture = readFixture();
  const allArticles = fixture.articles;
  console.log(`[fetch-blog-data] OFFLINE FIXTURE mode: ${allArticles.length} article(s) loaded from tools/blog-compliance/.articles-cache.json (fetchedAt: ${fixture.fetchedAt})`);

  const includeUnpublished = process.env.BLOG_INCLUDE_UNPUBLISHED === 'true';
  const publishedArticles = includeUnpublished
    ? allArticles
    : allArticles.filter((a) => a.published !== false);
  const skippedCount = allArticles.length - publishedArticles.length;

  console.log(
    `[fetch-blog-data] fixture: ${allArticles.length} total, ${publishedArticles.length} published, ${skippedCount} skipped` +
    (includeUnpublished ? ' (BLOG_INCLUDE_UNPUBLISHED=true — filter bypassed)' : '')
  );

  if (publishedArticles.length === 0) {
    console.warn('[fetch-blog-data] 0 published articles in fixture after filtering.');
  }

  buildAndWrite(publishedArticles);
}

async function runFromApi() {
  const apiKey = process.env.BABYLOVE_API_KEY;

  if (!apiKey) {
    console.warn('[fetch-blog-data] BABYLOVE_API_KEY not set — BabyLoveGrowth contributes 0 articles this build.');
    buildAndWrite([]);
    return;
  }

  let summaries;
  try {
    summaries = await fetchAllSummaries(apiKey);
  } catch (err) {
    console.warn(`[fetch-blog-data] failed to reach BabyLoveGrowth API: ${err.message} — BabyLoveGrowth contributes 0 articles this build.`);
    buildAndWrite([]);
    return;
  }

  if (summaries.length === 0) {
    console.warn('[fetch-blog-data] API returned 0 articles.');
    buildAndWrite([]);
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
    console.warn('[fetch-blog-data] 0 published articles after filtering.');
    buildAndWrite([]);
    return;
  }

  const articles = await fetchFullDetailForAll(publishedSummaries, apiKey, {
    onSkipped: (summary, err, afterRetry) => {
      console.warn(`[fetch-blog-data] failed to fetch article ${summary.id} (${summary.slug || 'no-slug'})${afterRetry ? ' after retry' : ''}: ${err.message} — skipping.`);
    },
  });

  buildAndWrite(articles);
}

async function main() {
  if (process.env.BLOG_COMPLIANCE_FIXTURE === 'true') {
    return runFromFixture();
  }
  return runFromApi();
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
