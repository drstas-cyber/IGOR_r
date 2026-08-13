#!/usr/bin/env node
/* eslint-disable no-console */
// Routine-proofing (2026-08-13, from the Aug-13 half-sequence incident where
// a scheduled routine merged an article PR at 09a80ca but skipped the
// flip/_headers/rebuild remainder -- merge != publish, and nothing caught
// the gap until a human noticed by hand). Given a slug, reports whether the
// FULL publish sequence completed: published:true in the article JSON,
// the _headers cache pair, presence in the built blog-articles.json, and
// (best-effort) that the article actually serves live. One command a future
// routine or human can run instead of re-deriving "did this finish?" by
// hand across four different files/checks every time.
//
// Deliberately read-only -- unlike setPublished.mjs/headersCacheEntry.mjs,
// this never writes anything. It's a status check, not a fixer; running it
// twice must never change state.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasCacheEntry } from './headersCacheEntry.mjs';
import { articlePath } from './setPublished.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const HEADERS_PATH = path.join(PROJECT_ROOT, 'public', '_headers');
const BLOG_DATA_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const SITE = 'https://temeculavalleyhomes.us';

// Pure: the three checks derivable from repo state alone, no I/O, no
// network -- exactly the assembleArticle()/insertCacheEntry() split this
// tool suite already uses everywhere else. The 4th check (live) is network
// I/O and deliberately lives only in the CLI block below, same reasoning
// setPublished.mjs/headersCacheEntry.mjs already document for keeping I/O
// out of the testable core.
export function evaluatePublishStatus({ slug, article, headersText, blogArticlesSlugs }) {
  const checks = [
    {
      key: 'published_flag',
      label: 'published:true in generated-articles/<slug>.json',
      ok: article != null && article.published === true,
      detail: article == null
        ? 'article JSON not found'
        : `published: ${JSON.stringify(article.published)}`,
    },
    {
      key: 'headers_entry',
      label: '_headers cache pair present',
      ok: hasCacheEntry(headersText || '', slug),
      detail: hasCacheEntry(headersText || '', slug)
        ? 'both /blog/<slug>/ and /blog/<slug> rules present'
        : 'missing one or both of the with-slash/without-slash rules',
    },
    {
      key: 'blog_articles_json',
      label: 'present in src/data/blog-articles.json',
      ok: (blogArticlesSlugs || []).includes(slug),
      detail: (blogArticlesSlugs || []).includes(slug)
        ? 'found'
        : 'not found -- build has not been run since publish, or the slug was dropped (collision, see loadGenerated.js)',
    },
  ];

  return { slug, checks, complete: checks.every((c) => c.ok) };
}

function readArticle(slug) {
  const filePath = articlePath(slug);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readHeadersText() {
  return fs.existsSync(HEADERS_PATH) ? fs.readFileSync(HEADERS_PATH, 'utf8') : '';
}

function readBlogArticlesSlugs() {
  if (!fs.existsSync(BLOG_DATA_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed.map((a) => a.slug).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// Best-effort live check -- network I/O, never part of evaluatePublishStatus's
// pure `complete` verdict. Environments without outbound network access (or
// a sandboxed CLI run) fail closed into UNVERIFIED-TOOLING rather than being
// misreported as a broken deploy -- same convention already used elsewhere
// in this repo (see tools/seo-prerender.js, src/lib/scrollToTop.test.mjs)
// for "couldn't check" vs. "checked and failed."
async function checkLive(slug) {
  const url = `${SITE}/blog/${slug}/`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { status: 'FAIL', detail: `HTTP ${res.status}` };
    const html = await res.text();
    const hasTitle = /<title>[^<]+<\/title>/.test(html);
    return hasTitle
      ? { status: 'OK', detail: `HTTP ${res.status}, <title> present` }
      : { status: 'FAIL', detail: `HTTP ${res.status} but no <title> found` };
  } catch (err) {
    return { status: 'UNVERIFIED-TOOLING', detail: `network check unavailable: ${err.message}` };
  }
}

function printReport(result, live) {
  console.log(`[publishStatusReport] "${result.slug}"`);
  for (const check of result.checks) {
    console.log(`  [${check.ok ? 'PASS' : 'FAIL'}] ${check.label} -- ${check.detail}`);
  }
  if (live) {
    const mark = live.status === 'OK' ? 'PASS' : live.status === 'FAIL' ? 'FAIL' : 'SKIP';
    console.log(`  [${mark}] live at ${SITE}/blog/${result.slug}/ -- ${live.status}: ${live.detail}`);
  }

  const localVerdict = result.complete ? 'COMPLETE (local)' : 'INCOMPLETE (local)';
  if (!live || live.status === 'UNVERIFIED-TOOLING') {
    console.log(`[publishStatusReport] verdict: ${localVerdict}, live: UNVERIFIED-TOOLING`);
  } else if (result.complete && live.status === 'OK') {
    console.log('[publishStatusReport] verdict: COMPLETE -- full sequence landed, article is live');
  } else {
    console.log(`[publishStatusReport] verdict: INCOMPLETE -- ${localVerdict}, live: ${live.status}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const slugArg = process.argv.find((a) => a.startsWith('--slug='));
  const slug = slugArg ? slugArg.slice('--slug='.length) : '';
  const skipLive = process.argv.includes('--skip-live');

  if (!slug) {
    console.error('[publishStatusReport] usage: node publishStatusReport.mjs --slug=<slug> [--skip-live]');
    process.exitCode = 1;
  } else {
    const result = evaluatePublishStatus({
      slug,
      article: readArticle(slug),
      headersText: readHeadersText(),
      blogArticlesSlugs: readBlogArticlesSlugs(),
    });

    if (skipLive) {
      printReport(result, null);
      process.exitCode = result.complete ? 0 : 1;
    } else {
      checkLive(slug).then((live) => {
        printReport(result, live);
        process.exitCode = result.complete && live.status !== 'FAIL' ? 0 : 1;
      });
    }
  }
}
