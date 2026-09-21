#!/usr/bin/env node
/* eslint-disable no-console */
// Publish-on-merge (hardening batch item 3, 2026-08-25) — the standing spec:
// merge of a `blog-generator/auto-*` PR by a human -> flip published:true,
// regenerate blog-articles.json, push. This is the exact sequence a human
// previously ran by hand after every supervised read (see the "blog:
// publish ..." / "blog: cache pair + rebuild ..." commit pairs throughout
// this repo's history) — now triggered automatically by the merge itself,
// so "the next held PR merged from the GitHub mobile app" doesn't need a
// follow-up terminal session at all.
//
// Deliberately mirrors setPublished.mjs's own "pure core, thin I/O shell"
// split rather than reimplementing it -- this file is the ORCHESTRATION
// layer only, reusing it directly.
//
// BATCH F / OPTION D: this script NO LONGER WRITES public/_headers. Until
// Batch F it called insertCacheEntry() on every publish, appending a
// concrete /blog/<slug> + /blog/<slug>/ pair and growing the file by two
// rules per article. Option D replaced all of those with two shared
// placeholder routes that already cover every present and future article,
// so there is nothing left to append -- the rule count is fixed at 12 no
// matter how many articles publish. What remains is a VALIDATION: the
// shared contract must be intact, or this run fails closed.
//
// IDEMPOTENT by construction, not by a special-cased flag: the one write
// this script makes goes through a function that is itself a no-op when
// the target state is already reached (setPublishedInJson's `changed`
// flag) -- and the whole run short-circuits to a clean no-op via
// evaluatePublishStatus() before touching anything if the article is
// ALREADY fully published (this workflow firing twice for the same merge;
// historically also possible if generate-article.yml's since-retired
// auto-publish path had already handled it -- see README.md's decision
// record). Never assumes "not yet run" -- always checks real repo state
// first.
//
// FAIL-CLOSED on a broken header contract: if the shared Option D coverage
// is missing or malformed, this script throws rather than flipping
// published:true. It propagates all the way up to a non-zero process exit,
// which fails the calling workflow step before any git commit/push happens
// (bash's default `-e`). Result: the article stays merged on main but
// published:false -- a safe, visibly-incomplete state, not silently wrong
// -- requiring a human to notice the red run and repair _headers by hand.
// Publishing an article into a file whose cache contract is broken would
// be exactly the "green run, wrong production" outcome this pipeline keeps
// designing against.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import realFs from 'node:fs';
import { setPublishedInJson, articlePath } from './setPublished.mjs';
import { validateBlogArticleCacheCoverage } from './headersCacheEntry.mjs';
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
// onSlugKnown (2026-08-31, FIX 3) -- fired the moment the slug is resolved,
// before any read/write work below. Not merely a convenience: this is what
// lets a LATER failure (the _headers cap-guard throw, or anything else
// past this point) still carry the slug into $GITHUB_OUTPUT via the real
// CLI's callback (see isMain below) -- last night's actual failure (git
// diff itself failing, i.e. the slug never resolves at all) is exactly the
// other case this distinguishes: onSlugKnown simply never fires, so the
// failure email can say so explicitly instead of naming a slug it doesn't
// have. Default no-op so every existing caller (tests, and any future
// direct import) is unaffected unless it opts in.
export async function runPublishOnMerge({ mergeSha, exec = execSync, fs = realFs, blogArticlesSlugs, onSlugKnown = () => {} } = {}) {
  const slug = getMergedArticleSlug({ mergeSha, exec });
  onSlugKnown(slug);

  const filePath = articlePath(slug);
  const articleText = fs.readFileSync(filePath, 'utf8');
  const article = JSON.parse(articleText);
  const headersText = fs.readFileSync(HEADERS_PATH, 'utf8');
  const resolvedBlogArticlesSlugs = blogArticlesSlugs ?? readBlogArticlesSlugs(fs);

  const status = evaluatePublishStatus({ slug, article, headersText, blogArticlesSlugs: resolvedBlogArticlesSlugs });
  if (status.complete) {
    console.log(`[publishOnMerge] "${slug}" is already fully published (published:true, shared blog article cache coverage valid, in blog-articles.json) -- idempotent no-op, nothing to do.`);
    return { slug, alreadyComplete: true };
  }

  // Validate the SHARED Option D contract BEFORE flipping published:true.
  // Nothing is written to _headers here, by design -- publication no longer
  // grows this file. See the header comment for why a broken contract must
  // stop the publish rather than be repaired automatically.
  const coverage = validateBlogArticleCacheCoverage(headersText);
  if (!coverage.valid) {
    throw new Error(
      `publishOnMerge: refusing to publish "${slug}" -- the shared blog article cache coverage in public/_headers is invalid: ` +
      `${coverage.errors.join('; ')}. Repair _headers (it must declare exactly /blog/:slug and /blog/:slug/ with ` +
      'Cache-Control: public, max-age=0, s-maxage=300, must-revalidate, and no concrete per-article Cache-Control rule) and re-run.'
    );
  }

  const publishResult = setPublishedInJson(articleText, true);
  if (publishResult.changed) {
    fs.writeFileSync(filePath, publishResult.text, 'utf8');
    console.log(`[publishOnMerge] "${slug}": published ${publishResult.before} -> ${publishResult.after}`);
  }

  console.log(`[publishOnMerge] "${slug}": covered by the shared placeholder routes ${coverage.placeholders.join(' and ')} -- public/_headers not modified.`);

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
    // slug is written to $GITHUB_OUTPUT here, at the moment it's known --
    // not bundled into the success-only .then() below -- so a later throw
    // (the cap-guard, or anything else) still leaves it behind for the
    // failure email to name (see runPublishOnMerge's onSlugKnown comment
    // and README.md's "Publish-on-merge" decision record).
    runPublishOnMerge({
      mergeSha,
      onSlugKnown: (slug) => {
        if (process.env.GITHUB_OUTPUT) {
          realFs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
        }
      },
    })
      .then((result) => {
        if (process.env.GITHUB_OUTPUT) {
          realFs.appendFileSync(process.env.GITHUB_OUTPUT, `already_complete=${result.alreadyComplete}\n`);
        }
      })
      .catch((err) => {
        console.error(`[publishOnMerge] FATAL: ${err.message}`);
        // err.code (2026-08-31, Task 1) -- printed as its own greppable
        // line so a TYPED error (e.g. HeadersCapExceededError, see
        // headersCacheEntry.mjs) survives into the captured log text as a
        // stable token. buildFailureDetail (notificationEmail.mjs) only
        // ever sees this log text, not the live Error object -- it cannot
        // check `err.code` directly, so the code has to be written out
        // explicitly, in a fixed, parseable shape, independent of
        // err.message's own wording.
        if (err.code) {
          console.error(`[publishOnMerge] error_code=${err.code}`);
        }
        process.exitCode = 1;
      });
  }
}
