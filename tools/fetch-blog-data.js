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
// Compliance filter is FAIL-CLOSED (ENFORCE) by default as of 2026-07-26 —
// only the literal BLOG_COMPLIANCE_ENFORCE=false opts into report-only
// (logs what it would exclude, excludes nothing). A missing/unset var must
// never mean "ship everything" — see resolveEnforceMode() in
// tools/blog-compliance/scan.js and its "prove it goes red" test. See
// tools/blog-compliance/README.md for the report-only opt-out use case.
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
import { scanArticle, evaluateBatch, resolveEnforceMode, GENERATOR_LOG_ONLY_FINDING_KEYS } from './blog-compliance/scan.js';
import { MAX_TRIP_RATE } from './blog-compliance/patterns.js';
import { fetchAllSummaries, fetchFullDetailForAll } from './blog-compliance/babyLoveApi.js';
import { readFixture } from './blog-compliance/fixture.js';
import { loadGeneratedArticles, mergeArticleSources, isGeneratedArticle } from './blog-generator/loadGenerated.js';
import { renderAllFootnotes } from './blog-generator/renderCitations.mjs';
import { assertNoGeneratedArticleSilentlyDropped } from './silentDropGuard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
// PATH OVERRIDES (2026-09-04, Phase 6B2b). Each defaults to the exact
// expression it replaced, so an environment with none of these set is
// byte-identical to before -- which matters more here than anywhere else
// in the repo: this script is the FIRST and FATAL step of every build.
//
// They exist so fetch-blog-data.test.mjs can point the script at temp
// directories instead of writing the real src/data/blog-articles.json.
// Before this, that test snapshotted and restored a TRACKED file around
// every spawn; an interrupted run left the repo's real article data in
// whatever state the test had produced. Restoring afterwards cannot fix
// that, because the failure mode is the run never reaching the restore.
// Same reasoning as 6B2a's fix to merge.test.mjs.
//
// NOT read anywhere else, and deliberately not wired into run-build.mjs
// or package.json: production never sets them.
const OUT_PATH = process.env.TVH_BLOG_OUT_PATH
  || path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');

function writeArticles(articles) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
}

const COMPLIANCE_REPORT_PATH = process.env.TVH_BLOG_COMPLIANCE_REPORT_PATH
  || path.join(PROJECT_ROOT, 'tools', 'blog-compliance', 'last-report.json');

// Shared tail end of both runFromFixture/runFromApi (and their early-exit
// branches): merges in locally-generated articles, runs the compliance
// filter over the COMBINED set, and writes the result. Used even when
// babyLoveArticles is [] (missing key, network failure, zero published) so
// generated articles aren't silently dropped just because BabyLoveGrowth had
// nothing to contribute this build.
function buildAndWrite(babyLoveArticles) {
  // TVH_GENERATED_DIR: undefined re-selects loadGeneratedArticles's own
  // default (GENERATED_DIR), so production reads exactly the directory it
  // always has. The parameter already exists from 6B2a; this is the first
  // caller to use it. loadGenerated.js itself is untouched -- putting the
  // env read there would change the constant for every consumer,
  // including merge.test.mjs's guard that asserts against the real path.
  const generated = loadGeneratedArticles(process.env.TVH_GENERATED_DIR || undefined);
  if (generated.length > 0) console.log(`[fetch-blog-data] ${generated.length} locally-generated article(s) eligible (published:true) from src/data/generated-articles/`);
  const combined = mergeArticleSources(babyLoveArticles, generated);
  const surviving = runComplianceFilter(combined);
  // Footnote rendering runs AFTER the compliance filter, on survivors only
  // -- this is purely a display transform (citations array -> rendered
  // <ol> footnotes), not a compliance concern, so it doesn't need to see
  // articles the filter already excluded. FAILS THE BUILD on any
  // marker<->array inconsistency (see renderCitations.mjs) -- caught here,
  // via renderCitationsFatal below, not silently shipped as a dead
  // footnote link a reader clicks.
  let rendered;
  try {
    rendered = renderAllFootnotes(surviving);
  } catch (err) {
    err.renderCitationsFatal = true;
    throw err;
  }
  assertNoGeneratedArticleSilentlyDropped(combined, rendered, path.relative(PROJECT_ROOT, COMPLIANCE_REPORT_PATH));
  writeArticles(rendered);
  console.log(`[fetch-blog-data] wrote ${rendered.length} of ${combined.length} combined articles (${babyLoveArticles.length} BabyLoveGrowth + ${generated.length} generated) to ${path.relative(PROJECT_ROOT, OUT_PATH)}`);
}

// Scans every article, logs every finding loudly (matched sentence, not just
// a category name), and writes a machine-readable report file for review.
// FAIL-CLOSED as of 2026-07-26: enforce unless BLOG_COMPLIANCE_ENFORCE is the
// literal string 'false' — a missing/unset var means enforce, not
// report-only (see resolveEnforceMode() in blog-compliance/scan.js). Set
// BLOG_COMPLIANCE_ENFORCE=false explicitly for a report-only run. Exclusion
// only, never rewriting either way: a tripped article is dropped from the
// array entirely, its content is never modified.
function runComplianceFilter(articles) {
  const enforce = resolveEnforceMode(process.env.BLOG_COMPLIANCE_ENFORCE);
  // results[i] corresponds to articles[i] — kept index-aligned throughout
  // rather than reconstructed by slug lookup, since slugs aren't guaranteed
  // unique/present and a lookup-based rebuild would be fragile.
  //
  // Demotion parity (2026-08-12): generator-sourced articles (isGeneratedArticle
  // -- has sourceTopic) get the same exclusivity:only/superlative log-only
  // demotion here that generate.mjs's own Layer 1 already applies at
  // generation time (GENERATOR_LOG_ONLY_FINDING_KEYS, see scan.js) --
  // previously this batch path called scanArticle with no options for
  // EVERY article regardless of source, so a finding the generator's own
  // PR report already showed as demoted (Layer 1 tripped: false) could
  // still silently exclude the article here, at build time, with a
  // published:true flag and a merged PR that never actually reach the
  // live site. Scoped by isGeneratedArticle() -- a BabyLoveGrowth article
  // (no sourceTopic) always gets scanArticle(a) with no options, byte-
  // identical to before this change, same "unaffected by construction, not
  // just by measurement" discipline scan.js's own GENERATOR_LOG_ONLY_
  // FINDING_KEYS comment already documents for the demotion generally.
  const results = articles.map((a) =>
    scanArticle(a, isGeneratedArticle(a) ? { logOnlyFindingKeys: GENERATOR_LOG_ONLY_FINDING_KEYS } : {})
  );
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

// BLG (BabyLoveGrowth) is retired as fetch-blog-data.js's active content
// source -- see the 2026-07-27 decision log entry in
// tools/blog-generator/README.md for the incident that prompted this
// (deployment eac8380: the build silently kept shipping a stale 2-article
// blog-articles.json because "|| true" in package.json's build script was
// swallowing a real, correct FATAL refusal from the compliance gate below).
//
// Retired means retired: the BLG fetch/fixture paths must not re-enter
// production just because BABYLOVE_API_KEY happens to still be set, or a
// stale fixture file happens to exist on disk. They run ONLY when
// BLOG_INCLUDE_BLG is the literal string 'true' -- set deliberately, for a
// specific build, to re-enable BLG. Any other value (unset, 'false', a
// typo, etc.) takes the retired, generated-articles-only path below.
async function main() {
  if (process.env.BLOG_INCLUDE_BLG !== 'true') {
    console.log('[fetch-blog-data] BLOG_INCLUDE_BLG is not "true" -- BLG retired, using generated-articles only.');
    return buildAndWrite([]);
  }
  if (process.env.BLOG_COMPLIANCE_FIXTURE === 'true') {
    return runFromFixture();
  }
  return runFromApi();
}

main().catch((err) => {
  if (err.blogComplianceFatal || err.renderCitationsFatal) {
    // Two deliberate exceptions to "never fail the build" — see the header
    // comment, runComplianceFilter(), and buildAndWrite()'s footnote-
    // rendering step. Both must actually exit non-zero, not fall through
    // to the soft-fail path below: a citations[]<->data-cite mismatch is a
    // pipeline defect (most likely a hand-edit during PR review breaking a
    // marker after generation-time validation already passed), not a
    // transient API/network problem "ship with an empty blog" exists to
    // absorb.
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

