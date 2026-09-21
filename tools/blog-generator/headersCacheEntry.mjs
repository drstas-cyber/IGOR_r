#!/usr/bin/env node
/* eslint-disable no-console */
// Validates the SHARED Cloudflare Pages edge-cache contract that covers
// every blog article in public/_headers. Pure string parsing, no I/O in the
// exported functions, matching this repo's existing extraction pattern
// (assembleArticle, checkRejectedMarker) -- I/O only happens in the CLI
// block at the bottom.
//
// BATCH F / OPTION D (this rewrite). Until Batch F this module's job was
// the opposite one: build and INSERT a concrete two-rule pair
// (/blog/<slug>/ + /blog/<slug>) into public/_headers every time an
// article published, because there was no wildcard catching new articles.
// That made the file grow by two rules per article against Cloudflare
// Pages' hard 100-rule limit, and it made "is this article cached
// correctly?" a per-slug question.
//
// Option D replaces all 26 concrete pairs with two PLACEHOLDER rules:
//
//   /blog/:slug/
//   /blog/:slug
//
// `:slug` is a Cloudflare Pages placeholder matching exactly ONE path
// segment. It is NOT a wildcard/splat: `/blog/*` remains prohibited for
// Cache-Control here, because CF Pages CONCATENATES header values across
// every rule that matches a request rather than letting the most specific
// one win -- the reason a bare wildcard was tried and rejected before.
//
// The question this module now answers is therefore a GLOBAL one:
//
//   "Does public/_headers contain the valid shared article-cache contract?"
//
// and NOT:
//
//   "Does this specific slug have a concrete cache pair?"
//
// That single shared answer is consumed by publishStatusReport.mjs, and
// through it by publishOnMerge.mjs, buildNotificationEmailCli.mjs and
// retroAudit.mjs. None of them parse _headers themselves -- there is
// exactly one parser, here, so the four consumers cannot drift apart.
//
// REMOVED DELIBERATELY in Batch F: buildCacheEntryBlock(), insertCacheEntry()
// and hasCacheEntry(). They are not deprecated-but-kept, they are gone. Any
// one of them left exported and callable could re-add a concrete
// /blog/<slug> rule, which would then match the same request as the
// placeholder and make Cloudflare concatenate two identical Cache-Control
// values onto that article. A compatibility shim that can recreate the
// exact state this batch exists to eliminate is not a compatibility shim,
// it is the bug with a longer fuse. Their tests are replaced in kind, not
// weakened.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const HEADERS_PATH = path.join(PROJECT_ROOT, 'public', '_headers');

// Cloudflare Pages' documented per-project _headers rule limit. Under
// Option D the file is a FIXED 12 rules and article publication no longer
// adds any, so this is no longer a budget the pipeline spends down -- it
// stays as the ceiling any future hand-edit of this file is measured
// against. See HEADERS_CAP_EXCEEDED_CODE below for why the cap error type
// still exists.
export const MAX_HEADERS_RULES = 100;

// The exact Cache-Control value every blog article route must carry.
// Exported so tests and the _headers file cannot drift apart by a comma.
export const BLOG_ARTICLE_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, must-revalidate';

// The two placeholder routes that constitute the whole article contract.
export const BLOG_PLACEHOLDER_ROUTES = Object.freeze(['/blog/:slug', '/blog/:slug/']);

// The literal index routes. These are NOT article routes and must keep
// their own concrete rules -- a placeholder cannot express them.
const BLOG_INDEX_ROUTES = new Set(['/blog', '/blog/']);

// HEADERS_CAP_EXCEEDED_CODE / HeadersCapExceededError (2026-08-31, Task 1
// of the notification-hardening pass) -- kept, but NO LONGER REACHABLE
// from the article-publication path as of Batch F, because nothing in that
// path writes _headers any more. notificationEmail.mjs still detects this
// code in captured log text, and that detection is left intact
// deliberately: it is dormant rather than wrong, it costs nothing, and
// deleting it would mean editing notification behaviour that this batch has
// no other reason to touch. If a future change ever reintroduces a writer
// for this file, the diagnostic is already wired.
//
// The original constraint still applies to whoever does that: a workflow
// catching this failure only has the PROCESS's captured stdout/stderr LOG
// TEXT by the time it builds a failure email, not a live Error object -- so
// the code has to survive into that log as a literal, greppable token.
export const HEADERS_CAP_EXCEEDED_CODE = 'HEADERS_CAP_EXCEEDED';

export class HeadersCapExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HeadersCapExceededError';
    this.code = HEADERS_CAP_EXCEEDED_CODE;
  }
}

// A "rule" is one path-pattern line -- every line starting at column 0
// with "/". Matches the counting convention already used in this repo's
// commit history ("70 rules total, well under the documented 100-rule
// limit"). Still generic and still useful: the real-file test pins the
// post-Option-D count at exactly 12 with it.
export function countRules(headersText) {
  return (headersText.match(/^\//gm) || []).length;
}

// Parses _headers into [{ path, headers: [...] }]. A column-0 line starting
// with "/" opens a rule; indented non-empty lines attach to it; a blank
// line or a comment closes it. Deliberately tolerant of CRLF, because this
// file is edited on Windows checkouts where core.autocrlf rewrites it.
function parseRules(headersText) {
  const rules = [];
  let current = null;
  for (const rawLine of String(headersText).split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      current = null;
      continue;
    }
    if (line.startsWith('/')) {
      current = { path: line.trim(), headers: [] };
      rules.push(current);
      continue;
    }
    if (/^\s/.test(line) && current) current.headers.push(line.trim());
  }
  return rules;
}

function cacheControlValues(rule) {
  return rule.headers
    .filter((h) => /^cache-control\s*:/i.test(h))
    .map((h) => h.slice(h.indexOf(':') + 1).trim());
}

// Classifies one rule path relative to the blog article contract.
//   'index'       -> /blog or /blog/ (literal, allowed, not an article rule)
//   'placeholder' -> /blog/:slug or /blog/:slug/
//   'wildcard'    -> /blog/* or /blog/*/ (prohibited for Cache-Control)
//   'concrete'    -> /blog/<single-segment> (would overlap a placeholder)
//   'other'       -> anything else, including deeper /blog/a/b paths, which
//                    a single-segment placeholder cannot match and so
//                    cannot concatenate with.
function classifyBlogPath(rulePath) {
  if (BLOG_INDEX_ROUTES.has(rulePath)) return 'index';
  if (BLOG_PLACEHOLDER_ROUTES.includes(rulePath)) return 'placeholder';
  const match = /^\/blog\/([^/]+)\/?$/.exec(rulePath);
  if (!match) return 'other';
  const segment = match[1];
  if (segment === '*') return 'wildcard';
  if (segment === ':slug') return 'placeholder';
  return 'concrete';
}

// THE canonical shared validator. Returns a structured result rather than
// a bare boolean so publishStatusReport can surface WHY coverage is
// invalid, and so tests can assert on a specific failure rather than on
// "something was false".
//
// Fails closed on every way this contract can be broken:
//   - either placeholder route missing
//   - a placeholder route declared more than once
//   - a placeholder carrying the wrong (or no, or duplicated) Cache-Control
//   - a /blog/* wildcard carrying Cache-Control
//   - a concrete /blog/<slug> rule carrying Cache-Control alongside the
//     placeholders (the concatenation hazard this batch exists to remove)
export function validateBlogArticleCacheCoverage(headersText) {
  const errors = [];
  if (typeof headersText !== 'string' || headersText.trim() === '') {
    return {
      valid: false,
      errors: ['_headers content is empty or not a string'],
      placeholders: [],
      concreteArticleRoutes: [],
      wildcardRoutes: [],
    };
  }

  const rules = parseRules(headersText);
  const placeholders = [];
  const concreteArticleRoutes = [];
  const wildcardRoutes = [];

  for (const rule of rules) {
    const kind = classifyBlogPath(rule.path);
    if (kind === 'placeholder') placeholders.push(rule);
    else if (kind === 'wildcard' && cacheControlValues(rule).length > 0) wildcardRoutes.push(rule.path);
    else if (kind === 'concrete' && cacheControlValues(rule).length > 0) concreteArticleRoutes.push(rule.path);
  }

  for (const route of BLOG_PLACEHOLDER_ROUTES) {
    const matching = placeholders.filter((r) => r.path === route);
    if (matching.length === 0) {
      errors.push(`missing the required placeholder route "${route}"`);
      continue;
    }
    if (matching.length > 1) {
      errors.push(`placeholder route "${route}" is declared ${matching.length} times -- Cloudflare would concatenate its Cache-Control value with itself`);
    }
    for (const rule of matching) {
      const values = cacheControlValues(rule);
      if (values.length === 0) {
        errors.push(`placeholder route "${route}" declares no Cache-Control header`);
      } else if (values.length > 1) {
        errors.push(`placeholder route "${route}" declares Cache-Control ${values.length} times`);
      } else if (values[0] !== BLOG_ARTICLE_CACHE_CONTROL) {
        errors.push(`placeholder route "${route}" has Cache-Control "${values[0]}", expected "${BLOG_ARTICLE_CACHE_CONTROL}"`);
      }
    }
  }

  for (const route of wildcardRoutes) {
    errors.push(`"${route}" declares Cache-Control -- a /blog/* wildcard is prohibited here because Cloudflare Pages concatenates overlapping rules instead of letting the most specific win`);
  }
  for (const route of concreteArticleRoutes) {
    errors.push(`concrete article route "${route}" declares Cache-Control alongside the placeholders -- both would match the same request and Cloudflare would concatenate the two values`);
  }

  return {
    valid: errors.length === 0,
    errors,
    placeholders: placeholders.map((r) => r.path),
    concreteArticleRoutes,
    wildcardRoutes,
  };
}

// Convenience wrapper for the common "is any article covered?" question.
// Coverage under Option D is a property of the FILE, not of a slug, so this
// deliberately takes no slug argument -- there is no per-article answer to
// give, and offering one would reintroduce the idea this batch removed.
export function hasValidBlogArticleCacheCoverage(headersText) {
  return validateBlogArticleCacheCoverage(headersText).valid;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  // Read-only by construction. The old CLI took --slug= and WROTE a concrete
  // pair into public/_headers; under Option D there is nothing to write, so
  // the CLI reports on the shared contract instead.
  try {
    const text = fs.readFileSync(HEADERS_PATH, 'utf8');
    const result = validateBlogArticleCacheCoverage(text);
    const count = countRules(text);
    if (result.valid) {
      console.log(`[headersCacheEntry] shared blog article cache coverage VALID -- ${result.placeholders.join(', ')} -- ${count}/${MAX_HEADERS_RULES} rules.`);
    } else {
      console.error('[headersCacheEntry] shared blog article cache coverage INVALID:');
      result.errors.forEach((e) => console.error(`    - ${e}`));
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`[headersCacheEntry] FATAL: ${err.message}`);
    process.exitCode = 1;
  }
}
