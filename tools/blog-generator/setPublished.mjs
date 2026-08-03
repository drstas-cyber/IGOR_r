#!/usr/bin/env node
/* eslint-disable no-console */
// Flips a generated article's `published` flag -- the one operation
// shared by the publish step (false -> true, whether decided by a human
// after a supervised read or, as of 2026-08-03, the auto-publish path on
// a perfectly-silent run) and the retrospective-audit rollback line
// (true -> false, unpublishing an article that fails a later read). Same
// operation, opposite direction -- one script, a --value flag, not two
// near-duplicate ones.
//
// Deliberately does nothing else: no _headers change, no git commit, no
// build. Composed with headersCacheEntry.mjs and git by the workflow (or
// by hand for the rollback line) rather than doing everything in one
// script -- each piece independently testable, matching this repo's
// existing extraction pattern.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'generated-articles');

// Pure-ish: takes the article JSON text, returns the updated text plus
// before/after state. No file I/O here -- the CLI block below does the
// read/write, exactly the assembleArticle()/insertCacheEntry() split.
export function setPublishedInJson(articleJsonText, published) {
  const article = JSON.parse(articleJsonText);
  if (typeof article.published !== 'boolean') {
    throw new Error(`setPublishedInJson: article has no boolean "published" field to flip (got ${JSON.stringify(article.published)}).`);
  }
  const before = article.published;
  article.published = published;
  return {
    text: `${JSON.stringify(article, null, 2)}\n`,
    before,
    after: published,
    changed: before !== published,
    slug: article.slug,
  };
}

export function articlePath(slug, generatedDir = GENERATED_DIR) {
  return path.join(generatedDir, `${slug}.json`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const slugArg = process.argv.find((a) => a.startsWith('--slug='));
  const valueArg = process.argv.find((a) => a.startsWith('--value='));
  const slug = slugArg ? slugArg.slice('--slug='.length) : '';
  const valueRaw = valueArg ? valueArg.slice('--value='.length) : '';

  if (!slug || (valueRaw !== 'true' && valueRaw !== 'false')) {
    console.error('[setPublished] usage: node setPublished.mjs --slug=<slug> --value=true|false');
    process.exitCode = 1;
  } else {
    const filePath = articlePath(slug);
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      const result = setPublishedInJson(text, valueRaw === 'true');
      fs.writeFileSync(filePath, result.text, 'utf8');
      console.log(`[setPublished] ${slug}: published ${result.before} -> ${result.after}${result.changed ? '' : ' (no change -- already at that value)'}`);
    } catch (err) {
      console.error(`[setPublished] FATAL: ${err.message}`);
      process.exitCode = 1;
    }
  }
}
