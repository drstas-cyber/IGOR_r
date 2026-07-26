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
export function loadGeneratedArticles() {
  if (!fs.existsSync(GENERATED_DIR)) return [];
  const files = fs.readdirSync(GENERATED_DIR).filter((f) => f.endsWith('.json'));
  const articles = [];
  for (const file of files) {
    try {
      const article = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, file), 'utf8'));
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
