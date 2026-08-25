#!/usr/bin/env node
/* eslint-disable no-console */
// Publish-on-merge (hardening batch item 3, 2026-08-25) — the standing spec:
// merge of a `blog-generator/auto-*` PR by a human -> flip published:true,
// _headers cache pair, regenerate blog-articles.json, push. This is the
// exact sequence a human previously ran by hand after every supervised
// read (see the "blog: publish ..." / "blog: cache pair + rebuild ..."
// commit pairs throughout this repo's history) — now triggered
// automatically by the merge itself, so "the next held PR merged from the
// GitHub mobile app" doesn't need a follow-up terminal session at all.
//
// Deliberately mirrors setPublished.mjs / headersCacheEntry.mjs's own
// "pure core, thin I/O shell" split rather than reimplementing either --
// this file is the ORCHESTRATION layer only, reusing both directly.
//
// IDEMPOTENT by construction, not by a special-cased flag: every write
// this script makes already goes through a function that is itself a
// no-op when the target state is already reached (setPublishedInJson's
// `changed` flag, insertCacheEntry's `inserted` flag) -- and the whole run
// short-circuits to a clean no-op via evaluatePublishStatus() before
// touching anything if the article is ALREADY fully published (e.g. the
// perfectly-silent auto-publish path already handled it, or this workflow
// fires twice for the same merge). Never assumes "not yet run" -- always
// checks real repo state first.
//
// CAP-GUARD: insertCacheEntry() already throws, unmodified, when the
// _headers 100-rule limit would be exceeded (see headersCacheEntry.mjs).
// This script does NOT catch that -- it propagates all the way up to a
// non-zero process exit, which fails the calling workflow step before any
// git commit/push happens (bash's default `-e`, same mechanism the
// existing perfectly-silent auto-publish step already relies on). Result:
// the article stays merged on main but published:false -- a safe,
// visibly-incomplete state, not silently wrong -- requiring a human to
// notice the red run and finish the sequence by hand, exactly the failure
// mode README.md's "Automated publishing" §3 already documents for the
// silent path, now shared by this path too.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import realFs from 'node:fs';
import { setPublishedInJson, articlePath } from './setPublished.mjs';
import { insertCacheEntry } from './headersCacheEntry.mjs';
import { evaluatePublishStatus } from './publishStatusReport.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const HEADERS_PATH = path.join(PROJECT_ROOT, 'public', '_headers');
const BLOG_DATA_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const GENERATED_ARTICLES_PREFIX = 'src/data/generated-articles/';

// parseAddedArticleSlugs (exported, pure) — filters `git diff --name-only`
// output down to real article files added under generated-articles/
// (never `.rejected/` markers, never sibling files like
// citation-host-log.json that ride along in the same PR via its own
// add-paths scoping).
export function parseAddedArticleSlugs(diffOutput) {
  return String(diffOutput || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith(GENERATED_ARTICLES_PREFIX) && l.endsWith('.json'))
    .filter((l) => !l.includes('/.rejected/'))
    .map((l) => l.slice(GENERATED_ARTICLES_PREFIX.length, -'.json'.length));
}

// getMergedArticleSlug (exported) — fail-closed: throws on a git failure,
// on zero added article files, or on more than one (should never happen
// given the PR's own add-paths scoping to a single generated slug per run,
// but refusing to guess which one is the only safe response if it ever
// does).
export function getMergedArticleSlug({ mergeSha, exec = execSync }) {
  // `~1` (first parent), not `^` -- `^` is a cmd.exe escape character on
  // Windows and gets mangled by execSync's default shell there even though
  // this script's real runtime (ubuntu-latest, generate-article.yml's own
  // shell) would have handled `^` fine; `~1` means the same thing to git
  // and has no special meaning in either shell, so this works identically
  // everywhere it might run, including a developer's local Windows
  // machine testing this script by hand.
  let diffOutput;
  try {
    diffOutput = exec(`git diff --name-only --diff-filter=A ${mergeSha}~1 ${mergeSha} -- ${GENERATED_ARTICLES_PREFIX}`, { encoding: 'utf8' });
  } catch (err) {
    throw new Error(`[publishOnMerge] git diff failed: ${err.message}. Refusing to guess which article this PR added.`);
  }
  const slugs = parseAddedArticleSlugs(diffOutput);
  if (slugs.length !== 1) {
    throw new Error(`[publishOnMerge] found ${slugs.length} added article file(s) in merge commit ${mergeSha} (expected exactly 1): ${JSON.stringify(slugs)}. Refusing to guess.`);
  }
  return slugs[0];
}

function readBlogArticlesSlugs(fs) {
  if (!fs.existsSync(BLOG_DATA_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed.map((a) => a.slug).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// runPublishOnMerge (exported) — the full orchestration, `fs`/`exec`
// injectable for tests (default: real node:fs / execSync). Returns
// { slug, alreadyComplete }. Throws on the cap-guard (see header comment)
// or on slug ambiguity -- both must reach the caller as real failures.
export async function runPublishOnMerge({ mergeSha, exec = execSync, fs = realFs, blogArticlesSlugs } = {}) {
  const slug = getMergedArticleSlug({ mergeSha, exec });

  const filePath = articlePath(slug);
  const articleText = fs.readFileSync(filePath, 'utf8');
  const article = JSON.parse(articleText);
  const headersText = fs.readFileSync(HEADERS_PATH, 'utf8');
  const resolvedBlogArticlesSlugs = blogArticlesSlugs ?? readBlogArticlesSlugs(fs);

  const status = evaluatePublishStatus({ slug, article, headersText, blogArticlesSlugs: resolvedBlogArticlesSlugs });
  if (status.complete) {
    console.log(`[publishOnMerge] "${slug}" is already fully published (published:true, _headers pair present, in blog-articles.json) -- idempotent no-op, nothing to do.`);
    return { slug, alreadyComplete: true };
  }

  const publishResult = setPublishedInJson(articleText, true);
  if (publishResult.changed) {
    fs.writeFileSync(filePath, publishResult.text, 'utf8');
    console.log(`[publishOnMerge] "${slug}": published ${publishResult.before} -> ${publishResult.after}`);
  }

  // Throws on the 100-rule cap -- see this file's header comment for why
  // that must propagate uncaught.
  const headersResult = insertCacheEntry(headersText, slug);
  if (headersResult.inserted) {
    fs.writeFileSync(HEADERS_PATH, headersResult.headersText, 'utf8');
    console.log(`[publishOnMerge] "${slug}": added _headers cache pair -- ${headersResult.ruleCountAfter} rules.`);
  }

  return { slug, alreadyComplete: false };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const mergeShaArg = process.argv.find((a) => a.startsWith('--merge-sha='));
  const mergeSha = mergeShaArg ? mergeShaArg.slice('--merge-sha='.length) : '';
  if (!mergeSha) {
    console.error('[publishOnMerge] usage: node publishOnMerge.mjs --merge-sha=<sha>');
    process.exitCode = 1;
  } else {
    runPublishOnMerge({ mergeSha })
      .then((result) => {
        if (process.env.GITHUB_OUTPUT) {
          realFs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${result.slug}\nalready_complete=${result.alreadyComplete}\n`);
        }
      })
      .catch((err) => {
        console.error(`[publishOnMerge] FATAL: ${err.message}`);
        process.exitCode = 1;
      });
  }
}
