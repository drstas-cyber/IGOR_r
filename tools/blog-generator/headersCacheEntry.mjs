#!/usr/bin/env node
/* eslint-disable no-console */
// Generates and inserts the per-route Cloudflare Pages edge-cache entry
// pair for a blog article slug into public/_headers. Extracted 2026-08-03
// as part of automated publishing (see README.md "Automated publishing")
// specifically because auto-publish removes the human PR-review step that
// previously added this by hand for every article -- "auto-publish makes
// the manual per-article _headers entry a guaranteed future miss" (owner
// instruction). Pure string transforms, no I/O in the exported functions,
// matching this repo's existing extraction pattern (assembleArticle,
// checkRejectedMarker) -- I/O only happens in the CLI block at the bottom.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const HEADERS_PATH = path.join(PROJECT_ROOT, 'public', '_headers');

// Cloudflare Pages' documented per-project _headers rule limit. Each blog
// article costs 2 rules (with-slash, without-slash path pair) -- see
// countRules() below for what counts as a "rule".
export const MAX_HEADERS_RULES = 100;

const CACHE_CONTROL_LINE = '  Cache-Control: public, max-age=0, s-maxage=300, must-revalidate';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildCacheEntryBlock(slug) {
  return `/blog/${slug}/\n${CACHE_CONTROL_LINE}\n/blog/${slug}\n${CACHE_CONTROL_LINE}\n`;
}

// A "rule" is one path-pattern line -- every line starting at column 0
// with "/". Matches the counting convention already used in this repo's
// commit history ("70 rules total, well under the documented 100-rule
// limit").
export function countRules(headersText) {
  return (headersText.match(/^\//gm) || []).length;
}

export function hasCacheEntry(headersText, slug) {
  const esc = escapeRegex(slug);
  const withSlash = new RegExp(`^/blog/${esc}/$`, 'm');
  const withoutSlash = new RegExp(`^/blog/${esc}$`, 'm');
  return withSlash.test(headersText) && withoutSlash.test(headersText);
}

// Inserts immediately before the "/assets/*" block, matching where every
// prior article's entry (articles 1-6, added by hand) was placed --
// keeps all per-route blog cache entries grouped together rather than
// scattered. Idempotent: a slug that already has an entry is a no-op, not
// a duplicate. Fails closed on the two ways this could go wrong silently:
// the anchor not existing (refuses to guess an insertion point rather
// than appending somewhere arbitrary) and the resulting rule count
// exceeding MAX_HEADERS_RULES (refuses to write a file that would break
// on Cloudflare Pages rather than shipping it and finding out at deploy
// time).
export function insertCacheEntry(headersText, slug) {
  if (hasCacheEntry(headersText, slug)) {
    return { headersText, inserted: false, ruleCountAfter: countRules(headersText) };
  }

  const anchorIdx = headersText.indexOf('\n/assets/*');
  if (anchorIdx === -1) {
    throw new Error('insertCacheEntry: could not find the "/assets/*" anchor in _headers -- refusing to guess an insertion point.');
  }

  const before = headersText.slice(0, anchorIdx).trimEnd();
  const after = headersText.slice(anchorIdx); // starts with "\n/assets/*..."
  const block = buildCacheEntryBlock(slug).trimEnd();
  const updated = `${before}\n${block}\n${after}`;

  const ruleCountAfter = countRules(updated);
  if (ruleCountAfter > MAX_HEADERS_RULES) {
    throw new Error(
      `insertCacheEntry: adding "${slug}" would bring the total to ${ruleCountAfter} rules, over Cloudflare Pages' ` +
      `${MAX_HEADERS_RULES}-rule limit -- refusing to write. Prune stale entries (e.g. the dead-BabyLoveGrowth ` +
      `noindex block already in this file) before adding more, or raise MAX_HEADERS_RULES only if Cloudflare's own limit changed.`
    );
  }

  return { headersText: updated, inserted: true, ruleCountAfter };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const slugArg = process.argv.find((a) => a.startsWith('--slug='));
  const slug = slugArg ? slugArg.slice('--slug='.length) : '';
  if (!slug) {
    console.error('[headersCacheEntry] --slug=<slug> is required.');
    process.exitCode = 1;
  } else {
    try {
      const text = fs.readFileSync(HEADERS_PATH, 'utf8');
      const result = insertCacheEntry(text, slug);
      if (result.inserted) {
        fs.writeFileSync(HEADERS_PATH, result.headersText, 'utf8');
        console.log(`[headersCacheEntry] added cache entry for "${slug}" -- ${result.ruleCountAfter}/${MAX_HEADERS_RULES} rules.`);
      } else {
        console.log(`[headersCacheEntry] "${slug}" already has a cache entry -- no change. ${result.ruleCountAfter}/${MAX_HEADERS_RULES} rules.`);
      }
    } catch (err) {
      console.error(`[headersCacheEntry] FATAL: ${err.message}`);
      process.exitCode = 1;
    }
  }
}
