// Loads locally-generated articles (src/data/generated-articles/*.json) and
// merges them with BabyLoveGrowth articles into the single array
// fetch-blog-data.js writes to src/data/blog-articles.json. Both sources
// coexist during the transition described in the Phase 1 build spec.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const GENERATED_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'generated-articles');

// Only articles with published !== false are eligible — generated articles
// default to published:false (see generate.mjs), so merging a PR does NOT
// by itself put an article live. A human must separately, deliberately flip
// published:true during PR review for it to ever reach this filter as
// eligible. This mirrors the exact convention fetch-blog-data.js already
// uses for BabyLoveGrowth articles.
// generatedDir (2026-09-04, Phase 6B2a) -- optional, defaults to
// GENERATED_DIR, so every production caller is byte-identical to before:
// fetch-blog-data.js calls loadGeneratedArticles() with no argument and
// reads exactly the same directory it always has. The parameter exists
// solely so tests can point at a temp fixture directory instead of the
// real one.
//
// WHY THAT MATTERS MORE THAN TEST HYGIENE: merge.test.mjs used to write
// its fixtures into the REAL src/data/generated-articles/ and unlink them
// afterwards. One of those fixtures carries published: true. An
// interrupted run (Ctrl+C, a killed CI step) left it behind in the exact
// directory this function feeds into fetch-blog-data.js's build --
// mergeArticleSources -> compliance filter -> src/data/blog-articles.json.
// The next build would then either ship a junk article titled
// "Generated: pub" to the live blog or fail on footnote rendering. That is
// a live path from a cancelled test to production content, which is why
// the fix is a real parameter here rather than more careful cleanup there.
export function loadGeneratedArticles(generatedDir = GENERATED_DIR) {
  if (!fs.existsSync(generatedDir)) return [];
  const files = fs.readdirSync(generatedDir).filter((f) => f.endsWith('.json'));
  const articles = [];
  for (const file of files) {
    try {
      const article = JSON.parse(fs.readFileSync(path.join(generatedDir, file), 'utf8'));
      articles.push(article);
    } catch (err) {
      console.warn(`[loadGenerated] failed to parse ${file}: ${err.message} — skipping.`);
    }
  }
  return articles.filter((a) => a.published !== false);
}

// Merges two article arrays, handling slug collisions EXPLICITLY: on a
// collision, the BabyLoveGrowth article wins (it's the pre-existing, already
// -live source) and the generated one is dropped with a loud warning —
// never silently. A collision should be rare (slugs.js checks uniqueness
// against BabyLoveGrowth's known 28 at generation time) but isn't
// impossible if a new BabyLoveGrowth article appears after generation.
// isGeneratedArticle (2026-08-12) — the single, canonical way to tell a
// locally-generated article from a BabyLoveGrowth one. Generated articles
// always carry sourceTopic (schema.js requires it; generate.mjs's
// assembleArticle() always sets it, see that file's own header comment);
// BabyLoveGrowth articles never have this field at all. Used by
// fetch-blog-data.js's compliance filter to decide, per article, whether
// to apply the generator's own Layer-1 demotion
// (GENERATOR_LOG_ONLY_FINDING_KEYS) -- the BabyLoveGrowth path must stay
// unaffected by construction, not just by measurement, same discipline
// scan.js's own header comment already documents for the demotion
// generally.
export function isGeneratedArticle(article) {
  return typeof article?.sourceTopic === 'string' && article.sourceTopic.length > 0;
}

export function mergeArticleSources(babyLoveArticles, generatedArticles) {
  const babyLoveSlugs = new Set(babyLoveArticles.map((a) => a.slug).filter(Boolean));
  const merged = [...babyLoveArticles];
  for (const generated of generatedArticles) {
    if (babyLoveSlugs.has(generated.slug)) {
      console.warn(
        `[loadGenerated] SLUG COLLISION: "${generated.slug}" exists in both BabyLoveGrowth and ` +
        `src/data/generated-articles/ — keeping the BabyLoveGrowth article, dropping the generated one. ` +
        `Rename the slug in the generated article's JSON file to resolve.`
      );
      continue;
    }
    merged.push(generated);
  }
  return merged;
}
