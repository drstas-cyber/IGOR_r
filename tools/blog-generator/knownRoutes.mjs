// Canonical "known live routes" list for the internal-link feature (Batch
// B, Part 3, 2026-08-08) — used two ways: (1) injected into the writer's
// generation context so it can only ever choose from real URLs, (2) read
// by internalLinkGate.mjs to validate what the model actually produced.
//
// Deliberately NOT built from slugs.js's getKnownSlugs() -- that function
// is a uniqueness/collision-avoidance set and includes 28 retired
// BabyLoveGrowth slugs that are NOT live under this pipeline; treating
// that as "known live routes" would validate links to dead URLs as if
// they were real. Built instead from the two genuinely canonical sources
// per the task's own instruction ("route inventory... current article
// data... or the same canonical source already used by the generator"):
// tools/seo-prerender.js's ROUTES array (the same list that drives the
// real sitemap/prerender) for static pages, plus blog-articles.json (the
// same published-article data BlogPostPage.jsx and seo-prerender.js's
// prerenderBlog() both already read) for article routes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES } from '../seo-prerender.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BLOG_ARTICLES_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const SITE = 'https://temeculavalleyhomes.us';

// getKnownRoutes (exported, path override for tests) — returns
// [{ url, title }], one entry per static page (from ROUTES) + '/blog/'
// + every published article currently in blog-articles.json. Pure aside
// from the one file read, which callers can override.
export function getKnownRoutes({ blogArticlesPath = DEFAULT_BLOG_ARTICLES_PATH } = {}) {
  const routes = [];

  for (const r of ROUTES) {
    routes.push({ url: `${SITE}${r.path}`, title: r.h1 || r.path });
  }
  routes.push({ url: `${SITE}/blog/`, title: 'Temecula Real Estate Blog' });

  let articles = [];
  try {
    const raw = fs.readFileSync(blogArticlesPath, 'utf8');
    const parsed = JSON.parse(raw);
    articles = Array.isArray(parsed) ? parsed : [];
  } catch {
    articles = [];
  }
  for (const a of articles) {
    if (!a.slug || !a.title) continue;
    routes.push({ url: `${SITE}/blog/${a.slug}/`, title: a.title });
  }

  return routes;
}

// formatKnownRoutesForPrompt (exported, pure) — the injected-into-context
// text form. One line per route, "URL — Title", so the writer model has
// both the exact URL to use and enough context to judge relevance without
// a second lookup.
export function formatKnownRoutesForPrompt(knownRoutes) {
  return knownRoutes.map((r) => `${r.url} — ${r.title}`).join('\n');
}
